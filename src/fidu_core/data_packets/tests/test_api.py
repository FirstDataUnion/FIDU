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
from ...identity_service.client import get_user_from_identity_service
from ...users.schema import IdentityServiceUser, IdentityServiceProfile


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
def sample_identity_service_user():
    """Create a sample identity service user for testing."""
    return IdentityServiceUser(
        id="test_user_123",
        name="John Doe",
        email="test@example.com",
        is_admin=False,
        is_active=True,
        is_locked=False,
        rate_limit_per_minute=60,
        rate_limit_per_hour=1000,
        last_login=None,
        login_count=5,
        created_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
        profiles=[
            IdentityServiceProfile(
                id="test_profile_123",
                user_id="test_user_123",
                display_name="Test Profile",
                is_active=True,
                created_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                updated_at=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
            )
        ],
    )


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

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_404_if_data_packet_not_found(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_token_data,
        sample_identity_service_user,
    ):
        """Test that exception handler returns a 404 if the data packet is not found."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_id"
        )

        response = test_client.get(
            "/api/v1/data-packets/test_packet_id",
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 404
        assert (
            response.json()["detail"]
            == "Data packet with ID 'test_packet_id' not found"
        )

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_409_if_data_packet_already_exists(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_token_data,
        sample_identity_service_user,
    ):
        """Test that exception handler returns a 409 if the data packet already exists."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        mock_service.get_data_packet.side_effect = DataPacketAlreadyExistsError(
            "test_packet_id"
        )

        response = test_client.get(
            "/api/v1/data-packets/test_packet_id",
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 409
        assert (
            response.json()["detail"]
            == "Data packet with ID 'test_packet_id' already exists"
        )

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_400_if_data_packet_validation_error(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_token_data,
        sample_identity_service_user,
    ):
        """Test that exception handler returns a 400 if the data packet validation error."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        mock_service.get_data_packet.side_effect = DataPacketValidationError(
            "Data packet validation error"
        )

        response = test_client.get(
            "/api/v1/data-packets/test_packet_id",
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Data packet validation error"

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_403_if_data_packet_permission_error(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_token_data,
        sample_identity_service_user,
    ):
        """Test that exception handler returns a 403 if the data packet permission error."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        mock_service.get_data_packet.side_effect = DataPacketPermissionError(
            "test_packet_id", "test_user_id"
        )

        response = test_client.get(
            "/api/v1/data-packets/test_packet_id",
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 403
        assert (
            response.json()["detail"]
            == "User 'test_user_id' does not have permission to access data packet 'test_packet_id'"
        )

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_500_if_data_packet_error(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_token_data,
        sample_identity_service_user,
    ):
        """Test that exception handler returns a 500 if a general data packet error occurs."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        mock_service.get_data_packet.side_effect = DataPacketError("Data packet error")

        response = test_client.get(
            "/api/v1/data-packets/test_packet_id",
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 500
        assert (
            response.json()["detail"]
            == "An unexpected error occurred while processing the data packet"
        )


class TestCreateDataPacket:
    """Test cases for creating data packets."""

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_data_packet_create,
        sample_identity_service_user,
    ):
        """Test that create data packet passes the request to the service layer."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        mock_service.create_data_packet.return_value = sample_data_packet_internal

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")

        # Data Packet passed to service layer should have user_id set
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_internal.id,
            profile_id=sample_data_packet_internal.profile_id,
            user_id=sample_identity_service_user.id,
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

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_403_if_identity_service_returns_none(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
    ):
        """Test that create data packet raises a 403 if identity service returns None."""
        # Mock the identity service to return None (unauthorized)
        mock_get_user.return_value = None

        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")
        assert response.status_code == 403
        assert response.json()["detail"] == "Profile ID not found"

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_403_if_profile_not_in_user_profiles(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
        sample_identity_service_user,
    ):
        """Test that create data packet raises a 403 if profile is not in user's profiles."""
        # Mock the identity service to return a user with different profiles
        user_without_profile = IdentityServiceUser(
            id="test_user_123",
            name="John Doe",
            email="test@example.com",
            is_admin=False,
            is_active=True,
            is_locked=False,
            rate_limit_per_minute=60,
            rate_limit_per_hour=1000,
            last_login=None,
            login_count=5,
            created_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            updated_at=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
            profiles=[
                IdentityServiceProfile(
                    id="different_profile_456",
                    user_id="test_user_123",
                    display_name="Different Profile",
                    is_active=True,
                    created_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
                    updated_at=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
                )
            ],
        )
        mock_get_user.return_value = user_without_profile

        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")
        assert response.status_code == 403
        assert response.json()["detail"] == "Profile ID not found"

    def test_raises_422_if_request_id_is_missing(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
    ):
        """Test that create data packet raises a 422 if the request id is missing."""
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
        request_data = {"request_id": "req_123"}
        response = test_client.post(
            "/api/v1/data-packets",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_409_if_data_packet_already_exists_error_raised_from_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_create,
        sample_identity_service_user,
    ):
        """Test that create data packet raises a 409 if the service raises DataPacketAlreadyExistsError."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        request = DataPacketCreateRequest(
            request_id="req_123", data_packet=sample_data_packet_create
        )

        mock_service.create_data_packet.side_effect = DataPacketAlreadyExistsError(
            "test_packet_123"
        )

        # Call create data packet
        json_compatible_request = jsonable_encoder(request)

        response = test_client.post(
            "/api/v1/data-packets",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        assert response.status_code == 409


class TestUpdateDataPacket:
    """Test cases for updating data packets."""

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal_updated,
        sample_data_packet_update,
        sample_identity_service_user,
    ):
        """Test that update data packet passes the request to the service layer."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        request = DataPacketUpdateRequest(
            request_id="req_123", data_packet=sample_data_packet_update
        )

        mock_service.update_data_packet.return_value = (
            sample_data_packet_internal_updated
        )

        # Call update data packet
        json_compatible_request = jsonable_encoder(request)
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")

        # Data Packet passed to service layer should have user_id set
        expected_internal_data_packet = DataPacketInternal(
            id=sample_data_packet_internal_updated.id,
            user_id=sample_identity_service_user.id,
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

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_404_if_data_packet_not_found(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_update,
        sample_identity_service_user,
    ):
        """Test that update data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        request = DataPacketUpdateRequest(
            request_id="req_123", data_packet=sample_data_packet_update
        )

        mock_service.update_data_packet.side_effect = DataPacketNotFoundError(
            "test_packet_123"
        )

        # Call update data packet
        json_compatible_request = jsonable_encoder(request)

        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        assert response.status_code == 404

    def test_raises_422_if_request_id_is_missing(
        self,
        api,
        test_client,
        mock_service,
        sample_data_packet_update,
    ):
        """Test that update data packet raises a 422 if the request id is missing."""
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
    ):
        """Test that update data packet raises a 422 if the data packet is missing."""
        request_data = {"request_id": "req_123"}
        response = test_client.put(
            "/api/v1/data-packets/test_packet_123",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422


class TestDeleteDataPacket:
    """Test cases for deleting data packets."""

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_identity_service_user,
    ):
        """Test that delete data packet passes the request to the service layer."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.delete_data_packet.return_value = None

        # Call delete data packet
        response = test_client.delete(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")
        mock_service.delete_data_packet.assert_called_once_with(
            sample_identity_service_user.id, data_packet_id
        )
        assert response.status_code == 200

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_404_if_data_packet_not_found(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_identity_service_user,
    ):
        """Test that delete data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_service.delete_data_packet.side_effect = DataPacketNotFoundError(
            data_packet_id
        )

        # Call delete data packet
        response = test_client.delete(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        assert response.status_code == 404


class TestGetDataPacket:
    """Test cases for getting data packets."""

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_identity_service_user,
    ):
        """Test that get data packet passes the request to the service layer."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        data_packet_id = "test_packet_id"
        mock_service.get_data_packet.return_value = sample_data_packet_internal

        # Call get data packet
        response = test_client.get(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")
        mock_service.get_data_packet.assert_called_once_with(
            sample_identity_service_user.id, data_packet_id
        )
        assert response.status_code == 200
        expected_response = DataPacket(
            **sample_data_packet_internal.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_raises_404_if_data_packet_not_found(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_identity_service_user,
    ):
        """Test that get data packet raises a 404 if the service raises DataPacketNotFoundError."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        data_packet_id = "nonexistent_packet_id"
        mock_service.get_data_packet.side_effect = DataPacketNotFoundError(
            data_packet_id
        )

        # Call get data packet
        response = test_client.get(
            f"/api/v1/data-packets/{data_packet_id}",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        assert response.status_code == 404


class TestListDataPackets:
    """Test cases for listing data packets."""

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_identity_service_user,
    ):
        """Test that list data packets passes the request to the service layer."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        expected_packets = [sample_data_packet_internal]
        mock_service.list_data_packets.return_value = expected_packets

        # Call list data packets
        response = test_client.get(
            "/api/v1/data-packets", headers={"Authorization": "Bearer test_token"}
        )

        # Assert expectations
        mock_get_user.assert_called_once_with("test_token")
        # Should call service with internal query params that include user_id
        mock_service.list_data_packets.assert_called_once()
        call_args = mock_service.list_data_packets.call_args[0][0]
        assert isinstance(call_args, DataPacketQueryParamsInternal)
        assert call_args.user_id == sample_identity_service_user.id
        assert response.status_code == 200
        expected_response = [
            DataPacket(
                **packet.model_dump(),
            )
            for packet in expected_packets
        ]
        assert response.json() == jsonable_encoder(expected_response)

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_passes_request_to_service_with_all_params(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_data_packet_internal,
        sample_identity_service_user,
    ):
        """Test that list data packets passes the request to the service layer with all query parameters."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

        # Prepare expected calls
        expected_packets = [sample_data_packet_internal]
        mock_service.list_data_packets.return_value = expected_packets

        # Call list data packets with query parameters
        response = test_client.get(
            "/api/v1/data-packets?profile_id=test_profile&tags=test&tags=sample&from_timestamp=2023-01-01T00:00:00&to_timestamp=2023-12-31T23:59:59&limit=10&offset=0&sort_order=desc",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert expectations
        mock_service.list_data_packets.assert_called_once()
        call_args = mock_service.list_data_packets.call_args[0][0]
        assert isinstance(call_args, DataPacketQueryParamsInternal)
        assert call_args.user_id == sample_identity_service_user.id
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

    @patch("fidu_core.data_packets.api.get_user_from_identity_service")
    def test_returns_multiple_expected_data_packets(
        self,
        mock_get_user,
        api,
        test_client,
        mock_service,
        sample_identity_service_user,
    ):
        """Test that list data packets returns multiple expected data packets."""
        # Mock the identity service to return a user
        mock_get_user.return_value = sample_identity_service_user

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
