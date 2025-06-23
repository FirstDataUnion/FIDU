"""
Test the DataPacketService layer.
"""

from unittest.mock import Mock
import pytest
from datetime import datetime
from ..store.store import DataPacketStoreInterface
from ..service import DataPacketService
from ..schema import (
    DataPacket,
    StructuredDataPacket,
    UnstructuredDataPacket,
    PersonalData,
    NameInfo,
    BrowsingData,
    DataPacketUpdateRequest,
    DataPacketQueryParams,
)


@pytest.fixture
def mock_store():
    """Create a mock storage object for testing."""
    return Mock(spec=DataPacketStoreInterface)


@pytest.fixture
def service(mock_store):
    """Create a DataPacketService object for testing."""
    return DataPacketService(mock_store)


@pytest.fixture
def sample_structured_data_packet():
    """Create a sample structured data packet for testing."""
    return DataPacket(
        user_id="test_user_123",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="John", family_name="Doe", pronouns="he/him")
            ),
            browsing_data=BrowsingData(
                url="https://example.com",
                title="Example Page",
                description="A test page for testing",
            ),
        ),
    )


@pytest.fixture
def sample_unstructured_data_packet():
    """Create a sample unstructured data packet for testing."""
    return DataPacket(
        user_id="test_user_456",
        packet=UnstructuredDataPacket(
            tags=["test", "sample"], data={"key1": "value1", "key2": 42}
        ),
    )


def test_submit_data_packet_calls_store_with_correct_data(
    service, mock_store, sample_structured_data_packet
):
    """Test that the service calls the store with the correct data for structured packets."""
    # Arrange
    mock_store.store_data_packet.return_value = sample_structured_data_packet

    # Act
    result = service.submit_data_packet(sample_structured_data_packet)

    # Assert
    mock_store.store_data_packet.assert_called_once_with(sample_structured_data_packet)
    assert result == sample_structured_data_packet


def test_submit_data_packet_calls_store_with_unstructured_data(
    service, mock_store, sample_unstructured_data_packet
):
    """Test that the service calls the store with the correct data for unstructured packets."""
    # Arrange
    mock_store.store_data_packet.return_value = sample_unstructured_data_packet

    # Act
    result = service.submit_data_packet(sample_unstructured_data_packet)

    # Assert
    mock_store.store_data_packet.assert_called_once_with(
        sample_unstructured_data_packet
    )
    assert result == sample_unstructured_data_packet


def test_get_data_packet_calls_store_with_correct_data(
    service, mock_store, sample_structured_data_packet
):
    """Test that the service calls the store with the correct data packet ID."""
    # Arrange
    data_packet_id = "test_packet_123"
    mock_store.get_data_packet.return_value = sample_structured_data_packet

    # Act
    result = service.get_data_packet(data_packet_id)

    # Assert
    mock_store.get_data_packet.assert_called_once_with(data_packet_id)
    assert result == sample_structured_data_packet


def test_update_data_packet_calls_store_with_correct_data(
    service, mock_store, sample_structured_data_packet
):
    """Test that the service calls the store with the correct update request."""
    # Arrange
    update_request = DataPacketUpdateRequest(
        data_packet=sample_structured_data_packet,
        update_mask={"packet.personal_data.name.given_name"},
    )
    mock_store.update_data_packet.return_value = sample_structured_data_packet

    # Act
    result = service.update_data_packet(update_request)

    # Assert
    mock_store.update_data_packet.assert_called_once_with(update_request)
    assert result == sample_structured_data_packet


def test_list_data_packets_calls_store_with_correct_data(
    service, mock_store, sample_structured_data_packet, sample_unstructured_data_packet
):
    """Test that the service calls the store with the correct query parameters."""
    # Arrange
    query_params = DataPacketQueryParams(
        user_id="test_user_123", tags=["test"], limit=10, offset=0, sort_order="desc"
    )
    expected_packets = [sample_structured_data_packet, sample_unstructured_data_packet]
    mock_store.list_data_packets.return_value = expected_packets

    # Act
    result = service.list_data_packets(query_params)

    # Assert
    mock_store.list_data_packets.assert_called_once_with(query_params)
    assert result == expected_packets


def test_list_data_packets_with_minimal_query_params_calls_store_with_correct_data(
    service, mock_store
):
    """Test that the service calls the store with minimal query parameters."""
    # Arrange
    query_params = DataPacketQueryParams()  # Use defaults
    expected_packets = []
    mock_store.list_data_packets.return_value = expected_packets

    # Act
    result = service.list_data_packets(query_params)

    # Assert
    mock_store.list_data_packets.assert_called_once_with(query_params)
    assert result == expected_packets


def test_list_data_packets_with_all_query_params_calls_store_with_correct_data(
    service, mock_store
):
    """Test that the service calls the store with all query parameters."""
    # Arrange
    query_params = DataPacketQueryParams(
        user_id="test_user_123",
        tags=["test", "sample"],
        from_timestamp=datetime(2025, 1, 1),
        to_timestamp=datetime(2025, 1, 2),
        packet_type="structured",
        limit=10,
        offset=0,
        sort_order="desc",
    )
    expected_packets = []
    mock_store.list_data_packets.return_value = expected_packets

    # Act
    result = service.list_data_packets(query_params)

    # Assert
    mock_store.list_data_packets.assert_called_once_with(query_params)
    assert result == expected_packets


def test_delete_data_packet_calls_store_with_correct_data(service, mock_store):
    """Test that the service calls the store with the correct data packet ID for deletion."""
    # Arrange
    data_packet_id = "test_packet_123"
    mock_store.delete_data_packet.return_value = None

    # Act
    service.delete_data_packet(data_packet_id)

    # Assert
    mock_store.delete_data_packet.assert_called_once_with(data_packet_id)
