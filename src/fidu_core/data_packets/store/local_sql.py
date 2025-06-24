"""
Local SQL storage for data packets.
"""

import sqlite3
import json
from datetime import datetime, timezone
from typing import List, Any
from .store import DataPacketStoreInterface
from ..schema import (
    DataPacketInternal,
    DataPacketQueryParams,
)
from ..exceptions import DataPacketNotFoundError, DataPacketError
from ...utils.db import get_cursor


class LocalSqlDataPacketStore(DataPacketStoreInterface):
    """Local SQL storage for data packets."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS data_packets (
        id TEXT PRIMARY KEY,
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

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        """Initialize the storage layer."""
        self.db_conn = db_conn

        # Executing these in line for now, but we should use a migration system eventually.
        with get_cursor(self.db_conn) as cursor:
            cursor.execute(self.create_table_query)
            cursor.execute(self.create_tags_table_query)
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

    def store_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Submit a data packet to the system to be stored."""
        query = """
        INSERT INTO data_packets (
            id, profile_id, create_timestamp, update_timestamp, tags, data
        ) VALUES (?, ?, ?, ?, ?, ?)
        """

        # Prepare data
        tags_json = json.dumps(data_packet.tags) if data_packet.tags else None
        data_json = json.dumps(data_packet.data) if data_packet.data else "{}"

        create_timestamp_iso = (
            data_packet.create_timestamp.isoformat()
            if data_packet.create_timestamp
            else datetime.now(timezone.utc).isoformat()
        )
        update_timestamp_iso = (
            data_packet.update_timestamp.isoformat()
            if data_packet.update_timestamp
            else datetime.now(timezone.utc).isoformat()
        )

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(
                query,
                (
                    data_packet.id,
                    data_packet.profile_id,
                    create_timestamp_iso,
                    update_timestamp_iso,
                    tags_json,
                    data_json,
                ),
            )

            # Sync tags to junction table for efficient querying
            if data_packet.tags:
                self._sync_tags_to_junction_table(data_packet.id, data_packet.tags)

        return data_packet

    def update_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Update a data packet in the system."""

        # TODO: Add idempotency check

        # Update the database with transaction handling to avoid any race conditions
        with get_cursor(self.db_conn) as cursor:
            # First check if the packet exists
            cursor.execute(
                "SELECT id FROM data_packets WHERE id = ?", (data_packet.id,)
            )
            if cursor.fetchone() is None:
                raise KeyError(f"Data packet with ID {data_packet.id} not found")

            # Build the update query dynamically
            query_parts = ["UPDATE data_packets SET update_timestamp = ?"]
            params = [
                (
                    data_packet.update_timestamp.isoformat()
                    if data_packet.update_timestamp
                    else datetime.now(timezone.utc).isoformat()
                )
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
                raise KeyError(f"Data packet with ID {data_packet.id} not found")

            # Fetch the updated record (SQLite doesn't support RETURNING)
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (data_packet.id,))
            row = cursor.fetchone()
            if row is None:
                raise ValueError(
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
