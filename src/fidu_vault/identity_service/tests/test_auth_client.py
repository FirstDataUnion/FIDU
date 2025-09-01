"""
Tests for the enhanced authentication client with refresh token support.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from httpx import HTTPStatusError, ConnectError, TimeoutException

from ..auth_client import (
    AuthTokenManager,
    AuthenticatedClient,
    get_user_from_identity_service,
    create_profile,
)


class TestAuthTokenManager:
    """Test cases for AuthTokenManager class."""

    def test_set_tokens(self):
        """Test setting tokens with expiration."""
        manager = AuthTokenManager()
        manager.set_tokens("access_token_123", "refresh_token_456", 3600)
        
        assert manager.access_token == "access_token_123"
        assert manager.refresh_token == "refresh_token_456"
        assert manager.token_expires_at is not None

    def test_is_token_expired_when_no_token(self):
        """Test token expiration check when no token is set."""
        manager = AuthTokenManager()
        assert manager.is_token_expired() is True

    def test_is_token_expired_when_token_valid(self):
        """Test token expiration check when token is still valid."""
        manager = AuthTokenManager()
        manager.set_tokens("access_token_123", "refresh_token_456", 3600)
        
        # Token should be valid for ~1 hour minus 5 minutes safety margin
        assert manager.is_token_expired() is False

    def test_get_valid_access_token_when_valid(self):
        """Test getting valid access token when token is not expired."""
        manager = AuthTokenManager()
        manager.set_tokens("access_token_123", "refresh_token_456", 3600)
        
        assert manager.get_valid_access_token() == "access_token_123"

    def test_get_valid_access_token_when_expired(self):
        """Test getting valid access token when token is expired."""
        manager = AuthTokenManager()
        manager.set_tokens("access_token_123", "refresh_token_456", 0)  # Expired immediately
        
        assert manager.get_valid_access_token() is None

    def test_clear_tokens(self):
        """Test clearing all tokens."""
        manager = AuthTokenManager()
        manager.set_tokens("access_token_123", "refresh_token_456", 3600)
        manager.clear_tokens()
        
        assert manager.access_token is None
        assert manager.refresh_token is None
        assert manager.token_expires_at is None

    @pytest.mark.asyncio
    @patch("fidu_vault.identity_service.auth_client.httpx.AsyncClient")
    async def test_refresh_access_token_success(self, mock_client_class):
        """Test successful access token refresh."""
        manager = AuthTokenManager()
        manager.set_tokens("old_token", "refresh_token_456", 0)
        
        # Mock successful refresh response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json = lambda: {
            "access_token": "new_access_token",
            "expires_in": 3600
        }
        
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test refresh
        result = await manager.refresh_access_token()
        
        assert result is True
        assert manager.access_token == "new_access_token"
        assert manager.token_expires_at is not None

    @pytest.mark.asyncio
    @patch("fidu_vault.identity_service.auth_client.httpx.AsyncClient")
    async def test_refresh_access_token_failure(self, mock_client_class):
        """Test failed access token refresh."""
        manager = AuthTokenManager()
        manager.set_tokens("old_token", "refresh_token_456", 0)
        
        # Mock failed refresh response
        mock_response = AsyncMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test refresh
        result = await manager.refresh_access_token()
        
        assert result is False
        assert manager.access_token == "old_token"  # Should remain unchanged


class TestAuthenticatedClient:
    """Test cases for AuthenticatedClient class."""

    def test_set_tokens(self):
        """Test setting tokens in the client."""
        client = AuthenticatedClient()
        client.set_tokens("access_token_123", "refresh_token_456", 3600)
        
        assert client.token_manager.access_token == "access_token_123"
        assert client.token_manager.refresh_token == "refresh_token_456"

    def test_clear_tokens(self):
        """Test clearing tokens from the client."""
        client = AuthenticatedClient()
        client.set_tokens("access_token_123", "refresh_token_456", 3600)
        client.clear_tokens()
        
        assert client.token_manager.access_token is None
        assert client.token_manager.refresh_token is None


class TestGetUserFromIdentityService:
    """Test cases for get_user_from_identity_service function."""

    def test_raises_401_when_no_token_provided(self):
        """Test that function raises 401 when no token is provided."""
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service(""))

        assert exc_info.value.status_code == 401
        assert "Authorization token is required" in str(exc_info.value.detail)

    def test_raises_401_when_token_is_none(self):
        """Test that function raises 401 when token is None."""
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service(None))

        assert exc_info.value.status_code == 401
        assert "Authorization token is required" in str(exc_info.value.detail)

    @patch("fidu_vault.identity_service.auth_client.httpx.AsyncClient")
    def test_returns_user_when_valid_response(self, mock_client_class):
        """Test that function returns user when identity service returns valid response."""
        # Mock the response
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json = lambda: {
            "user": {
                "id": "test_user_123",
                "name": "John Doe",
                "email": "test@example.com",
                "is_admin": False,
                "is_active": True,
                "is_locked": False,
                "rate_limit_per_minute": 60,
                "rate_limit_per_hour": 1000,
                "last_login": None,
                "login_count": 5,
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-02T12:00:00Z",
                "profiles": [],
            }
        }

        # Mock the client context manager
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        # Call the function
        result = asyncio.run(get_user_from_identity_service("valid_token"))

        # Assertions
        assert result is not None
        assert result.id == "test_user_123"
        assert result.name == "John Doe"
        assert result.email == "test@example.com"

        # Verify the request was made correctly
        mock_client.get.assert_called_once()
        call_args = mock_client.get.call_args
        assert "Bearer valid_token" in call_args[1]["headers"]["Authorization"]


class TestCreateProfile:
    """Test cases for create_profile function."""

    @patch("fidu_vault.identity_service.auth_client.httpx.AsyncClient")
    def test_returns_profile_when_valid_response(self, mock_client_class):
        """Test that function returns profile when identity service returns valid response."""
        # Mock the response
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json = lambda: {
            "profile": {
                "id": "test_profile_123",
                "user_id": "test_user_123",
                "display_name": "Test Profile",
                "is_active": True,
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-02T12:00:00Z",
            }
        }

        # Mock the client context manager
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        # Call the function
        result = asyncio.run(create_profile("valid_token", "Test Profile"))

        # Assertions
        assert result is not None
        assert result.id == "test_profile_123"
        assert result.display_name == "Test Profile"

        # Verify the request was made correctly
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert "Bearer valid_token" in call_args[1]["headers"]["Authorization"]
        assert call_args[1]["json"]["display_name"] == "Test Profile"
