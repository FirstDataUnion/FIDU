"""Profile models for the FIDU system."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class IdentityServiceProfile(BaseModel):
    """Model for representing Profiles from the Identity Service.
    This model aligns with the Identity service definition, and should not be changed.
    """

    id: str
    user_id: str
    display_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "display_name": "John Doe",
                "is_active": True,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-02T00:00:00",
            }
        }
    )
