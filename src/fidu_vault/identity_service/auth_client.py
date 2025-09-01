"""Enhanced authentication client with refresh token support."""

import os
import json
import logging
import httpx
from typing import Optional, Dict, Any
from fastapi import HTTPException
from fidu_vault.users.schema import IdentityServiceUser
from fidu_vault.profiles.schema import IdentityServiceProfile

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
        import time
        self.token_expires_at = int(time.time()) + expires_in - 300
    
    def is_token_expired(self) -> bool:
        """Check if the current access token is expired."""
        if not self.token_expires_at or not self.access_token:
            return True
        import time
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
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data and "expires_in" in data:
                        self.access_token = data["access_token"]
                        # Update expiration time
                        import time
                        self.token_expires_at = int(time.time()) + data["expires_in"] - 300
                        logger.info("Successfully refreshed access token")
                        return True
                    else:
                        logger.error("Invalid refresh response format")
                        return False
                else:
                    logger.error(f"Failed to refresh token: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error refreshing access token: {str(e)}")
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
        self, 
        method: str, 
        url: str, 
        **kwargs
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
                    headers["Authorization"] = f"Bearer {self.token_manager.get_valid_access_token()}"
                    kwargs["headers"] = headers
                    
                    response = await client.request(method, url, **kwargs)
                    
                    # If still unauthorized after refresh, raise exception
                    if response.status_code == 401:
                        raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            return response


# Global authenticated client instance
auth_client = AuthenticatedClient()


async def get_user_from_identity_service(token: str) -> IdentityServiceUser | None:
    """Fetch a user from the identity service by user_id."""
    identity_service_url = os.getenv(
        "FIDU_IDENTITY_SERVICE_URL", IDENTITY_SERVICE_DEFAULT_URL
    )
    if not token:
        raise HTTPException(status_code=401, detail="Authorization token is required")
    logging.info("Fetching user from identity service: %s", token)

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{identity_service_url}/user", headers=headers, follow_redirects=False
            )
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    if "user" in response_data:
                        return IdentityServiceUser(**response_data["user"])
                    return None
                except (json.JSONDecodeError, ValueError, TypeError) as e:
                    logging.error("Failed to parse response JSON: %s", str(e))
                    raise HTTPException(
                        status_code=500, detail="Invalid response from identity service"
                    ) from e
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            if response.status_code == 403:
                raise HTTPException(status_code=403, detail="Access forbidden")

            logging.error("Failed to fetch user: %s", response.text)
            raise HTTPException(status_code=500, detail="Identity service error")
    except httpx.ConnectError as e:
        logger.error(
            "Failed to connect to identity service at %s: %s",
            identity_service_url,
            str(e),
        )
        raise HTTPException(
            status_code=503,
            detail="Identity service is currently unavailable. Please try again later.",
        ) from e
    except httpx.TimeoutException as e:
        logger.error("Timeout connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service request timed out. Please try again later.",
        ) from e
    except httpx.HTTPStatusError as e:
        # Handle specific HTTP status errors
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=401, detail="Invalid or expired token"
            ) from e
        if e.response.status_code == 403:
            raise HTTPException(status_code=403, detail="Access forbidden") from e

        logger.error("HTTP status error from identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Unable to communicate with identity service. Please try again later.",
        ) from e
    except httpx.HTTPError as e:
        logger.error("HTTP error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Unable to communicate with identity service. Please try again later.",
        ) from e
    except HTTPException:
        # Re-raise HTTPExceptions as-is to preserve their status codes
        raise
    except Exception as e:
        logger.error("Unexpected error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while validating your credentials.",
        ) from e


async def create_profile(
    token: str, display_name: str
) -> IdentityServiceProfile | None:
    """Create a new profile for the user."""
    identity_service_url = os.getenv(
        "FIDU_IDENTITY_SERVICE_URL", IDENTITY_SERVICE_DEFAULT_URL
    )

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{identity_service_url}/profiles",
                headers=headers,
                json={"display_name": display_name},
            )
            if response.status_code == 201:
                try:
                    response_data = response.json()
                    if "profile" in response_data:
                        return IdentityServiceProfile(**response_data["profile"])
                except (json.JSONDecodeError, ValueError, TypeError) as e:
                    logger.error("Failed to parse response JSON: %s", str(e))
                    raise HTTPException(
                        status_code=500, detail="Invalid response from identity service"
                    ) from e

                logger.error(
                    "Error converting identity service response to IdentityServiceProfile: %s",
                    response.json(),
                )
                raise HTTPException(status_code=500, detail="Identity service error")
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            if response.status_code == 409:
                raise HTTPException(
                    status_code=409, detail="Profile with that name already exists"
                )

            # Use response.text instead of response.json() to avoid JSON parsing errors
            logger.error(
                "Identity service error: %s code: %s",
                response.text,
                response.status_code,
            )
            raise HTTPException(
                status_code=500, detail="Identity service error"
            )
    except httpx.ConnectError as e:
        logger.error(
            "Failed to connect to identity service at %s: %s",
            identity_service_url,
            str(e),
        )
        raise HTTPException(
            status_code=503,
            detail="Identity service is currently unavailable. Please try again later.",
        ) from e
    except httpx.TimeoutException as e:
        logger.error("Timeout connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service request timed out. Please try again later.",
        ) from e
    except httpx.HTTPError as e:
        logger.error("HTTP error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Unable to communicate with identity service. Please try again later.",
        ) from e
    except HTTPException:
        # Re-raise HTTPExceptions as-is to preserve their status codes
        raise
    except Exception as e:
        logger.error("Unexpected error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating the profile.",
        ) from e


async def get_user_with_refresh_support(token: str) -> IdentityServiceUser | None:
    """Get user with refresh token support using the authenticated client."""
    # For now, use the existing function but this can be enhanced later
    return await get_user_from_identity_service(token)


async def create_profile_with_refresh_support(
    token: str, display_name: str
) -> IdentityServiceProfile | None:
    """Create profile with refresh token support using the authenticated client."""
    # For now, use the existing function but this can be enhanced later
    return await create_profile(token, display_name)
