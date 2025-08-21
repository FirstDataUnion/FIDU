"""Storage layer for API keys."""

import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime, timezone
from fidu_vault.utils.db import get_cursor
from fidu_vault.api_keys.schema import (
    APIKeyInternal,
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyQueryParamsInternal,
)
from fidu_vault.api_keys.exceptions import APIKeyNotFoundError, APIKeyDuplicateError

logger = logging.getLogger(__name__)


class APIKeyStore(ABC):
    """Abstract base class for API key storage."""

    @abstractmethod
    def create(self, api_key: APIKeyCreate) -> APIKeyInternal:
        """Create a new API key."""

    @abstractmethod
    def get(self, api_key_id: str) -> APIKeyInternal:
        """Get an API key by ID."""

    @abstractmethod
    def update(self, api_key: APIKeyUpdate) -> APIKeyInternal:
        """Update an existing API key."""

    @abstractmethod
    def delete(self, api_key_id: str) -> None:
        """Delete an API key."""

    @abstractmethod
    def list(self, query_params: APIKeyQueryParamsInternal) -> List[APIKeyInternal]:
        """List API keys based on query parameters."""

    @abstractmethod
    def get_by_provider(self, provider: str, user_id: str) -> Optional[APIKeyInternal]:
        """Get an API key by provider and user ID."""


class LocalSqlAPIKeyStore(APIKeyStore):
    """SQLite-based implementation of API key storage."""

    create_table_query = """
    CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        UNIQUE(provider, user_id)
    )
    """

    def __init__(self):
        """Initialize the store and create the table if it doesn't exist."""
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """Ensure the API keys table exists, create it if it doesn't."""
        try:
            with get_cursor() as cursor:
                cursor.execute(self.create_table_query)
                logger.info("API keys table ensured to exist")
        except Exception as e:
            logger.error("Error ensuring table exists: %s", e)
            raise

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC."""
        return datetime.now(timezone.utc)

    def create(self, api_key: APIKeyCreate) -> APIKeyInternal:
        """Create a new API key."""
        now = self._get_current_timestamp()

        # Check for duplicates
        existing = self.get_by_provider(api_key.provider, api_key.user_id)
        if existing:
            raise APIKeyDuplicateError(
                f"API key already exists for provider {api_key.provider} and user {api_key.user_id}"
            )

        api_key_internal = APIKeyInternal(
            id=api_key.id,
            provider=api_key.provider,
            api_key=api_key.api_key,
            user_id=api_key.user_id,
            create_timestamp=now,
            update_timestamp=now,
        )

        with get_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO api_keys 
                (id, provider, api_key, user_id, create_timestamp, update_timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    api_key_internal.id,
                    api_key_internal.provider,
                    api_key_internal.api_key,
                    api_key_internal.user_id,
                    api_key_internal.create_timestamp.isoformat(),
                    api_key_internal.update_timestamp.isoformat(),
                ),
            )
            logger.info(
                "Successfully created API key %s for provider %s",
                api_key_internal.id,
                api_key_internal.provider,
            )

        return api_key_internal

    def get(self, api_key_id: str) -> APIKeyInternal:
        """Get an API key by ID."""
        with get_cursor() as cursor:
            cursor.execute(
                """
                SELECT id, provider, api_key, user_id, create_timestamp, update_timestamp
                FROM api_keys WHERE id = ?
            """,
                (api_key_id,),
            )
            row = cursor.fetchone()

        if not row:
            raise APIKeyNotFoundError(f"API key with ID {api_key_id} not found")

        return self._row_to_internal(row)

    def update(self, api_key: APIKeyUpdate) -> APIKeyInternal:
        """Update an existing API key."""
        # Get the existing API key
        existing = self.get(api_key.id)

        # Update fields if provided
        if api_key.api_key is not None:
            existing.api_key = api_key.api_key

        existing.update_timestamp = self._get_current_timestamp()

        with get_cursor() as cursor:
            cursor.execute(
                """
                UPDATE api_keys 
                SET api_key = ?, update_timestamp = ?
                WHERE id = ?
            """,
                (existing.api_key, existing.update_timestamp.isoformat(), existing.id),
            )

        return existing

    def delete(self, api_key_id: str) -> None:
        """Delete an API key."""
        with get_cursor() as cursor:
            cursor.execute("DELETE FROM api_keys WHERE id = ?", (api_key_id,))
            if cursor.rowcount == 0:
                raise APIKeyNotFoundError(f"API key with ID {api_key_id} not found")

    def list(self, query_params: APIKeyQueryParamsInternal) -> List[APIKeyInternal]:
        """List API keys based on query parameters."""
        query = (
            "SELECT id, provider, api_key, user_id, create_timestamp, update_timestamp "
            "FROM api_keys"
        )
        params = []
        conditions = []

        if query_params.user_id:
            conditions.append("user_id = ?")
            params.append(query_params.user_id)

        if query_params.provider:
            conditions.append("provider = ?")
            params.append(query_params.provider)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY create_timestamp DESC LIMIT ? OFFSET ?"
        params.extend(
            [
                str(query_params.limit) if query_params.limit is not None else "100",
                str(query_params.offset) if query_params.offset is not None else "0",
            ]
        )

        logger.debug("Executing query: %s with params: %s", query, params)

        with get_cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

        logger.debug("Found %d API keys", len(rows))
        return [self._row_to_internal(row) for row in rows]

    def get_by_provider(self, provider: str, user_id: str) -> Optional[APIKeyInternal]:
        """Get an API key by provider and user ID."""
        with get_cursor() as cursor:
            cursor.execute(
                """
                SELECT id, provider, api_key, user_id, create_timestamp, update_timestamp
                FROM api_keys 
                WHERE provider = ? AND user_id = ?
            """,
                (provider, user_id),
            )
            row = cursor.fetchone()

        if not row:
            return None

        return self._row_to_internal(row)

    def _row_to_internal(self, row: tuple) -> APIKeyInternal:
        """Convert a database row to an APIKeyInternal object."""
        return APIKeyInternal(
            id=str(row[0]) if row[0] is not None else "",
            provider=str(row[1]) if row[1] is not None else "",
            api_key=str(row[2]) if row[2] is not None else "",
            user_id=str(row[3]) if row[3] is not None else "",
            create_timestamp=(
                datetime.fromisoformat(str(row[4]))
                if row[4] is not None
                else datetime.now(timezone.utc)
            ),
            update_timestamp=(
                datetime.fromisoformat(str(row[5]))
                if row[5] is not None
                else datetime.now(timezone.utc)
            ),
        )
