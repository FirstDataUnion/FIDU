"""
Tests for the identity service client.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from httpx import HTTPStatusError, ConnectError, TimeoutException

from ..client import get_user_from_identity_service, create_profile
from ...users.schema import IdentityServiceUser
from ...profiles.schema import IdentityServiceProfile


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

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
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
                "profiles": []
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
        assert isinstance(result, IdentityServiceUser)
        assert result.id == "test_user_123"
        assert result.name == "John Doe"
        assert result.email == "test@example.com"
        
        # Verify the request was made correctly
        mock_client.get.assert_called_once()
        call_args = mock_client.get.call_args
        assert "Bearer valid_token" in call_args[1]["headers"]["Authorization"]

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
    def test_raises_503_when_connection_error(self, mock_client_class):
        """Test that function raises 503 when connection error occurs."""
        # Mock the client to raise ConnectError
        mock_client = AsyncMock()
        mock_client.get.side_effect = ConnectError("Connection failed")
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Call the function and expect exception
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service("valid_token"))
        
        assert exc_info.value.status_code == 503
        assert "Identity service is currently unavailable" in str(exc_info.value.detail)

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
    def test_raises_503_when_timeout_error(self, mock_client_class):
        """Test that function raises 503 when timeout error occurs."""
        # Mock the client to raise TimeoutException
        mock_client = AsyncMock()
        mock_client.get.side_effect = TimeoutException("Request timed out")
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Call the function and expect exception
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service("valid_token"))
        
        assert exc_info.value.status_code == 503
        assert "Identity service request timed out" in str(exc_info.value.detail)

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
    def test_raises_401_when_http_status_error_401(self, mock_client_class):
        """Test that function raises 401 when HTTPStatusError with 401 occurs."""
        # Mock the response for HTTPStatusError
        mock_response = AsyncMock()
        mock_response.status_code = 401
        
        # Mock the client to raise HTTPStatusError
        mock_client = AsyncMock()
        mock_client.get.side_effect = HTTPStatusError("401 Unauthorized", request=None, response=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Call the function and expect exception
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service("invalid_token"))
        
        assert exc_info.value.status_code == 401
        assert "Invalid or expired token" in str(exc_info.value.detail)

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
    def test_raises_403_when_http_status_error_403(self, mock_client_class):
        """Test that function raises 403 when HTTPStatusError with 403 occurs."""
        # Mock the response for HTTPStatusError
        mock_response = AsyncMock()
        mock_response.status_code = 403
        
        # Mock the client to raise HTTPStatusError
        mock_client = AsyncMock()
        mock_client.get.side_effect = HTTPStatusError("403 Forbidden", request=None, response=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Call the function and expect exception
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_user_from_identity_service("forbidden_token"))
        
        assert exc_info.value.status_code == 403
        assert "Access forbidden" in str(exc_info.value.detail)


class TestCreateProfile:
    """Test cases for create_profile function."""

    @patch("fidu_vault.identity_service.client.httpx.AsyncClient")
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
                "updated_at": "2024-01-02T12:00:00Z"
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
        assert isinstance(result, IdentityServiceProfile)
        assert result.id == "test_profile_123"
        assert result.display_name == "Test Profile"
        
        # Verify the request was made correctly
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert "Bearer valid_token" in call_args[1]["headers"]["Authorization"]
        assert call_args[1]["json"]["display_name"] == "Test Profile" 