"""
Test the LocalSqlDataPacketStore implementation.
"""

import sqlite3
import pytest
import json
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from typing import List, Dict, Any
import uuid

from ..local_sql import LocalSqlDataPacketStore
from ...schema import DataPacketInternal, DataPacketQueryParamsInternal
from ...exceptions import (
    DataPacketAlreadyExistsError,
    DataPacketNotFoundError,
    DataPacketError,
)
from fidu_vault.utils.db import get_cursor
from fidu_vault.utils.test_helpers import setup_test_db


@pytest.fixture
def store():
    """Create a LocalSqlDataPacketStore instance with a fresh database."""
    return LocalSqlDataPacketStore()


@pytest.fixture
def sample_data_packet_minimal():
    """Create a minimal sample data packet for testing."""
    return DataPacketInternal(
        id="test_packet_001",
        profile_id="test_profile_001",
        user_id="test_user_001",
        create_timestamp=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        tags=None,
        data={},
    )


@pytest.fixture
def sample_data_packet_with_tags():
    """Create a sample data packet with tags for testing."""
    return DataPacketInternal(
        id="test_packet_002",
        profile_id="test_profile_001",
        user_id="test_user_001",
        create_timestamp=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
        tags=["important", "work", "project-a"],
        data={},
    )


@pytest.fixture
def sample_data_packet_with_data():
    """Create a sample data packet with data for testing."""
    return DataPacketInternal(
        id="test_packet_003",
        profile_id="test_profile_002",
        user_id="test_user_001",
        create_timestamp=datetime(2024, 1, 3, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2024, 1, 3, 12, 0, 0, tzinfo=timezone.utc),
        tags=None,
        data={
            "title": "Sample Document",
            "content": "This is a sample document content",
            "metadata": {"author": "John Doe", "version": "1.0"},
        },
    )


@pytest.fixture
def sample_data_packet_complete():
    """Create a complete sample data packet with tags and data for testing."""
    return DataPacketInternal(
        id="test_packet_004",
        profile_id="test_profile_002",
        user_id="test_user_001",
        create_timestamp=datetime(2024, 1, 4, 12, 0, 0, tzinfo=timezone.utc),
        update_timestamp=datetime(2024, 1, 4, 12, 0, 0, tzinfo=timezone.utc),
        tags=["important", "urgent", "personal", "finance"],
        data={
            "type": "expense",
            "amount": 150.50,
            "currency": "USD",
            "category": "groceries",
            "notes": "Weekly grocery shopping",
        },
    )


@pytest.fixture
def sample_data_packets(
    sample_data_packet_minimal,
    sample_data_packet_with_tags,
    sample_data_packet_with_data,
    sample_data_packet_complete,
):
    """Create a list of sample data packets for testing."""
    return [
        sample_data_packet_minimal,
        sample_data_packet_with_tags,
        sample_data_packet_with_data,
        sample_data_packet_complete,
    ]


@pytest.fixture
def sample_query_params():
    """Create sample query parameters for testing."""
    return DataPacketQueryParamsInternal(
        tags=None,
        profile_id=None,
        from_timestamp=None,
        to_timestamp=None,
        limit=50,
        offset=0,
        sort_order="desc",
    )


@pytest.fixture
def sample_timestamp():
    """Create a sample timestamp for testing."""
    return datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)


# Utility functions for testing
def assert_data_packets_equal(
    packet1: DataPacketInternal,
    packet2: DataPacketInternal,
    ignore_timestamps: bool = False,
):
    """Assert that two data packets are equal, with optional timestamp ignoring."""
    assert packet1.id == packet2.id
    assert packet1.profile_id == packet2.profile_id
    if packet1.tags is None or packet1.tags == []:
        if packet2.tags is None or packet2.tags == []:
            pass
        else:
            assert packet1.tags == packet2.tags

    assert packet1.data == packet2.data

    if not ignore_timestamps:
        assert packet1.create_timestamp == packet2.create_timestamp
        assert packet1.update_timestamp == packet2.update_timestamp


class TestInfrastructure:
    """Test that our test infrastructure is working correctly."""

    def test_store_initialization(self, store):
        """Test that the store can be initialized correctly."""
        assert store is not None
        assert isinstance(store, LocalSqlDataPacketStore)

    def test_database_tables_created(self, store):
        """Test that the required database tables are created."""
        with get_cursor() as cursor:
            # Check that data_packets table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='data_packets'
            """)
            assert cursor.fetchone() is not None

            # Check that data_packet_tags table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='data_packet_tags'
            """)
            assert cursor.fetchone() is not None


class TestRowToDataPacket:
    def test_minimal_row_converts_to_packet_correctly(self):
        """Test that a minimal database row converts to a DataPacket correctly."""
        # Create a mock database row as a tuple, matching the order of columns in data_packets table
        row = (
            "test_id_123",  # id
            "request_id_123",  # create_request_id
            "test_profile_456",  # profile_id
            "test_user_001",  # user_id
            "2024-01-15T10:30:00+00:00",  # create_timestamp
            "2024-01-15T10:30:00+00:00",  # update_timestamp
            None,  # tags (JSON)
            "{}",  # data (JSON)
        )

        # Create cursor description that would come from SQLite
        cursor_description = (
            ("id", None, None, None, None, None, None),
            ("create_request_id", None, None, None, None, None, None),
            ("profile_id", None, None, None, None, None, None),
            ("user_id", None, None, None, None, None, None),
            ("create_timestamp", None, None, None, None, None, None),
            ("update_timestamp", None, None, None, None, None, None),
            ("tags", None, None, None, None, None, None),
            ("data", None, None, None, None, None, None),
        )

        # Create mock cursor
        mock_cursor = Mock()
        mock_cursor.description = cursor_description

        # Convert row to dict and then to DataPacket
        store = LocalSqlDataPacketStore()
        packet = store._row_to_data_packet(row, mock_cursor)

        # Verify conversion
        assert isinstance(packet, DataPacketInternal)
        assert packet.id == "test_id_123"
        assert packet.profile_id == "test_profile_456"
        assert packet.user_id == "test_user_001"
        assert packet.create_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.update_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.tags == []
        assert packet.data == {}

    def test_row_with_tags_converts_to_packet_correctly(self):
        """Test that a row with tags converts to a DataPacket correctly."""
        # Create a mock database row as a tuple, matching the order of columns in data_packets table
        row = (
            "test_id_123",  # id
            "request_id_123",  # create_request_id
            "test_profile_456",  # profile_id
            "test_user_001",  # user_id
            "2024-01-15T10:30:00+00:00",  # create_timestamp
            "2024-01-15T10:30:00+00:00",  # update_timestamp
            '["tag1", "tag2"]',  # tags (JSON)
            "{}",  # data (JSON)
        )

        # Create cursor description that would come from SQLite
        cursor_description = (
            ("id", None, None, None, None, None, None),
            ("create_request_id", None, None, None, None, None, None),
            ("profile_id", None, None, None, None, None, None),
            ("user_id", None, None, None, None, None, None),
            ("create_timestamp", None, None, None, None, None, None),
            ("update_timestamp", None, None, None, None, None, None),
            ("tags", None, None, None, None, None, None),
            ("data", None, None, None, None, None, None),
        )

        # Create mock cursor
        mock_cursor = Mock()
        mock_cursor.description = cursor_description

        # Convert row to dict and then to DataPacket
        store = LocalSqlDataPacketStore()
        packet = store._row_to_data_packet(row, mock_cursor)

        # Verify conversion
        assert isinstance(packet, DataPacketInternal)
        assert packet.id == "test_id_123"
        assert packet.profile_id == "test_profile_456"
        assert packet.user_id == "test_user_001"
        assert packet.create_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.update_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.tags == ["tag1", "tag2"]
        assert packet.data == {}

    def test_row_with_data_converts_to_packet_correctly(self):
        # Create a mock database row as a tuple, matching the order of columns in data_packets table
        row = (
            "test_id_123",  # id
            "request_id_123",  # create_request_id
            "test_profile_456",  # profile_id
            "test_user_001",  # user_id
            "2024-01-15T10:30:00+00:00",  # create_timestamp
            "2024-01-15T10:30:00+00:00",  # update_timestamp
            None,  # tags (JSON)
            '{"key": "value"}',  # data (JSON)
        )

        # Create cursor description that would come from SQLite
        cursor_description = (
            ("id", None, None, None, None, None, None),
            ("create_request_id", None, None, None, None, None, None),
            ("profile_id", None, None, None, None, None, None),
            ("user_id", None, None, None, None, None, None),
            ("create_timestamp", None, None, None, None, None, None),
            ("update_timestamp", None, None, None, None, None, None),
            ("tags", None, None, None, None, None, None),
            ("data", None, None, None, None, None, None),
        )

        # Create mock cursor
        mock_cursor = Mock()
        mock_cursor.description = cursor_description

        # Convert row to dict and then to DataPacket
        store = LocalSqlDataPacketStore()
        packet = store._row_to_data_packet(row, mock_cursor)

        # Verify conversion
        assert isinstance(packet, DataPacketInternal)
        assert packet.id == "test_id_123"
        assert packet.profile_id == "test_profile_456"
        assert packet.user_id == "test_user_001"
        assert packet.create_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.update_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.tags == []
        assert packet.data == {"key": "value"}

    def test_row_with_tags_and_data_converts_to_packet_correctly(self):
        # Create a mock database row as a tuple, matching the order of columns in data_packets table
        row = (
            "test_id_123",  # id
            "request_id_123",  # create_request_id
            "test_profile_456",  # profile_id
            "test_user_001",  # user_id
            "2024-01-15T10:30:00+00:00",  # create_timestamp
            "2024-01-15T10:30:00+00:00",  # update_timestamp
            '["tag1", "tag2"]',  # tags (JSON)
            '{"key": "value"}',  # data (JSON)
        )

        # Create cursor description that would come from SQLite
        cursor_description = (
            ("id", None, None, None, None, None, None),
            ("create_request_id", None, None, None, None, None, None),
            ("profile_id", None, None, None, None, None, None),
            ("user_id", None, None, None, None, None, None),
            ("create_timestamp", None, None, None, None, None, None),
            ("update_timestamp", None, None, None, None, None, None),
            ("tags", None, None, None, None, None, None),
            ("data", None, None, None, None, None, None),
        )

        # Create mock cursor
        mock_cursor = Mock()
        mock_cursor.description = cursor_description

        # Convert row to dict and then to DataPacket
        store = LocalSqlDataPacketStore()
        packet = store._row_to_data_packet(row, mock_cursor)

        # Verify conversion
        assert isinstance(packet, DataPacketInternal)
        assert packet.id == "test_id_123"
        assert packet.profile_id == "test_profile_456"
        assert packet.user_id == "test_user_001"
        assert packet.create_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.update_timestamp == datetime(
            2024, 1, 15, 10, 30, tzinfo=timezone.utc
        )
        assert packet.tags == ["tag1", "tag2"]
        assert packet.data == {"key": "value"}


class TestSyncTagsToJunctionTable:

    def test_removes_existing_tags(self, store):
        # Add a data packet to the database with tags
        store.store_data_packet(
            str(uuid.uuid4()),
            DataPacketInternal(
                id="test_id_123",
                profile_id="test_profile_456",
                user_id="test_user_001",
                create_timestamp=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
                update_timestamp=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
                tags=["tag1", "tag2"],
            ),
        )

        # Sync an empty set of tags to the database
        store._sync_tags_to_junction_table("test_id_123", [])

        # Verify that the tags were removed
        with get_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM data_packet_tags WHERE data_packet_id = ?",
                ("test_id_123",),
            )
            assert cursor.fetchone() is None

    def test_inserts_new_tags(self, store):
        # Add a data packet to the database with no tags
        store.store_data_packet(
            str(uuid.uuid4()),
            DataPacketInternal(
                id="test_id_123",
                profile_id="test_profile_456",
                user_id="test_user_001",
                create_timestamp=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
                update_timestamp=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
                tags=None,
            ),
        )

        # Sync a new set of tags to the database
        store._sync_tags_to_junction_table("test_id_123", ["tag1", "tag2"])

        # Verify that the tags were inserted
        with get_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM data_packet_tags WHERE data_packet_id = ?",
                ("test_id_123",),
            )
            assert cursor.fetchone() == ("test_id_123", "tag1")
            assert cursor.fetchone() == ("test_id_123", "tag2")


class TestStoreDataPacket:
    def test_stores_packet_correctly(self, store, sample_data_packet_minimal):
        # Create a data packet and store it
        packet = sample_data_packet_minimal

        # Store the packet
        request_id = str(uuid.uuid4())
        stored_packet = store.store_data_packet(request_id, packet)

        # Verify that the packet was stored correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == packet.update_timestamp.isoformat()  # update_timestamp
            assert row[6] is None  # tags
            assert row[7] == "{}"  # data

        # Verify that the packet was returned correctly
        assert_data_packets_equal(stored_packet, packet)

    def test_stores_packet_with_tags_correctly(
        self, store, sample_data_packet_with_tags
    ):
        # Create a data packet and store it
        packet = sample_data_packet_with_tags

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Verify that the packet was stored correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == packet.update_timestamp.isoformat()  # update_timestamp
            assert row[6] == json.dumps(packet.tags)  # tags
            assert row[7] == "{}"  # data

    def test_stores_packet_with_data_correctly(
        self, store, sample_data_packet_with_data
    ):
        # Create a data packet and store it
        packet = sample_data_packet_with_data

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Verify that the packet was stored correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == packet.update_timestamp.isoformat()  # update_timestamp
            assert row[6] is None  # tags
            assert row[7] == json.dumps(packet.data)  # data

    @patch.object(LocalSqlDataPacketStore, "_get_current_timestamp")
    def test_creates_timestamps_if_not_provided(
        self,
        mock_get_current_timestamp,
        store,
        sample_data_packet_minimal,
        sample_timestamp,
    ):
        # Create a data packet and store it
        packet = sample_data_packet_minimal

        # remove timestamps
        packet.create_timestamp = None
        packet.update_timestamp = None

        # Mock the current timestamp
        mock_get_current_timestamp.return_value = sample_timestamp

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Verify that the packet was stored correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == sample_timestamp.isoformat()  # create_timestamp
            assert row[5] == sample_timestamp.isoformat()  # update_timestamp
            assert row[6] is None  # tags
            assert row[7] == "{}"  # data

    def test_returns_packet_already_exists_exception_on_duplicate_id(
        self, store, sample_data_packet_minimal
    ):
        # Create a data packet and store it
        packet = sample_data_packet_minimal

        # Store the packet
        store.store_data_packet(str(uuid.uuid4()), packet)

        # Store same packet again (different request ID)
        with pytest.raises(DataPacketAlreadyExistsError):
            store.store_data_packet(str(uuid.uuid4()), packet)

    def test_returns_existing_packet_on_request_id_collision_with_same_profile_id(
        self, store, sample_data_packet_minimal
    ):
        """Test that idempotency works - same request_id returns existing packet."""
        # Create a data packet and store it
        packet = sample_data_packet_minimal
        request_id = "test_request_123"

        # Store the packet
        stored_packet = store.store_data_packet(request_id, packet)

        # Verify the packet was stored
        assert stored_packet.id == packet.id

        # Try to store the same packet with the same request_id
        duplicate_packet = DataPacketInternal(
            id="different_id_456",  # Different ID to show it's ignored
            profile_id=packet.profile_id,
            user_id=packet.user_id,
            create_timestamp=datetime(2024, 1, 20, 12, 0, 0, tzinfo=timezone.utc),
            update_timestamp=datetime(2024, 1, 20, 12, 0, 0, tzinfo=timezone.utc),
            tags=["different", "tags"],
            data={"different": "data"},
        )

        # This should return the original packet, not the duplicate
        returned_packet = store.store_data_packet(request_id, duplicate_packet)

        # Verify we got the original packet back
        assert returned_packet.id == packet.id
        assert returned_packet.profile_id == packet.profile_id
        # Note: Database normalizes None tags to empty list, so we compare against normalized version
        expected_tags = packet.tags if packet.tags is not None else []
        assert returned_packet.tags == expected_tags
        assert returned_packet.data == packet.data

        # Verify only one row exists in the database
        with get_cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM data_packets WHERE create_request_id = ?",
                (request_id,),
            )
            count = cursor.fetchone()[0]
            assert count == 1

    def test_raises_exception_on_request_id_collision_with_different_profile_id(
        self, store, sample_data_packet_minimal
    ):
        """Test that idempotency works - same request_id returns existing packet."""
        # Create a data packet and store it
        packet = sample_data_packet_minimal
        request_id = "test_request_123"

        # Store the packet
        stored_packet = store.store_data_packet(request_id, packet)

        # Verify the packet was stored
        assert stored_packet.id == packet.id

        # Try to store the same packet with the same request_id
        duplicate_packet = DataPacketInternal(
            id="different_id_456",  # Different ID to show it's ignored
            profile_id="different_profile_id",
            user_id="different_user_id",
            create_timestamp=datetime(2024, 1, 20, 12, 0, 0, tzinfo=timezone.utc),
            update_timestamp=datetime(2024, 1, 20, 12, 0, 0, tzinfo=timezone.utc),
            tags=["different", "tags"],
            data={"different": "data"},
        )

        # This should raise an exception to avoid leaking data packets from other users/profiles.
        with pytest.raises(DataPacketError):
            store.store_data_packet(request_id, duplicate_packet)


class TestUpdateDataPacket:

    def test_updates_packet_with_only_tags_correctly(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
        )
        updated_packet = store.update_data_packet(update_request_id, packet_update)

        # Verify that the packet was updated correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == update_timestamp.isoformat()  # new update_timestamp
            assert row[6] == json.dumps(packet_update.tags)  # new tags
            assert row[7] == json.dumps(packet.data)  # data

        assert updated_packet.id == packet.id
        assert updated_packet.profile_id == packet.profile_id
        assert updated_packet.create_timestamp == packet.create_timestamp
        assert updated_packet.update_timestamp == update_timestamp
        assert updated_packet.tags == packet_update.tags
        assert updated_packet.data == packet.data

    def test_updates_packet_with_only_data_correctly(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            data={"new_key": "new_value"},
        )
        updated_packet = store.update_data_packet(update_request_id, packet_update)

        # Verify that the packet was updated correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == update_timestamp.isoformat()  # new update_timestamp
            assert row[6] == json.dumps(packet.tags)  # tags
            assert row[7] == json.dumps(packet_update.data)  # new data

    def test_updates_packet_with_tags_and_data_correctly(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
            data={"new_key": "new_value"},
        )
        updated_packet = store.update_data_packet(update_request_id, packet_update)

        # Verify that the packet was updated correctly
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert row[5] == update_timestamp.isoformat()  # new update_timestamp
            assert row[6] == json.dumps(packet_update.tags)  # new tags
            assert row[7] == json.dumps(packet_update.data)  # new data

        assert updated_packet.id == packet.id
        assert updated_packet.profile_id == packet.profile_id
        assert updated_packet.create_timestamp == packet.create_timestamp
        assert updated_packet.update_timestamp == update_timestamp
        assert updated_packet.tags == packet_update.tags
        assert updated_packet.data == packet_update.data

    def test_returns_packet_not_found_exception_on_missing_packet(self, store):
        # Update a non-existent packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id="non_existent_packet_id",
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
            data={"new_key": "new_value"},
        )
        with pytest.raises(DataPacketNotFoundError):
            store.update_data_packet(update_request_id, packet_update)

    def test_returns_existing_packet_on_idempotent_request(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete

        # Store the packet
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
        )
        updated_packet = store.update_data_packet(update_request_id, packet_update)
        assert updated_packet.id == packet.id

        # Send the same request again and assert the same packet is returned and no
        # exception is raised.
        second_updated_packet = store.update_data_packet(
            update_request_id, packet_update
        )
        assert second_updated_packet == updated_packet

    def test_returns_existing_packet_on_idempotent_request_with_different_values(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
        )
        updated_packet = store.update_data_packet(update_request_id, packet_update)

        # Create a new update for the packet, but use the same request_id
        # and different values.
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=datetime(2025, 1, 15, 10, 31, tzinfo=timezone.utc),
            tags=["new_tag3", "new_tag4"],
        )
        second_updated_packet = store.update_data_packet(
            update_request_id, packet_update
        )

        # Assert returned packet is the same as the first update.
        assert_data_packets_equal(second_updated_packet, updated_packet)

        # Verify that the packet was only updated with the first request.
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (packet.id,))
            row = cursor.fetchone()
            assert row[0] == packet.id  # id
            assert row[1] == request_id  # create_request_id
            assert row[2] == packet.profile_id  # profile_id
            assert row[3] == packet.user_id  # user_id
            assert row[4] == packet.create_timestamp.isoformat()  # create_timestamp
            assert (
                row[5] == updated_packet.update_timestamp.isoformat()
            )  # new update_timestamp
            assert row[6] == json.dumps(updated_packet.tags)  # new tags
            assert row[7] == json.dumps(updated_packet.data)  # new data

    def test_returns_latest_packet_on_idempotent_request(
        self, store, sample_data_packet_complete
    ):
        # Create a data packet and store it
        packet = sample_data_packet_complete
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Update the packet
        first_update_request_id = str(uuid.uuid4())
        update_timestamp = datetime(2024, 1, 15, 10, 31, tzinfo=timezone.utc)
        packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=update_timestamp,
            tags=["new_tag1", "new_tag2"],
        )
        updated_packet = store.update_data_packet(
            first_update_request_id, packet_update
        )

        # Create a second new update for the packet
        second_update_request_id = str(uuid.uuid4())
        second_packet_update = DataPacketInternal(
            id=packet.id,
            update_timestamp=datetime(2025, 1, 15, 10, 31, tzinfo=timezone.utc),
            tags=["new_tag3", "new_tag4"],
        )
        second_updated_packet = store.update_data_packet(
            second_update_request_id, second_packet_update
        )

        # repeat the first update and assert the packet returned is the "latest" version from the
        # second update.
        third_updated_packet = store.update_data_packet(
            first_update_request_id, packet_update
        )
        assert_data_packets_equal(third_updated_packet, second_updated_packet)


class GetDataPacket:
    def test_returns_packet_correctly(self, store, sample_data_packet_complete):
        # Create a data packet and store it
        packet = sample_data_packet_complete
        request_id = str(uuid.uuid4())
        store.store_data_packet(request_id, packet)

        # Get the packet
        retrieved_packet = store.get_data_packet(packet.id)
        assert_data_packets_equal(retrieved_packet, packet)

    def test_returns_packet_not_found_exception_on_missing_packet(self, store):
        # Get a non-existent packet
        with pytest.raises(DataPacketNotFoundError):
            store.get_data_packet("non_existent_packet_id")


class TestListDataPackets:
    def test_returns_all_packets_correctly(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(user_id="test_user_001")
        )

        # Assert the number of packets returned is the same as the number of packets stored
        assert len(retrieved_packets) == len(sample_data_packets)

        # create list of expected packets sorted by descending create_timestamp
        expected_packets = sorted(
            sample_data_packets, key=lambda x: x.create_timestamp, reverse=True
        )

        # Assert the packets are the same
        for retrieved_packet, packet in zip(retrieved_packets, expected_packets):
            assert_data_packets_equal(retrieved_packet, packet)

    def test_returns_empty_list_if_no_packets_found(self, store):
        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(user_id="test_user_001")
        )

        # Assert the number of packets returned is 0
        assert len(retrieved_packets) == 0

    def test_returns_empty_list_if_no_packets_found_for_user(
        self, store, sample_data_packets
    ):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(user_id="different_user_id")
        )

        # Assert the number of packets returned is 0
        assert len(retrieved_packets) == 0

    def test_filters_by_profile_id(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # sample data packets have profile_ids:
        #   test_profile_001,
        #   test_profile_001,
        #   test_profile_002,
        #   test_profile_002

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                profile_id="test_profile_001", user_id="test_user_001"
            )
        )

        assert len(retrieved_packets) == 2
        assert retrieved_packets[0].profile_id == "test_profile_001"
        assert retrieved_packets[1].profile_id == "test_profile_001"

    def test_filters_by_from_timestamp(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # sample data packets have create_timestamps:
        #   2024, 1, 1, 12, 0, 0
        #   2024, 1, 2, 12, 0, 0
        #   2024, 1, 3, 12, 0, 0
        #   2024, 1, 4, 12, 0, 0

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                from_timestamp=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
                user_id="test_user_001",
            )
        )

        assert len(retrieved_packets) == 3

    def test_filters_by_to_timestamp(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # sample data packets have create_timestamps:
        #   2024, 1, 1, 12, 0, 0
        #   2024, 1, 2, 12, 0, 0
        #   2024, 1, 3, 12, 0, 0
        #   2024, 1, 4, 12, 0, 0

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                to_timestamp=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
                user_id="test_user_001",
            )
        )

        assert len(retrieved_packets) == 2

    def test_filters_by_single_tag(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # sample data packets have tags:
        #   None
        #   ["important", "work", "project-a"],
        #   None,
        #   ["urgent", "personal", "finance"]

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(tags=["work"], user_id="test_user_001")
        )

        assert len(retrieved_packets) == 1
        assert retrieved_packets[0].tags == ["important", "work", "project-a"]

    def test_filters_by_multiple_tags(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # sample data packets have tags:
        #   None
        #   ["important", "work", "project-a"],
        #   None,
        #   ["urgent", "personal", "finance"]

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                tags=["important", "personal"], user_id="test_user_001"
            )
        )

        assert len(retrieved_packets) == 1
        assert retrieved_packets[0].tags == [
            "important",
            "urgent",
            "personal",
            "finance",
        ]

    def test_filters_by_all_parameters(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # Create query to retrieve a single specific packet
        query_params = DataPacketQueryParamsInternal(
            profile_id="test_profile_001",
            from_timestamp=datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
            to_timestamp=datetime(2024, 1, 3, 12, 0, 0, tzinfo=timezone.utc),
            tags=["important", "work", "project-a"],
            user_id="test_user_001",
        )
        retrieved_packets = store.list_data_packets(query_params)

        assert len(retrieved_packets) == 1

    def test_limits_results(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(limit=1, user_id="test_user_001")
        )
        assert len(retrieved_packets) == 1

    def test_offsets_results(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(limit=1, user_id="test_user_001")
        )
        packet_1_id = retrieved_packets[0].id

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(limit=1, offset=1, user_id="test_user_001")
        )
        packet_2_id = retrieved_packets[0].id

        assert packet_1_id != packet_2_id

    def test_sorts_results_by_create_timestamp_ascending(
        self, store, sample_data_packets
    ):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                sort_by="create_timestamp", sort_order="asc", user_id="test_user_001"
            )
        )
        assert retrieved_packets[0].create_timestamp == min(
            packet.create_timestamp for packet in sample_data_packets
        )
        assert retrieved_packets[3].create_timestamp == max(
            packet.create_timestamp for packet in sample_data_packets
        )

    def test_sorts_results_by_create_timestamp_descending(
        self, store, sample_data_packets
    ):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # List the packets
        retrieved_packets = store.list_data_packets(
            DataPacketQueryParamsInternal(
                sort_by="create_timestamp", sort_order="desc", user_id="test_user_001"
            )
        )
        assert retrieved_packets[0].create_timestamp == max(
            packet.create_timestamp for packet in sample_data_packets
        )
        assert retrieved_packets[3].create_timestamp == min(
            packet.create_timestamp for packet in sample_data_packets
        )


class TestDeleteDataPacket:
    def test_deletes_packet_correctly(self, store, sample_data_packets):
        # Store the packets
        for packet in sample_data_packets:
            request_id = str(uuid.uuid4())
            store.store_data_packet(request_id, packet)

        # Delete the packet
        store.delete_data_packet(sample_data_packets[0].id)

        # Verify that the packet was deleted correctly
        with get_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM data_packets WHERE id = ?", (sample_data_packets[0].id,)
            )
            row = cursor.fetchone()
            assert row is None

    def test_returns_packet_not_found_exception_on_missing_packet(self, store):
        # Delete a non-existent packet
        with pytest.raises(DataPacketNotFoundError):
            store.delete_data_packet("non_existent_packet_id")
