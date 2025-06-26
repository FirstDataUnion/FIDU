"""Data Packet models the various data packets that are handled by FIDU"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
from pydantic import BaseModel, Field
from fastapi import Query


class DataPacketCreate(BaseModel):
    """Model for creating a new data packet."""

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="""Unique identifier for the data packet.
        Optional on creation, will default to a UUID if not provided.""",
    )
    profile_id: str = Field(
        description="ID of the profile this data packet belongs to. Mandatory on creation."
    )
    tags: list[str] = Field(
        default_factory=list,
        description="""List of tags used to categorize and search for this data packet.
        Optional on creation. """,
    )
    data: Dict[str, Any] = Field(
        description="Flexible JSON object containing the actual data. Mandatory on creation."
    )


class DataPacketUpdate(BaseModel):
    """Model for updating an existing data packet."""

    id: str = Field(
        description="Unique identifier for the data packet. Mandatory on update."
    )
    tags: Optional[list[str]] = Field(
        description="""List of tags used to categorize and search for this data packet.
        Optional on update. If left as None on update, no change will be made.
        If set, the whole tags object will be replaced.""",
    )
    data: Optional[Dict[str, Any]] = Field(
        description="""Flexible JSON object containing the actual data. Optional on update.
        If left as None on update, no change will be made.
        If set, the whole data object will be replaced.""",
    )


class DataPacket(BaseModel):
    """Model for data packet responses (full view of the resource)."""

    id: str = Field(description="Unique identifier for the data packet.")
    profile_id: str = Field(
        description="ID of the profile this data packet belongs to."
    )
    create_timestamp: datetime = Field(
        description="Timestamp of when the data packet was created. Output only."
    )
    update_timestamp: datetime = Field(
        description="Timestamp of when the data packet was last updated. Output only."
    )
    tags: list[str] = Field(
        default_factory=list,
        description="List of tags used to categorize and search for this data packet.",
    )
    data: Dict[str, Any] = Field(
        description="Flexible JSON object containing the actual data."
    )


class DataPacketCreateRequest(BaseModel):
    """Request model for data packet creation."""

    request_id: str = Field(
        frozen=True, description="ID of the request, used for idempotency"
    )
    data_packet: DataPacketCreate = Field(
        description="The data packet to be created. Mandatory."
    )


class DataPacketUpdateRequest(BaseModel):
    """Request model for updating a DataPacket. Only supports full updates."""

    request_id: str = Field(
        frozen=True, description="ID of the request, used for idempotency"
    )
    data_packet: DataPacketUpdate = Field(
        description="The updated data packet. Mandatory. Fully replaced on update."
    )


# TODO: If we ever want to support partial updates, this should be a separate request type.
# It seems we could use something like https://pypi.org/project/pydantic-partial/ to get
# Pydantic to mostly handle it. However, uneeded for now. Idempotency here gets complicated.


class DataPacketInternal(BaseModel):
    """Internal data packet model. This is the model that is used internally by the service layer.
    It includes no validation to make internal handling easier.
    """

    id: str = Field(description="Unique identifier for the data packet.")
    profile_id: Optional[str] = Field(
        default=None, description="ID of the profile this data packet belongs to."
    )
    create_timestamp: Optional[datetime] = Field(
        default=None, description="Timestamp of when the data packet was created."
    )
    update_timestamp: Optional[datetime] = Field(
        default=None, description="Timestamp of when the data packet was last updated."
    )
    tags: Optional[list[str]] = Field(
        default=None,
        description="List of tags used to categorize and search for this data packet.",
    )
    data: Optional[Dict[str, Any]] = Field(
        default=None, description="Flexible JSON object containing the actual data."
    )


class DataPacketQueryParams(BaseModel):
    """Query parameters for filtering data packets."""

    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    profile_id: Optional[str] = Field(None, description="Filter by profile ID")
    from_timestamp: Optional[datetime] = Field(
        None, description="Filter by start timestamp. Filters by create_timestamp."
    )
    to_timestamp: Optional[datetime] = Field(
        None, description="Filter by end timestamp. Filters by create_timestamp."
    )
    limit: int = Field(
        default=50, ge=1, le=100, description="Number of results to return"
    )
    offset: int = Field(default=0, ge=0, description="Number of results to skip")
    sort_order: str = Field(default="desc", description="Sort order (asc/desc)")

    @classmethod
    def as_query_params(
        cls,
        tags: Optional[List[str]] = Query(None, description="Filter by tags"),
        profile_id: Optional[str] = Query(None, description="Filter by profile ID"),
        from_timestamp: Optional[str] = Query(
            None, description="Filter by start timestamp (ISO format)"
        ),
        to_timestamp: Optional[str] = Query(
            None, description="Filter by end timestamp (ISO format)"
        ),
        limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
        offset: int = Query(0, ge=0, description="Number of results to skip"),
        sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    ) -> "DataPacketQueryParams":
        """Create DataPacketQueryParams from query parameters.

        This is a helper method to create a DataPacketQueryParams object using FastAPI's Query
        function rather than Field, as Field is unable to automatically support complex fields
        like tags in the context of HTTP query parameters. It is used in the API layer to play
        nicely with the "Depends" function to support URL query parameters.
        """
        # Parse timestamps
        from_dt = None
        to_dt = None
        if from_timestamp:
            from_dt = datetime.fromisoformat(from_timestamp.replace("Z", "+00:00"))
        if to_timestamp:
            to_dt = datetime.fromisoformat(to_timestamp.replace("Z", "+00:00"))

        return cls(
            tags=tags,
            profile_id=profile_id,
            from_timestamp=from_dt,
            to_timestamp=to_dt,
            limit=limit,
            offset=offset,
            sort_order=sort_order,
        )
