"""Local SQL storage for users."""

import sqlite3
from datetime import datetime, timezone
from typing import List
from .store import UserStoreInterface
from ..schema import UserInternal
from ...utils.db import get_cursor
from ..exceptions import UserNotFoundError, UserError, UserAlreadyExistsError


class LocalSqlUserStore(UserStoreInterface):
    """Local SQL storage for users."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        create_request_id TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        password_hash TEXT,
        create_timestamp TEXT NOT NULL, 
        update_timestamp TEXT NOT NULL
    )
    """

    def __init__(self) -> None:
        """Initialize the user object storage layer."""
        # Initialize tables on first use
        self._ensure_tables_exist()

    def _ensure_tables_exist(self) -> None:
        """Ensure that the required tables exist."""
        with get_cursor() as cursor:
            cursor.execute(self.create_table_query)

    def _row_to_user_internal(self, row: tuple, cursor) -> UserInternal:
        """Convert a database row tuple to a UserInternal object."""
        try:
            # Convert to dict using column names
            columns = [description[0] for description in cursor.description]
            user_dict = dict(zip(columns, row))

            # Handle datetime conversion
            for field in ["create_timestamp", "update_timestamp"]:
                if user_dict.get(field):
                    user_dict[field] = datetime.fromisoformat(user_dict[field])

            return UserInternal(**user_dict)
        except Exception as e:
            raise UserError(
                f"Failed to convert database row to UserInternal: {e}"
            ) from e

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC."""
        return datetime.now(timezone.utc)

    def store_user(self, request_id: str, user: UserInternal) -> UserInternal:
        """Store a user in the system."""

        if user.create_timestamp is None:
            user.create_timestamp = self._get_current_timestamp()
        if user.update_timestamp is None:
            user.update_timestamp = self._get_current_timestamp()

        query = """
        INSERT INTO users (
            id, email, create_request_id, first_name, last_name, password_hash, create_timestamp, update_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(create_request_id) DO NOTHING
        """

        # Convert datetime objects to ISO format strings
        create_timestamp_iso = user.create_timestamp.isoformat()
        update_timestamp_iso = user.update_timestamp.isoformat()

        with get_cursor() as cursor:
            try:
                cursor.execute(
                    query,
                    (
                        user.id,
                        user.email,
                        request_id,
                        user.first_name,
                        user.last_name,
                        user.password_hash,
                        create_timestamp_iso,
                        update_timestamp_iso,
                    ),
                )
            except sqlite3.IntegrityError as e:
                if "UNIQUE constraint failed" in str(e) and "users.email" in str(e):
                    raise UserAlreadyExistsError(None, user.email) from e
                if "UNIQUE constraint failed" in str(e) and "users.id" in str(e):
                    raise UserAlreadyExistsError(user.id, None) from e
                raise UserError(f"Failed to store user: {e}") from e

            # Check for a conflict create request id, leading to now rows being added
            # or exceptions being raised.
            if cursor.rowcount == 0:
                # If so, handle the idempotent request by returning the existing user.
                cursor.execute(
                    "SELECT * FROM users WHERE create_request_id = ?", (request_id,)
                )
                row = cursor.fetchone()
                return self._row_to_user_internal(row, cursor)

            return user

    def get_user(self, user_id: str) -> UserInternal:
        """Get a user from the system by their ID."""
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()

            if row is None:
                raise UserNotFoundError(user_id)

            return self._row_to_user_internal(row, cursor)

    def get_user_by_email(self, email: str) -> UserInternal:
        """Get a user from the system by their email."""
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()

            if row is None:
                raise UserNotFoundError(email)

            return self._row_to_user_internal(row, cursor)

    def list_users(self) -> List[UserInternal]:
        """List all users in the system."""
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM users")
            rows = cursor.fetchall()
            return [self._row_to_user_internal(row, cursor) for row in rows]
