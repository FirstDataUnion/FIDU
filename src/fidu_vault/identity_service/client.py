"""Client for interacting with the identity service."""

import os
import logging
import httpx
from fastapi import HTTPException
from fidu_vault.users.schema import IdentityServiceUser
from fidu_vault.profiles.schema import IdentityServiceProfile

logger = logging.getLogger(__name__)

IDENTITY_SERVICE_DEFAULT_URL = "https://identity.firstdataunion.org"


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
            response = await client.get(f"{identity_service_url}/user", headers=headers, follow_redirects=False)
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    if "user" in response_data:
                        return IdentityServiceUser(**response_data["user"])
                    return None
                except Exception as e:
                    logging.error("Failed to parse response JSON: %s", str(e))
                    raise HTTPException(status_code=500, detail="Invalid response from identity service")
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
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        elif e.response.status_code == 403:
            raise HTTPException(status_code=403, detail="Access forbidden")
        else:
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
    """Create a profile in the identity service."""
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
                if "profile" in response.json():
                    return IdentityServiceProfile(**response.json()["profile"])

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

            logger.error(
                "Identity service error: %s code: %s",
                response.json(),
                response.status_code,
            )
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
