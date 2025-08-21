"""API Key models for managing AI model provider API keys."""

from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel, Field
from fastapi import Query


class APIKeyCreate(BaseModel):
    """Model for creating a new API key."""

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="""Unique identifier for the API key.
        Optional on creation, will default to a UUID if not provided.""",
    )
    provider: str = Field(
        description="Name of the AI model provider (e.g., 'openai', 'anthropic', 'google')"
    )
    api_key: str = Field(description="The actual API key value")
    user_id: str = Field(
        description="ID of the user this API key belongs to. Mandatory on creation."
    )


class APIKeyUpdate(BaseModel):
    """Model for updating an existing API key."""

    id: str = Field(
        description="Unique identifier for the API key. Mandatory on update."
    )
    api_key: Optional[str] = Field(
        description="The actual API key value. Optional on update."
    )


class APIKey(BaseModel):
    """Model for API key responses (full view of the resource, without the actual key value).

    This model is used for display purposes and general API key management.
    The actual API key value is not included for security reasons.
    """

    id: str = Field(description="Unique identifier for the API key.")
    provider: str = Field(description="Name of the AI model provider.")
    user_id: str = Field(description="ID of the user this API key belongs to.")
    create_timestamp: datetime = Field(
        description="Timestamp of when the API key was created. Output only."
    )
    update_timestamp: datetime = Field(
        description="Timestamp of when the API key was last updated. Output only."
    )


class APIKeyWithValue(BaseModel):
    """Model for API key responses that include the actual API key value.

    This model should only be used when the actual API key value is needed,
    such as for authenticated API calls to external services.
    """

    id: str = Field(description="Unique identifier for the API key.")
    provider: str = Field(description="Name of the AI model provider.")
    api_key: str = Field(description="The actual API key value.")
    user_id: str = Field(description="ID of the user this API key belongs to.")
    create_timestamp: datetime = Field(
        description="Timestamp of when the API key was created. Output only."
    )
    update_timestamp: datetime = Field(
        description="Timestamp of when the API key was last updated. Output only."
    )


class APIKeyCreateRequest(BaseModel):
    """Request model for API key creation."""

    request_id: str = Field(
        frozen=True, description="ID of the request, used for idempotency"
    )
    api_key: APIKeyCreate = Field(description="The API key to be created. Mandatory.")


class APIKeyUpdateRequest(BaseModel):
    """Request model for updating an API key."""

    request_id: str = Field(
        frozen=True, description="ID of the request, used for idempotency"
    )
    api_key: APIKeyUpdate = Field(description="The updated API key. Mandatory.")


class APIKeyInternal(BaseModel):
    """Internal API key model. This is the model that is used internally by the service layer.
    It includes no validation to make internal handling easier.
    """

    id: str
    provider: str
    api_key: str
    user_id: str
    create_timestamp: datetime
    update_timestamp: datetime


class APIKeyQueryParams(BaseModel):
    """Query parameters for filtering API keys."""

    user_id: Optional[str] = Query(None, description="Filter by user ID")
    provider: Optional[str] = Query(None, description="Filter by provider name")
    limit: Optional[int] = Query(100, description="Maximum number of results to return")
    offset: Optional[int] = Query(0, description="Number of results to skip")


class APIKeyQueryParamsInternal(BaseModel):
    """Internal query parameters for filtering API keys."""

    user_id: Optional[str] = None
    provider: Optional[str] = None
    limit: Optional[int] = 100
    offset: Optional[int] = 0
