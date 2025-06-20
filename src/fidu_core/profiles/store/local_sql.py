"""
Local SQL storage for profiles.
"""

import sqlite3
from datetime import datetime
from typing import List
from .store import ProfileStoreInterface
from ..schema import Profile
from ...utils.db import get_cursor


class LocalSqlProfileStore(ProfileStoreInterface):
    """Local SQL storage for profiles."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        """Initialize the profile storage layer."""
        self.db_conn = db_conn

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(self.create_table_query)

    def _row_to_profile(self, row: tuple, cursor) -> Profile:
        """Convert a database row tuple to a Profile object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            profile_dict = dict(zip(columns, row))

            # Handle datetime conversion
            for field in ["created_at", "updated_at"]:
                if profile_dict.get(field):
                    profile_dict[field] = datetime.fromisoformat(profile_dict[field])

            return Profile(**profile_dict)
        except Exception as e:
            raise ValueError(f"Failed to convert database row to Profile: {e}") from e

    def store_profile(self, profile: Profile) -> Profile:
        """Store a profile in the system."""
        profile.updated_at = datetime.now()
        profile.created_at = datetime.now()

        query = """
        INSERT INTO profiles (
            id, user_id, name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        """

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(
                query,
                (
                    profile.id,
                    profile.user_id,
                    profile.name,
                    profile.created_at,
                    profile.updated_at,
                ),
            )

        return profile

    def get_profile(self, profile_id: str) -> Profile:
        """Get a profile from the system by its ID."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,))
            row = cursor.fetchone()

            if row is None:
                raise KeyError(f"No profile found with ID {profile_id}")

            return self._row_to_profile(row, cursor)

    def get_profiles_by_user_id(self, user_id: str) -> List[Profile]:
        """Get all profiles for a specific user."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
            rows = cursor.fetchall()
            return [self._row_to_profile(row, cursor) for row in rows]

    def list_profiles(self) -> List[Profile]:
        """List all profiles in the system."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM profiles")
            rows = cursor.fetchall()
            return [self._row_to_profile(row, cursor) for row in rows]
