"""
Database utilities.

This module provides utilities for interacting with the database.
"""

from contextlib import contextmanager
from typing import Generator
import sqlite3


@contextmanager
def get_cursor(db_conn: sqlite3.Connection) -> Generator[sqlite3.Cursor, None, None]:
    """
    Context manager for SQLite cursor operations with automatic transaction management.

    This context manager:
    - Creates a cursor from the provided database connection
    - Automatically commits successful transactions
    - Automatically rolls back failed transactions
    - Ensures cursor cleanup in all cases

    Args:
        db_conn: SQLite database connection

    Yields:
        sqlite3.Cursor: Database cursor for executing queries

    Example:
        ```python
        with get_cursor(db_connection) as cursor:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
        # Transaction is automatically committed if no exception occurred
        ```

    Raises:
        Exception: Any exception that occurs during cursor operations
    """
    cursor = db_conn.cursor()
    try:
        yield cursor
        db_conn.commit()
    except Exception:
        db_conn.rollback()
        raise
    finally:
        cursor.close()
