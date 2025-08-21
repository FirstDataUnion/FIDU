"""Service layer for API key operations."""

import logging
from typing import List, Optional
from fidu_vault.api_keys.store import APIKeyStore
from fidu_vault.api_keys.schema import (
    APIKeyInternal,
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyQueryParamsInternal,
    APIKey,
    APIKeyQueryParams,
    APIKeyWithValue,
)
from fidu_vault.api_keys.exceptions import APIKeyError, APIKeyNotFoundError

logger = logging.getLogger(__name__)


class APIKeyService:
    """Service layer for API key operations."""

    def __init__(self, store: APIKeyStore):
        """Initialize the service with a store implementation."""
        self.store = store

    def create_api_key(self, api_key: APIKeyCreate) -> APIKey:
        """Create a new API key."""
        try:
            api_key_internal = self.store.create(api_key)
            return self._internal_to_response(api_key_internal)
        except Exception as e:
            logger.error("Failed to create API key: %s", e)
            raise APIKeyError(f"Failed to create API key: {e}") from e

    def get_api_key(self, api_key_id: str) -> APIKey:
        """Get an API key by ID (without the actual key value, for display purposes)."""
        try:
            api_key_internal = self.store.get(api_key_id)
            return self._internal_to_response(api_key_internal)
        except APIKeyNotFoundError:
            raise
        except Exception as e:
            logger.error("Failed to get API key %s: %s", api_key_id, e)
            raise APIKeyError(f"Failed to get API key: {e}") from e

    def get_api_key_with_value(self, api_key_id: str) -> APIKeyWithValue:
        """Get an API key by ID including the actual key value.

        This method should only be used when the actual API key value is needed,
        such as for authenticated API calls to external services.
        """
        try:
            api_key_internal = self.store.get(api_key_id)
            return self._internal_to_response_with_value(api_key_internal)
        except APIKeyNotFoundError:
            raise
        except Exception as e:
            logger.error("Failed to get API key with value %s: %s", api_key_id, e)
            raise APIKeyError(f"Failed to get API key with value: {e}") from e

    def update_api_key(self, api_key: APIKeyUpdate) -> APIKey:
        """Update an existing API key."""
        try:
            api_key_internal = self.store.update(api_key)
            return self._internal_to_response(api_key_internal)
        except APIKeyNotFoundError:
            raise
        except Exception as e:
            logger.error("Failed to update API key %s: %s", api_key.id, e)
            raise APIKeyError(f"Failed to update API key: {e}") from e

    def delete_api_key(self, api_key_id: str) -> None:
        """Delete an API key."""
        try:
            self.store.delete(api_key_id)
        except APIKeyNotFoundError:
            raise
        except Exception as e:
            logger.error("Failed to delete API key %s: %s", api_key_id, e)
            raise APIKeyError(f"Failed to delete API key: {e}") from e

    def list_api_keys(self, query_params: APIKeyQueryParams) -> List[APIKey]:
        """List API keys based on query parameters (without actual key values,
        for display purposes)."""
        try:
            # Convert query params to internal format
            internal_params = APIKeyQueryParamsInternal(
                user_id=query_params.user_id,
                provider=query_params.provider,
                limit=query_params.limit,
                offset=query_params.offset,
            )

            api_keys_internal = self.store.list(internal_params)
            return [
                self._internal_to_response(api_key) for api_key in api_keys_internal
            ]
        except Exception as e:
            logger.error("Failed to list API keys: %s", e)
            raise APIKeyError(f"Failed to list API keys: {e}") from e

    def get_api_key_by_provider(self, provider: str, user_id: str) -> Optional[APIKey]:
        """Get an API key by provider and user ID (without the actual key value,
        for display purposes)."""
        try:
            api_key_internal = self.store.get_by_provider(provider, user_id)
            if api_key_internal:
                return self._internal_to_response(api_key_internal)
            return None
        except Exception as e:
            logger.error("Failed to get API key by provider: %s", e)
            raise APIKeyError(f"Failed to get API key by provider: {e}") from e

    def get_api_key_by_provider_with_value(
        self, provider: str, user_id: str
    ) -> Optional[APIKeyWithValue]:
        """Get an API key by provider and user ID including the actual key value.

        This method should only be used when the actual API key value is needed,
        such as for authenticated API calls to external services.
        """
        try:
            api_key_internal = self.store.get_by_provider(provider, user_id)
            if api_key_internal:
                return self._internal_to_response_with_value(api_key_internal)
            return None
        except Exception as e:
            logger.error("Failed to get API key by provider with value: %s", e)
            raise APIKeyError(
                f"Failed to get API key by provider with value: {e}"
            ) from e

    def _internal_to_response(self, api_key_internal: APIKeyInternal) -> APIKey:
        """Convert an internal API key to a response model (without the actual key value)."""
        return APIKey(
            id=api_key_internal.id,
            provider=api_key_internal.provider,
            user_id=api_key_internal.user_id,
            create_timestamp=api_key_internal.create_timestamp,
            update_timestamp=api_key_internal.update_timestamp,
        )

    def _internal_to_response_with_value(
        self, api_key_internal: APIKeyInternal
    ) -> APIKeyWithValue:
        """Convert an internal API key to a response model with the actual key value."""
        return APIKeyWithValue(
            id=api_key_internal.id,
            provider=api_key_internal.provider,
            api_key=api_key_internal.api_key,
            user_id=api_key_internal.user_id,
            create_timestamp=api_key_internal.create_timestamp,
            update_timestamp=api_key_internal.update_timestamp,
        )
