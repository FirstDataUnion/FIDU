"""
Local SQL storage for profiles.
"""

import sqlite3
from datetime import datetime, timezone
from typing import List, Any
from .store import ProfileStoreInterface
from ..schema import ProfileInternal, ProfileQueryParamsInternal
from ..exceptions import (
    ProfileError,
    ProfileNotFoundError,
    ProfileUserAlreadyHasProfileError,
)
from ...utils.db import get_cursor


class LocalSqlProfileStore(ProfileStoreInterface):
    """Local SQL storage for profiles."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        create_request_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        """Initialize the profile storage layer."""
        self.db_conn = db_conn

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(self.create_table_query)

            # Create unique constraints on user_id + name
            cursor.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_id_name ON profiles (user_id, name)"
            )

    def _row_to_profile(self, row: tuple, cursor) -> ProfileInternal:
        """Convert a database row tuple to a Profile object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            profile_dict = dict(zip(columns, row))

            # Handle datetime conversion
            for field in ["create_timestamp", "update_timestamp"]:
                if profile_dict.get(field):
                    profile_dict[field] = datetime.fromisoformat(profile_dict[field])

            return ProfileInternal(**profile_dict)
        except Exception as e:
            raise ValueError(f"Failed to convert database row to Profile: {e}") from e

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC."""
        return datetime.now(timezone.utc)

    def store_profile(
        self, request_id: str, profile: ProfileInternal
    ) -> ProfileInternal:
        """Store a profile in the system."""

        query = """
        INSERT INTO profiles (
            id, create_request_id, user_id, name, create_timestamp, update_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(create_request_id) DO NOTHING
        """

        if not profile.create_timestamp:
            profile.create_timestamp = self._get_current_timestamp()
        if not profile.update_timestamp:
            profile.update_timestamp = self._get_current_timestamp()

        create_timestamp_iso = profile.create_timestamp.isoformat()
        update_timestamp_iso = profile.update_timestamp.isoformat()

        with get_cursor(self.db_conn) as cursor:
            try:
                cursor.execute(
                    query,
                    (
                        profile.id,
                        request_id,
                        profile.user_id,
                        profile.name,
                        create_timestamp_iso,
                        update_timestamp_iso,
                    ),
                )

                # if no insert occured with no error, we have a request ID conflict and idempotent
                # request. Return existing profile.
                if cursor.rowcount > 0:
                    # row was inserted, return the profile
                    return profile

                # row was not inserted, we have a request ID conflict and idempotent request.
                # Fetch the existing profile.
                cursor.execute(
                    "SELECT * FROM profiles WHERE create_request_id = ?", (request_id,)
                )
                row = cursor.fetchone()
                if row is None:
                    raise ProfileError(
                        f"Request ID {request_id} conflict detected but no existing row found"
                    )

                existing_profile = self._row_to_profile(row, cursor)

                # Make sure we're not returning a profile for a different user.
                if existing_profile.user_id != profile.user_id:
                    raise ProfileError(
                        f"Request ID {request_id} conflict detected but user ID mismatch"
                    )

                return existing_profile

            except sqlite3.IntegrityError as e:
                # if idx_user_id_name constraint failed, we have a duplicate profile name.
                if (
                    "UNIQUE constraint failed" in str(e)
                    and "user_id" in str(e)
                    and "name" in str(e)
                ):
                    raise ProfileUserAlreadyHasProfileError(
                        profile.user_id, profile.name
                    ) from e

                # Re-raise other integrity errors as they might be different constraint violations
                raise ProfileError(f"Failed to store profile: {e}") from e

    def get_profile(self, profile_id: str) -> ProfileInternal:
        """Get a profile from the system by its ID."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,))
            row = cursor.fetchone()

            if row is None:
                raise ProfileNotFoundError(profile_id)

            return self._row_to_profile(row, cursor)

    def list_profiles(
        self, query_params: ProfileQueryParamsInternal
    ) -> List[ProfileInternal]:
        """List all profiles in the system."""

        # Build the query based on the query params
        query = "SELECT * FROM profiles WHERE user_id = ?"
        params: List[Any] = []
        params.append(query_params.user_id)

        if query_params.name:
            query += " AND name = ?"
            params.append(query_params.name)

        sort_order = "desc"
        if query_params.sort_order:
            sort_order = query_params.sort_order
        query += " ORDER BY create_timestamp " + sort_order
        query += " LIMIT ? OFFSET ?"
        params.extend([query_params.limit, query_params.offset])

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_profile(row, cursor) for row in rows]
