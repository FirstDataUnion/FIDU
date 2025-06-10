"""Data Packet models the various data packets that are handled by FIDU"""

from typing import Optional, Union, Dict, Any, Literal, Set, List
from datetime import datetime
import uuid
from pydantic import BaseModel, Field


class NameInfo(BaseModel):
    """Basic name information for a person."""

    given_name: Optional[str] = None  # First name
    family_name: Optional[str] = None  # Last name
    additional_names: Optional[str] = None  # Middle name(s)
    pronouns: Optional[str] = None  # Pronouns


class BirthInfo(BaseModel):
    """Birth-related information."""

    birth_date: Optional[datetime] = None  # Date of birth
    birth_place: Optional[str] = None  # Place of birth
    nationality: Optional[str] = None  # Nationality


class ContactInfo(BaseModel):
    """Contact information."""

    email: Optional[str] = None  # Email address
    phone: Optional[str] = None  # Phone number
    address: Optional[str] = None  # Postal Address


class LocationInfo(BaseModel):
    """Geographic location information."""

    city: Optional[str] = None  # City of residence
    state: Optional[str] = None  # State of residence
    zip: Optional[str] = None  # Zip code
    country: Optional[str] = None  # Country of residence


class PhysicalInfo(BaseModel):
    """Physical characteristics."""

    height: Optional[float] = None  # Height in meters
    weight: Optional[float] = None  # Weight in kilograms
    gender: Optional[str] = (
        None  # Gender (TODO: I don't think this fits here, find a new home for it"?)
    )


class ProfessionalInfo(BaseModel):
    """Professional and organizational information."""

    job_title: Optional[str] = None  # Job title
    affiliation: Optional[str] = None  # Organisation that the person is affiliated with


class PersonalData(BaseModel):
    """A comprehensive representation of the user's personal data."""

    name: NameInfo = Field(default_factory=NameInfo)
    birth: BirthInfo = Field(default_factory=BirthInfo)
    contact: ContactInfo = Field(default_factory=ContactInfo)
    location: LocationInfo = Field(default_factory=LocationInfo)
    physical: PhysicalInfo = Field(default_factory=PhysicalInfo)
    professional: ProfessionalInfo = Field(default_factory=ProfessionalInfo)


class BrowsingData(BaseModel):
    """A basic initial representation of the user's browsing data."""

    url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None


class StructuredDataPacket(BaseModel):
    """Container for structured user data packets."""

    type: Literal["structured"] = "structured"  # Discriminator field
    personal_data: PersonalData = Field(
        default_factory=PersonalData
    )  # TODO: this might want to default to None
    browsing_data: BrowsingData = Field(
        default_factory=BrowsingData
    )  # TODO: this might want to default to None


class UnstructuredDataPacket(BaseModel):
    """Container for unstructured user data packets."""

    type: Literal["unstructured"] = "unstructured"  # Discriminator field
    tags: list[str] = Field(default_factory=list)  # List of tags to categorize the data
    data: Dict[str, Any] = Field(
        default_factory=dict
    )  # Flexible JSON blob for unstructured data


class DataPacket(BaseModel):
    """Top-level container for all types of data packets."""

    user_id: str  # Identifier for the user generating the data packet
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        frozen=True,  # This field cannot be modified after creation
    )
    timestamp: datetime = Field(
        default_factory=datetime.now,
        frozen=True,  # This field cannot be modified after creation
    )
    packet: Union[StructuredDataPacket, UnstructuredDataPacket] = Field(
        # Tell Pydantic to use the 'type' field to discriminate, avoiding any
        # ambiguity between the two types
        discriminator="type"
    )


class DataPacketSubmissionRequest(BaseModel):
    """Request model for data Packet submission."""

    request_id: str = Field(frozen=True)  # This field cannot be modified after creation
    data_packet: DataPacket  # The data packet to be submitted


class DataPacketUpdateRequest(BaseModel):
    """Model for updating a DataPacket with field masks."""

    # TODO: Consider adding a request_id field to the request. How would idempotency
    # be handled for updates? Do we care that much?

    # The data packet to be updated. The ID field must be set to identify
    # the data packet to be updated.
    data_packet: DataPacket

    # Field mask to specify which fields to update
    # Use dot notation for nested fields (e.g., "packet.personal_data.name.given_name")
    # If no mask is provided, all provided fields will be updated.
    update_mask: Set[str] = Field(default_factory=set)

    # TODO: I don't know how i feel about these living here, consider moving
    # to the storage or service layer.
    def _update_nested_field(self, obj: Any, path: List[str], value: Any) -> Any:
        """Recursively update a nested field in an object."""
        if len(path) == 1:
            # Base case: update the field
            return obj.model_copy(update={path[0]: value})

        # Get the current field value
        current = getattr(obj, path[0])
        if current is None:
            # If the field doesn't exist, create a new instance
            field_type = obj.model_fields[path[0]].annotation
            current = field_type()

        # Recursively update the nested field
        updated = self._update_nested_field(current, path[1:], value)
        return obj.model_copy(update={path[0]: updated})

    def apply_update(self, original: DataPacket) -> DataPacket:
        """Apply the update to the original packet, respecting the update mask."""
        if not self.update_mask:
            return self.data_packet

        result = original
        update_data = self.data_packet.model_dump(exclude_unset=True)

        # Process each field in the update mask
        for field_path in self.update_mask:
            # Split the path into parts (e.g., "packet.personal_data.name"
            # -> ["packet", "personal_data", "name"])
            path_parts = field_path.split(".")

            # Get the value from the update data
            value = update_data
            for part in path_parts:
                if part not in value:
                    raise ValueError(f"Field {field_path} not found in update data")
                value = value[part]

            # Apply the update
            result = self._update_nested_field(result, path_parts, value)

        return result


class DataPacketQueryParams(BaseModel):
    """Query parameters for filtering data packets."""

    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    from_timestamp: Optional[datetime] = Field(
        None, description="Filter by start timestamp"
    )
    to_timestamp: Optional[datetime] = Field(
        None, description="Filter by end timestamp"
    )
    packet_type: Optional[str] = Field(
        None, description="Filter by packet type (structured/unstructured)"
    )
    limit: int = Field(
        default=50, ge=1, le=100, description="Number of results to return"
    )
    offset: int = Field(default=0, ge=0, description="Number of results to skip")
    sort_order: str = Field(default="desc", description="Sort order (asc/desc)")
