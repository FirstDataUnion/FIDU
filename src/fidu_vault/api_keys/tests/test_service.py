"""Tests for API key service layer."""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from fidu_vault.api_keys.service import APIKeyService
from fidu_vault.api_keys.schema import (
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyQueryParams,
    APIKeyQueryParamsInternal,
    APIKey,
    APIKeyWithValue,
    APIKeyInternal,
)
from fidu_vault.api_keys.exceptions import APIKeyError, APIKeyNotFoundError
from fidu_vault.utils.test_helpers import setup_test_db


@pytest.fixture
def mock_store():
    """Create a mock store object for testing."""
    return Mock()


@pytest.fixture
def service(mock_store):
    """Create an APIKeyService object for testing."""
    return APIKeyService(mock_store)


@pytest.fixture
def sample_api_key_internal():
    """Create a sample APIKeyInternal object for testing."""
    return APIKeyInternal(
        id="test-id-123",
        provider="openai",
        api_key="sk-test-1234567890",
        user_id="user-123",
        create_timestamp=datetime.now(timezone.utc),
        update_timestamp=datetime.now(timezone.utc),
    )


@pytest.fixture
def sample_api_key_create():
    """Create a sample APIKeyCreate object for testing."""
    return APIKeyCreate(
        provider="openai", api_key="sk-test-1234567890", user_id="user-123"
    )


@pytest.fixture
def sample_api_key_update():
    """Create a sample APIKeyUpdate object for testing."""
    return APIKeyUpdate(id="test-id-123", api_key="sk-test-updated-1234567890")


@pytest.fixture
def sample_query_params():
    """Create sample query parameters for testing."""
    return APIKeyQueryParams(user_id="user-123", provider="openai", limit=10, offset=0)


class TestAPIKeyService:
    """Test the API key service layer."""

    def test_create_api_key_success(
        self, service, mock_store, sample_api_key_create, sample_api_key_internal
    ):
        """Test successful API key creation."""
        mock_store.create.return_value = sample_api_key_internal

        result = service.create_api_key(sample_api_key_create)

        mock_store.create.assert_called_once_with(sample_api_key_create)
        assert isinstance(result, APIKey)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert result.user_id == sample_api_key_internal.user_id
        # Note: api_key field should not be present in the response

    def test_create_api_key_store_error(
        self, service, mock_store, sample_api_key_create
    ):
        """Test API key creation when store raises an error."""
        mock_store.create.side_effect = Exception("Store error")

        with pytest.raises(APIKeyError, match="Failed to create API key: Store error"):
            service.create_api_key(sample_api_key_create)

    def test_get_api_key_success(self, service, mock_store, sample_api_key_internal):
        """Test successful API key retrieval (without value)."""
        mock_store.get.return_value = sample_api_key_internal

        result = service.get_api_key("test-id-123")

        mock_store.get.assert_called_once_with("test-id-123")
        assert isinstance(result, APIKey)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert result.user_id == sample_api_key_internal.user_id
        # Note: api_key field should not be present in the response

    def test_get_api_key_with_value_success(
        self, service, mock_store, sample_api_key_internal
    ):
        """Test successful API key retrieval with value."""
        mock_store.get.return_value = sample_api_key_internal

        result = service.get_api_key_with_value("test-id-123")

        mock_store.get.assert_called_once_with("test-id-123")
        assert isinstance(result, APIKeyWithValue)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert (
            result.api_key == sample_api_key_internal.api_key
        )  # This should include the value
        assert result.user_id == sample_api_key_internal.user_id

    def test_get_api_key_not_found(self, service, mock_store):
        """Test API key retrieval when not found."""
        mock_store.get.side_effect = APIKeyNotFoundError("API key not found")

        with pytest.raises(APIKeyNotFoundError, match="API key not found"):
            service.get_api_key("non-existent-id")

    def test_get_api_key_with_value_not_found(self, service, mock_store):
        """Test API key retrieval with value when not found."""
        mock_store.get.side_effect = APIKeyNotFoundError("API key not found")

        with pytest.raises(APIKeyNotFoundError, match="API key not found"):
            service.get_api_key_with_value("non-existent-id")

    def test_update_api_key_success(
        self, service, mock_store, sample_api_key_update, sample_api_key_internal
    ):
        """Test successful API key update."""
        mock_store.update.return_value = sample_api_key_internal

        result = service.update_api_key(sample_api_key_update)

        mock_store.update.assert_called_once_with(sample_api_key_update)
        assert isinstance(result, APIKey)
        assert result.id == sample_api_key_internal.id

    def test_delete_api_key_success(self, service, mock_store):
        """Test successful API key deletion."""
        service.delete_api_key("test-id-123")

        mock_store.delete.assert_called_once_with("test-id-123")

    def test_list_api_keys_success(
        self, service, mock_store, sample_query_params, sample_api_key_internal
    ):
        """Test successful API key listing (without values)."""
        mock_store.list.return_value = [sample_api_key_internal]

        result = service.list_api_keys(sample_query_params)

        # Verify the query params were converted correctly
        expected_internal_params = APIKeyQueryParamsInternal(
            user_id=sample_query_params.user_id,
            provider=sample_query_params.provider,
            limit=sample_query_params.limit,
            offset=sample_query_params.offset,
        )
        mock_store.list.assert_called_once_with(expected_internal_params)

        assert len(result) == 1
        assert isinstance(result[0], APIKey)
        assert result[0].id == sample_api_key_internal.id

    def test_get_api_key_by_provider_success(
        self, service, mock_store, sample_api_key_internal
    ):
        """Test successful API key retrieval by provider (without value)."""
        mock_store.get_by_provider.return_value = sample_api_key_internal

        result = service.get_api_key_by_provider("openai", "user-123")

        mock_store.get_by_provider.assert_called_once_with("openai", "user-123")
        assert isinstance(result, APIKey)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider

    def test_get_api_key_by_provider_with_value_success(
        self, service, mock_store, sample_api_key_internal
    ):
        """Test successful API key retrieval by provider with value."""
        mock_store.get_by_provider.return_value = sample_api_key_internal

        result = service.get_api_key_by_provider_with_value("openai", "user-123")

        mock_store.get_by_provider.assert_called_once_with("openai", "user-123")
        assert isinstance(result, APIKeyWithValue)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert (
            result.api_key == sample_api_key_internal.api_key
        )  # This should include the value

    def test_get_api_key_by_provider_not_found(self, service, mock_store):
        """Test API key retrieval by provider when not found."""
        mock_store.get_by_provider.return_value = None

        result = service.get_api_key_by_provider("openai", "user-123")

        assert result is None

    def test_get_api_key_by_provider_with_value_not_found(self, service, mock_store):
        """Test API key retrieval by provider with value when not found."""
        mock_store.get_by_provider.return_value = None

        result = service.get_api_key_by_provider_with_value("openai", "user-123")

        assert result is None

    def test_internal_to_response_conversion(self, service, sample_api_key_internal):
        """Test conversion from internal to response model (without value)."""
        result = service._internal_to_response(sample_api_key_internal)

        assert isinstance(result, APIKey)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert result.user_id == sample_api_key_internal.user_id
        assert result.create_timestamp == sample_api_key_internal.create_timestamp
        assert result.update_timestamp == sample_api_key_internal.update_timestamp
        # Verify api_key field is not present
        assert not hasattr(result, "api_key")

    def test_internal_to_response_with_value_conversion(
        self, service, sample_api_key_internal
    ):
        """Test conversion from internal to response model with value."""
        result = service._internal_to_response_with_value(sample_api_key_internal)

        assert isinstance(result, APIKeyWithValue)
        assert result.id == sample_api_key_internal.id
        assert result.provider == sample_api_key_internal.provider
        assert (
            result.api_key == sample_api_key_internal.api_key
        )  # This should include the value
        assert result.user_id == sample_api_key_internal.user_id
        assert result.create_timestamp == sample_api_key_internal.create_timestamp
        assert result.update_timestamp == sample_api_key_internal.update_timestamp
