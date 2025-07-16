import os
import httpx
from fastapi import HTTPException
from fidu_core.users.schema import IdentityServiceUser, IdentityServiceProfile
import logging

logger = logging.getLogger(__name__)

identity_service_default_url = "https://fidu.identity-service.com"

async def get_user_from_identity_service(token: str) -> IdentityServiceUser:

    identity_service_url = os.getenv(
        "FIDU_IDENTITY_SERVICE_URL", identity_service_default_url
    )
    
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{identity_service_url}/user", headers=headers)
        if response.status_code == 200:
            if 'user' in response.json():
                return IdentityServiceUser(**response.json()['user'])
            else:
                logger.error(f"Error converting identity service response to IdentityServiceUser: {response.json()}")
                raise HTTPException(status_code=500, detail="Identity service error")
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        else:
            raise HTTPException(status_code=500, detail="Identity service error") 

async def create_profile(token: str, display_name: str) -> IdentityServiceProfile:
    identity_service_url = os.getenv(
        "FIDU_IDENTITY_SERVICE_URL", identity_service_default_url
    )
    
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{identity_service_url}/profiles", headers=headers, json={"display_name": display_name})
        if response.status_code == 201:
            if 'profile' in response.json():
                return IdentityServiceProfile(**response.json()['profile'])
            else:
                logger.error(f"Error converting identity service response to IdentityServiceProfile: {response.json()}")
                raise HTTPException(status_code=500, detail="Identity service error")
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        elif response.status_code == 409:
            raise HTTPException(status_code=409, detail="Profile with that name already exists")
        else:
            logger.error(f"Identity service error: {response.json()} code: {response.status_code}")
            raise HTTPException(status_code=500, detail="Identity service error")