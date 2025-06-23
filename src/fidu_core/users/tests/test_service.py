"""
Test the UserService layer.
"""

from unittest.mock import Mock
import pytest
from datetime import datetime
from ..store.store import UserStoreInterface
from ..service import UserService
from ..schema import UserInternal, UserBase


@pytest.fixture
def mock_store():
    """Create a mock storage object for testing."""
    return Mock(spec=UserStoreInterface)


@pytest.fixture
def service(mock_store):
    """Create a UserService object for testing."""
    return UserService(mock_store)


@pytest.fixture
def sample_user_internal():
    """Create a sample user for testing."""
    return UserInternal(
        id="test_user_123",
        email="test@example.com",
        first_name="John",
        last_name="Doe",
        password_hash="hashed_password_123",
        created_at=datetime(2024, 1, 1, 12, 0, 0),
        updated_at=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_user_internal_2():
    """Create another sample user for testing."""
    return UserInternal(
        id="test_user_456",
        email="jane@example.com",
        first_name="Jane",
        last_name="Smith",
        password_hash="hashed_password_456",
        created_at=datetime(2024, 1, 2, 12, 0, 0),
        updated_at=datetime(2024, 1, 2, 12, 0, 0),
    )


def test_create_user_calls_store_with_correct_data(
    service, mock_store, sample_user_internal
):
    """Test that the service calls the store with the correct data for user creation."""
    # Arrange
    mock_store.store_user.return_value = sample_user_internal

    # Act
    result = service.create_user(sample_user_internal)

    # Assert
    mock_store.store_user.assert_called_once_with(sample_user_internal)
    assert result == sample_user_internal


def test_get_user_calls_store_with_correct_data(
    service, mock_store, sample_user_internal
):
    """Test that the service calls the store with the correct user ID."""
    # Arrange
    user_id = "test_user_123"
    mock_store.get_user.return_value = sample_user_internal

    # Act
    result = service.get_user(user_id)

    # Assert
    mock_store.get_user.assert_called_once_with(user_id)
    assert result == sample_user_internal


def test_get_user_by_email_calls_store_with_correct_data(
    service, mock_store, sample_user_internal
):
    """Test that the service calls the store with the correct email address."""
    # Arrange
    email = "test@example.com"
    mock_store.get_user_by_email.return_value = sample_user_internal

    # Act
    result = service.get_user_by_email(email)

    # Assert
    mock_store.get_user_by_email.assert_called_once_with(email)
    assert result == sample_user_internal


def test_list_users_calls_store_with_correct_data(
    service, mock_store, sample_user_internal, sample_user_internal_2
):
    """Test that the service calls the store to list all users."""
    # Arrange
    expected_users = [sample_user_internal, sample_user_internal_2]
    mock_store.list_users.return_value = expected_users

    # Act
    result = service.list_users()

    # Assert
    mock_store.list_users.assert_called_once()
    assert result == expected_users


def test_list_users_returns_empty_list_when_no_users(service, mock_store):
    """Test that the service returns an empty list when no users exist."""
    # Arrange
    expected_users = []
    mock_store.list_users.return_value = expected_users

    # Act
    result = service.list_users()

    # Assert
    mock_store.list_users.assert_called_once()
    assert result == expected_users


def test_get_user_by_email_with_different_email(
    service, mock_store, sample_user_internal_2
):
    """Test that the service calls the store with a different email address."""
    # Arrange
    email = "jane@example.com"
    mock_store.get_user_by_email.return_value = sample_user_internal_2

    # Act
    result = service.get_user_by_email(email)

    # Assert
    mock_store.get_user_by_email.assert_called_once_with(email)
    assert result == sample_user_internal_2
    assert result.email == "jane@example.com"
    assert result.first_name == "Jane"


def test_get_user_with_different_user_id(service, mock_store, sample_user_internal_2):
    """Test that the service calls the store with a different user ID."""
    # Arrange
    user_id = "test_user_456"
    mock_store.get_user.return_value = sample_user_internal_2

    # Act
    result = service.get_user(user_id)

    # Assert
    mock_store.get_user.assert_called_once_with(user_id)
    assert result == sample_user_internal_2
    assert result.id == "test_user_456"
    assert result.first_name == "Jane"
