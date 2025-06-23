"""
Test the DataPacketUpdateRequest model.
"""

import pytest
from datetime import datetime
from ..schema import (
    DataPacketUpdateRequest,
    DataPacket,
    StructuredDataPacket,
    UnstructuredDataPacket,
    PersonalData,
    NameInfo,
    BrowsingData,
    ContactInfo,
    LocationInfo,
)


@pytest.fixture
def original_structured_data_packet():
    """Create an original structured data packet for testing updates."""
    return DataPacket(
        user_id="test_user_123",
        id="original_packet_123",
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="John", family_name="Doe", pronouns="he/him")
            ),
            browsing_data=BrowsingData(
                url="https://original.com",
                title="Original Page",
                description="Original description",
            ),
        ),
    )


@pytest.fixture
def original_unstructured_data_packet():
    """Create an original unstructured data packet for testing updates."""
    return DataPacket(
        user_id="test_user_456",
        id="original_packet_456",
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        packet=UnstructuredDataPacket(
            tags=["original", "test"], data={"original_key": "original_value"}
        ),
    )


def test_data_packet_update_request_apply_update_updates_top_level_field(
    original_structured_data_packet,
):
    """Test that the DataPacketUpdateRequest.apply_update method updates top-level fields correctly."""
    # Arrange

    # Create update to user_id
    updated_packet = DataPacket(
        user_id="updated_user_123",
        id="original_packet_123",
        packet=original_structured_data_packet.packet,
    )

    update_request = DataPacketUpdateRequest(
        data_packet=updated_packet, update_mask={"user_id"}
    )

    # Act
    result = update_request.apply_update(original_structured_data_packet)

    # Assert
    # Check updated field
    assert result.user_id == "updated_user_123"


def test_data_packet_update_request_apply_update_updates_many_nested_fields(
    original_structured_data_packet,
):
    """Test that the DataPacketUpdateRequest.apply_update method updates many nested fields correctly."""
    # Arrange
    updated_packet = DataPacket(
        id="original_packet_123",
        user_id="test_user_123",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(
                    given_name="Jane", family_name="Smith", pronouns="she/her"
                ),
                contact=ContactInfo(
                    email="jane.smith@example.com", phone="+1234567890"
                ),
                location=LocationInfo(city="New York", country="USA"),
            ),
            browsing_data=BrowsingData(
                url="https://updated.com",
                title="Updated Page",
                description="Updated description",
            ),
        ),
    )

    update_request = DataPacketUpdateRequest(
        data_packet=updated_packet,
        update_mask={
            "packet.personal_data.name.given_name",
            "packet.personal_data.name.family_name",
            "packet.personal_data.contact.email",
            "packet.personal_data.location.city",
            "packet.browsing_data.url",
        },
    )

    # Act
    result = update_request.apply_update(original_structured_data_packet)

    # Assert
    assert result.packet.personal_data.name.given_name == "Jane"
    assert result.packet.personal_data.name.family_name == "Smith"
    assert result.packet.personal_data.contact.email == "jane.smith@example.com"
    assert result.packet.personal_data.location.city == "New York"
    assert result.packet.browsing_data.url == "https://updated.com"


def test_data_packet_update_request_doesnt_update_fields_not_in_update_mask(
    original_structured_data_packet,
):
    """Test that the DataPacketUpdateRequest.apply_update method doesn't update fields not in the update mask."""
    # Arrange
    updated_packet = DataPacket(
        user_id="updated_user_123",
        id="original_packet_123",
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(
                    given_name="Jane", family_name="Smith", pronouns="she/her"
                )
            ),
            browsing_data=BrowsingData(url="https://updated.com", title="Updated Page"),
        ),
    )

    update_request = DataPacketUpdateRequest(
        data_packet=updated_packet,
        update_mask={"packet.personal_data.name.given_name"},  # Only update given_name
    )

    # Act
    result = update_request.apply_update(original_structured_data_packet)

    # Assert
    # Check updated field
    assert result.packet.personal_data.name.given_name == "Jane"

    # All other fields should remain unchanged
    assert result.packet.personal_data.name.family_name == "Doe"
    assert result.packet.personal_data.name.pronouns == "he/him"
    assert result.packet.browsing_data.url == "https://original.com"
    assert result.packet.browsing_data.title == "Original Page"


def test_data_packet_update_request_apply_update_with_empty_update_mask_returns_original_packet(
    original_structured_data_packet,
):
    """Test that the DataPacketUpdateRequest.apply_update method returns the original packet when update mask is empty."""
    # Arrange
    updated_packet = DataPacket(
        user_id="updated_user_123",
        id="original_packet_123",
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Jane", family_name="Smith")
            )
        ),
    )

    update_request = DataPacketUpdateRequest(
        data_packet=updated_packet, update_mask=set()
    )

    # Act
    result = update_request.apply_update(original_structured_data_packet)

    # Assert
    assert result == updated_packet
    assert result.user_id == "updated_user_123"
    assert result.packet.personal_data.name.given_name == "Jane"
    assert result.packet.personal_data.name.family_name == "Smith"


def test_data_packet_update_request_apply_update_with_invalid_field_path_raises_value_error(
    original_structured_data_packet,
):
    """Test that the DataPacketUpdateRequest.apply_update method raises ValueError for invalid field paths."""
    # Arrange
    updated_packet = DataPacket(
        user_id="test_user_123",
        id="original_packet_123",
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        packet=original_structured_data_packet.packet,
    )

    update_request = DataPacketUpdateRequest(
        data_packet=updated_packet, update_mask={"invalid.field.path"}
    )

    # Act & Assert
    with pytest.raises(
        ValueError, match="Field invalid.field.path not found in update data"
    ):
        update_request.apply_update(original_structured_data_packet)
