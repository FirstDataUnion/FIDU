"""
Local SQL storage for data packets.
"""

import sqlite3
import json
from datetime import datetime
from typing import List, cast, Any
from .store import DataPacketStoreInterface
from ..schema import (
    DataPacket,
    DataPacketQueryParams,
    DataPacketUpdateRequest,
    StructuredDataPacket,
    UnstructuredDataPacket,
)
from ...utils.db import get_cursor


class LocalSqlDataPacketStore(DataPacketStoreInterface):
    """Local SQL storage for data packets."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS data_packets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        packet_type TEXT NOT NULL CHECK (packet_type IN ('structured', 'unstructured')),
        tags TEXT,  -- JSON array for unstructured packets
        structured_data TEXT,  -- JSON for structured packet data
        unstructured_data TEXT,  -- JSON for unstructured packet data
        FOREIGN KEY (user_id) REFERENCES users (id)
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
                """CREATE INDEX IF NOT EXISTS idx_data_packets_user_id
                ON data_packets(user_id)"""
            )
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packets_timestamp
                ON data_packets(timestamp)"""
            )
            cursor.execute(
                """CREATE INDEX IF NOT EXISTS idx_data_packets_packet_type
                ON data_packets(packet_type)"""
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

    def _row_to_data_packet(self, row: tuple, cursor) -> DataPacket:
        """Convert a database row tuple to a DataPacket object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            packet_dict = dict(zip(columns, row))

            # Handle datetime conversion
            if packet_dict.get("timestamp"):
                packet_dict["timestamp"] = datetime.fromisoformat(
                    packet_dict["timestamp"]
                )

            # Reconstruct the packet based on type
            packet_type = packet_dict["packet_type"]

            if packet_type == "structured":
                structured_data = (
                    json.loads(packet_dict["structured_data"])
                    if packet_dict["structured_data"]
                    else {}
                )
                packet_dict["packet"] = StructuredDataPacket(**structured_data)
            elif packet_type == "unstructured":
                tags = json.loads(packet_dict["tags"]) if packet_dict["tags"] else []
                unstructured_data = (
                    json.loads(packet_dict["unstructured_data"])
                    if packet_dict["unstructured_data"]
                    else {}
                )
                packet_dict["packet"] = UnstructuredDataPacket(
                    tags=tags, data=unstructured_data
                )

            # Remove database-specific fields
            for field in [
                "packet_type",
                "tags",
                "structured_data",
                "unstructured_data",
            ]:
                packet_dict.pop(field, None)

            return DataPacket(**packet_dict)
        except Exception as e:
            raise ValueError(
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

    def store_data_packet(self, data_packet: DataPacket) -> DataPacket:
        """Submit a data packet to the system to be stored."""
        query = """
        INSERT INTO data_packets (
            id, user_id, timestamp, packet_type, tags, structured_data, unstructured_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        # Prepare data based on packet type
        packet_type = data_packet.packet.type
        tags = None
        structured_data = None
        unstructured_data = None

        if packet_type == "structured":
            structured_data = json.dumps(data_packet.packet.model_dump())
        elif packet_type == "unstructured":
            unstructured_data_packet = cast(UnstructuredDataPacket, data_packet.packet)
            tags = json.dumps(unstructured_data_packet.tags)
            unstructured_data = json.dumps(unstructured_data_packet.data)

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(
                query,
                (
                    data_packet.id,
                    data_packet.user_id,
                    data_packet.timestamp.isoformat(),
                    packet_type,
                    tags,
                    structured_data,
                    unstructured_data,
                ),
            )

            # Sync tags to junction table for efficient querying
            if packet_type == "unstructured":
                # cast to UnstructuredDataPacket to ensure safe typing.
                unstructured_data_packet = cast(
                    UnstructuredDataPacket, data_packet.packet
                )
                if unstructured_data_packet.tags:
                    self._sync_tags_to_junction_table(
                        data_packet.id, unstructured_data_packet.tags
                    )

        return data_packet

    def update_data_packet(
        self, data_packet_update_request: DataPacketUpdateRequest
    ) -> DataPacket:
        """Update a data packet in the system."""

        # TODO: Review this along with creation conflicts, as it's very haphazard.

        # First get the existing packet
        existing_packet = self.get_data_packet(
            data_packet_update_request.data_packet.id
        )

        # Apply the update
        updated_packet = data_packet_update_request.apply_update(existing_packet)

        # Store the updated packet
        return self.store_data_packet(updated_packet)

    def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM data_packets WHERE id = ?", (data_packet_id,))
            row = cursor.fetchone()

            if row is None:
                raise ValueError(f"Data packet with ID {data_packet_id} not found")

            return self._row_to_data_packet(row, cursor)

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParams
    ) -> List[DataPacket]:
        """List data packets from the system."""

        print(f"data_packet_query_params: {data_packet_query_params}")

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

        if data_packet_query_params.user_id:
            query_parts.append("AND dp.user_id = ?")
            params.append(data_packet_query_params.user_id)

        if data_packet_query_params.from_timestamp:
            query_parts.append("AND dp.timestamp >= ?")
            params.append(data_packet_query_params.from_timestamp.isoformat())

        if data_packet_query_params.to_timestamp:
            query_parts.append("AND dp.timestamp <= ?")
            params.append(data_packet_query_params.to_timestamp.isoformat())

        if data_packet_query_params.packet_type:
            query_parts.append("AND dp.packet_type = ?")
            params.append(data_packet_query_params.packet_type)

        if data_packet_query_params.tags:
            for tag in data_packet_query_params.tags:
                query_parts.append(
                    "AND dp.id IN (SELECT data_packet_id FROM data_packet_tags WHERE tag = ?)"
                )
                params.append(tag)

        # Add sorting
        sort_order = "DESC" if data_packet_query_params.sort_order == "desc" else "ASC"
        query_parts.append(f"ORDER BY dp.timestamp {sort_order}")

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
                raise ValueError(f"Data packet with ID {data_packet_id} not found")
            cursor.execute(
                "DELETE FROM data_packet_tags WHERE data_packet_id = ?",
                (data_packet_id,),
            )
