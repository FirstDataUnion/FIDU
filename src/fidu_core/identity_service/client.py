"""Client for interacting with the identity service."""

import os
import logging
import httpx
from fastapi import HTTPException
from fidu_core.users.schema import IdentityServiceUser, IdentityServiceProfile

logger = logging.getLogger(__name__)

IDENTITY_SERVICE_DEFAULT_URL = "https://identity.firstdataunion.org"

async def get_user_from_identity_service(token: str) -> IdentityServiceUser | None:
    """Fetch a user from the identity service by user_id."""
    identity_service_url = os.getenv(
        "FIDU_IDENTITY_SERVICE_URL", IDENTITY_SERVICE_DEFAULT_URL
    )
    if not token:
        return None
    logging.info("Fetching user from identity service: %s", token)

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{identity_service_url}/user", headers=headers
            )
            if response.status_code == 200:
                if "user" in response.json():
                    return IdentityServiceUser(**response.json()["user"])
                return None
            logging.error("Failed to fetch user: %s", response.text)
            return None
    except httpx.ConnectError as e:
        logger.error("Failed to connect to identity service at %s: %s", 
                    identity_service_url, str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service is currently unavailable. Please try again later."
        )
    except httpx.TimeoutException as e:
        logger.error("Timeout connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service request timed out. Please try again later."
        )
    except httpx.HTTPError as e:
        logger.error("HTTP error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Unable to communicate with identity service. Please try again later."
        )
    except Exception as e:
        logger.error("Unexpected error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while validating your credentials."
        )


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
        logger.error("Failed to connect to identity service at %s: %s", 
                    identity_service_url, str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service is currently unavailable. Please try again later."
        )
    except httpx.TimeoutException as e:
        logger.error("Timeout connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Identity service request timed out. Please try again later."
        )
    except httpx.HTTPError as e:
        logger.error("HTTP error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Unable to communicate with identity service. Please try again later."
        )
    except Exception as e:
        logger.error("Unexpected error connecting to identity service: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating the profile."
        )
