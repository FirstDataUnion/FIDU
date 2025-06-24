"""
Test the DataPacket service layer.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from ..service import DataPacketService
from ..schema import (
    DataPacketInternal,
    DataPacketQueryParams,
)
from ..store import DataPacketStoreInterface
from ..exceptions import DataPacketNotFoundError, DataPacketAlreadyExistsError


@pytest.fixture
def mock_store():
    """Create a mock store object for testing."""
    return Mock(spec=DataPacketStoreInterface)


@pytest.fixture
def service(mock_store):
    """Create a DataPacketService object for testing."""
    return DataPacketService(mock_store)

@pytest.fixture
def sample_timestamp():
    """Create a sample timestamp for testing."""
    return datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc)

@pytest.fixture
def sample_data_packet_internal():
    """Create a sample data packet for testing."""
    return DataPacketInternal(
        id="test_packet_123",
        profile_id="test_profile_123",
        tags=["test", "sample"],
        data={"name": "Falco Lombardi", "type": "character"}
    )

class TestCreateDataPacket:
    """Test cases for creating data packets."""

    @patch.object(DataPacketService, '_get_current_timestamp')
    def test_sets_timestamps_and_passes_to_store(self, mock_get_current_timestamp, service, mock_store, sample_data_packet_internal, sample_timestamp):
        """Test that create data packet sets timestamps and passes to store."""
        # Prepare expected calls
        expected_data_packet = sample_data_packet_internal.model_copy(
            update={"create_timestamp": sample_timestamp, "update_timestamp": sample_timestamp}
        )
        mock_store.store_data_packet.return_value = expected_data_packet
        mock_get_current_timestamp.return_value = sample_timestamp
        request_id = "req_123"

        # Call create data packet
        result = service.create_data_packet(request_id, sample_data_packet_internal)

        # Assert expectations
        mock_get_current_timestamp.assert_called()
        mock_store.store_data_packet.assert_called_once_with(request_id, expected_data_packet)
        assert result == expected_data_packet

    @patch.object(DataPacketService, '_get_current_timestamp')
    def test_raises_already_exists_error_when_store_raises_key_error(self, mock_get_current_timestamp, service, mock_store, sample_data_packet_internal, sample_timestamp):
        """Test that create data packet raises DataPacketAlreadyExistsError when store raises KeyError."""
        # Prepare expected calls
        mock_store.store_data_packet.side_effect = DataPacketAlreadyExistsError("Data packet already exists")
        mock_get_current_timestamp.return_value = sample_timestamp
        request_id = "req_123"

        # Call create data packet and expect exception
        with pytest.raises(DataPacketAlreadyExistsError):
            service.create_data_packet(request_id, sample_data_packet_internal)

        # Assert expectations
        mock_get_current_timestamp.assert_called()
        expected_data_packet = sample_data_packet_internal.model_copy(
            update={"create_timestamp": sample_timestamp, "update_timestamp": sample_timestamp}
        )
        mock_store.store_data_packet.assert_called_once_with(request_id, expected_data_packet)


class TestUpdateDataPacket:
    """Test cases for updating data packets."""

    @patch.object(DataPacketService, '_get_current_timestamp')
    def test_sets_update_timestamp_and_passes_to_store(self, mock_get_current_timestamp, service, mock_store, sample_data_packet_internal, sample_timestamp):
        """Test that update data packet sets update timestamp and passes to store."""
        # Prepare expected calls
        request_id = "req_123"
        expected_updated_packet = sample_data_packet_internal.model_copy(
            update={"update_timestamp": sample_timestamp}
        )
        mock_get_current_timestamp.return_value = sample_timestamp
        mock_store.update_data_packet.return_value = expected_updated_packet

        # Call update data packet
        result = service.update_data_packet(request_id, sample_data_packet_internal)

        # Assert expectations
        mock_get_current_timestamp.assert_called()
        mock_store.update_data_packet.assert_called_once_with(request_id, expected_updated_packet)
        assert result == expected_updated_packet

    @patch.object(DataPacketService, '_get_current_timestamp')
    def test_raises_not_found_error_when_store_raises_key_error(self, mock_get_current_timestamp, service, mock_store, sample_data_packet_internal, sample_timestamp):
        """Test that update data packet raises DataPacketNotFoundError when store raises KeyError."""
        # Prepare expected calls
        request_id = "req_123"
        mock_get_current_timestamp.return_value = sample_timestamp
        mock_store.update_data_packet.side_effect = DataPacketNotFoundError("Data packet not found")

        # Call update data packet and expect exception
        with pytest.raises(DataPacketNotFoundError):
            service.update_data_packet(request_id, sample_data_packet_internal)

        # Assert expectations
        mock_get_current_timestamp.assert_called()
        expected_updated_packet = sample_data_packet_internal.model_copy(
            update={"update_timestamp": sample_timestamp}
        )
        mock_store.update_data_packet.assert_called_once_with(request_id, expected_updated_packet)


class TestGetDataPacket:
    """Test cases for getting data packets."""

    def test_passes_to_store(self, service, mock_store, sample_data_packet_internal):
        """Test that get data packet passes the ID to the store."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_store.get_data_packet.return_value = sample_data_packet_internal

        # Call get data packet
        result = service.get_data_packet(data_packet_id)

        # Assert expectations
        mock_store.get_data_packet.assert_called_once_with(data_packet_id)
        assert result == sample_data_packet_internal

    def test_raises_not_found_error_when_store_raises_key_error(self, service, mock_store):
        """Test that get data packet raises DataPacketNotFoundError when store raises KeyError."""
        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_store.get_data_packet.side_effect = DataPacketNotFoundError("Data packet not found")

        # Call get data packet and expect exception
        with pytest.raises(DataPacketNotFoundError):
            service.get_data_packet(data_packet_id)

        # Assert expectations
        mock_store.get_data_packet.assert_called_once_with(data_packet_id)


class TestListDataPackets:
    """Test cases for listing data packets."""

    def test_passes_to_store(self, service, mock_store, sample_data_packet_internal):
        """Test that list data packets passes the query params to the store."""
        # Prepare expected calls
        query_params = DataPacketQueryParams(
            profile_id="test_profile_123",
            tags=["test"],
            limit=10,
            offset=0,
        )
        expected_packets = [sample_data_packet_internal]
        mock_store.list_data_packets.return_value = expected_packets

        # Call list data packets
        result = service.list_data_packets(query_params)

        # Assert expectations
        mock_store.list_data_packets.assert_called_once_with(query_params)
        assert result == expected_packets

    def test_returns_empty_list_when_store_returns_empty(self, service, mock_store):
        """Test that list data packets returns empty list when store returns empty."""
        # Prepare expected calls
        query_params = DataPacketQueryParams(
            profile_id="test_profile_123",
            limit=10,
            offset=0,
        )
        mock_store.list_data_packets.return_value = []

        # Call list data packets
        result = service.list_data_packets(query_params)

        # Assert expectations
        mock_store.list_data_packets.assert_called_once_with(query_params)
        assert result == []


class TestDeleteDataPacket:
    """Test cases for deleting data packets."""

    def test_passes_to_store(self, service, mock_store):
        """Test that delete data packet passes the ID to the store."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_store.delete_data_packet.return_value = None

        # Call delete data packet
        service.delete_data_packet(data_packet_id)

        # Assert expectations
        mock_store.delete_data_packet.assert_called_once_with(data_packet_id)

    def test_raises_not_found_error_when_store_raises_key_error(self, service, mock_store):
        """Test that delete data packet raises DataPacketNotFoundError when store raises KeyError."""
        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_store.delete_data_packet.side_effect = DataPacketNotFoundError("Data packet not found")

        # Call delete data packet and expect exception
        with pytest.raises(DataPacketNotFoundError):
            service.delete_data_packet(data_packet_id)

        # Assert expectations
        mock_store.delete_data_packet.assert_called_once_with(data_packet_id)
