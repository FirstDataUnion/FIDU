"""
Local SQL storage for data packets.
"""

import sqlite3
import json
import logging
from datetime import datetime, timezone
from typing import List, Any
from .store import DataPacketStoreInterface
from ..schema import (
    DataPacketInternal,
    DataPacketQueryParams,
)
from ..exceptions import (
    DataPacketNotFoundError,
    DataPacketError,
    DataPacketAlreadyExistsError,
)
from ...utils.db import get_cursor

logger = logging.getLogger(__name__)


class LocalSqlDataPacketStore(DataPacketStoreInterface):
    """Local SQL storage for data packets."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS data_packets (
        id TEXT PRIMARY KEY,
        create_request_id TEXT UNIQUE NOT NULL,
        profile_id TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        tags TEXT,  -- JSON array for tags
        data TEXT NOT NULL  -- JSON for data
        -- FOREIGN KEY (profile_id) REFERENCES profiles (id) -- Add this back when we have profiles
    )
    """

    # Create separate table for tags to allow for efficient querying.
    create_tags_table_query = """
    CREATE TABLE IF NOT EXISTS data_packet_tags (
        data_packet_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (data_packet_id, tag),
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
    )
    """

    # Create a table to track updates to data packets to detect idempotent requests.
    create_updates_table_query = """
    CREATE TABLE IF NOT EXISTS data_packet_updates (
        request_id TEXT PRIMARY KEY,
        data_packet_id TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
    )
    """

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        """Initialize the storage layer."""
        self.db_conn = db_conn

        # Executing these in line for now, but we should use a migration system eventually.
        with get_cursor(self.db_conn) as cursor:
            cursor.execute(self.create_table_query)
            cursor.execute(self.create_tags_table_query)
            cursor.execute(self.create_updates_table_query)
            # Create indexes for efficient querying
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packets_profile_id
                ON data_packets(profile_id)"""
            )
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packets_create_timestamp
                ON data_packets(create_timestamp)"""
            )
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packets_update_timestamp
                ON data_packets(update_timestamp)"""
            )
            # Create indexes for tag queries
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packet_tags_tag
                ON data_packet_tags(tag)"""
            )
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packet_tags_packet_id
                ON data_packet_tags(data_packet_id)"""
            )
            # Create indexes for update queries
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packet_updates_request_id
                ON data_packet_updates(request_id)"""
            )

    def _row_to_data_packet(self, row: tuple, cursor) -> DataPacketInternal:
        """Convert a database row tuple to a DataPacket object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            packet_dict = dict(zip(columns, row))

            # Handle datetime conversion
            if packet_dict.get("create_timestamp"):
                packet_dict["create_timestamp"] = datetime.fromisoformat(
                    packet_dict["create_timestamp"]
                )
            if packet_dict.get("update_timestamp"):
                packet_dict["update_timestamp"] = datetime.fromisoformat(
                    packet_dict["update_timestamp"]
                )

            # Parse tags and data from JSON
            if packet_dict.get("tags"):
                packet_dict["tags"] = json.loads(packet_dict["tags"])
            else:
                packet_dict["tags"] = []

            if packet_dict.get("data"):
                packet_dict["data"] = json.loads(packet_dict["data"])
            else:
                packet_dict["data"] = {}

            return DataPacketInternal(**packet_dict)
        except Exception as e:
            raise DataPacketError(
                f"Failed to convert database row to DataPacket: {e}"
            ) from e

    def _sync_tags_to_junction_table(
        self, data_packet_id: str, tags: List[str]
    ) -> None:
        """Sync tags from JSON to junction table for efficient querying."""
        with get_cursor(self.db_conn) as cursor:
            # Remove existing tags for this packet
            cursor.execute(
                "DELETE FROM data_packet_tags WHERE data_packet_id = ?",
                (data_packet_id,),
            )

            # Insert new tags
            if tags:
                tag_values = [(data_packet_id, tag) for tag in tags]
                cursor.executemany(
                    "INSERT INTO data_packet_tags (data_packet_id, tag) VALUES (?, ?)",
                    tag_values,
                )

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC.
        This helper is used to allow us to patch it in testing.
        """
        return datetime.now(timezone.utc)

    def store_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Submit a data packet to the system to be stored."""

        # Idempotent requests are caught by the ON CONFLICT clause doing nothing,
        # and a check to see if no rows were inserted afterwards. This is differentiated
        # from ID conflicts, which raise an exception. SQLite has no RETURNING clause,
        # so this is the best approach it supports.
        query = """
        INSERT INTO data_packets (
            id, create_request_id, profile_id, create_timestamp, update_timestamp, tags, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(create_request_id) DO NOTHING
        """

        # Prepare data
        tags_json = json.dumps(data_packet.tags) if data_packet.tags else None
        data_json = json.dumps(data_packet.data) if data_packet.data else "{}"

        create_timestamp_iso = (
            data_packet.create_timestamp.isoformat()
            if data_packet.create_timestamp
            else self._get_current_timestamp().isoformat()
        )
        update_timestamp_iso = (
            data_packet.update_timestamp.isoformat()
            if data_packet.update_timestamp
            else self._get_current_timestamp().isoformat()
        )

        with get_cursor(self.db_conn) as cursor:
            try:
                cursor.execute(
                    query,
                    (
                        data_packet.id,
                        request_id,
                        data_packet.profile_id,
                        create_timestamp_iso,
                        update_timestamp_iso,
                        tags_json,
                        data_json,
                    ),
                )

                # Check if the insert actually happened (no request ID conflict)
                if cursor.rowcount > 0:
                    # New row was inserted, sync tags and return the packet
                    if data_packet.tags:
                        self._sync_tags_to_junction_table(
                            data_packet.id, data_packet.tags
                        )
                    return data_packet

                # Request ID conflict occurred, fetch the existing row
                # (Request ID is the only thing we can conflict on that
                # won't raise an exception)
                cursor.execute(
                    "SELECT * FROM data_packets WHERE create_request_id = ?",
                    (request_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    # This shouldn't happen, but handle it gracefully
                    raise DataPacketError(
                        f"Request ID {request_id} conflict detected but no existing row found"
                    )

                # Return the existing data packet
                return self._row_to_data_packet(row, cursor)

            except sqlite3.IntegrityError as e:
                # Check if this is a primary key constraint violation (duplicate ID)
                if "UNIQUE constraint failed" in str(e) and "data_packets.id" in str(e):
                    raise DataPacketAlreadyExistsError(
                        f"Data packet with ID {data_packet.id} already exists"
                    ) from e
                # Re-raise other integrity errors as they might be different constraint violations
                raise DataPacketError(f"Failed to store data packet: {e}") from e

    def update_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Update a data packet in the system.
        Currently supports partial idempotency, where the same request ID will return the most
        recent version of the packet.
        """

        # Update the database with transaction handling to avoid any race conditions
        with get_cursor(self.db_conn) as cursor:
            # First check if the packet exists
            cursor.execute(
                "SELECT id FROM data_packets WHERE id = ?", (data_packet.id,)
            )
            if cursor.fetchone() is None:
                raise DataPacketNotFoundError(
                    f"Data packet with ID {data_packet.id} not found"
                )

            # Check if the request ID already exists in the updates table
            cursor.execute(
                "SELECT * FROM data_packet_updates WHERE request_id = ?", (request_id,)
            )
            row = cursor.fetchone()
            if row is not None:
                # Request ID already exists, update has already been completed. Return most
                # recent version of the packet.
                packet_id = row[1]
                logger.info(
                    """Update request ID %s already exists, returning most recent 
                    version of packet %s""",
                    request_id,
                    packet_id,
                )
                try:
                    return self.get_data_packet(packet_id)
                except DataPacketNotFoundError as e:
                    # The packet was deleted after the update request was made.
                    # This is a rare edge case, but it's possible.
                    logger.warning(
                        "Data packet with ID %s not found after update request %s was made",
                        packet_id,
                        request_id,
                    )
                    raise DataPacketNotFoundError(
                        f"""Data packet with ID {packet_id} not found after update request
                         {request_id} was made""",
                    ) from e

            # Set update timestamp if not provided
            if data_packet.update_timestamp is None:
                data_packet.update_timestamp = self._get_current_timestamp()

            # Build the update query dynamically
            query_parts = ["UPDATE data_packets SET update_timestamp = ?"]
            params = [
                data_packet.update_timestamp.isoformat(),
            ]

            # Handle tags - only update if explicitly provided (not None)
            if data_packet.tags is not None:
                query_parts.append(", tags = ?")
                params.append(json.dumps(data_packet.tags))

            # Handle data - only update if explicitly provided (not None)
            if data_packet.data is not None:
                query_parts.append(", data = ?")
                params.append(json.dumps(data_packet.data))

            query_parts.append(" WHERE id = ?")
            params.append(data_packet.id)

            # Execute the update
            query = "".join(query_parts)
            cursor.execute(query, params)

            if cursor.rowcount == 0:
                logger.error(
                    "Updated data packet with ID %s not found in database exists check passed",
                    data_packet.id,
                )
                raise DataPacketNotFoundError(
                    f"Data packet with ID {data_packet.id} not found in database"
                )

            # update the updates table
            cursor.execute(
                """INSERT INTO data_packet_updates (request_id, data_packet_id, update_timestamp) 
                VALUES (?, ?, ?)""",
                (request_id, data_packet.id, data_packet.update_timestamp.isoformat()),
            )

            # Fetch the updated record (SQLite doesn't support RETURNING)
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (data_packet.id,))
            row = cursor.fetchone()
            if row is None:
                logger.error(
                    "Updated data packet with ID %s not found in database after update",
                    data_packet.id,
                )
                raise DataPacketNotFoundError(
                    f"Updated data packet with ID {data_packet.id} not found in database"
                )

            updated_data_packet = self._row_to_data_packet(row, cursor)

            # Sync tags to junction table for efficient querying
            if data_packet.tags is not None:
                if data_packet.tags:
                    self._sync_tags_to_junction_table(data_packet.id, data_packet.tags)
                else:
                    # Remove all tags if empty list provided
                    cursor.execute(
                        "DELETE FROM data_packet_tags WHERE data_packet_id = ?",
                        (data_packet.id,),
                    )

            return updated_data_packet

    def get_data_packet(self, data_packet_id: str) -> DataPacketInternal:
        """Get a data packet from the system by its ID."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (data_packet_id,))
            row = cursor.fetchone()

            if row is None:
                raise DataPacketNotFoundError(
                    f"Data packet with ID {data_packet_id} not found"
                )

            return self._row_to_data_packet(row, cursor)

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParams
    ) -> List[DataPacketInternal]:
        """List data packets from the system."""

        # Build the query dynamically based on filters
        query_parts = [
            "SELECT DISTINCT dp.* FROM data_packets dp",
        ]
        if data_packet_query_params.tags:
            query_parts.append(
                "JOIN data_packet_tags dpt ON dp.id = dpt.data_packet_id",
            )

        # a no-op, but makes adding the AND statements below easier.
        query_parts.append("WHERE 1=1")

        params: List[Any] = []

        if data_packet_query_params.profile_id:
            query_parts.append("AND dp.profile_id = ?")
            params.append(data_packet_query_params.profile_id)

        if data_packet_query_params.from_timestamp:
            query_parts.append("AND dp.create_timestamp >= ?")
            params.append(data_packet_query_params.from_timestamp.isoformat())

        if data_packet_query_params.to_timestamp:
            query_parts.append("AND dp.create_timestamp <= ?")
            params.append(data_packet_query_params.to_timestamp.isoformat())

        if data_packet_query_params.tags:
            for tag in data_packet_query_params.tags:
                query_parts.append(
                    "AND dp.id IN (SELECT data_packet_id FROM data_packet_tags WHERE tag = ?)"
                )
                params.append(tag)

        # Add sorting
        sort_order = "DESC" if data_packet_query_params.sort_order == "desc" else "ASC"
        query_parts.append(f"ORDER BY dp.create_timestamp {sort_order}")

        # Add pagination
        query_parts.append("LIMIT ? OFFSET ?")
        params.extend(
            [
                data_packet_query_params.limit,
                data_packet_query_params.offset,
            ]
        )

        query = " ".join(query_parts)

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_data_packet(row, cursor) for row in rows]

    def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("DELETE FROM data_packets WHERE id = ?", (data_packet_id,))
            if cursor.rowcount == 0:
                raise DataPacketNotFoundError(
                    f"Data packet with ID {data_packet_id} not found"
                )
            # Tags will be automatically deleted due to CASCADE
