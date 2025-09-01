"""Enhanced authentication client with refresh token support."""

import logging
import os
import time
from typing import Optional

import httpx
from fastapi import HTTPException

from .client import (
    get_user_from_identity_service,
    create_profile,
    get_profile_from_identity_service,
)

logger = logging.getLogger(__name__)

IDENTITY_SERVICE_DEFAULT_URL = "https://identity.firstdataunion.org"


class AuthTokenManager:
    """Manages authentication tokens including refresh token logic."""

    def __init__(self):
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[int] = None
        self.identity_service_url = os.getenv(
            "FIDU_IDENTITY_SERVICE_URL", IDENTITY_SERVICE_DEFAULT_URL
        )

    def set_tokens(self, access_token: str, refresh_token: str, expires_in: int):
        """Set the access and refresh tokens with expiration."""
        self.access_token = access_token
        self.refresh_token = refresh_token
        # Calculate expiration time (subtract 5 minutes for safety margin)
        self.token_expires_at = int(time.time()) + expires_in - 300

    def is_token_expired(self) -> bool:
        """Check if the current access token is expired."""
        if not self.token_expires_at or not self.access_token:
            return True
        return int(time.time()) >= self.token_expires_at

    def get_valid_access_token(self) -> Optional[str]:
        """Get the current access token if it's still valid."""
        if not self.is_token_expired():
            return self.access_token
        return None

    async def refresh_access_token(self) -> bool:
        """Attempt to refresh the access token using the refresh token."""
        if not self.refresh_token:
            logger.warning("No refresh token available")
            return False

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.identity_service_url}/refresh",
                    json={"refresh_token": self.refresh_token},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data and "expires_in" in data:
                        self.access_token = data["access_token"]
                        # Update expiration time
                        self.token_expires_at = (
                            int(time.time()) + data["expires_in"] - 300
                        )
                        logger.info("Successfully refreshed access token")
                        return True
                    logger.error("Invalid refresh response format")
                    return False
                logger.error(
                    "Failed to refresh token: %s - %s",
                    response.status_code,
                    response.text,
                )
                return False

        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError) as e:
            logger.error("Network error refreshing access token: %s", str(e))
            return False
        except (ValueError, KeyError, TypeError) as e:
            logger.error("Data parsing error refreshing access token: %s", str(e))
            return False

    def clear_tokens(self):
        """Clear all stored tokens."""
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = None


class AuthenticatedClient:
    """Client for making authenticated requests with automatic token refresh."""

    def __init__(self):
        self.token_manager = AuthTokenManager()

    def set_tokens(self, access_token: str, refresh_token: str, expires_in: int):
        """Set the authentication tokens."""
        self.token_manager.set_tokens(access_token, refresh_token, expires_in)

    def clear_tokens(self):
        """Clear all authentication tokens."""
        self.token_manager.clear_tokens()

    async def _make_authenticated_request(
        self, method: str, url: str, **kwargs
    ) -> httpx.Response:
        """Make an authenticated request with automatic token refresh."""
        # Ensure we have a valid access token
        access_token = self.token_manager.get_valid_access_token()
        if not access_token:
            # Try to refresh the token
            if not await self.token_manager.refresh_access_token():
                raise HTTPException(status_code=401, detail="Authentication required")
            access_token = self.token_manager.get_valid_access_token()

        # Add authorization header
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {access_token}"
        kwargs["headers"] = headers

        # Make the request
        async with httpx.AsyncClient() as client:
            response = await client.request(method, url, **kwargs)

            # If unauthorized, try refreshing token once and retry
            if response.status_code == 401:
                if await self.token_manager.refresh_access_token():
                    # Update the token in headers and retry
                    headers["Authorization"] = (
                        f"Bearer {self.token_manager.get_valid_access_token()}"
                    )
                    kwargs["headers"] = headers

                    response = await client.request(method, url, **kwargs)

                    # If still unauthorized after refresh, raise exception
                    if response.status_code == 401:
                        raise HTTPException(
                            status_code=401, detail="Invalid or expired token"
                        )

            return response


# Global authenticated client instance
auth_client = AuthenticatedClient()

# Re-export functions from client.py for backward compatibility
__all__ = [
    "auth_client",
    "get_user_from_identity_service",
    "create_profile",
    "get_profile_from_identity_service",
]
