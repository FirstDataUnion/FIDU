"""
Database utilities.

This module provides utilities for interacting with the database.
"""

import os
import sqlite3
import sys
import shutil
import threading
from pathlib import Path
from contextlib import contextmanager
from typing import Generator


def get_app_data_dir() -> Path:
    """
    Get the appropriate application data directory for the current operating system.

    Returns:
        Path: Path to the application data directory
    """
    try:
        if sys.platform == "win32":
            # Windows: %APPDATA%\FIDU
            app_data = os.environ.get("APPDATA")
            if app_data:
                return Path(app_data) / "FIDU"

            # Fallback to user home directory
            return Path.home() / "AppData" / "Roaming" / "FIDU"

        if sys.platform == "darwin":
            # macOS: ~/Library/Application Support/FIDU
            return Path.home() / "Library" / "Application Support" / "FIDU"

        # Linux and other Unix-like systems: ~/.local/share/fidu
        return Path.home() / ".local" / "share" / "fidu"
    except (OSError, PermissionError) as e:
        # Fallback to current directory if we can't determine the proper path
        print(f"Warning: Could not determine proper app data directory: {e}")
        print("Falling back to current directory")
        return Path.cwd()


def ensure_app_data_dir() -> Path:
    """
    Ensure the application data directory exists and return its path.

    Returns:
        Path: Path to the created application data directory
    """
    try:
        app_data_dir = get_app_data_dir()
        app_data_dir.mkdir(parents=True, exist_ok=True)
        return app_data_dir
    except (OSError, PermissionError) as e:
        print(f"Warning: Could not create app data directory: {e}")
        print("Falling back to current directory")
        return Path.cwd()


# Thread-local storage for database connections
_thread_local = threading.local()

# Global variable to override database path for testing
_TEST_DB_PATH = None


def get_db_path() -> str:
    """Get the database file path."""
    if _TEST_DB_PATH is not None:
        return _TEST_DB_PATH

    # Get the application data directory and ensure it exists
    app_data_dir = ensure_app_data_dir()
    db_file = app_data_dir / "fidu.db"
    return str(db_file)


def set_test_db_path(path: str) -> None:
    """Set the database path for testing purposes.

    This function allows tests to use in-memory databases or specific test files.
    Call this before creating any store instances in your tests.

    Args:
        path: The database path to use (e.g., ":memory:" for in-memory database)
    """
    global _TEST_DB_PATH  # pylint: disable=global-statement
    _TEST_DB_PATH = path


def reset_db_path() -> None:
    """Reset the database path to the default for production use."""
    global _TEST_DB_PATH  # pylint: disable=global-statement
    _TEST_DB_PATH = None


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
def get_cursor() -> Generator[sqlite3.Cursor, None, None]:
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


def migrate_existing_db() -> bool:
    """
    Attempt to migrate an existing database from the old location to the new location.

    This function looks for a database file named 'fidu.db' in the current working directory
    and moves it to the new application data directory if found.

    Returns:
        bool: True if migration was successful or not needed, False if migration failed
    """
    try:
        old_db_path = Path.cwd() / "fidu.db"
        new_db_path = Path(get_db_path())

        # If the new database already exists, no migration needed
        if new_db_path.exists():
            return True

        # If old database exists, migrate it
        if old_db_path.exists():
            print(f"Found existing database at: {old_db_path}")
            print(f"Migrating to: {new_db_path}")

            # Ensure the new directory exists
            new_db_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy the database file
            shutil.copy2(old_db_path, new_db_path)

            # Verify the copy was successful
            if new_db_path.exists():
                print("Database migration completed successfully!")
                print(f"Old database remains at: {old_db_path}")
                print("You can safely delete the old database file if desired.")
                return True

            print(
                "Warning: Database migration failed - new database not found after copy"
            )
            return False
        # No old database to migrate
        return True

    except (OSError, PermissionError, shutil.Error) as e:
        print(f"Error during database migration: {e}")
        return False
