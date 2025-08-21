"""Tests for API key schema models."""

import pytest
from datetime import datetime
from fidu_vault.api_keys.schema import (
    APIKeyCreate,
    APIKeyUpdate,
    APIKey,
    APIKeyQueryParams,
)


class TestAPIKeyCreate:
    """Test APIKeyCreate model."""

    def test_create_with_defaults(self):
        """Test creating API key with default values."""
        api_key = APIKeyCreate(
            provider="openai", api_key="sk-1234567890", user_id="user-123"
        )

        assert api_key.provider == "openai"
        assert api_key.api_key == "sk-1234567890"
        assert api_key.user_id == "user-123"
        assert api_key.id is not None

    def test_create_with_all_fields(self):
        """Test creating API key with all fields."""
        api_key = APIKeyCreate(
            id="custom-id-123",
            provider="anthropic",
            api_key="sk-ant-1234567890",
            user_id="user-456",
        )

        assert api_key.id == "custom-id-123"
        assert api_key.provider == "anthropic"
        assert api_key.api_key == "sk-ant-1234567890"
        assert api_key.user_id == "user-456"


class TestAPIKeyUpdate:
    """Test APIKeyUpdate model."""

    def test_update_with_partial_fields(self):
        """Test updating API key with partial fields."""
        api_key = APIKeyUpdate(id="key-123", api_key="new-api-key")

        assert api_key.id == "key-123"
        assert api_key.api_key == "new-api-key"

    def test_update_with_all_fields(self):
        """Test updating API key with all fields."""
        api_key = APIKeyUpdate(id="key-456", api_key="new-api-key")

        assert api_key.id == "key-456"
        assert api_key.api_key == "new-api-key"


class TestAPIKey:
    """Test APIKey model."""

    def test_api_key_response(self):
        """Test API key response model."""
        now = datetime.utcnow()
        api_key = APIKey(
            id="key-789",
            provider="google",
            user_id="user-789",
            create_timestamp=now,
            update_timestamp=now,
        )

        assert api_key.id == "key-789"
        assert api_key.provider == "google"
        assert api_key.user_id == "user-789"
        assert api_key.create_timestamp == now
        assert api_key.update_timestamp == now


class TestAPIKeyQueryParams:
    """Test APIKeyQueryParams model."""

    def test_query_params_with_filters(self):
        """Test query parameters with filters."""
        params = APIKeyQueryParams(
            user_id="user-123", provider="openai", limit=50, offset=10
        )

        assert params.user_id == "user-123"
        assert params.provider == "openai"
        assert params.limit == 50
        assert params.offset == 10

    def test_query_params_defaults(self):
        """Test query parameters with default values."""
        params = APIKeyQueryParams()

        assert params.user_id is None
        assert params.provider is None
        assert params.limit == 100
        assert params.offset == 0
