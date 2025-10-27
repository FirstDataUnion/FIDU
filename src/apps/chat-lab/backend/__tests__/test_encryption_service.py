"""
Backend Encryption Service Tests
Tests for the new encryption service integration with cookies.
"""

import pytest
import json
import base64
from unittest.mock import Mock, patch, AsyncMock
import httpx

import sys
import os
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from encryption_service import BackendEncryptionService  # type: ignore[import-not-found]


class TestBackendEncryptionService:
    """Test the backend encryption service."""

    def setup_method(self):
        """Set up test fixtures."""
        self.service = BackendEncryptionService()

    def _get_test_key(self) -> str:
        """Get a proper base64-encoded 256-bit key for testing."""
        # Generate exactly 32 bytes and encode as base64
        return base64.b64encode(b"test_encryption_key_32_bytes_exact"[:32]).decode(
            "utf-8"
        )

    @pytest.mark.asyncio
    async def test_get_user_encryption_key_success(self):
        """Test successful key retrieval."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "encryption_key": {"key": "test_encryption_key_base64"}
            }

            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )

            key = await self.service.get_user_encryption_key("user123", "auth_token")

            assert key == "test_encryption_key_base64"
            assert "user123" in self.service.key_cache

    @pytest.mark.asyncio
    async def test_get_user_encryption_key_404_creates_new(self):
        """Test key creation when key doesn't exist."""
        with patch("httpx.AsyncClient") as mock_client:
            # First call returns 404
            mock_get_response = Mock()
            mock_get_response.status_code = 404

            # Second call (create) returns success
            mock_post_response = Mock()
            mock_post_response.status_code = 200
            mock_post_response.json.return_value = {
                "encryption_key": {"key": "new_encryption_key_base64"}
            }

            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_get_response
            )
            mock_client.return_value.__aenter__.return_value.post.return_value = (
                mock_post_response
            )

            key = await self.service.get_user_encryption_key("user123", "auth_token")

            assert key == "new_encryption_key_base64"
            assert "user123" in self.service.key_cache

    @pytest.mark.asyncio
    async def test_get_user_encryption_key_401_raises_exception(self):
        """Test authentication failure handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 401

            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )

            with pytest.raises(Exception, match="Authentication failed"):
                await self.service.get_user_encryption_key("user123", "invalid_token")

    @pytest.mark.asyncio
    async def test_key_caching(self):
        """Test that keys are cached properly."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"encryption_key": {"key": "cached_key"}}

            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )

            # First call should fetch from API
            key1 = await self.service.get_user_encryption_key("user123", "auth_token")
            assert key1 == "cached_key"

            # Second call should use cache
            key2 = await self.service.get_user_encryption_key("user123", "auth_token")
            assert key2 == "cached_key"

            # Should only have made one API call
            assert mock_client.return_value.__aenter__.return_value.get.call_count == 1

    def test_encrypt_refresh_token(self):
        """Test token encryption."""
        # Use a proper base64-encoded 256-bit key (32 bytes)
        encryption_key = base64.b64encode(
            b"test_encryption_key_32_bytes_exact"[:32]
        ).decode("utf-8")
        token = "test_refresh_token"

        encrypted = self.service.encrypt_refresh_token(token, encryption_key)

        # Should return base64 encoded string
        assert isinstance(encrypted, str)
        assert len(encrypted) > 0

        # Should be different from original token
        assert encrypted != token

    def test_decrypt_refresh_token(self):
        """Test token decryption."""
        encryption_key = self._get_test_key()
        token = "test_refresh_token"

        # Encrypt first
        encrypted = self.service.encrypt_refresh_token(token, encryption_key)

        # Then decrypt
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == token

    def test_decrypt_with_wrong_key_fails(self):
        """Test that decryption fails with wrong key."""
        encryption_key1 = self._get_test_key()
        encryption_key2 = base64.b64encode(
            b"different_test_key_32_bytes_long!"[:32]
        ).decode("utf-8")
        token = "test_refresh_token"

        # Encrypt with key1
        encrypted = self.service.encrypt_refresh_token(token, encryption_key1)

        # Try to decrypt with key2 - should fail with InvalidTag (AES-GCM behavior)
        with pytest.raises(RuntimeError, match="Failed to decrypt refresh token"):
            self.service.decrypt_refresh_token(encrypted, encryption_key2)

    def test_encrypt_decrypt_roundtrip(self):
        """Test complete encrypt/decrypt roundtrip."""
        encryption_key = self._get_test_key()
        original_token = "very_long_refresh_token_12345"

        # Encrypt
        encrypted = self.service.encrypt_refresh_token(original_token, encryption_key)

        # Decrypt
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == original_token

    @pytest.mark.asyncio
    async def test_create_user_encryption_key(self):
        """Test creating a new encryption key."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "encryption_key": {"key": "newly_created_key"}
            }

            mock_client.return_value.__aenter__.return_value.post.return_value = (
                mock_response
            )

            key = await self.service.create_user_encryption_key("user123", "auth_token")

            assert key == "newly_created_key"
            assert "user123" in self.service.key_cache

    @pytest.mark.asyncio
    async def test_create_user_encryption_key_failure(self):
        """Test handling of key creation failure."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.text = "Internal server error"
            mock_response.is_success = False

            mock_client.return_value.__aenter__.return_value.post.return_value = (
                mock_response
            )

            with pytest.raises(Exception, match="Failed to create encryption key"):
                await self.service.create_user_encryption_key("user123", "auth_token")

    def test_encryption_with_special_characters(self):
        """Test encryption with special characters in token."""
        encryption_key = self._get_test_key()
        special_token = "token_with_special_chars!@#$%^&*()_+-=[]{}|;':\",./<>?"

        encrypted = self.service.encrypt_refresh_token(special_token, encryption_key)
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == special_token

    def test_encryption_with_unicode(self):
        """Test encryption with unicode characters."""
        encryption_key = self._get_test_key()
        unicode_token = "token_with_unicode_🚀_🎉_测试"

        encrypted = self.service.encrypt_refresh_token(unicode_token, encryption_key)
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == unicode_token

    @pytest.mark.asyncio
    async def test_network_error_handling(self):
        """Test handling of network errors."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = (
                httpx.ConnectError("Connection failed")
            )

            with pytest.raises(Exception, match="Connection failed"):
                await self.service.get_user_encryption_key("user123", "auth_token")

    def test_empty_token_handling(self):
        """Test handling of empty tokens."""
        encryption_key = self._get_test_key()
        empty_token = ""

        encrypted = self.service.encrypt_refresh_token(empty_token, encryption_key)
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == empty_token

    def test_very_long_token(self):
        """Test encryption with very long tokens."""
        encryption_key = self._get_test_key()
        long_token = "a" * 1000  # 1000 character token

        encrypted = self.service.encrypt_refresh_token(long_token, encryption_key)
        decrypted = self.service.decrypt_refresh_token(encrypted, encryption_key)

        assert decrypted == long_token


class TestEncryptionServiceIntegration:
    """Integration tests for the encryption service."""

    @pytest.mark.asyncio
    async def test_full_encryption_flow(self):
        """Test the complete encryption flow."""
        service = BackendEncryptionService()
        service.identity_service_url = "http://localhost:4000"

        with patch("httpx.AsyncClient") as mock_client:
            # Mock key retrieval
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "encryption_key": {
                    "key": base64.b64encode(
                        b"integration_test_key_32_bytes_long!"[:32]
                    ).decode("utf-8")
                }
            }

            mock_client.return_value.__aenter__.return_value.get.return_value = (
                mock_response
            )

            # Get encryption key
            key = await service.get_user_encryption_key("user123", "auth_token")

            # Encrypt token
            original_token = "integration_test_token"
            encrypted_token = service.encrypt_refresh_token(original_token, key)

            # Decrypt token
            decrypted_token = service.decrypt_refresh_token(encrypted_token, key)

            assert decrypted_token == original_token

    @pytest.mark.asyncio
    async def test_multiple_users_encryption(self):
        """Test encryption with multiple users."""
        service = BackendEncryptionService()
        service.identity_service_url = "http://localhost:4000"

        with patch("httpx.AsyncClient") as mock_client:
            # Mock different keys for different users
            def mock_get_response(url, **kwargs):
                mock_response = Mock()
                mock_response.status_code = 200

                if "user1" in str(kwargs.get("headers", {}).get("Authorization", "")):
                    mock_response.json.return_value = {
                        "encryption_key": {
                            "key": base64.b64encode(
                                b"user1_test_key_32_bytes_longer!"
                                + b"x" * (32 - len(b"user1_test_key_32_bytes_longer!"))
                            ).decode("utf-8")
                        }
                    }
                else:
                    mock_response.json.return_value = {
                        "encryption_key": {
                            "key": base64.b64encode(
                                b"user2_test_key_32_bytes_longer!"
                                + b"y" * (32 - len(b"user2_test_key_32_bytes_longer!"))
                            ).decode("utf-8")
                        }
                    }

                return mock_response

            mock_client.return_value.__aenter__.return_value.get.side_effect = (
                mock_get_response
            )

            # Encrypt same token for different users
            token = "shared_token"

            encrypted1 = service.encrypt_refresh_token(
                token,
                base64.b64encode(
                    b"user1_test_key_32_bytes_longer!"
                    + b"x" * (32 - len(b"user1_test_key_32_bytes_longer!"))
                ).decode("utf-8"),
            )
            encrypted2 = service.encrypt_refresh_token(
                token,
                base64.b64encode(
                    b"user2_test_key_32_bytes_longer!"
                    + b"y" * (32 - len(b"user2_test_key_32_bytes_longer!"))
                ).decode("utf-8"),
            )

            # Should produce different encrypted values
            assert encrypted1 != encrypted2

            # Each should decrypt correctly with its own key
            decrypted1 = service.decrypt_refresh_token(
                encrypted1,
                base64.b64encode(
                    b"user1_test_key_32_bytes_longer!"
                    + b"x" * (32 - len(b"user1_test_key_32_bytes_longer!"))
                ).decode("utf-8"),
            )
            decrypted2 = service.decrypt_refresh_token(
                encrypted2,
                base64.b64encode(
                    b"user2_test_key_32_bytes_longer!"
                    + b"y" * (32 - len(b"user2_test_key_32_bytes_longer!"))
                ).decode("utf-8"),
            )

            assert decrypted1 == token
            assert decrypted2 == token


if __name__ == "__main__":
    pytest.main([__file__])
