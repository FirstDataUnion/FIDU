"""Local SQL storage for users."""

import sqlite3
from datetime import datetime
from typing import List
from .store import UserStoreInterface
from ..schema import UserInternal
from ...utils.db import get_cursor


class LocalSqlUserStore(UserStoreInterface):
    """Local SQL storage for users."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE, first_name TEXT, last_name TEXT, password_hash TEXT, created_at TEXT, updated_at TEXT)
    """

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        """Initialize the user object storage layer."""
        self.db_conn = db_conn

        # Executing these in line for now, but we should use a migration system eventually.
        with get_cursor(self.db_conn) as cursor:
            cursor.execute(self.create_table_query)

    def _row_to_user_internal(self, row: tuple, cursor) -> UserInternal:
        """Convert a database row tuple to a UserInternal object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            user_dict = dict(zip(columns, row))

            # Handle datetime conversion
            for field in ["created_at", "updated_at"]:
                if user_dict.get(field):
                    user_dict[field] = datetime.fromisoformat(user_dict[field])

            return UserInternal(**user_dict)
        except Exception as e:
            raise ValueError(
                f"Failed to convert database row to UserInternal: {e}"
            ) from e

    def store_user(self, user: UserInternal) -> UserInternal:
        """Store a user in the system."""

        user.updated_at = datetime.now()
        user.created_at = datetime.now()

        query = """
        INSERT INTO users (
            id, email, first_name, last_name, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        with get_cursor(self.db_conn) as cursor:
            cursor.execute(
                query,
                (
                    user.id,
                    user.email,
                    user.first_name,
                    user.last_name,
                    user.password_hash,
                    user.created_at,
                    user.updated_at,
                ),
            )
            return user

    def get_user(self, user_id: str) -> UserInternal:
        """Get a user from the system by their ID."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()

            if row is None:
                raise KeyError(f"No user found with ID {user_id}")

            return self._row_to_user_internal(row, cursor)

    def get_user_by_email(self, email: str) -> UserInternal:
        """Get a user from the system by their email."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()

            if row is None:
                raise KeyError(f"No user found with email {email}")

            return self._row_to_user_internal(row, cursor)

    def list_users(self) -> List[UserInternal]:
        """List all users in the system."""
        with get_cursor(self.db_conn) as cursor:
            cursor.execute("SELECT * FROM users")
            rows = cursor.fetchall()
            return [self._row_to_user_internal(row, cursor) for row in rows]
