"""
Test the Profile API layer.
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from ..api import ProfileAPI
from ..schema import (
    Profile,
    ProfileInternal,
    CreateProfileRequest,
    ProfileCreate,
    ProfileQueryParams,
    ProfileQueryParamsInternal,
)
from ..service import ProfileService
from ..exceptions import (
    ProfileNotFoundError,
    ProfileIDAlreadyExistsError,
    ProfileUserAlreadyHasProfileError,
    ProfileError,
)
from ...security.jwt import TokenData


@pytest.fixture
def mock_service():
    """Create a mock service object for testing."""
    return Mock(spec=ProfileService)


@pytest.fixture
def app():
    """Create a FastAPI app for testing."""
    return FastAPI()


@pytest.fixture
def api(app, mock_service):
    """Create a ProfileAPI instance with mocked service."""
    return ProfileAPI(app, mock_service)


@pytest.fixture
def test_client(app):
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_token_data():
    """Create sample token data for testing."""
    return TokenData(user_id="test_user_123")


@pytest.fixture
def sample_profile():
    """Create a sample profile for testing."""
    return Profile(
        id="test_profile_123",
        user_id="test_user_123",
        name="Test Profile",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_internal():
    """Create a sample internal profile for testing."""
    return ProfileInternal(
        id="test_profile_123",
        user_id="test_user_123",
        name="Test Profile",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_2():
    """Create another sample profile for testing."""
    return Profile(
        id="test_profile_456",
        user_id="test_user_123",
        name="Another Profile",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_create():
    """Create a sample profile create model for testing."""
    return ProfileCreate(
        user_id="test_user_123",
        name="Test Profile",
    )


@pytest.fixture
def sample_create_profile_request(sample_profile_create):
    """Create a sample create profile request for testing."""
    return CreateProfileRequest(
        request_id="req_123",
        profile=sample_profile_create,
    )


class TestExceptionHandlers:
    """Test cases for exception handlers."""

    def test_raises_404_if_profile_not_found(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 404 if the profile is not found."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_profile.side_effect = ProfileNotFoundError("test_profile_id")

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/profiles/test_profile_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 404

    def test_raises_400_if_profile_id_already_exists(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 400 if a profile ID already exists."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.create_profile.side_effect = ProfileIDAlreadyExistsError(
            "test_profile_id"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/profiles",
                json={
                    "request_id": "req_123",
                    "profile": {"user_id": "test_user_123", "name": "Test Profile"},
                },
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 400

    def test_raises_400_if_user_already_has_profile(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 400 if a user already has a profile with the same name."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.create_profile.side_effect = ProfileUserAlreadyHasProfileError(
            "test_user_123", "Test Profile"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/profiles",
                json={
                    "request_id": "req_123",
                    "profile": {"user_id": "test_user_123", "name": "Test Profile"},
                },
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 400

    def test_raises_500_if_profile_error(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that exception handler raises a 500 if a general profile error occurs."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        mock_service.get_profile.side_effect = ProfileError("Profile error")

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/profiles/test_profile_id",
                headers={"Authorization": "Bearer test_token"},
            )

        assert exc_info.value.status_code == 500


class TestCreateProfile:
    """Test cases for creating profiles."""

    @patch("fidu_core.profiles.api.uuid.uuid4")
    def test_passes_request_to_service(
        self,
        mock_uuid,
        api,
        test_client,
        mock_service,
        sample_profile,
        sample_profile_internal,
        sample_create_profile_request,
        sample_token_data,
    ):
        """Test that create profile passes the request to the service layer."""
        # Arrange
        mock_uuid.return_value = "test_profile_123"
        mock_service.create_profile.return_value = sample_profile_internal
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)
        response = test_client.post(
            "/api/v1/profiles",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        # Create the expected internal profile with the mocked ID
        expected_internal_profile = ProfileInternal(
            **sample_create_profile_request.profile.model_dump(),
            id="test_profile_123",
        )

        mock_service.create_profile.assert_called_once_with(
            sample_create_profile_request.request_id,
            expected_internal_profile,
        )
        assert response.status_code == 200
        expected_response = Profile(
            **sample_profile_internal.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_400_if_profile_id_already_exists_error_raised_from_service(
        self,
        api,
        test_client,
        mock_service,
        sample_create_profile_request,
        sample_token_data,
    ):
        """Test that create profile raises a 400 if the service raises ProfileIDAlreadyExistsError."""
        # Arrange
        mock_service.create_profile.side_effect = ProfileIDAlreadyExistsError(
            "test_profile_id"
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/profiles",
                json=json_compatible_request,
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert
        assert exc_info.value.status_code == 400

    def test_raises_400_if_user_already_has_profile_error_raised_from_service(
        self,
        api,
        test_client,
        mock_service,
        sample_create_profile_request,
        sample_token_data,
    ):
        """Test that create profile raises a 400 if the service raises ProfileUserAlreadyHasProfileError."""
        # Arrange
        mock_service.create_profile.side_effect = ProfileUserAlreadyHasProfileError(
            "test_user_123", "Test Profile"
        )
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/profiles",
                json=json_compatible_request,
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert
        assert exc_info.value.status_code == 400

    def test_raises_422_if_request_id_is_missing(
        self, api, test_client, mock_service, sample_profile_create, sample_token_data
    ):
        """Test that create profile raises a 422 if the request id is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        # This will fail validation because request_id is required
        request_data = {"profile": jsonable_encoder(sample_profile_create)}
        response = test_client.post(
            "/api/v1/profiles",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_422_if_profile_is_missing(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that create profile raises a 422 if the profile is missing."""
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)
        # This will fail validation because profile is required
        request_data = {"request_id": "req_123"}
        response = test_client.post(
            "/api/v1/profiles",
            json=request_data,
            headers={"Authorization": "Bearer test_token"},
        )
        assert response.status_code == 422

    def test_raises_401_if_invalid_token(
        self, api, test_client, mock_service, sample_create_profile_request
    ):
        """Test that create profile raises a 401 if the token is invalid."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)
        response = test_client.post(
            "/api/v1/profiles",
            json=json_compatible_request,
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert
        assert response.status_code == 401

    def test_raises_403_if_user_id_mismatch(
        self,
        api,
        test_client,
        mock_service,
        sample_create_profile_request,
        sample_token_data,
    ):
        """Test that create profile raises a 403 if the user_id in request doesn't match token."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Create request with different user_id
        different_user_request = CreateProfileRequest(
            request_id="req_123",
            profile=ProfileCreate(
                user_id="different_user_456",
                name="Test Profile",
            ),
        )

        # Act
        json_compatible_request = jsonable_encoder(different_user_request)
        response = test_client.post(
            "/api/v1/profiles",
            json=json_compatible_request,
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        assert response.status_code == 403


class TestGetProfile:
    """Test cases for getting profiles."""

    def test_successful_get_profile(
        self,
        api,
        test_client,
        mock_service,
        sample_profile,
        sample_profile_internal,
        sample_token_data,
    ):
        """Test that get profile successfully retrieves a profile."""
        # Arrange
        mock_service.get_profile.return_value = sample_profile_internal
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        response = test_client.get(
            "/api/v1/profiles/test_profile_123",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        mock_service.get_profile.assert_called_once_with("test_profile_123")
        assert response.status_code == 200
        expected_response = Profile(
            **sample_profile_internal.model_dump(),
        )
        assert response.json() == jsonable_encoder(expected_response)

    def test_raises_404_if_profile_not_found(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that get profile raises a 404 if the profile is not found."""
        # Arrange
        mock_service.get_profile.side_effect = ProfileNotFoundError("test_profile_id")
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        with pytest.raises(HTTPException) as exc_info:
            test_client.get(
                "/api/v1/profiles/test_profile_id",
                headers={"Authorization": "Bearer test_token"},
            )

        # Assert
        assert exc_info.value.status_code == 404

    def test_raises_401_if_invalid_token(self, api, test_client, mock_service):
        """Test that get profile raises a 401 if the token is invalid."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act
        response = test_client.get(
            "/api/v1/profiles/test_profile_id",
            headers={"Authorization": "Bearer invalid_token"},
        )

        # Assert
        assert response.status_code == 401

    def test_raises_403_if_profile_belongs_to_different_user(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that get profile raises a 403 if the profile belongs to a different user."""
        # Arrange
        different_user_profile = ProfileInternal(
            id="test_profile_123",
            user_id="different_user_456",
            name="Test Profile",
            create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        )
        mock_service.get_profile.return_value = different_user_profile
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        response = test_client.get(
            "/api/v1/profiles/test_profile_123",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        assert response.status_code == 403


class TestListProfiles:
    """Test cases for listing profiles."""

    def test_successful_list_profiles(
        self,
        api,
        test_client,
        mock_service,
        sample_profile,
        sample_profile_2,
        sample_token_data,
    ):
        """Test that list profiles successfully retrieves all profiles."""
        # Arrange
        sample_profile_internal_1 = ProfileInternal(
            id="test_profile_123",
            user_id="test_user_123",
            name="Test Profile",
            create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        )
        sample_profile_internal_2 = ProfileInternal(
            id="test_profile_456",
            user_id="test_user_123",
            name="Another Profile",
            create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        )
        mock_service.list_profiles.return_value = [
            sample_profile_internal_1,
            sample_profile_internal_2,
        ]
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        response = test_client.get(
            "/api/v1/profiles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        mock_service.list_profiles.assert_called_once()
        call_args = mock_service.list_profiles.call_args[0][0]
        assert isinstance(call_args, ProfileQueryParamsInternal)
        assert call_args.user_id == sample_token_data.user_id
        assert response.status_code == 200
        expected_response = [
            Profile(**sample_profile_internal_1.model_dump()),
            Profile(**sample_profile_internal_2.model_dump()),
        ]
        assert response.json() == jsonable_encoder(expected_response)

    def test_returns_empty_list_when_no_profiles(
        self, api, test_client, mock_service, sample_token_data
    ):
        """Test that list profiles returns an empty list when no profiles exist."""
        # Arrange
        mock_service.list_profiles.return_value = []
        api.jwt_manager.verify_token_or_raise = Mock(return_value=sample_token_data)

        # Act
        response = test_client.get(
            "/api/v1/profiles", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        mock_service.list_profiles.assert_called_once()
        call_args = mock_service.list_profiles.call_args[0][0]
        assert isinstance(call_args, ProfileQueryParamsInternal)
        assert call_args.user_id == sample_token_data.user_id
        assert response.status_code == 200
        assert response.json() == []

    def test_raises_401_if_invalid_token(self, api, test_client, mock_service):
        """Test that list profiles raises a 401 if the token is invalid."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act
        response = test_client.get(
            "/api/v1/profiles", headers={"Authorization": "Bearer invalid_token"}
        )

        # Assert
        assert response.status_code == 401


class TestAPIInitialization:
    """Test cases for API initialization."""

    def test_api_initialization_sets_up_service(self, app, mock_service):
        """Test that API initialization sets up the service correctly."""
        api = ProfileAPI(app, mock_service)
        assert api.service == mock_service

    def test_api_initialization_sets_up_routes(self, app, mock_service):
        """Test that API initialization sets up the routes correctly."""
        api = ProfileAPI(app, mock_service)
        # Check that routes are added to the app
        routes = [route for route in app.routes if hasattr(route, "path")]
        assert len(routes) >= 3  # Should have at least 3 routes (create, get, list)
