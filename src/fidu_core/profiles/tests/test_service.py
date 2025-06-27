"""
Test the ProfileService layer.
"""

from unittest.mock import Mock
import pytest
from datetime import datetime
from ..store.store import ProfileStoreInterface
from ..service import ProfileService
from ..schema import ProfileInternal, ProfileQueryParamsInternal


@pytest.fixture
def mock_store():
    """Create a mock storage object for testing."""
    return Mock(spec=ProfileStoreInterface)


@pytest.fixture
def service(mock_store):
    """Create a ProfileService object for testing."""
    return ProfileService(mock_store)


@pytest.fixture
def sample_profile_internal():
    """Create a sample profile for testing."""
    return ProfileInternal(
        id="test_profile_123",
        user_id="test_user_123",
        name="Test Profile",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_internal_2():
    """Create another sample profile for testing."""
    return ProfileInternal(
        id="test_profile_456",
        user_id="test_user_456",
        name="Another Test Profile",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
    )


@pytest.fixture
def sample_query_params():
    """Create sample query parameters for testing."""
    return ProfileQueryParamsInternal(
        user_id="test_user_123",
        name="Test Profile",
        limit=10,
        offset=0,
        sort_order="desc",
    )


class TestCreateProfile:
    """Test cases for creating profiles."""

    def test_calls_store_with_correct_data(
        self, service, mock_store, sample_profile_internal
    ):
        """Test that the service calls the store with the correct data for profile creation."""
        # Arrange
        request_id = "req_123"
        mock_store.store_profile.return_value = sample_profile_internal

        # Act
        result = service.create_profile(request_id, sample_profile_internal)

        # Assert
        mock_store.store_profile.assert_called_once_with(request_id, sample_profile_internal)
        assert result == sample_profile_internal

    def test_returns_created_profile_from_store(
        self, service, mock_store, sample_profile_internal
    ):
        """Test that the service returns the profile created by the store."""
        # Arrange
        request_id = "req_123"
        created_profile = sample_profile_internal.model_copy(
            update={"id": "new_profile_id", "name": "New Profile Name"}
        )
        mock_store.store_profile.return_value = created_profile

        # Act
        result = service.create_profile(request_id, sample_profile_internal)

        # Assert
        assert result == created_profile
        assert result.id == "new_profile_id"
        assert result.name == "New Profile Name"


class TestGetProfile:
    """Test cases for getting a profile by ID."""

    def test_calls_store_with_correct_profile_id(
        self, service, mock_store, sample_profile_internal
    ):
        """Test that the service calls the store with the correct profile ID."""
        # Arrange
        profile_id = "test_profile_123"
        mock_store.get_profile.return_value = sample_profile_internal

        # Act
        result = service.get_profile(profile_id)

        # Assert
        mock_store.get_profile.assert_called_once_with(profile_id)
        assert result == sample_profile_internal

class TestListProfiles:
    """Test cases for listing profiles."""

    def test_calls_store_with_correct_query_params(
        self, service, mock_store, sample_profile_internal, sample_query_params
    ):
        """Test that the service calls the store with the correct query parameters."""
        # Arrange
        expected_profiles = [sample_profile_internal]
        mock_store.list_profiles.return_value = expected_profiles

        # Act
        result = service.list_profiles(sample_query_params)

        # Assert
        mock_store.list_profiles.assert_called_once_with(sample_query_params)
        assert result == expected_profiles

    def test_returns_empty_list_when_no_profiles(self, service, mock_store):
        """Test that the service returns an empty list when no profiles exist."""
        # Arrange
        query_params = ProfileQueryParamsInternal(user_id="*")
        expected_profiles = []
        mock_store.list_profiles.return_value = expected_profiles

        # Act
        result = service.list_profiles(query_params)

        # Assert
        mock_store.list_profiles.assert_called_once_with(query_params)
        assert result == expected_profiles
        assert len(result) == 0

    def test_handles_query_params_with_all_fields(
        self, service, mock_store, sample_profile_internal
    ):
        """Test that the service handles query parameters with all fields set."""
        # Arrange
        query_params = ProfileQueryParamsInternal(
            user_id="test_user_123",
            name="Test Profile",
            limit=5,
            offset=10,
            sort_order="asc"
        )
        expected_profiles = [sample_profile_internal]
        mock_store.list_profiles.return_value = expected_profiles

        # Act
        result = service.list_profiles(query_params)

        # Assert
        mock_store.list_profiles.assert_called_once_with(query_params)
        assert result == expected_profiles

    def test_handles_query_params_with_minimal_fields(
        self, service, mock_store, sample_profile_internal
    ):
        """Test that the service handles query parameters with only required fields."""
        # Arrange
        query_params = ProfileQueryParamsInternal(user_id="test_user_123")
        expected_profiles = [sample_profile_internal]
        mock_store.list_profiles.return_value = expected_profiles

        # Act
        result = service.list_profiles(query_params)

        # Assert
        mock_store.list_profiles.assert_called_once_with(query_params)
        assert result == expected_profiles
