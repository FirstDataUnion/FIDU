"""Profile models for the FIDU system."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import Query


class ProfileBase(BaseModel):
    """Base profile model with common fields"""

    id: str = Field(description="Unique identifier for the profile.")
    user_id: str = Field(..., description="ID of the user who owns this profile.")
    name: str = Field(..., description="Display name for the profile.")


class Profile(ProfileBase):
    """Model for profile responses (full view of the resource)."""

    create_timestamp: datetime = Field(description="Creation timestamp.")
    update_timestamp: datetime = Field(description="Last updated timestamp.")


class ProfileInternal(ProfileBase):
    """Internal profile model. This is the model that is used internally by the service layer.
    It includes minimal validation to make internal handling easier.
    """

    create_timestamp: Optional[datetime] = Field(
        default=None, description="Creation timestamp."
    )
    update_timestamp: Optional[datetime] = Field(
        default=None, description="Last updated timestamp."
    )


class ProfileCreate(BaseModel):
    """Profile model for creating a new profile."""

    user_id: str = Field(..., description="ID of the user who owns this profile.")
    name: str = Field(..., description="Display name for the profile.")


class CreateProfileRequest(BaseModel):
    """Request model for creating a new profile."""

    request_id: str = Field(..., description="Request ID for tracking")
    profile: ProfileCreate = Field(..., description="Profile object to create")


class ProfileUpdate(BaseModel):
    """Profile model for updating an existing profile."""

    id: str = Field(..., description="Unique identifier for the profile.")
    name: Optional[str] = Field(
        default=None, description="Updated display name for the profile."
    )


class UpdateProfileRequest(BaseModel):
    """Request model for updating an existing profile."""

    request_id: str = Field(..., description="Request ID for tracking")
    profile: ProfileUpdate = Field(..., description="Profile object to update")


class ProfileQueryParams(BaseModel):
    """Query parameters for filtering profiles in the List Profiles endpoint."""

    # TODO: remove this field as it should always be set to current user (once implemented)
    user_id: Optional[str] = Field(default=None, description="Filter by user ID.")
    name: Optional[str] = Field(default=None, description="Filter by profile name.")
    limit: Optional[int] = Field(
        default=50,
        ge=1,
        le=100,
        description="Number of results to return. Default is 50.",
    )
    offset: Optional[int] = Field(
        default=0, ge=0, description="Number of results to skip. Default is 0."
    )
    sort_order: Optional[str] = Field(
        default="desc",
        description="Sort order (asc/desc). Sorts by create_timestamp. Default is desc.",
    )

    @classmethod
    def as_query_params(
        cls,
        user_id: Optional[str] = Query(None, description="Filter by user ID."),
        name: Optional[str] = Query(None, description="Filter by profile name."),
        limit: Optional[int] = Query(
            50, ge=1, le=100, description="Number of results to return. Default is 50."
        ),
        offset: Optional[int] = Query(
            0, ge=0, description="Number of results to skip. Default is 0."
        ),
        sort_order: Optional[str] = Query(
            "desc",
            description="Sort order (asc/desc). Sorts by create_timestamp. Default is desc.",
        ),
    ) -> "ProfileQueryParams":
        """Convert the query parameters to a ProfileQueryParamsInternal object."""
        return cls(
            user_id=user_id,
            name=name,
            limit=limit,
            offset=offset,
            sort_order=sort_order,
        )


class ProfileQueryParamsInternal(BaseModel):
    """Internal query parameters for filtering profiles in the List Profiles endpoint."""

    user_id: str = Field(..., description="Filter by user ID.")
    name: Optional[str] = Field(default=None, description="Filter by profile name.")
    limit: Optional[int] = Field(
        default=50,
        ge=1,
        le=100,
        description="Number of results to return. Default is 50.",
    )
    offset: Optional[int] = Field(
        default=0, ge=0, description="Number of results to skip. Default is 0."
    )
    sort_order: Optional[str] = Field(
        default="desc",
        description="Sort order (asc/desc). Sorts by create_timestamp. Default is desc.",
    )
