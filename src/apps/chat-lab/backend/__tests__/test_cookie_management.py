"""
Backend Cookie Management Tests
Tests for the new HTTP-only cookie functionality in the ChatLab backend.
"""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import Request

import sys
import os
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from server import (  # type: ignore[import-not-found]
    app,
    set_secure_cookie,
    get_cookie_value,
    clear_cookie,
    encrypt_refresh_token,
    decrypt_refresh_token,
    get_user_id_from_request,
)


class TestCookieManagement:
    """Test cookie management utilities."""

    def test_set_secure_cookie(self):
        """Test setting secure cookies with proper attributes."""
        from fastapi.responses import JSONResponse

        response = JSONResponse(content={"test": "data"})
        set_secure_cookie(response, "test_cookie", "test_value", max_age=3600)

        # Check that cookie was set
        set_cookie_headers = response.headers.getlist("set-cookie")
        assert len(set_cookie_headers) == 1

        cookie_header = set_cookie_headers[0]
        assert "test_cookie=test_value" in cookie_header
        assert "HttpOnly" in cookie_header
        assert "SameSite=strict" in cookie_header
        assert "Max-Age=3600" in cookie_header

    def test_get_cookie_value(self):
        """Test retrieving cookie values from request."""
        request = Mock()
        request.cookies = {"test_cookie": "test_value"}

        value = get_cookie_value(request, "test_cookie")
        assert value == "test_value"

        # Test non-existent cookie
        value = get_cookie_value(request, "non_existent")
        assert value is None

    def test_clear_cookie(self):
        """Test clearing cookies."""
        from fastapi.responses import JSONResponse

        response = JSONResponse(content={"test": "data"})
        clear_cookie(response, "test_cookie")

        set_cookie_headers = response.headers.getlist("set-cookie")
        assert len(set_cookie_headers) == 1

        cookie_header = set_cookie_headers[0]
        assert "test_cookie=" in cookie_header
        assert "Max-Age=0" in cookie_header


class TestEncryptionIntegration:
    """Test encryption integration with cookies."""

    @pytest.mark.asyncio
    async def test_encrypt_decrypt_flow(self):
        """Test the complete encrypt/decrypt flow."""
        # Mock the encryption service
        with patch("server.encryption_service") as mock_service:
            mock_service.get_user_encryption_key = AsyncMock(return_value="test_key")
            mock_service.encrypt_refresh_token = Mock(return_value="encrypted_token")
            mock_service.decrypt_refresh_token = Mock(return_value="original_token")

            # Test encryption
            encrypted = await encrypt_refresh_token(
                "test_token", "user123", "auth_token"
            )
            assert encrypted == "encrypted_token"

            # Test decryption
            decrypted = await decrypt_refresh_token(
                "encrypted_token", "user123", "auth_token"
            )
            assert decrypted == "original_token"

    def test_get_user_id_from_request(self):
        """Test user ID extraction from request."""
        # Test with Authorization header
        request = Mock()
        request.headers = {"Authorization": "Bearer test_token"}
        request.client = Mock()
        request.client.host = "127.0.0.1"

        user_id = get_user_id_from_request(request)
        assert user_id == "default_user"  # Based on current implementation

        # Test without Authorization header
        request.headers = {}
        user_id = get_user_id_from_request(request)
        assert user_id == "user_127.0.0.1"


class TestOAuthEndpoints:
    """Test OAuth endpoints with cookie integration."""

    def test_oauth_exchange_code_endpoint(self):
        """Test OAuth code exchange with cookie setting."""
        # Mock the OpenBao secrets loading and set global variable
        with patch("server.load_chatlab_secrets_from_openbao") as mock_openbao:
            mock_secrets = Mock()
            mock_secrets.google_client_id = "test_client_id"
            mock_secrets.google_client_secret = "test_client_secret"
            mock_openbao.return_value = mock_secrets

            # Set the global variable
            import server

            server.chatlab_secrets = mock_secrets

            client = TestClient(app)

            # Mock the OAuth exchange
            with patch("server.httpx.AsyncClient") as mock_client:
                mock_response = Mock()
                mock_response.is_success = True
                mock_response.json.return_value = {
                    "access_token": "test_access_token",
                    "refresh_token": "test_refresh_token",
                    "expires_in": 3600,
                    "scope": "test_scope",
                }

                mock_client.return_value.__aenter__.return_value.post.return_value = (
                    mock_response
                )

                # Mock encryption
                with patch(
                    "server.encrypt_refresh_token", new_callable=AsyncMock
                ) as mock_encrypt:
                    mock_encrypt.return_value = "encrypted_refresh_token"

                    response = client.post(
                        "/fidu-chat-lab/api/oauth/exchange-code",
                        json={
                            "code": "test_code",
                            "redirect_uri": "http://localhost:3000/callback",
                        },
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert "access_token" in data
                    assert "expires_in" in data

                    # Check that cookie was set
                    assert "set-cookie" in response.headers
                    cookie_header = response.headers["set-cookie"]
                    assert "google_refresh_token" in cookie_header

    def test_oauth_refresh_token_endpoint(self):
        """Test OAuth token refresh with cookie reading."""
        # Mock the OpenBao secrets loading and set global variable
        with patch("server.load_chatlab_secrets_from_openbao") as mock_openbao:
            mock_secrets = Mock()
            mock_secrets.google_client_id = "test_client_id"
            mock_secrets.google_client_secret = "test_client_secret"
            mock_openbao.return_value = mock_secrets

            # Set the global variable
            import server

            server.chatlab_secrets = mock_secrets

            client = TestClient(app)

            # Mock the refresh token request
            with patch("server.httpx.AsyncClient") as mock_client:
                mock_response = Mock()
                mock_response.is_success = True
                mock_response.json.return_value = {
                    "access_token": "new_access_token",
                    "expires_in": 3600,
                }

                mock_client.return_value.__aenter__.return_value.post.return_value = (
                    mock_response
                )

                # Mock decryption
                with patch(
                    "server.decrypt_refresh_token", new_callable=AsyncMock
                ) as mock_decrypt:
                    mock_decrypt.return_value = "original_refresh_token"

                    # Set up cookies
                    cookies = {"google_refresh_token": "encrypted_token"}

                    response = client.post(
                        "/fidu-chat-lab/api/oauth/refresh-token", cookies=cookies
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert "access_token" in data
                    assert "expires_in" in data


class TestAuthEndpoints:
    """Test authentication cookie endpoints."""

    def test_set_auth_token_endpoint(self):
        """Test setting authentication tokens in cookies."""
        client = TestClient(app)

        # Mock encryption
        with patch(
            "server.encrypt_refresh_token", new_callable=AsyncMock
        ) as mock_encrypt:
            mock_encrypt.return_value = "encrypted_data"

            response = client.post(
                "/fidu-chat-lab/api/auth/set-token",
                json={
                    "token": "test_token",
                    "expires_in": 3600,
                    "user": {"id": "user123", "email": "test@example.com"},
                    "profile": {"id": "profile123", "name": "Test Profile"},
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

            # Check that cookies were set
            assert "set-cookie" in response.headers
            cookie_header = response.headers["set-cookie"]
            assert "auth_token" in cookie_header
            assert "user" in cookie_header
            assert "current_profile" in cookie_header

    def test_get_auth_tokens_endpoint(self):
        """Test retrieving authentication tokens from cookies."""
        client = TestClient(app)

        # Mock decryption
        with patch(
            "server.decrypt_refresh_token", new_callable=AsyncMock
        ) as mock_decrypt:
            mock_decrypt.side_effect = [
                "test_refresh_token",
                '{"id": "user123", "email": "test@example.com"}',
                '{"id": "profile123", "name": "Test Profile"}',
            ]

            # Set up cookies
            cookies = {
                "auth_token": "test_token",
                "fiduRefreshToken": "encrypted_refresh",
                "user": "encrypted_user",
                "current_profile": "encrypted_profile",
            }

            response = client.get("/fidu-chat-lab/api/auth/get-tokens", cookies=cookies)

            assert response.status_code == 200
            data = response.json()
            assert "auth_token" in data
            assert "refresh_token" in data
            assert "user" in data
            assert "profile" in data

    def test_clear_auth_tokens_endpoint(self):
        """Test clearing all authentication cookies."""
        client = TestClient(app)

        response = client.post("/fidu-chat-lab/api/auth/clear-tokens")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Check that cookies were cleared
        assert "set-cookie" in response.headers
        cookie_header = response.headers["set-cookie"]
        assert "auth_token=" in cookie_header
        assert "Max-Age=0" in cookie_header


class TestErrorHandling:
    """Test error handling in cookie operations."""

    def test_encryption_error_handling(self):
        """Test handling of encryption errors."""
        with patch("server.encryption_service") as mock_service:
            mock_service.get_user_encryption_key = AsyncMock(
                side_effect=Exception("Encryption failed")
            )

            # This should raise an HTTPException
            import pytest
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                import asyncio

                asyncio.run(
                    encrypt_refresh_token("test_token", "user123", "auth_token")
                )

            assert exc_info.value.status_code == 500
            assert "Failed to encrypt refresh token" in str(exc_info.value.detail)

    def test_missing_cookie_error_handling(self):
        """Test handling of missing cookies."""
        client = TestClient(app)

        # Request without cookies should return 401
        response = client.post("/fidu-chat-lab/api/oauth/refresh-token")
        assert response.status_code == 401
        assert "No refresh token found" in response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__])
