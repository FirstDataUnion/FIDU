"""API layer for external access to API keys."""

import logging
from typing import List
from fastapi import FastAPI, HTTPException, Depends, status, Response, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.security import HTTPBearer
from fidu_vault.api_keys.service import APIKeyService
from fidu_vault.api_keys.schema import (
    APIKey,
    APIKeyCreateRequest,
    APIKeyUpdateRequest,
    APIKeyQueryParams,
    APIKeyWithValue,
)
from fidu_vault.api_keys.exceptions import (
    APIKeyError,
    APIKeyNotFoundError,
    APIKeyDuplicateError,
)
from fidu_vault.identity_service.client import get_user_from_identity_service

logger = logging.getLogger(__name__)

# Security scheme for token authentication
security = HTTPBearer(auto_error=False)


def get_authorization_token(request: Request) -> str:
    """Extract the authorization token from the request headers."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]  # Remove "Bearer " prefix
    return auth_header


class APIKeyAPI:
    """API layer for external access to API keys."""

    def __init__(self, app: FastAPI, api_key_service: APIKeyService):
        """Initialize the API with a service layer."""
        self.app = app
        self.api_key_service = api_key_service
        self._setup_routes()
        self._setup_exception_handlers()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        # Standard API key management endpoints (without actual key values)
        self.app.add_api_route(
            "/api/v1/api-keys",
            self.create_api_key,
            methods=["POST"],
            response_model=APIKey,
            tags=["api-keys"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys/{api_key_id}",
            self.get_api_key,
            methods=["GET"],
            response_model=APIKey,
            tags=["api-keys"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys/{api_key_id}",
            self.update_api_key,
            methods=["PUT"],
            response_model=APIKey,
            tags=["api-keys"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys/{api_key_id}",
            self.delete_api_key,
            methods=["DELETE"],
            tags=["api-keys"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys",
            self.list_api_keys,
            methods=["GET"],
            response_model=List[APIKey],
            tags=["api-keys"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys/provider/{provider}",
            self.get_api_key_by_provider,
            methods=["GET"],
            response_model=APIKey,
            tags=["api-keys"],
        )

        # Secure endpoints for retrieving API keys with actual values
        # These should only be used when the actual API key value is needed
        self.app.add_api_route(
            "/api/v1/api-keys/{api_key_id}/value",
            self.get_api_key_with_value,
            methods=["GET"],
            response_model=APIKeyWithValue,
            tags=["api-keys-secure"],
        )
        self.app.add_api_route(
            "/api/v1/api-keys/provider/{provider}/value",
            self.get_api_key_by_provider_with_value,
            methods=["GET"],
            response_model=APIKeyWithValue,
            tags=["api-keys-secure"],
        )

    def _setup_exception_handlers(self) -> None:
        """Set up exception handlers for converting service exceptions to HTTP responses."""

        @self.app.exception_handler(APIKeyNotFoundError)
        async def handle_api_key_not_found(
            _request: Request,
            exc: APIKeyNotFoundError,
        ) -> Response:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)}
            )

        @self.app.exception_handler(APIKeyDuplicateError)
        async def handle_api_key_duplicate(
            _request: Request,
            exc: APIKeyDuplicateError,
        ) -> Response:
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)}
            )

        @self.app.exception_handler(APIKeyError)
        async def handle_api_key_error(_request: Request, exc: APIKeyError) -> Response:
            logger.error("API key error: %s", exc)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An unexpected error occurred while processing the API key"
                },
            )

    async def create_api_key(
        self,
        request: APIKeyCreateRequest,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Create a new API key.

        Args:
            request: The API key creation request
            authorization: The JWT token from the Authorization header

        Returns:
            The created API key

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate the request by requesting the User from the identity service
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Create the API key
        api_key = self.api_key_service.create_api_key(request.api_key)
        logger.info("Created API key %s for user %s", api_key.id, user.email)

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))

    async def get_api_key(
        self,
        api_key_id: str,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Get an API key by ID (without the actual key value, for display purposes).

        Args:
            api_key_id: The ID of the API key to retrieve
            authorization: The JWT token from the Authorization header

        Returns:
            The API key

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Get the API key
        api_key = self.api_key_service.get_api_key(api_key_id)
        logger.info("Retrieved API key %s for user %s", api_key_id, user.email)

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))

    async def get_api_key_with_value(
        self,
        api_key_id: str,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Get an API key by ID including the actual key value.

        This endpoint should only be used when the actual API key value is needed,
        such as for authenticated API calls to external services.

        Args:
            api_key_id: The ID of the API key to retrieve
            authorization: The JWT token from the Authorization header

        Returns:
            The API key with value

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Get the API key with value
        api_key = self.api_key_service.get_api_key_with_value(api_key_id)
        logger.info(
            "Retrieved API key with value %s for user %s", api_key_id, user.email
        )

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))

    async def update_api_key(
        self,
        api_key_id: str,
        request: APIKeyUpdateRequest,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Update an existing API key.

        Args:
            api_key_id: The ID of the API key to update
            request: The API key update request
            authorization: The JWT token from the Authorization header

        Returns:
            The updated API key

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Ensure the ID in the request matches the path parameter
        if request.api_key.id != api_key_id:
            raise HTTPException(status_code=400, detail="API key ID mismatch")

        # Update the API key
        api_key = self.api_key_service.update_api_key(request.api_key)
        logger.info("Updated API key %s for user %s", api_key_id, user.email)

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))

    async def delete_api_key(
        self,
        api_key_id: str,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Delete an API key.

        Args:
            api_key_id: The ID of the API key to delete
            authorization: The JWT token from the Authorization header

        Returns:
            Success message

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Delete the API key
        self.api_key_service.delete_api_key(api_key_id)
        logger.info("Deleted API key %s for user %s", api_key_id, user.email)

        return JSONResponse(content={"message": "API key deleted successfully"})

    async def list_api_keys(
        self,
        provider: str = None,
        limit: int = 100,
        offset: int = 0,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """List API keys based on query parameters (without actual key values,
        for display purposes).

        Args:
            provider: Filter by provider name
            limit: Maximum number of results to return
            offset: Number of results to skip
            authorization: The JWT token from the Authorization header

        Returns:
            A list of API keys for the authenticated user

        Raises:
            HTTPException: If the token is invalid
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Create query parameters
        query_params = APIKeyQueryParams(
            user_id=user.id, provider=provider, limit=limit, offset=offset
        )

        # List the API keys
        api_keys = self.api_key_service.list_api_keys(query_params)
        logger.info("Listed %d API keys for user %s", len(api_keys), user.email)

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_keys))

    async def get_api_key_by_provider(
        self,
        provider: str,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Get an API key by provider for the authenticated user (without the actual key value,
        for display purposes).

        Args:
            provider: The provider name
            authorization: The JWT token from the Authorization header

        Returns:
            The API key for the specified provider

        Raises:
            HTTPException: If the token is invalid or the API key is not found
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Get the API key
        api_key = self.api_key_service.get_api_key_by_provider(provider, user.id)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"API key not found for provider {provider}",
            )

        logger.info(
            "Retrieved API key by provider %s for user %s", provider, user.email
        )

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))

    async def get_api_key_by_provider_with_value(
        self,
        provider: str,
        authorization: str = Depends(get_authorization_token),
    ) -> Response:
        """Get an API key by provider for the authenticated user including the actual key value.

        This endpoint should only be used when the actual API key value is needed,
        such as for authenticated API calls to external services.

        Args:
            provider: The provider name
            authorization: The JWT token from the Authorization header

        Returns:
            The API key with value for the specified provider

        Raises:
            HTTPException: If the token is invalid or the API key is not found
        """
        # Validate token and get user ID
        user = await get_user_from_identity_service(authorization)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Get the API key with value
        api_key = self.api_key_service.get_api_key_by_provider_with_value(
            provider, user.id
        )
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"API key not found for provider {provider}",
            )

        logger.info(
            "Retrieved API key by provider %s with value for user %s",
            provider,
            user.email,
        )

        # Convert to response model and return as JSONResponse
        return JSONResponse(content=jsonable_encoder(api_key))
