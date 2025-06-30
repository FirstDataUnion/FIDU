"""
Test the LocalSqlUserStore implementation.
"""

import sqlite3
import pytest
from datetime import datetime
from unittest.mock import Mock, patch
from typing import List, Dict, Any

from ..local_sql import LocalSqlUserStore
from ...schema import UserInternal
from ...exceptions import (
    UserNotFoundError,
    UserAlreadyExistsError,
    UserError,
)
from fidu_core.utils.db import get_cursor
from fidu_core.utils.test_helpers import setup_test_db


@pytest.fixture
def store():
    """Create a LocalSqlUserStore instance with a fresh database."""
    return LocalSqlUserStore()


@pytest.fixture
def populated_store(store, sample_users):
    """Create a store with sample users already inserted."""
    # Insert all sample users
    for i, user in enumerate(sample_users):
        store.store_user(f"req_{i}", user)
    return store


@pytest.fixture
def sample_user_minimal():
    """Create a minimal sample user for testing."""
    return UserInternal(
        id="test_user_001",
        email="user1@example.com",
        first_name=None,
        last_name=None,
        password_hash="hashed_password_001",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def sample_user_with_names():
    """Create a sample user with names for testing."""
    return UserInternal(
        id="test_user_002",
        email="user2@example.com",
        first_name="John",
        last_name="Doe",
        password_hash="hashed_password_002",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0),
    )


@pytest.fixture
def sample_user_complete():
    """Create a complete sample user for testing."""
    return UserInternal(
        id="test_user_003",
        email="user3@example.com",
        first_name="Jane",
        last_name="Smith",
        password_hash="hashed_password_003",
        create_timestamp=datetime(2024, 1, 3, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 3, 12, 0, 0),
    )


@pytest.fixture
def sample_user_another():
    """Create another sample user for testing."""
    return UserInternal(
        id="test_user_004",
        email="user4@example.com",
        first_name="Bob",
        last_name="Johnson",
        password_hash="hashed_password_004",
        create_timestamp=datetime(2024, 1, 4, 12, 0, 0),
        update_timestamp=datetime(2024, 1, 4, 12, 0, 0),
    )


@pytest.fixture
def sample_users(
    sample_user_minimal,
    sample_user_with_names,
    sample_user_complete,
    sample_user_another,
):
    """Create a list of sample users for testing."""
    return [
        sample_user_minimal,
        sample_user_with_names,
        sample_user_complete,
        sample_user_another,
    ]


@pytest.fixture
def sample_timestamp():
    """Create a sample timestamp for testing."""
    return datetime(2024, 1, 15, 10, 30)


# Utility functions for testing
def assert_users_equal(
    user1: UserInternal,
    user2: UserInternal,
    ignore_timestamps: bool = False,
):
    """Assert that two users are equal, with optional timestamp ignoring."""
    assert user1.id == user2.id
    assert user1.email == user2.email
    assert user1.first_name == user2.first_name
    assert user1.last_name == user2.last_name
    assert user1.password_hash == user2.password_hash

    if not ignore_timestamps:
        assert user1.create_timestamp == user2.create_timestamp
        assert user1.update_timestamp == user2.update_timestamp


class TestInfrastructure:
    """Test that our test infrastructure is working correctly."""

    def test_store_initialization(self, store):
        """Test that the store can be initialized correctly."""
        assert store is not None
        assert isinstance(store, LocalSqlUserStore)

    def test_database_tables_created(self, store):
        """Test that the required database tables are created."""
        with get_cursor() as cursor:
            # Check that users table exists
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            )
            result = cursor.fetchone()
            assert result is not None
            assert result[0] == "users"

            # Check that users table has the correct columns
            cursor.execute("PRAGMA table_info(users)")
            columns = [row[1] for row in cursor.fetchall()]
            expected_columns = [
                "id",
                "email",
                "create_request_id",
                "first_name",
                "last_name",
                "password_hash",
                "create_timestamp",
                "update_timestamp",
            ]
            assert set(columns) == set(expected_columns)

    def test_populated_store_has_data(self, populated_store, sample_users):
        """Test that the populated store fixture works correctly."""
        stored_users = populated_store.list_users()
        assert len(stored_users) == len(sample_users)

        # Check that all users are present
        stored_emails = {user.email for user in stored_users}
        expected_emails = {user.email for user in sample_users}
        assert stored_emails == expected_emails


class TestRowToUserInternal:
    """Test the _row_to_user_internal method."""

    def test_minimal_row_converts_to_user_correctly(self, store):
        """Test that a minimal database row converts to a user correctly."""
        # Create a mock database row as a tuple, matching the order of columns in users table
        row = (
            "test_user_001",  # id
            "user1@example.com",  # email
            "req_001",  # create_request_id
            None,  # first_name
            None,  # last_name
            "hashed_password_001",  # password_hash
            "2024-01-01T12:00:00",  # create_timestamp
            "2024-01-01T12:00:00",  # update_timestamp
        )

        # Create a mock cursor with column descriptions
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id",),
            ("email",),
            ("create_request_id",),
            ("first_name",),
            ("last_name",),
            ("password_hash",),
            ("create_timestamp",),
            ("update_timestamp",),
        ]

        result = store._row_to_user_internal(row, mock_cursor)

        assert result.id == "test_user_001"
        assert result.email == "user1@example.com"
        assert result.first_name is None
        assert result.last_name is None
        assert result.password_hash == "hashed_password_001"
        assert result.create_timestamp == datetime(2024, 1, 1, 12, 0, 0)
        assert result.update_timestamp == datetime(2024, 1, 1, 12, 0, 0)

    def test_row_with_names_converts_to_user_correctly(self, store):
        """Test that a row with names converts to a user correctly."""
        # Create a mock database row as a tuple, matching the order of columns in users table
        row = (
            "test_user_002",  # id
            "user2@example.com",  # email
            "req_002",  # create_request_id
            "John",  # first_name
            "Doe",  # last_name
            "hashed_password_002",  # password_hash
            "2024-01-02T12:00:00",  # create_timestamp
            "2024-01-02T12:00:00",  # update_timestamp
        )

        # Create a mock cursor with column descriptions
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id",),
            ("email",),
            ("create_request_id",),
            ("first_name",),
            ("last_name",),
            ("password_hash",),
            ("create_timestamp",),
            ("update_timestamp",),
        ]

        result = store._row_to_user_internal(row, mock_cursor)

        assert result.id == "test_user_002"
        assert result.email == "user2@example.com"
        assert result.first_name == "John"
        assert result.last_name == "Doe"
        assert result.password_hash == "hashed_password_002"
        assert result.create_timestamp == datetime(2024, 1, 2, 12, 0, 0)
        assert result.update_timestamp == datetime(2024, 1, 2, 12, 0, 0)

    def test_raises_user_error_on_conversion_failure(self, store):
        """Test that _row_to_user_internal raises UserError on conversion failure."""
        # Create an invalid row that will cause conversion to fail
        row = ("invalid",)  # Too few columns

        # Create a mock cursor with column descriptions
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id",),
            ("email",),
            ("create_request_id",),
            ("first_name",),
            ("last_name",),
            ("password_hash",),
            ("create_timestamp",),
            ("update_timestamp",),
        ]

        with pytest.raises(UserError) as exc_info:
            store._row_to_user_internal(row, mock_cursor)

        assert "Failed to convert database row to UserInternal" in str(exc_info.value)


class TestStoreUser:
    """Test the store_user method."""

    def test_stores_user_correctly(self, store, sample_user_minimal):
        """Test that a user is stored correctly."""
        # Store the user
        request_id = "req_001"
        result = store.store_user(request_id, sample_user_minimal)

        # Verify the result
        assert_users_equal(result, sample_user_minimal, ignore_timestamps=True)

        # Verify the user is in the database
        stored_user = store.get_user(sample_user_minimal.id)
        assert_users_equal(stored_user, sample_user_minimal, ignore_timestamps=True)

        # Verify the request_id is stored
        with get_cursor() as cursor:
            cursor.execute(
                "SELECT create_request_id FROM users WHERE id = ?",
                (sample_user_minimal.id,),
            )
            result = cursor.fetchone()
            assert result is not None
            assert result[0] == request_id

    def test_stores_user_with_names_correctly(self, store, sample_user_with_names):
        """Test that a user with names is stored correctly."""
        # Store the user
        request_id = "req_002"
        result = store.store_user(request_id, sample_user_with_names)

        # Verify the result
        assert_users_equal(result, sample_user_with_names, ignore_timestamps=True)

        # Verify the user is in the database
        stored_user = store.get_user(sample_user_with_names.id)
        assert_users_equal(stored_user, sample_user_with_names, ignore_timestamps=True)

    @patch.object(LocalSqlUserStore, "_get_current_timestamp")
    def test_creates_timestamps_if_not_provided(
        self,
        mock_get_current_timestamp,
        store,
        sample_user_minimal,
        sample_timestamp,
    ):
        """Test that timestamps are created if not provided."""
        # Create a user without timestamps
        user_without_timestamps = UserInternal(
            id="test_user_timestamp",
            email="timestamp@example.com",
            first_name="Test",
            last_name="User",
            password_hash="hashed_password_timestamp",
            create_timestamp=None,
            update_timestamp=None,
        )

        # Mock the current timestamp
        mock_get_current_timestamp.return_value = sample_timestamp

        # Store the user
        request_id = "req_timestamp"
        result = store.store_user(request_id, user_without_timestamps)

        # Verify timestamps were set
        assert result.create_timestamp == sample_timestamp
        assert result.update_timestamp == sample_timestamp

    def test_returns_existing_user_on_request_id_collision(
        self, store, sample_user_minimal
    ):
        """Test that store_user returns existing user on request_id collision."""
        # Store the user first time
        request_id = "req_collision"
        first_result = store.store_user(request_id, sample_user_minimal)

        # Try to store the same user with the same request_id
        second_result = store.store_user(request_id, sample_user_minimal)

        # Verify both results are the same (ignore timestamps since they get updated)
        assert_users_equal(first_result, second_result, ignore_timestamps=True)

        # Verify only one user exists in the database
        stored_users = store.list_users()
        assert len(stored_users) == 1

    def test_returns_existing_user_on_request_id_collision_with_different_user_data(
        self, store, sample_user_minimal
    ):
        """Test that store_user returns existing user on request_id collision even with different user data."""
        # Store the user first time
        request_id = "req_collision_diff"
        first_result = store.store_user(request_id, sample_user_minimal)

        # Create a different user with the same request_id
        different_user = UserInternal(
            id="different_user_id",
            email="different@example.com",
            first_name="Different",
            last_name="User",
            password_hash="different_hash",
            create_timestamp=datetime(2024, 1, 10, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 10, 12, 0, 0),
        )

        # Try to store the different user with the same request_id
        second_result = store.store_user(request_id, different_user)

        # Verify the result is the original user, not the different user
        assert_users_equal(first_result, second_result)
        assert second_result.id == sample_user_minimal.id
        assert second_result.email == sample_user_minimal.email

        # Verify only one user exists in the database
        stored_users = store.list_users()
        assert len(stored_users) == 1

    def test_raises_user_already_exists_error_on_duplicate_id(
        self, store, sample_user_minimal
    ):
        """Test that store_user raises UserAlreadyExistsError on duplicate ID."""
        # Store the user first time
        request_id_1 = "req_duplicate_1"
        store.store_user(request_id_1, sample_user_minimal)

        # Try to store a user with the same ID but different request_id
        request_id_2 = "req_duplicate_2"
        duplicate_user = UserInternal(
            id=sample_user_minimal.id,  # Same ID
            email="different@example.com",  # Different email
            first_name="Different",
            last_name="User",
            password_hash="different_hash",
            create_timestamp=datetime(2024, 1, 10, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 10, 12, 0, 0),
        )

        # This should raise an exception due to the UNIQUE constraint on id
        with pytest.raises(UserAlreadyExistsError):
            store.store_user(request_id_2, duplicate_user)

    def test_raises_integrity_error_on_duplicate_email(
        self, store, sample_user_minimal
    ):
        """Test that store_user raises IntegrityError on duplicate email."""
        # Store the user first time
        request_id_1 = "req_email_1"
        store.store_user(request_id_1, sample_user_minimal)

        # Try to store a user with the same email but different ID
        request_id_2 = "req_email_2"
        duplicate_email_user = UserInternal(
            id="different_id",  # Different ID
            email=sample_user_minimal.email,  # Same email
            first_name="Different",
            last_name="User",
            password_hash="different_hash",
            create_timestamp=datetime(2024, 1, 10, 12, 0, 0),
            update_timestamp=datetime(2024, 1, 10, 12, 0, 0),
        )

        # This should raise an exception due to the UNIQUE constraint on email
        with pytest.raises(UserAlreadyExistsError):
            store.store_user(request_id_2, duplicate_email_user)


class TestGetUser:
    """Test the get_user method."""

    def test_returns_user_correctly(self, store, sample_user_complete):
        """Test that get_user returns the correct user."""
        # Store the user
        request_id = "req_get"
        store.store_user(request_id, sample_user_complete)

        # Get the user
        result = store.get_user(sample_user_complete.id)

        # Verify the result
        assert_users_equal(result, sample_user_complete, ignore_timestamps=True)

    def test_returns_user_not_found_error_on_missing_user(self, store):
        """Test that get_user raises UserNotFoundError on missing user."""
        with pytest.raises(UserNotFoundError) as exc_info:
            store.get_user("nonexistent_user")

        assert "nonexistent_user" in str(exc_info.value)


class TestGetUserByEmail:
    """Test the get_user_by_email method."""

    def test_returns_user_correctly(self, store, sample_user_complete):
        """Test that get_user_by_email returns the correct user."""
        # Store the user
        request_id = "req_get_email"
        store.store_user(request_id, sample_user_complete)

        # Get the user by email
        result = store.get_user_by_email(sample_user_complete.email)

        # Verify the result
        assert_users_equal(result, sample_user_complete, ignore_timestamps=True)

    def test_returns_user_not_found_error_on_missing_email(self, store):
        """Test that get_user_by_email raises UserNotFoundError on missing email."""
        with pytest.raises(UserNotFoundError) as exc_info:
            store.get_user_by_email("nonexistent@example.com")

        assert "nonexistent@example.com" in str(exc_info.value)


class TestListUsers:
    """Test the list_users method."""

    def test_returns_all_users_correctly(self, store, sample_users):
        """Test that list_users returns all users correctly."""
        # Store the users
        for i, user in enumerate(sample_users):
            store.store_user(f"req_list_{i}", user)

        # List the users
        result = store.list_users()

        # Verify the result
        assert len(result) == len(sample_users)

        # Check that all users are present
        result_emails = {user.email for user in result}
        expected_emails = {user.email for user in sample_users}
        assert result_emails == expected_emails

    def test_returns_empty_list_if_no_users_found(self, store):
        """Test that list_users returns an empty list if no users found."""
        result = store.list_users()
        assert result == []
