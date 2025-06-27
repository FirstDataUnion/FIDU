"""
Test the LocalSqlProfileStore implementation.
"""

import sqlite3
import pytest
from datetime import datetime
from unittest.mock import Mock, patch
from fidu_core.users.schema import UserInternal

from ..local_sql import LocalSqlProfileStore
from ...schema import Profile, ProfileInternal, ProfileQueryParamsInternal
from ...exceptions import (
    ProfileNotFoundError,
    ProfileUserAlreadyHasProfileError,
    ProfileError,
)
from fidu_core.users.store.local_sql import LocalSqlUserStore
from fidu_core.utils.db import get_cursor
from fidu_core.utils.test_helpers import setup_test_db

@pytest.fixture
def user_store():
    """Create a LocalSqlUserStore instance with a fresh database."""
    return LocalSqlUserStore()

@pytest.fixture
def store():
    """Create a LocalSqlProfileStore instance with a fresh database."""
    return LocalSqlProfileStore()

@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return UserInternal(
        id="user_001",
        create_request_id="req_001",
        first_name="John",
        last_name="Doe",
        password_hash="password_hash",
        email="user_001@example.com",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )

@pytest.fixture
def sample_alternative_user():
    """Create a sample user for testing."""
    return UserInternal(
        id="user_002",
        create_request_id="req_002",
        first_name="Jane",
        last_name="Doe",
        password_hash="password_hash",
        email="user_002@example.com",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_minimal():
    """Create a minimal sample profile for testing."""
    return Profile(
        id="test_profile_001",
        user_id="user_001",
        name="Work Profile",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_personal():
    """Create a personal profile for testing."""
    return Profile(
        id="test_profile_002",
        user_id="user_001",
        name="Personal Profile",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_another_user():
    """Create a profile for another user for testing."""
    return Profile(
        id="test_profile_003",
        user_id="user_002",
        name="Work Profile",
        create_timestamp=datetime(2024, 1, 3, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 3, 12, 0, 0),
    )


@pytest.fixture
def sample_profile_gaming():
    """Create a gaming profile for testing."""
    return Profile(
        id="test_profile_004",
        user_id="user_001",
        name="Gaming Profile",
        create_timestamp=datetime(2024, 1, 4, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 4, 12, 0, 0),
    )


@pytest.fixture
def sample_profiles(
    sample_profile_minimal,
    sample_profile_personal,
    sample_profile_another_user,
    sample_profile_gaming,
):
    """Create a list of sample profiles for testing."""
    return [
        sample_profile_minimal,
        sample_profile_personal,
        sample_profile_another_user,
        sample_profile_gaming,
    ]


@pytest.fixture
def sample_timestamp():
    """Create a sample timestamp for testing."""
    return datetime(2024, 1, 15, 10, 30)


# Utility functions for testing
def assert_profiles_equal(
    profile1: Profile,
    profile2: Profile,
    ignore_timestamps: bool = False,
):
    """Assert that two profiles are equal, with optional timestamp ignoring."""
    assert profile1.id == profile2.id
    assert profile1.user_id == profile2.user_id
    assert profile1.name == profile2.name

    if not ignore_timestamps:
        assert profile1.create_timestamp == profile2.create_timestamp
        assert profile1.update_timestamp == profile2.update_timestamp


class TestInfrastructure:
    """Test that our test infrastructure is working correctly."""

    def test_store_initialization(self, user_store, store):
        """Test that the store can be initialized correctly."""
        assert store is not None
        assert isinstance(store, LocalSqlProfileStore)

    def test_database_tables_created(self, user_store, store):
        """Test that the required database tables are created."""
        with get_cursor() as cursor:

            # Check that profiles table exists
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'"
            )
            result = cursor.fetchone()
            assert result is not None
            assert result[0] == "profiles"

            # Check that profiles table has the correct columns
            cursor.execute("PRAGMA table_info(profiles)")
            columns = [row[1] for row in cursor.fetchall()]
            expected_columns = [
                "id",
                "create_request_id",
                "user_id",
                "name",
                "create_timestamp",
                "update_timestamp",
            ]
            assert set(columns) == set(expected_columns)

            # Check that the unique index exists
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_user_id_name'"
            )
            index_result = cursor.fetchone()
            assert index_result is not None
            assert index_result[0] == "idx_user_id_name"


class TestRowToProfile:
    """Test the _row_to_profile method."""

    def test_row_converts_to_profile_correctly(self, user_store, store):
        """Test that a database row converts to a profile correctly."""
        # Create a mock database row as a tuple, matching the order of columns in profiles table
        row = (
            "test_profile_001",  # id
            "req_001",  # create_request_id
            "user_001",  # user_id
            "Work Profile",  # name
            "2024-01-01T12:00:00",  # create_timestamp
            "2024-01-01T12:00:00",  # update_timestamp
        )

        # Create a mock cursor with column descriptions
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id",),
            ("create_request_id",),
            ("user_id",),
            ("name",),
            ("create_timestamp",),
            ("update_timestamp",),
        ]

        result = store._row_to_profile(row, mock_cursor)

        assert result.id == "test_profile_001"
        assert result.user_id == "user_001"
        assert result.name == "Work Profile"
        assert result.create_timestamp == datetime(2024, 1, 1, 12, 0, 0)
        assert result.update_timestamp == datetime(2024, 1, 1, 12, 0, 0)

    def test_raises_value_error_on_conversion_failure(self, store):
        """Test that _row_to_profile raises ValueError on conversion failure."""
        # Create an invalid row that will cause conversion to fail
        row = ("invalid",)  # Too few columns

        # Create a mock cursor with column descriptions
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id",),
            ("create_request_id",),
            ("user_id",),
            ("name",),
            ("create_timestamp",),
            ("update_timestamp",),
        ]

        with pytest.raises(ValueError) as exc_info:
            store._row_to_profile(row, mock_cursor)

        assert "Failed to convert database row to Profile" in str(exc_info.value)


class TestStoreProfile:
    """Test the store_profile method."""

    def test_stores_profile_correctly(self, user_store, sample_user, store, sample_profile_minimal):
        """Test that a profile is stored correctly."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        # Store the profile
        request_id = "req_001"
        result = store.store_profile(request_id, sample_profile_minimal)

        # Verify the result
        assert_profiles_equal(result, sample_profile_minimal, ignore_timestamps=True)

        # Verify the profile is in the database
        stored_profile = store.get_profile(sample_profile_minimal.id)
        assert_profiles_equal(
            stored_profile, sample_profile_minimal, ignore_timestamps=True
        )

        # Verify the profile is in the database
        with get_cursor() as cursor:
            row = cursor.execute(
                "SELECT * FROM profiles WHERE id = ?", (sample_profile_minimal.id,)
            ).fetchone()
            assert row is not None
            assert row[0] == sample_profile_minimal.id
            assert row[1] == request_id
            assert row[2] == sample_profile_minimal.user_id
            assert row[3] == sample_profile_minimal.name
            assert row[4] == sample_profile_minimal.create_timestamp.isoformat()
            assert row[5] == sample_profile_minimal.update_timestamp.isoformat()

    @patch.object(LocalSqlProfileStore, "_get_current_timestamp")
    def test_creates_timestamps_if_not_provided(
        self,
        mock_get_current_timestamp,
        user_store,
        sample_user,
        store,
        sample_timestamp,
    ):
        """Test that timestamps are created if not provided."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        # Create a profile without timestamps using ProfileInternal
        profile_without_timestamps = ProfileInternal(
            id="test_profile_timestamp",
            user_id="user_001",
            name="Timestamp Profile",
            create_timestamp=None,
            update_timestamp=None,
        )

        # Mock the current timestamp
        mock_get_current_timestamp.return_value = sample_timestamp

        # Store the profile
        request_id = "req_timestamp"
        result = store.store_profile(request_id, profile_without_timestamps)

        # Verify timestamps were set
        assert result.create_timestamp == sample_timestamp
        assert result.update_timestamp == sample_timestamp

    def test_returns_existing_profile_on_request_id_collision(
        self, user_store, sample_user, store, sample_profile_minimal
    ):
        """Test that store_profile returns existing profile on request_id collision."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        # Store the profile first time
        request_id = "req_collision"
        first_result = store.store_profile(request_id, sample_profile_minimal)

        # Try to store the same profile with the same request_id
        second_result = store.store_profile(request_id, sample_profile_minimal)

        # Verify both results are the same (ignore timestamps since they get updated)
        assert_profiles_equal(first_result, second_result, ignore_timestamps=True)

        # Verify only one profile exists in the database
        query_params = ProfileQueryParamsInternal(
            user_id=sample_profile_minimal.user_id
        )
        stored_profiles = store.list_profiles(query_params)
        assert len(stored_profiles) == 1

    def test_raises_profile_error_on_request_id_collision_with_different_profile_data(
        self, user_store, sample_user, sample_alternative_user, store, sample_profile_minimal
    ):
        """Test that store_profile returns existing profile on request_id collision with different profile data."""

        # Store the users to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)

        # Store the profile first time
        request_id = "req_collision_diff"
        first_result = store.store_profile(request_id, sample_profile_minimal)

        # Create a different profile with the same request_id
        different_profile = Profile(
            id="different_profile_id",
            user_id="user_002",
            name="Different Profile",
            create_timestamp=datetime(2024, 1, 10, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 10, 12, 0, 0),
        )

        # Try to store the different profile with the same request_id
        with pytest.raises(ProfileError) as exc_info:
            store.store_profile(request_id, different_profile)

        assert (
            "Request ID req_collision_diff conflict detected but user ID mismatch"
            in str(exc_info.value)
        )

        # Verify only one profile exists in the database for the original user
        query_params = ProfileQueryParamsInternal(
            user_id=sample_profile_minimal.user_id
        )
        stored_profiles = store.list_profiles(query_params)
        assert len(stored_profiles) == 1

    def test_raises_profile_user_already_has_profile_error_on_duplicate_name_same_user(
        self, user_store, sample_user, store, sample_profile_minimal
    ):
        """Test that store_profile raises ProfileUserAlreadyHasProfileError on duplicate name for same user."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        # Store the profile first time
        request_id_1 = "req_duplicate_1"
        store.store_profile(request_id_1, sample_profile_minimal)

        # Try to store a profile with the same name for the same user
        request_id_2 = "req_duplicate_2"
        duplicate_name_profile = Profile(
            id="different_profile_id",  # Different ID
            user_id=sample_profile_minimal.user_id,  # Same user_id
            name=sample_profile_minimal.name,  # Same name
            create_timestamp=datetime(2024, 1, 10, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 10, 12, 0, 0),
        )

        # This should raise an exception due to the UNIQUE constraint on user_id + name
        with pytest.raises(ProfileUserAlreadyHasProfileError) as exc_info:
            store.store_profile(request_id_2, duplicate_name_profile)

        assert sample_profile_minimal.user_id in str(exc_info.value)
        assert sample_profile_minimal.name in str(exc_info.value)

    def test_allows_same_name_for_different_users(
        self, user_store, sample_user, sample_alternative_user, store, sample_profile_minimal, sample_profile_another_user
    ):
        """Test that the same profile name is allowed for different users."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)

        # Store the first profile
        request_id_1 = "req_same_name_1"
        store.store_profile(request_id_1, sample_profile_minimal)

        # Store a profile with the same name but different user
        request_id_2 = "req_same_name_2"
        store.store_profile(request_id_2, sample_profile_another_user)

        # Verify both profiles are in the database
        query_params_1 = ProfileQueryParamsInternal(
            user_id=sample_profile_minimal.user_id
        )
        profiles_1 = store.list_profiles(query_params_1)
        assert len(profiles_1) == 1
        assert profiles_1[0].name == sample_profile_minimal.name

        query_params_2 = ProfileQueryParamsInternal(
            user_id=sample_profile_another_user.user_id
        )
        profiles_2 = store.list_profiles(query_params_2)
        assert len(profiles_2) == 1
        assert profiles_2[0].name == sample_profile_another_user.name


class TestGetProfile:
    """Test the get_profile method."""

    def test_returns_profile_correctly(self, user_store, sample_user, store, sample_profile_minimal):
        """Test that get_profile returns the correct profile."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        # Store the profile
        request_id = "req_get"
        store.store_profile(request_id, sample_profile_minimal)

        # Get the profile
        result = store.get_profile(sample_profile_minimal.id)

        # Verify the result
        assert_profiles_equal(result, sample_profile_minimal, ignore_timestamps=True)

    def test_returns_profile_not_found_error_on_missing_profile(self, user_store, sample_user, store):
        """Test that get_profile raises ProfileNotFoundError on missing profile."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        with pytest.raises(ProfileNotFoundError) as exc_info:
            store.get_profile("nonexistent_profile")

        assert "nonexistent_profile" in str(exc_info.value)


class TestListProfiles:
    """Test the list_profiles method."""

    def test_returns_all_profiles_for_user_correctly(
        self, user_store, sample_user, sample_alternative_user, store, sample_profiles
    ):
        """Test that list_profiles returns all profiles for a user correctly."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)

        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_list_{i}", profile)

        # List the profiles for user_001
        query_params = ProfileQueryParamsInternal(user_id="user_001")
        result = store.list_profiles(query_params)

        # Verify the result (user_001 has 3 profiles)
        assert len(result) == 3

        # Check that all profiles for user_001 are present
        result_names = {profile.name for profile in result}
        expected_names = {"Work Profile", "Personal Profile", "Gaming Profile"}
        assert result_names == expected_names

    def test_returns_empty_list_if_no_profiles_found_for_user(self, user_store, sample_user, store):
        """Test that list_profiles returns an empty list if no profiles found for user."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)

        query_params = ProfileQueryParamsInternal(user_id="nonexistent_user")
        result = store.list_profiles(query_params)
        assert result == []

    def test_filters_by_name_correctly(
        self, user_store, sample_user, sample_alternative_user, store, sample_profiles
    ):
        """Test that list_profiles filters by name correctly."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)
        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_filter_{i}", profile)

        # Filter by name
        query_params = ProfileQueryParamsInternal(
            user_id="user_001", name="Work Profile"
        )
        result = store.list_profiles(query_params)

        # Verify the result
        assert len(result) == 1
        assert result[0].name == "Work Profile"
        assert result[0].user_id == "user_001"

    def test_respects_limit_and_offset(
        self, user_store, sample_user, sample_alternative_user, store, sample_profiles
    ):
        """Test that list_profiles respects limit and offset parameters."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)

        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_limit_{i}", profile)

        # Test with limit and offset
        query_params = ProfileQueryParamsInternal(user_id="user_001", limit=2, offset=1)
        result = store.list_profiles(query_params)

        # Verify the result
        assert len(result) == 2

    def test_respects_sort_order_asc(self, user_store, sample_user, sample_alternative_user, store, sample_profiles):
        """Test that list_profiles respects ascending sort order."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)
        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_sort_{i}", profile)

        # Test ascending sort
        query_params = ProfileQueryParamsInternal(user_id="user_001", sort_order="asc")
        result = store.list_profiles(query_params)

        # Verify the result is sorted by create_timestamp ascending
        assert len(result) == 3
        timestamps = [profile.create_timestamp for profile in result]
        assert timestamps == sorted(timestamps)

    def test_respects_sort_order_desc(self, user_store, sample_user, sample_alternative_user, store, sample_profiles):
        """Test that list_profiles respects descending sort order."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)
        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_sort_{i}", profile)

        # Test descending sort (default)
        query_params = ProfileQueryParamsInternal(user_id="user_001", sort_order="desc")
        result = store.list_profiles(query_params)

        # Verify the result is sorted by create_timestamp descending
        assert len(result) == 3
        timestamps = [profile.create_timestamp for profile in result]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_returns_profiles_for_different_users_separately(
        self, user_store, sample_user, sample_alternative_user, store, sample_profiles
    ):
        """Test that list_profiles returns profiles for different users separately."""

        # Store the user to satisfy foreign key constraints
        user_store.store_user(f"req_001", sample_user)
        user_store.store_user(f"req_002", sample_alternative_user)
        # Store the profiles
        for i, profile in enumerate(sample_profiles):
            store.store_profile(f"req_users_{i}", profile)

        # List profiles for user_001
        query_params_1 = ProfileQueryParamsInternal(user_id="user_001")
        result_1 = store.list_profiles(query_params_1)
        assert len(result_1) == 3

        # List profiles for user_002
        query_params_2 = ProfileQueryParamsInternal(user_id="user_002")
        result_2 = store.list_profiles(query_params_2)
        assert len(result_2) == 1
        assert result_2[0].user_id == "user_002"
