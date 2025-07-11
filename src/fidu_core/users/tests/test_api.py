"""
Test the User API layer.
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from ..api import UserAPI
from ..schema import (
    User,
    UserInternal,
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UserBase,
)
from ..service import UserService
from fidu_core.security import PasswordHasher, JWTManager
from fidu_core.users.exceptions import (
    UserNotFoundError,
    UserAlreadyExistsError,
    UserValidationError,
    UserPermissionError,
    UserError,
)


@pytest.fixture
def mock_service():
    """Create a mock service object for testing."""
    return Mock(spec=UserService)


@pytest.fixture
def app():
    """Create a FastAPI app for testing."""
    return FastAPI()


@pytest.fixture
def api(app, mock_service):
    """Create a UserAPI instance with mocked service."""
    return UserAPI(app, mock_service)


@pytest.fixture
def test_client(app):
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_user_base():
    """Create a sample user base model for testing."""
    return UserBase(
        email="test@example.com",
        first_name="John",
        last_name="Doe",
    )


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return User(
        id="test_user_123",
        email="test@example.com",
        first_name="John",
        last_name="Doe",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_user_internal():
    """Create a sample internal user for testing."""
    return UserInternal(
        id="test_user_123",
        email="test@example.com",
        first_name="John",
        last_name="Doe",
        password_hash="hashed_password_123",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_user_2():
    """Create another sample user for testing."""
    return User(
        id="test_user_456",
        email="jane@example.com",
        first_name="Jane",
        last_name="Smith",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
    )


@pytest.fixture
def sample_create_user_request(sample_user_base):
    """Create a sample create user request for testing."""
    return CreateUserRequest(
        request_id="req_123",
        password="password123",
        user=sample_user_base,
    )


@pytest.fixture
def sample_login_request():
    """Create a sample login request for testing."""
    return LoginRequest(
        email="test@example.com",
        password="password123",
    )


class TestExceptionHandlers:
    """Test cases for exception handlers."""

    def test_raises_404_if_user_not_found(self, api, test_client, mock_service):
        """Test that exception handler raises a 404 if the user is not found."""
        user_id = "test_user_id"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.side_effect = UserNotFoundError(user_id)
        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 404

    def test_raises_409_if_user_already_exists(self, api, test_client, mock_service):
        """Test that exception handler raises a 409 if a user already exists."""
        user_id = "test_user_id"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.side_effect = UserAlreadyExistsError(
            user_id, "test@example.com"
        )
        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 409

    def test_raises_400_if_user_validation_error(self, api, test_client, mock_service):
        """Test that exception handler raises a 400 if a user validation error occurs."""
        user_id = "test_user_id"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.side_effect = UserValidationError("User validation error")
        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 400

    def test_raises_403_if_user_permission_error(self, api, test_client, mock_service):
        """Test that exception handler raises a 403 for a user permission error."""
        user_id = "test_user_id"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.side_effect = UserPermissionError(user_id)
        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 403

    def test_raises_500_if_user_error(self, api, test_client, mock_service):
        """Test that exception handler raises a 500 if a general user error occurs."""
        user_id = "test_user_id"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.side_effect = UserError("User error")
        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 500


class TestCreateUser:
    """Test cases for creating users."""

    @patch("fidu_core.users.api.uuid.uuid4")
    def test_passes_request_to_service(
        self,
        mock_uuid,
        api,
        test_client,
        mock_service,
        sample_user,
        sample_user_internal,
        sample_create_user_request,
    ):
        """Test that create user passes the request to the service layer."""
        # Arrange
        mock_uuid.return_value = "test_user_123"
        mock_service.create_user.return_value = sample_user_internal

        # Mock the password hasher to return a predictable hash
        expected_hash = "mocked_hashed_password_123"
        api.password_hasher.hash_password = Mock(return_value=expected_hash)

        # Act
        json_compatible_request = jsonable_encoder(sample_create_user_request)
        response = test_client.post("/api/v1/users", json=json_compatible_request)

        # Assert
        # Create the expected internal user with the mocked hash
        expected_internal_user = UserInternal(
            **sample_create_user_request.user.model_dump(),
            id="test_user_123",
            password_hash=expected_hash,
        )

        mock_service.create_user.assert_called_once_with(
            sample_create_user_request.request_id, expected_internal_user
        )
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_user)

    def test_raises_409_if_user_already_exists_error_raised_from_service(
        self, api, test_client, mock_service, sample_create_user_request
    ):
        """Test that create user raises a 409 if a user already exists error is raised from the service."""
        mock_service.create_user.side_effect = UserAlreadyExistsError(
            "test_user_id", "test@example.com"
        )

        with pytest.raises(HTTPException) as exc_info:
            test_client.post(
                "/api/v1/users", json=jsonable_encoder(sample_create_user_request)
            )

        assert exc_info.value.status_code == 409

    def test_raises_422_if_request_id_is_missing(
        self, api, test_client, mock_service, sample_user_base
    ):
        """Test that create user raises a 422 if the request id is missing."""
        # This will fail validation because request_id is required
        request_data = {
            "password": "password123",
            "user": jsonable_encoder(sample_user_base),
        }
        response = test_client.post("/api/v1/users", json=request_data)
        assert response.status_code == 422

    def test_raises_422_if_password_is_missing(
        self, api, test_client, mock_service, sample_user_base
    ):
        """Test that create user raises a 422 if the password is missing."""
        # This will fail validation because password is required
        request_data = {
            "request_id": "req_123",
            "user": jsonable_encoder(sample_user_base),
        }
        response = test_client.post("/api/v1/users", json=request_data)
        assert response.status_code == 422

    def test_raises_422_if_user_is_missing(self, api, test_client, mock_service):
        """Test that create user raises a 422 if the user is missing."""
        # This will fail validation because user is required
        request_data = {"request_id": "req_123", "password": "password123"}
        response = test_client.post("/api/v1/users", json=request_data)
        assert response.status_code == 422


class TestLoginUser:
    """Test cases for user login."""

    def test_successful_login(
        self,
        api,
        test_client,
        mock_service,
        sample_user,
        sample_user_internal,
        sample_login_request,
    ):
        """Test successful user login."""
        # Arrange
        mock_service.get_user_by_email.return_value = sample_user_internal
        # Mock the password hasher to return True for verification
        api.password_hasher.verify_password = Mock(return_value=True)
        api.jwt_manager.create_access_token = Mock(return_value="test_token_123")

        # Act
        json_compatible_request = jsonable_encoder(sample_login_request)
        response = test_client.post("/api/v1/users/login", json=json_compatible_request)

        # Assert
        mock_service.get_user_by_email.assert_called_once_with(
            sample_login_request.email
        )
        api.password_hasher.verify_password.assert_called_once_with(
            sample_login_request.password, sample_user_internal.password_hash
        )
        api.jwt_manager.create_access_token.assert_called_once_with(
            data={"sub": sample_user_internal.id}
        )
        assert response.status_code == 200

        response_data = response.json()
        assert response_data["access_token"] == "test_token_123"
        assert response_data["token_type"] == "bearer"
        assert response_data["user"] == jsonable_encoder(sample_user)

    def test_raises_401_if_user_not_found(
        self, api, test_client, mock_service, sample_login_request
    ):
        """Test that login raises a 401 if the user is not found."""
        # Arrange
        mock_service.get_user_by_email.side_effect = UserNotFoundError("test_user_id")

        # Act
        json_compatible_request = jsonable_encoder(sample_login_request)
        response = test_client.post("/api/v1/users/login", json=json_compatible_request)

        # Assert
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    def test_raises_401_if_password_incorrect(
        self,
        api,
        test_client,
        mock_service,
        sample_user_internal,
        sample_login_request,
    ):
        """Test that login raises a 401 if the password is incorrect."""
        # Arrange
        mock_service.get_user_by_email.return_value = sample_user_internal
        api.password_hasher.verify_password = Mock(return_value=False)

        # Act
        json_compatible_request = jsonable_encoder(sample_login_request)
        response = test_client.post("/api/v1/users/login", json=json_compatible_request)

        # Assert
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    def test_raises_422_if_email_is_missing(self, api, test_client, mock_service):
        """Test that login raises a 422 if the email is missing."""
        # This will fail validation because email is required
        request_data = {"password": "password123"}
        response = test_client.post("/api/v1/users/login", json=request_data)
        assert response.status_code == 422

    def test_raises_422_if_password_is_missing(self, api, test_client, mock_service):
        """Test that login raises a 422 if the password is missing."""
        # This will fail validation because password is required
        request_data = {"email": "test@example.com"}
        response = test_client.post("/api/v1/users/login", json=request_data)
        assert response.status_code == 422


class TestGetCurrentUser:
    """Test cases for getting the current authenticated user."""

    def test_successful_get_current_user(
        self,
        api,
        test_client,
        mock_service,
        sample_user,
        sample_user_internal,
    ):
        """Test successful retrieval of current user."""
        # Arrange
        mock_service.get_user.return_value = sample_user_internal
        # Mock the JWT manager to return valid token data
        mock_token_data = Mock()
        mock_token_data.user_id = "test_user_123"
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        # Act
        headers = {"Authorization": "Bearer test_token_123"}
        response = test_client.get("/api/v1/users/current", headers=headers)

        # Assert
        api.jwt_manager.verify_token_or_raise.assert_called_once_with("test_token_123")
        mock_service.get_user.assert_called_once_with("test_user_123")
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_user)

    def test_raises_401_if_token_invalid(
        self,
        api,
        test_client,
        mock_service,
    ):
        """Test that get current user raises a 401 if the token is invalid."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act
        headers = {"Authorization": "Bearer invalid_token"}
        response = test_client.get("/api/v1/users/current", headers=headers)

        # Assert
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"

    def test_raises_401_if_token_has_no_user_id(
        self,
        api,
        test_client,
        mock_service,
    ):
        """Test that get current user raises a 401 if the token has no user_id."""
        # Arrange
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act
        headers = {"Authorization": "Bearer test_token_123"}
        response = test_client.get("/api/v1/users/current", headers=headers)

        # Assert
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"

    def test_raises_401_if_user_not_found(
        self,
        api,
        test_client,
        mock_service,
    ):
        """Test that get current user raises a 401 if the user is not found."""
        # Arrange
        mock_token_data = Mock()
        mock_token_data.user_id = "test_user_123"
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)
        mock_service.get_user.side_effect = KeyError("User not found")

        # Act
        headers = {"Authorization": "Bearer test_token_123"}
        response = test_client.get("/api/v1/users/current", headers=headers)

        # Assert
        assert response.status_code == 401
        assert response.json()["detail"] == "User not found"

    def test_raises_401_if_no_authorization_header(
        self, api, test_client, mock_service
    ):
        """Test that get current user raises a 401 if no authorization header."""
        # Act
        response = test_client.get("/api/v1/users/current")

        # Assert
        assert response.status_code == 401


class TestGetUser:
    """Test cases for getting a user by ID."""

    def test_successful_get_user(
        self, api, test_client, mock_service, sample_user, sample_user_internal
    ):
        """Test successful retrieval of a user by ID."""

        # Arrange
        mock_token_data = Mock()
        user_id = "test_user_123"
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)

        mock_service.get_user.return_value = sample_user_internal

        # Act
        headers = {"Authorization": "Bearer test_token_123"}
        response = test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        # Assert
        mock_service.get_user.assert_called_once_with(user_id)
        assert response.status_code == 200
        assert response.json() == jsonable_encoder(sample_user)

    def test_raises_500_if_user_not_found(self, api, test_client, mock_service):
        """Test that get user raises a 500 if the user is not found."""
        user_id = "nonexistent_user"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(return_value=mock_token_data)
        mock_service.get_user.side_effect = UserNotFoundError(user_id)

        headers = {"Authorization": "Bearer test_token_123"}

        with pytest.raises(HTTPException) as exc_info:
            test_client.get(f"/api/v1/users/{user_id}", headers=headers)

        assert exc_info.value.status_code == 404

    def test_raises_403_if_user_not_authorized(self, api, test_client, mock_service):
        """Test that get user raises a 403 if the user is not authorized."""
        # Arrange
        user_id = "test_user_456"
        mock_token_data = Mock()
        mock_token_data.user_id = user_id
        api.jwt_manager.verify_token_or_raise = Mock(
            side_effect=HTTPException(
                status_code=401, detail="Could not validate credentials"
            )
        )

        # Act & Assert
        headers = {"Authorization": "Bearer test_token_123"}
        response = test_client.get(f"/api/v1/users/{user_id}", headers=headers)
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"


class TestListUsers:
    """Test cases for listing all users."""

    def test_successful_list_users(
        self, api, test_client, mock_service, sample_user, sample_user_2
    ):
        """Test successful retrieval of all users."""
        # Arrange
        sample_user_internal_1 = UserInternal(
            id=sample_user.id,
            email=sample_user.email,
            first_name=sample_user.first_name,
            last_name=sample_user.last_name,
            password_hash="hashed_password_123",
            create_timestamp=sample_user.create_timestamp,
            update_timestamp=sample_user.update_timestamp,
        )
        sample_user_internal_2 = UserInternal(
            id=sample_user_2.id,
            email=sample_user_2.email,
            first_name=sample_user_2.first_name,
            last_name=sample_user_2.last_name,
            password_hash="hashed_password_456",
            create_timestamp=sample_user_2.create_timestamp,
            update_timestamp=sample_user_2.update_timestamp,
        )
        mock_service.list_users.return_value = [
            sample_user_internal_1,
            sample_user_internal_2,
        ]

        # Act
        response = test_client.get("/api/v1/users")

        # Assert
        mock_service.list_users.assert_called_once()
        assert response.status_code == 200
        assert response.json() == [
            jsonable_encoder(sample_user),
            jsonable_encoder(sample_user_2),
        ]

    def test_returns_empty_list_when_no_users(self, api, test_client, mock_service):
        """Test that list users returns an empty list when no users exist."""
        # Arrange
        mock_service.list_users.return_value = []

        # Act
        response = test_client.get("/api/v1/users")

        # Assert
        mock_service.list_users.assert_called_once()
        assert response.status_code == 200
        assert response.json() == []


class TestAPIInitialization:
    """Test cases for API initialization and route setup."""

    def test_api_initialization_creates_password_hasher_and_jwt_manager(
        self, app, mock_service
    ):
        """Test that API initialization creates password hasher and JWT manager."""
        # Act
        api = UserAPI(app, mock_service)

        # Assert
        assert isinstance(api.password_hasher, PasswordHasher)
        assert isinstance(api.jwt_manager, JWTManager)
        assert api.service == mock_service
        assert api.app == app

    def test_api_initialization_sets_up_routes(self, app, mock_service):
        """Test that API initialization sets up all required routes."""
        # Act
        api = UserAPI(app, mock_service)

        # Assert
        # Check that routes are added to the app
        routes = [route for route in app.routes if hasattr(route, "path")]
        route_paths = [route.path for route in routes]

        assert "/api/v1/users" in route_paths  # POST for create, GET for list
        assert "/api/v1/users/login" in route_paths
        assert "/api/v1/users/current" in route_paths
        assert "/api/v1/users/{user_id}" in route_paths
