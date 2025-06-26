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

    def test_raises_404_if_profile_not_found(self, api, test_client, mock_service):
        """Test that exception handler raises a 404 if the profile is not found."""
        mock_service.get_profile.side_effect = ProfileNotFoundError("test_profile_id")
        response = test_client.get("/api/v1/profiles/test_profile_id")
        assert response.status_code == 404

    def test_raises_400_if_profile_id_already_exists(
        self, api, test_client, mock_service
    ):
        """Test that exception handler raises a 400 if a profile ID already exists."""
        mock_service.create_profile.side_effect = ProfileIDAlreadyExistsError(
            "test_profile_id"
        )
        response = test_client.post(
            "/api/v1/profiles",
            json={
                "request_id": "req_123",
                "profile": {"user_id": "test_user_123", "name": "Test Profile"},
            },
        )
        assert response.status_code == 400

    def test_raises_400_if_user_already_has_profile(
        self, api, test_client, mock_service
    ):
        """Test that exception handler raises a 400 if a user already has a profile with the same name."""
        mock_service.create_profile.side_effect = ProfileUserAlreadyHasProfileError(
            "test_user_123", "Test Profile"
        )
        response = test_client.post(
            "/api/v1/profiles",
            json={
                "request_id": "req_123",
                "profile": {"user_id": "test_user_123", "name": "Test Profile"},
            },
        )
        assert response.status_code == 400

    def test_raises_500_if_profile_error(self, api, test_client, mock_service):
        """Test that exception handler raises a 500 if a general profile error occurs."""
        mock_service.get_profile.side_effect = ProfileError("Profile error")
        response = test_client.get("/api/v1/profiles/test_profile_id")
        assert response.status_code == 500


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
    ):
        """Test that create profile passes the request to the service layer."""
        # Arrange
        mock_uuid.return_value = "test_profile_123"
        mock_service.create_profile.return_value = sample_profile_internal

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)
        response = test_client.post("/api/v1/profiles", json=json_compatible_request)

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
        assert response.json() == jsonable_encoder(sample_profile)

    def test_raises_400_if_profile_id_already_exists_error_raised_from_service(
        self, api, test_client, mock_service, sample_create_profile_request
    ):
        """Test that create profile raises a 400 if the service raises ProfileIDAlreadyExistsError."""
        # Arrange
        mock_service.create_profile.side_effect = ProfileIDAlreadyExistsError(
            "test_profile_id"
        )

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)
        response = test_client.post("/api/v1/profiles", json=json_compatible_request)

        # Assert
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_raises_400_if_user_already_has_profile_error_raised_from_service(
        self, api, test_client, mock_service, sample_create_profile_request
    ):
        """Test that create profile raises a 400 if the service raises ProfileUserAlreadyHasProfileError."""
        # Arrange
        mock_service.create_profile.side_effect = ProfileUserAlreadyHasProfileError(
            "test_user_123", "Test Profile"
        )

        # Act
        json_compatible_request = jsonable_encoder(sample_create_profile_request)
        response = test_client.post("/api/v1/profiles", json=json_compatible_request)

        # Assert
        assert response.status_code == 400
        assert "already has a profile" in response.json()["detail"]

    def test_raises_422_if_request_id_is_missing(
        self, api, test_client, mock_service, sample_profile_create
    ):
        """Test that create profile raises a 422 if request_id is missing."""
        # Arrange
        invalid_request = {"profile": sample_profile_create.model_dump()}

        # Act
        response = test_client.post("/api/v1/profiles", json=invalid_request)

        # Assert
        assert response.status_code == 422

    def test_raises_422_if_profile_is_missing(self, api, test_client, mock_service):
        """Test that create profile raises a 422 if profile is missing."""
        # Arrange
        invalid_request = {"request_id": "req_123"}

        # Act
        response = test_client.post("/api/v1/profiles", json=invalid_request)

        # Assert
        assert response.status_code == 422


class TestGetProfile:
    """Test cases for getting a profile by ID."""

    def test_successful_get_profile(
        self, api, test_client, mock_service, sample_profile, sample_profile_internal
    ):
        """Test successful retrieval of a profile by ID."""
        # Arrange
        mock_service.get_profile.return_value = sample_profile_internal

        # Act
        response = test_client.get("/api/v1/profiles/test_profile_123")

        # Assert
        mock_service.get_profile.assert_called_once_with("test_profile_123")
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_profile)

    def test_raises_404_if_profile_not_found(self, api, test_client, mock_service):
        """Test that get profile raises a 404 if the profile is not found."""
        # Arrange
        mock_service.get_profile.side_effect = ProfileNotFoundError("test_profile_id")

        # Act
        response = test_client.get("/api/v1/profiles/test_profile_id")

        # Assert
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


class TestListProfiles:
    """Test cases for listing all profiles."""

    def test_successful_list_profiles(
        self, api, test_client, mock_service, sample_profile, sample_profile_2
    ):
        """Test successful listing of all profiles."""
        # Arrange
        mock_service.list_profiles.return_value = [
            ProfileInternal(**sample_profile.model_dump()),
            ProfileInternal(**sample_profile_2.model_dump()),
        ]

        # Act
        response = test_client.get(
            "/api/v1/profiles",
            params={
                "user_id": "test_user_123",
                "name": "Test Profile",
                "limit": 100,
                "offset": 10,
                "sort_order": "asc",
            },
        )

        # Assert
        expected_query_params = ProfileQueryParamsInternal(
            user_id="test_user_123",
            name="Test Profile",
            limit=100,
            offset=10,
            sort_order="asc",
        )
        mock_service.list_profiles.assert_called_once_with(expected_query_params)
        assert response.status_code == 200
        assert len(response.json()) == 2
        assert response.json()[0]["id"] == sample_profile.id
        assert response.json()[1]["id"] == sample_profile_2.id

    def test_returns_empty_list_when_no_profiles(self, api, test_client, mock_service):
        """Test that list profiles returns an empty list when no profiles exist."""
        # Arrange
        mock_service.list_profiles.return_value = []

        # Act
        response = test_client.get("/api/v1/profiles")

        # Assert
        expected_query_params = ProfileQueryParamsInternal(
            # default values only
            user_id="*",  # TODO: Placeholder for now, we need to get the current user from the token
            limit=50,
            offset=0,
            sort_order="desc",
        )
        mock_service.list_profiles.assert_called_once_with(expected_query_params)
        assert response.status_code == 200
        assert response.json() == []


class TestAPIInitialization:
    """Test cases for API initialization."""

    def test_api_initialization_sets_up_service(self, app, mock_service):
        """Test that API initialization properly sets up the service."""
        # Act
        api = ProfileAPI(app, mock_service)

        # Assert
        assert api.service == mock_service
        assert api.app == app

    def test_api_initialization_sets_up_routes(self, app, mock_service):
        """Test that API initialization sets up all the required routes."""
        # Act
        api = ProfileAPI(app, mock_service)

        # Assert
        # Check that routes are added to the app
        routes = [route for route in app.routes if hasattr(route, "path")]
        route_paths = [route.path for route in routes]

        assert "/api/v1/profiles" in route_paths  # POST and GET
        assert "/api/v1/profiles/{profile_id}" in route_paths  # GET
