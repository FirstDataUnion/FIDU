"""
Test the DataPacket API layer.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
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
    DataPacketQueryParamsInternal,
    DataPacket,
)
from ..service import DataPacketService
from ..exceptions import (
    DataPacketAlreadyExistsError,
    DataPacketNotFoundError,
    DataPacketValidationError,
    DataPacketPermissionError,
    DataPacketError,
)
from ...security.jwt import TokenData


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
def sample_token_data():
    """Create sample token data for testing."""
    return TokenData(user_id="test_user_123")


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
        user_id="test_user_123",
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
        user_id="test_user_123",
        create_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2025, 6, 25, 12, 0, 0, tzinfo=timezone.utc),
        tags=["test", "updated"],
        data={"name": "Fox McCloud", "type": "character"},
    )


class TestExceptionHandlers:
    """Test cases for exception handlers."""

    def test_raises_404_if_data_packet_not_found(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 404 if the data packet is not found."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_id"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/data-packets/test_packet_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 404

    def test_raises_409_if_data_packet_already_exists(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 409 if the data packet already exists."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_data_packet.side_effect = DataPacketAlreadyExistsError(
            "test_packet_id"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/data-packets/test_packet_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 409

    def test_raises_400_if_data_packet_validation_error(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 400 if the data packet validation error."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_data_packet.side_effect = DataPacketValidationError(
            "Data packet validation error"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/data-packets/test_packet_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 400

    def test_raises_403_if_data_packet_permission_error(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 403 if the data packet permission error."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_data_packet.side_effect = DataPacketPermissionError(
            "test_packet_id", "test_user_id"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/data-packets/test_packet_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 403

    def test_raises_500_if_data_packet_error(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 500 if a general data packet error occurs."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_data_packet.side_effect = DataPacketError("Data packet error")

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/data-packets/test_packet_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 500


class TestCreateDataPacket:
    """Test cases for creating data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_data_packet_create,
        sample_token_data,
    ):
        """Test that create data packet passes the request to the service layer."""
        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        mock_service.create_data_packet.return_value = sample_data_packet_internal
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        # Data Packet passed to service layer should have user_id set
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_internal.id,
            profile_id=sample_data_packet_internal.profile_id,
            user_id=sample_token_data.user_id,
            tags=sample_data_packet_internal.tags,
            data=sample_data_packet_internal.data,
        )
        mock_service.create_data_packet.assert_called_once_with(
            request.request_id, expected_internal_data_packet
        )
        assert response.status_code == 200
        expected_response = DataPacket(
            **sample_data_packet_internal.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_422_if_request_id_is_missing(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
        sample_token_data,
    ):
        """Test that create data packet raises a 422 if the request id is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        request_data = {"data_packet": jsonable_encoder(sample_data_packet_create)}
        response = test_client.post(
            "/api/v1/data-packets",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_422_if_data_packet_is_missing(
        self, api, test_client, mock_service, sample_data_packet_create
    ):
        """Test that create data packet raises a 422 if the data packet is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        request_data = {"request_id": "req_123"}
        response = test_client.post(
            "/api/v1/data-packets",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_409_if_data_packet_already_exists_error_raised_from_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
        sample_token_data,
    ):
        """Test that create data packet raises a 409 if the service raises DataPacketAlreadyExistsError."""
        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        mock_service.create_data_packet.side_effect = DataPacketAlreadyExistsError(
            "test_packet_123"
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/data-packets",
                json=json_compatible_request,
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert expectations
        assert exc_info.value.status_code == 409

    def test_raises_401_if_invalid_token(
        self, api, test_client, mock_service, sample_data_packet_create
    ):
        """Test that create data packet raises a 401 if the token is invalid."""
        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert expectations
        assert response.status_code == 401


class TestUpdateDataPacket:
    """Test cases for updating data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal_updated,
        sample_data_packet_update,
        sample_token_data,
    ):
        """Test that update data packet passes the request to the service layer."""
        # Prepare expected calls
        request = DataPacketUpdateRequest(
            request_id="req_123", data_packet=sample_data_packet_update
        )

        mock_service.update_data_packet.return_value = (
            sample_data_packet_internal_updated
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call update data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        # Data Packet passed to service layer should have user_id set
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_internal_updated.id,
            user_id=sample_token_data.user_id,
            tags=sample_data_packet_internal_updated.tags,
            data=sample_data_packet_internal_updated.data,
        )
        mock_service.update_data_packet.assert_called_once_with(
            request.request_id, expected_internal_data_packet
        )
        assert response.status_code == 200
        expected_response = DataPacket(
            **sample_data_packet_internal_updated.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_404_if_data_packet_not_found(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_update,
        sample_token_data,
    ):
        """Test that update data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Prepare expected calls
        request = DataPacketUpdateRequest(
            request_id="req_123", data_packet=sample_data_packet_update
        )

        mock_service.update_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_123"
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call update data packet
        json_compatible_request = jsonable_encoder(request)

        with pytest.raises(HTTPException) as exc_info:
            test_client.put(
                "/api/v1/data-packets/test_packet_123",
                json=json_compatible_request,
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert expectations
        assert exc_info.value.status_code == 404

    def test_raises_422_if_request_id_is_missing(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_update,
        sample_token_data,
    ):
        """Test that update data packet raises a 422 if the request id is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        request_data = {"data_packet": jsonable_encoder(sample_data_packet_update)}
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_422_if_data_packet_is_missing(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_update,
        sample_token_data,
    ):
        """Test that update data packet raises a 422 if the data packet is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        request_data = {"request_id": "req_123"}
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_401_if_invalid_token(
        self, api, test_client, mock_service, sample_data_packet_update
    ):
        """Test that update data packet raises a 401 if the token is invalid."""
        # Prepare expected calls
        request = DataPacketUpdateRequest(
            request_id="req_123", data_packet=sample_data_packet_update
        )

        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Call update data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=json_compatible_request,
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert expectations
        assert response.status_code == 401


class TestDeleteDataPacket:
    """Test cases for deleting data packets."""

    def test_passes_request_to_service(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that delete data packet passes the request to the service layer."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.delete_data_packet.return_value = None
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call delete data packet
        response = test_client.delete(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_service.delete_data_packet.assert_called_once_with(
            sample_token_data.user_id, data_packet_id
        )
        assert response.status_code == 200

    def test_raises_404_if_data_packet_not_found(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that delete data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_service.delete_data_packet.side_effect = DataPacketNotFoundError(
            data_packet_id
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call delete data packet
        with pytest.raises(HTTPException) as exc_info:
            test_client.delete(
                f"/api/v1/data-packets/{data_packet_id}",
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert expectations
        assert exc_info.value.status_code == 404

    def test_raises_401_if_invalid_token(self, api, test_client, mock_service):
        """Test that delete data packet raises a 401 if the token is invalid."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Call delete data packet
        response = test_client.delete(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert expectations
        assert response.status_code == 401


class TestGetDataPacket:
    """Test cases for getting data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_token_data,
    ):
        """Test that get data packet passes the request to the service layer."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.get_data_packet.return_value = sample_data_packet_internal
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call get data packet
        response = test_client.get(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_service.get_data_packet.assert_called_once_with(
            sample_token_data.user_id, data_packet_id
        )
        assert response.status_code == 200
        expected_response = DataPacket(
            **sample_data_packet_internal.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_404_if_data_packet_not_found(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that get data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            data_packet_id
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call get data packet
        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                f"/api/v1/data-packets/{data_packet_id}",
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert expectations
        assert exc_info.value.status_code == 404

    def test_raises_401_if_invalid_token(self, api, test_client, mock_service):
        """Test that get data packet raises a 401 if the token is invalid."""
        # Prepare expected calls
        data_packet_id = "test_packet_id"
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Call get data packet
        response = test_client.get(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert expectations
        assert response.status_code == 401


class TestListDataPackets:
    """Test cases for listing data packets."""

    def test_passes_request_to_service(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_token_data,
    ):
        """Test that list data packets passes the request to the service layer."""
        # Prepare expected calls
        expected_packets = [sample_data_packet_internal]
        mock_service.list_data_packets.return_value = expected_packets
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call list data packets
        response = test_client.get(
            "/api/v1/data-packets", headers={"Authorization": "Bearer test_token"}
        )

        # Assert expectations
        # Should call service with internal query params that include user_id
        mock_service.list_data_packets.assert_called_once()
        call_args = mock_service.list_data_packets.call_args[0][0]
        assert isinstance(call_args, DataPacketQueryParamsInternal)
        assert call_args.user_id == sample_token_data.user_id
        assert response.status_code == 200
        expected_response = [
            DataPacket(
                **packet.model_dump(),
            )
            for packet in expected_packets
        ]
        assert response.json() == jsonable_encoder(expected_response)

    def test_passes_request_to_service_with_all_params(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_token_data,
    ):
        """Test that list data packets passes the request to the service layer with all query parameters."""
        # Prepare expected calls
        expected_packets = [sample_data_packet_internal]
        mock_service.list_data_packets.return_value = expected_packets
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call list data packets with query parameters
        response = test_client.get(
            "/api/v1/data-packets?profile_id=test_profile&tags=test&tags=sample&from_timestamp=2023-01-01T00:00:00&to_timestamp=2023-12-31T23:59:59&limit=10&offset=0&sort_order=desc",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_service.list_data_packets.assert_called_once()
        call_args = mock_service.list_data_packets.call_args[0][0]
        assert isinstance(call_args, DataPacketQueryParamsInternal)
        assert call_args.user_id == sample_token_data.user_id
        assert call_args.profile_id == "test_profile"
        assert call_args.tags == ["test", "sample"]
        assert call_args.limit == 10
        assert call_args.offset == 0
        assert call_args.sort_order == "desc"
        assert response.status_code == 200
        expected_response = [
            DataPacket(
                **packet.model_dump(),
            )
            for packet in expected_packets
        ]
        assert response.json() == jsonable_encoder(expected_response)

    def test_returns_multiple_expected_data_packets(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that list data packets returns multiple expected data packets."""
        # Prepare expected calls
        expected_packets = [
            DataPacketInternal(
                id="test_packet_1",
                profile_id="test_profile_1",
                user_id="test_user_123",
                create_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
                update_timestamp=datetime(2025, 6, 24, 12, 0, 0, tzinfo=timezone.utc),
                tags=["test", "sample"],
                data={"name": "Falco Lombardi", "type": "character"},
            ),
            DataPacketInternal(
                id="test_packet_2",
                profile_id="test_profile_2",
                user_id="test_user_123",
                create_timestamp=datetime(2025, 6, 25, 12, 0, 0, tzinfo=timezone.utc),
                update_timestamp=datetime(2025, 6, 25, 12, 0, 0, tzinfo=timezone.utc),
                tags=["test", "updated"],
                data={"name": "Fox McCloud", "type": "character"},
            ),
        ]
        mock_service.list_data_packets.return_value = expected_packets
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Call list data packets
        response = test_client.get(
            "/api/v1/data-packets", headers={"Authorization": "Bearer test_token"}
        )

        # Assert expectations
        assert response.status_code == 200
        expected_response = [
            DataPacket(
                **packet.model_dump(),
            )
            for packet in expected_packets
        ]
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_401_if_invalid_token(self, api, test_client, mock_service):
        """Test that list data packets raises a 401 if the token is invalid."""
        # Prepare expected calls
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Call list data packets
        response = test_client.get(
            "/api/v1/data-packets", headers={"Authorization": "Bearer invalid_token"}
        )

        # Assert expectations
        assert response.status_code == 401
