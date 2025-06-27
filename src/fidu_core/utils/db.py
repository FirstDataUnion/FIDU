"""
Database utilities.

This module provides utilities for interacting with the database.
"""

import sqlite3
import threading
from contextlib import contextmanager
from typing import Generator


# Thread-local storage for database connections
_thread_local = threading.local()

# Global variable to override database path for testing
_test_db_path = None


def get_db_path() -> str:
    """Get the database file path."""
    if _test_db_path is not None:
        return _test_db_path
    return "fidu.db"


def set_test_db_path(path: str) -> None:
    """Set the database path for testing purposes.
    
    This function allows tests to use in-memory databases or specific test files.
    Call this before creating any store instances in your tests.
    
    Args:
        path: The database path to use (e.g., ":memory:" for in-memory database)
    """
    global _test_db_path
    _test_db_path = path


def reset_db_path() -> None:
    """Reset the database path to the default for production use."""
    global _test_db_path
    _test_db_path = None


def get_connection() -> sqlite3.Connection:
    """
    Get a database connection for the current thread.

    This function ensures that each thread gets its own database connection,
    which is necessary because SQLite connections are not thread-safe.

    Returns:
        sqlite3.Connection: A database connection for the current thread
    """
    if not hasattr(_thread_local, "connection"):
        db_path = get_db_path()
        _thread_local.connection = sqlite3.connect(db_path)
        # Enable foreign key constraints
        _thread_local.connection.execute("PRAGMA foreign_keys = ON")

    return _thread_local.connection


def close_connection() -> None:
    """Close the database connection for the current thread."""
    if hasattr(_thread_local, "connection"):
        _thread_local.connection.close()
        delattr(_thread_local, "connection")


@contextmanager
def get_cursor(
    db_conn: sqlite3.Connection = None,
) -> Generator[sqlite3.Cursor, None, None]:
    """
    Context manager for SQLite cursor operations with automatic transaction management.

    This context manager:
    - Creates a cursor from the provided database connection (or gets one for current thread)
    - Automatically commits successful transactions
    - Automatically rolls back failed transactions
    - Ensures cursor cleanup in all cases

    Args:
        db_conn: SQLite database connection (optional, will use thread-local
        connection if not provided).

    Yields:
        sqlite3.Cursor: Database cursor for executing queries

    Example:
        ```python
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
        # Transaction is automatically committed if no exception occurred
        ```

    Raises:
        Exception: Any exception that occurs during cursor operations
    """
    if db_conn is None:
        db_conn = get_connection()

    cursor = db_conn.cursor()
    try:
        yield cursor
        db_conn.commit()
    except Exception:
        db_conn.rollback()
        raise
    finally:
        cursor.close()


@contextmanager
def get_db_context() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager for database operations that provides a connection.

    This is useful when you need a connection object for store initialization
    or other operations that require the connection itself.

    Yields:
        sqlite3.Connection: A database connection for the current thread
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        # Don't close the connection here as it's managed by thread-local storage
        pass
