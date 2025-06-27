"""
Test helpers for database operations.

This module provides utilities for testing with the thread-local connection pattern.
"""

import pytest
from typing import Dict, List, Any
from .db import get_cursor, set_test_db_path, reset_db_path, close_connection


@pytest.fixture(autouse=True)
def setup_test_db():
    """Automatically set up test database for each test."""
    # Use in-memory database for fast, isolated tests
    set_test_db_path(":memory:")
    yield
    # Clean up after each test
    close_connection()
    reset_db_path()


def get_database_state() -> Dict[str, List[Dict[str, Any]]]:
    """
    Get the current state of the database for inspection.
    
    This function uses the thread-local connection, so it's safe to use
    in tests with the new connection pattern.
    
    Returns:
        Dict containing the state of all tables
    """
    with get_cursor() as cursor:
        # Get all table names
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        
        state = {}
        for table in tables:
            cursor.execute(f"SELECT * FROM {table}")
            rows = []
            for row in cursor.fetchall():
                columns = [description[0] for description in cursor.description]
                rows.append(dict(zip(columns, row)))
            state[table] = rows
        
        return state


def assert_table_has_rows(table_name: str, expected_count: int) -> None:
    """
    Assert that a table has the expected number of rows.
    
    Args:
        table_name: Name of the table to check
        expected_count: Expected number of rows
    """
    with get_cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        actual_count = cursor.fetchone()[0]
        assert actual_count == expected_count, f"Expected {expected_count} rows in {table_name}, got {actual_count}"


def assert_table_contains(table_name: str, expected_data: Dict[str, Any]) -> None:
    """
    Assert that a table contains a row with the specified data.
    
    Args:
        table_name: Name of the table to check
        expected_data: Dictionary of column names and expected values
    """
    with get_cursor() as cursor:
        # Build WHERE clause
        where_conditions = " AND ".join([f"{k} = ?" for k in expected_data.keys()])
        query = f"SELECT COUNT(*) FROM {table_name} WHERE {where_conditions}"
        
        cursor.execute(query, list(expected_data.values()))
        count = cursor.fetchone()[0]
        assert count > 0, f"No rows found in {table_name} matching {expected_data}"


def clear_table(table_name: str) -> None:
    """
    Clear all rows from a table.
    
    Args:
        table_name: Name of the table to clear
    """
    with get_cursor() as cursor:
        cursor.execute(f"DELETE FROM {table_name}")


def get_table_schema(table_name: str) -> List[str]:
    """
    Get the column names for a table.
    
    Args:
        table_name: Name of the table
        
    Returns:
        List of column names
    """
    with get_cursor() as cursor:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return [row[1] for row in cursor.fetchall()] 