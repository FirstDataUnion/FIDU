"""
Test the DataPacket API layer.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from ..api import DataPacketAPI
from ..schema import (
    DataPacketInternal,
    DataPacketCreate,
    DataPacketUpdate,
    DataPacketCreateRequest,
    DataPacketUpdateRequest,
    DataPacketQueryParams,
)
from ..service import DataPacketService
from ..exceptions import (
    DataPacketAlreadyExistsError,
    DataPacketNotFoundError,
    DataPacketValidationError,
    DataPacketPermissionError,
    DataPacketError,
)


@pytest.fixture
def mock_service():
    """Create a mock service object for testing."""
    return Mock(spec=DataPacketService)


@pytest.fixture
def app():
    """Create a FastAPI app for testing."""
    return FastAPI()


@pytest.fixture
def api(app, mock_service):
    """Create a DataPacketAPI instance with mocked service."""
    # Note that this fixture MUST be called before the test_client fixture
    # can be used as it sets up the API routes. Errors related to missing routes
    # are likly due to this not being called.
    return DataPacketAPI(app, mock_service)


@pytest.fixture
def test_client(app):
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_data_packet_create():
    """Create a sample data packet create model for testing."""
    return DataPacketCreate(
        id="test_packet_123",
        profile_id="test_profile_123",
        tags=["test", "sample"],
        data={"name": "Falco Lombardi", "type": "character"},
    )


@pytest.fixture
def sample_data_packet_internal():
    """Create a sample data packet for testing."""
    return DataPacketInternal(
        id="test_packet_123",
        profile_id="test_profile_123",
        create_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
        tags=["test", "sample"],
        data={"name": "Falco Lombardi", "type": "character"},
    )


@pytest.fixture
def sample_data_packet_update():
    """Create a sample data packet update model for testing."""
    return DataPacketUpdate(
        id="test_packet_123",
        tags=["test", "updated"],
        data={"name": "Fox McCloud", "type": "character"},
    )


@pytest.fixture
def sample_data_packet_internal_updated():
    """Create a sample data packet for testing."""
    return DataPacketInternal(
        id="test_packet_123",
        profile_id="test_profile_123",
        create_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2025, 6, 25, 12, 0, 0, tzinfo=timezone.utc),
        tags=["test", "updated"],
        data={"name": "Fox McCloud", "type": "character"},
    )


class TestExceptionHandlers:
    """Test cases for exception handlers."""

    def test_raises_404_if_data_packet_not_found(self, api, test_client, mock_service):
        """Test that exception handler raises a 404 if the data packet is not found."""
        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_id"
        )
        response = test_client.get("/api/v1/data-packets/test_packet_id")
        assert response.status_code == 404

    def test_raises_409_if_data_packet_already_exists(
        self, api, test_client, mock_service
    ):
        """Test that exception handler raises a 409 if the data packet already exists."""
        mock_service.get_data_packet.side_effect = DataPacketAlreadyExistsError(
            "Data packet already exists"
        )
        response = test_client.get("/api/v1/data-packets/test_packet_id")
        assert response.status_code == 409

    def test_raises_400_if_data_packet_validation_error(
        self, api, test_client, mock_service
    ):
        """Test that exception handler raises a 400 if the data packet validation error."""
        mock_service.get_data_packet.side_effect = DataPacketValidationError(
            "Data packet validation error"
        )
        response = test_client.get("/api/v1/data-packets/test_packet_id")
        assert response.status_code == 400

    def test_raises_403_if_data_packet_permission_error(
        self, api, test_client, mock_service
    ):
        """Test that exception handler raises a 403 if the data packet permission error."""
        mock_service.get_data_packet.side_effect = DataPacketPermissionError(
            data_packet_id="test_packet_id", user_id="test_user_id"
        )
        response = test_client.get("/api/v1/data-packets/test_packet_id")
        assert response.status_code == 403

    def test_raises_500_if_data_packet_error(self, api, test_client, mock_service):
        """Test that exception handler raises a 500 if the data packet error."""
        mock_service.get_data_packet.side_effect = DataPacketError("Data packet error")
        response = test_client.get("/api/v1/data-packets/test_packet_id")
        assert response.status_code == 500


class TestCreateDataPacket:
    """Test cases for creating data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_data_packet_create,
    ):
        """Test that create data packet passes the request to the service layer."""
        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        mock_service.create_data_packet.return_value = sample_data_packet_internal

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets", json=json_compatible_request
        )

        # Assert expectations

        # Data Packet passed to service layer not expected to have create
        # or update timestamp set.
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_internal.id,
            profile_id=sample_data_packet_internal.profile_id,
            tags=sample_data_packet_internal.tags,
            data=sample_data_packet_internal.data,
        )
        mock_service.create_data_packet.assert_called_once_with(
            request.request_id, expected_internal_data_packet
        )
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_data_packet_internal)

    def test_raises_422_if_request_id_is_missing(
        self, api, test_client, mock_service, sample_data_packet_create
    ):
        """Test that create data packet raises a 422 if the request id is missing."""
        # This will fail validation because request_id is required
        request_data = {"data_packet": jsonable_encoder(sample_data_packet_create)}
        response = test_client.post("/api/v1/data-packets", json=request_data)
        assert response.status_code == 422

    def test_raises_422_if_data_packet_is_missing(
        self, api, test_client, mock_service, sample_data_packet_create
    ):
        """Test that create data packet raises a 422 if the data packet is missing."""
        # This will fail validation because data_packet is required
        request_data = {"request_id": "req_123"}
        response = test_client.post("/api/v1/data-packets", json=request_data)
        assert response.status_code == 422

    def test_raises_409_if_data_packet_already_exists_error_raised_from_service(
        self, api, test_client, mock_service, sample_data_packet_create
    ):
        """Test that create data packet raises a 409 if the data packet already exists."""
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )
        mock_service.create_data_packet.side_effect = DataPacketAlreadyExistsError(
            "Data packet already exists"
        )
        response = test_client.post(
            "/api/v1/data-packets", json=jsonable_encoder(request)
        )
        assert response.status_code == 409


class TestUpdateDataPacket:
    """Test cases for updating data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal_updated,
        sample_data_packet_update,
    ):
        """Test that update data packet passes the request to the service layer."""
        # Prepare expected calls
        update_request = DataPacketUpdateRequest(
            request_id="req_456",
            data_packet=sample_data_packet_update,
        )
        mock_service.update_data_packet.return_value = (
            sample_data_packet_internal_updated
        )

        # Call update data packet
        json_compatible_request = jsonable_encoder(update_request)
        response = test_client.put(
            "/api/v1/data-packets/test_packet_id", json=json_compatible_request
        )

        # Assert expectations
        # Data Packet passed to service layer not expected to have create
        # or update timestamp set.
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_update.id,
            tags=sample_data_packet_update.tags,
            data=sample_data_packet_update.data,
        )
        mock_service.update_data_packet.assert_called_once_with(
            update_request.request_id, expected_internal_data_packet
        )
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_data_packet_internal_updated)

    def test_raises_404_if_data_packet_not_found(
        self, api, test_client, mock_service, sample_data_packet_update
    ):
        """Test that update data packet raises a 404 if the data packet is not found."""
        # Prepare expected calls
        update_request = DataPacketUpdateRequest(
            request_id="req_789",
            data_packet=sample_data_packet_update,
        )
        mock_service.update_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_id"
        )

        # Call update data packet
        json_compatible_request = jsonable_encoder(update_request)
        response = test_client.put(
            "/api/v1/data-packets/test_packet_id", json=json_compatible_request
        )

        # Assert expectations
        assert response.status_code == 404

    def test_raises_422_if_request_id_is_missing(
        self, api, test_client, mock_service, sample_data_packet_update
    ):
        """Test that update data packet raises a 422 if the request id is missing."""
        # This will fail validation because request_id is required
        request_data = {"data_packet": jsonable_encoder(sample_data_packet_update)}
        response = test_client.put(
            "/api/v1/data-packets/test_packet_id", json=request_data
        )
        assert response.status_code == 422

    def test_raises_422_if_data_packet_is_missing(
        self, api, test_client, mock_service, sample_data_packet_update
    ):
        """Test that update data packet raises a 422 if the data packet is missing."""
        # This will fail validation because data_packet is required
        request_data = {"request_id": "req_789"}
        response = test_client.put(
            "/api/v1/data-packets/test_packet_id", json=request_data
        )
        assert response.status_code == 422


class TestDeleteDataPacket:
    """Test cases for deleting data packets."""

    def test_passes_request_to_service(self, api, test_client, mock_service):
        """Test that delete data packet passes the request to the service layer."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.delete_data_packet.return_value = None

        # Call delete data packet
        response = test_client.delete(f"/api/v1/data-packets/{data_packet_id}")

        # Assert expectations
        mock_service.delete_data_packet.assert_called_once_with(data_packet_id)
        assert response.status_code == 200


class TestGetDataPacket:
    """Test cases for getting data packets."""

    def test_passes_request_to_service(
        self, api, test_client, mock_service, sample_data_packet_internal
    ):
        """Test that get data packet passes the request to the service layer."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.get_data_packet.return_value = sample_data_packet_internal

        # Call get data packet
        response = test_client.get(f"/api/v1/data-packets/{data_packet_id}")

        # Assert expectations
        mock_service.get_data_packet.assert_called_once_with(data_packet_id)
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_data_packet_internal)

    def test_raises_404_if_data_packet_not_found(self, api, test_client, mock_service):
        """Test that get data packet raises a 404 if the data packet is not found."""
        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            data_packet_id
        )

        # Call get data packet
        response = test_client.get(f"/api/v1/data-packets/{data_packet_id}")

        # Assert expectations
        assert response.status_code == 404


class TestListDataPackets:
    """Test cases for listing data packets."""

    def test_passes_request_to_service(
        self, api, test_client, mock_service, sample_data_packet_internal
    ):
        """Test that list data packets passes the request to the service layer."""
        # Prepare expected calls
        mock_service.list_data_packets.return_value = [sample_data_packet_internal]

        # Call list data packets
        response = test_client.get("/api/v1/data-packets")

        # Assert expectations
        mock_service.list_data_packets.assert_called_once()
        assert response.status_code == 200
        assert response.json() == jsonable_encoder([sample_data_packet_internal])

    def test_passes_request_to_service_with_all_params(
        self, api, test_client, mock_service, sample_data_packet_internal
    ):
        """Test that list data packets passes the request to the service layer with all params."""
        # Prepare expected calls
        mock_service.list_data_packets.return_value = [sample_data_packet_internal]

        # Call list data packets with all parameters
        response = test_client.get(
            "/api/v1/data-packets",
            params={
                "tags": ["test", "sample"],
                "profile_id": "test_profile_123",
                "from_timestamp": "2023-01-01T00:00:00",
                "to_timestamp": "2023-12-31T23:59:59",
                "limit": 10,
                "offset": 5,
                "sort_order": "asc",
            },
        )

        # Assert expectations
        mock_service.list_data_packets.assert_called_once()
        call_args = mock_service.list_data_packets.call_args[0][0]
        assert call_args.tags == ["test", "sample"]
        assert call_args.profile_id == "test_profile_123"
        assert call_args.limit == 10
        assert call_args.offset == 5
        assert call_args.sort_order == "asc"
        assert response.status_code == 200
        assert response.json() == jsonable_encoder([sample_data_packet_internal])

    def test_returns_multiple_expected_data_packets(
        self, api, test_client, mock_service
    ):
        """Test that list data packets returns multiple expected data packets."""
        # Prepare expected calls
        data_packet_1 = DataPacketInternal(
            id="packet_1",
            profile_id="profile_1",
            create_timestamp=datetime.now(timezone.utc),
            update_timestamp=datetime.now(timezone.utc),
            tags=["test"],
            data={"name": "Falco Lombardi"},
        )
        data_packet_2 = DataPacketInternal(
            id="packet_2",
            profile_id="profile_2",
            create_timestamp=datetime.now(timezone.utc),
            update_timestamp=datetime.now(timezone.utc),
            tags=["sample"],
            data={"name": "Fox McCloud"},
        )
        mock_service.list_data_packets.return_value = [data_packet_1, data_packet_2]

        # Call list data packets
        response = test_client.get("/api/v1/data-packets")

        # Assert expectations
        assert response.status_code == 200
        assert response.json() == jsonable_encoder([data_packet_1, data_packet_2])
