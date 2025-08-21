"""Tests for API key store functionality."""

import pytest
from datetime import datetime, timezone
from fidu_vault.api_keys.store import LocalSqlAPIKeyStore
from fidu_vault.api_keys.schema import (
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyQueryParamsInternal,
)
from fidu_vault.api_keys.exceptions import APIKeyNotFoundError, APIKeyDuplicateError
from fidu_vault.utils.test_helpers import setup_test_db


@pytest.fixture
def store():
    """Create a LocalSqlAPIKeyStore instance with a fresh database."""
    return LocalSqlAPIKeyStore()


class TestLocalSqlAPIKeyStore:
    """Test the local SQL API key store."""

    def test_create_api_key(self, store):
        """Test creating a new API key."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        result = store.create(api_key_create)

        assert result.id == api_key_create.id
        assert result.provider == "openai"
        assert result.api_key == "sk-1234567890"
        assert result.user_id == "user-123"
        assert isinstance(result.create_timestamp, datetime)
        assert isinstance(result.update_timestamp, datetime)

    def test_create_api_key_duplicate_provider_user(self, store):
        """Test that creating duplicate API keys for same provider/user fails."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        # Create first API key
        store.create(api_key_create)

        # Try to create another with same provider/user
        duplicate_create = APIKeyCreate(
            provider="openai", api_key="sk-different-key", user_id="user-123"
        )

        with pytest.raises(APIKeyDuplicateError):
            store.create(duplicate_create)

    def test_create_api_key_different_provider_same_user(self, store):
        """Test that creating API keys for different providers with same user works."""
        api_key_create_1 = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        api_key_create_2 = APIKeyCreate(
            provider="anthropic", api_key="sk-ant-1234567890", user_id="user-123"
        )

        # Both should succeed
        result1 = store.create(api_key_create_1)
        result2 = store.create(api_key_create_2)

        assert result1.provider == "openai"
        assert result2.provider == "anthropic"
        assert result1.user_id == result2.user_id

    def test_get_api_key(self, store):
        """Test retrieving an API key by ID."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        created = store.create(api_key_create)
        retrieved = store.get(created.id)

        assert retrieved.id == created.id
        assert retrieved.provider == created.provider
        assert retrieved.api_key == created.api_key
        assert retrieved.user_id == created.user_id

    def test_get_api_key_not_found(self, store):
        """Test that getting non-existent API key raises error."""
        with pytest.raises(APIKeyNotFoundError):
            store.get("non-existent-id")

    def test_update_api_key(self, store):
        """Test updating an existing API key."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        created = store.create(api_key_create)

        # Update the API key
        update = APIKeyUpdate(id=created.id, api_key="sk-new-key-123")

        updated = store.update(update)

        assert updated.id == created.id
        assert updated.provider == created.provider
        assert updated.api_key == "sk-new-key-123"
        assert updated.user_id == created.user_id
        assert updated.update_timestamp > created.update_timestamp

    def test_update_api_key_not_found(self, store):
        """Test that updating non-existent API key raises error."""
        update = APIKeyUpdate(id="non-existent-id", api_key="new-key")

        with pytest.raises(APIKeyNotFoundError):
            store.update(update)

    def test_delete_api_key(self, store):
        """Test deleting an API key."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        created = store.create(api_key_create)

        # Delete the API key
        store.delete(created.id)

        # Verify it's gone
        with pytest.raises(APIKeyNotFoundError):
            store.get(created.id)

    def test_delete_api_key_not_found(self, store):
        """Test that deleting non-existent API key raises error."""
        with pytest.raises(APIKeyNotFoundError):
            store.delete("non-existent-id")

    def test_list_api_keys(self, store):
        """Test listing API keys with filters."""
        # Create multiple API keys
        api_key_1 = store.create(
            APIKeyCreate(provider="openai", api_key="sk-1234567890", user_id="user-123")
        )

        api_key_2 = store.create(
            APIKeyCreate(
                provider="anthropic", api_key="sk-ant-1234567890", user_id="user-123"
            )
        )

        api_key_3 = store.create(
            APIKeyCreate(provider="openai", api_key="sk-0987654321", user_id="user-456")
        )

        # Test listing all for a specific user
        query_params = APIKeyQueryParamsInternal(user_id="user-123")
        results = store.list(query_params)

        assert len(results) == 2
        user_ids = {r.user_id for r in results}
        assert user_ids == {"user-123"}

        # Test listing all for a specific provider
        query_params = APIKeyQueryParamsInternal(provider="openai")
        results = store.list(query_params)

        assert len(results) == 2
        providers = {r.provider for r in results}
        assert providers == {"openai"}

        # Test listing with both filters
        query_params = APIKeyQueryParamsInternal(user_id="user-123", provider="openai")
        results = store.list(query_params)

        assert len(results) == 1
        assert results[0].user_id == "user-123"
        assert results[0].provider == "openai"

    def test_list_api_keys_pagination(self, store):
        """Test listing API keys with pagination."""
        # Create multiple API keys
        for i in range(5):
            store.create(
                APIKeyCreate(
                    provider=f"provider-{i}", api_key=f"sk-{i}", user_id="user-123"
                )
            )

        # Test limit
        query_params = APIKeyQueryParamsInternal(limit=3)
        results = store.list(query_params)
        assert len(results) == 3

        # Test offset
        query_params = APIKeyQueryParamsInternal(limit=3, offset=2)
        results = store.list(query_params)
        assert len(results) == 3

    def test_get_by_provider(self, store):
        """Test getting API key by provider and user ID."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        created = store.create(api_key_create)

        # Get by provider
        retrieved = store.get_by_provider("openai", "user-123")

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.provider == "openai"
        assert retrieved.user_id == "user-123"

    def test_get_by_provider_not_found(self, store):
        """Test that getting non-existent provider/user combination returns None."""
        result = store.get_by_provider("openai", "user-123")
        assert result is None

    def test_persistence_across_instances(self, store):
        """Test that data persists across store instances."""
        api_key_create = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        # Create with first instance
        created = store.create(api_key_create)

        # Create new instance (should see same data)
        new_store = LocalSqlAPIKeyStore()
        retrieved = new_store.get(created.id)

        assert retrieved.id == created.id
        assert retrieved.provider == created.provider
        assert retrieved.api_key == created.api_key
        assert retrieved.user_id == created.user_id
