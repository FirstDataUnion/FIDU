"""User models for the FIDU system."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from fidu_core.profiles.schema import IdentityServiceProfile


class IdentityServiceUser(BaseModel):
    """Model for representing Users from the Identity Service.
    This model aligns with the Identity service definition, and should not be changed.
    """

    id: str
    name: str
    email: str
    is_admin: bool
    is_active: bool
    is_locked: bool
    rate_limit_per_minute: int
    rate_limit_per_hour: int
    last_login: Optional[datetime] = None
    login_count: int
    created_at: datetime
    updated_at: datetime
    profiles: list[IdentityServiceProfile]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "John Doe",
                "email": "user@example.com",
                "is_admin": False,
                "is_active": True,
                "is_locked": False,
                "rate_limit_per_minute": 60,
                "rate_limit_per_hour": 1000,
                "last_login": "2024-01-01T12:00:00",
                "login_count": 5,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-02T00:00:00",
                "profiles": [
                    {
                        "id": "profile-1",
                        "user_id": "123e4567-e89b-12d3-a456-426614174000",
                        "name": "Default",
                        "create_timestamp": "2024-01-01T00:00:00",
                        "update_timestamp": "2024-01-02T00:00:00",
                    }
                ],
            }
        }
    )
