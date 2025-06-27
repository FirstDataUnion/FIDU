"""API endpoints for profile management."""

import uuid
import logging
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fidu_core.security import JWTManager
from .schema import (
    Profile,
    CreateProfileRequest,
    ProfileQueryParams,
    ProfileQueryParamsInternal,
    ProfileInternal,
)
from .service import ProfileService
from .exceptions import (
    ProfileNotFoundError,
    ProfileIDAlreadyExistsError,
    ProfileUserAlreadyHasProfileError,
    ProfileError,
)

logger = logging.getLogger(__name__)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/users/login")


class ProfileAPI:
    """API endpoints for profile management."""

    def __init__(self, app: FastAPI, service: ProfileService) -> None:
        """Initialize the API layer.

        Args:
            app: The FastAPI app to mount the API on
            service: The service layer for profile operations
        """
        self.service = service
        self.app = app
        self.jwt_manager = JWTManager()
        self._setup_routes()
        self._setup_exception_handlers()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        self.app.add_api_route(
            "/api/v1/profiles",
            self.create_profile,
            methods=["POST"],
            response_model=Profile,
            tags=["profiles"],
        )
        self.app.add_api_route(
            "/api/v1/profiles/{profile_id}",
            self.get_profile,
            methods=["GET"],
            response_model=Profile,
            tags=["profiles"],
        )
        self.app.add_api_route(
            "/api/v1/profiles",
            self.list_profiles,
            methods=["GET"],
            response_model=List[Profile],
            tags=["profiles"],
        )

    def _setup_exception_handlers(self) -> None:
        """Set up exception handlers for the API."""

        @self.app.exception_handler(ProfileNotFoundError)
        async def handle_profile_not_found(request, exc: ProfileNotFoundError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

        @self.app.exception_handler(ProfileIDAlreadyExistsError)
        async def handle_profile_id_already_exists(
            request, exc: ProfileIDAlreadyExistsError
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

        @self.app.exception_handler(ProfileUserAlreadyHasProfileError)
        async def handle_profile_user_already_has_profile(
            request, exc: ProfileUserAlreadyHasProfileError
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

        @self.app.exception_handler(ProfileError)
        # pylint: disable=unused-argument
        async def handle_profile_error(request, exc: ProfileError):
            logger.error("Internal profile error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
            )

    async def create_profile(
        self,
        create_profile_request: CreateProfileRequest,
        token: str = Depends(oauth2_scheme),
    ) -> Profile:
        """Create a new profile.

        Args:
            create_profile_request: The request to create a new profile
            token: The JWT token from the Authorization header

        Returns:
            The created profile

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        token_data = self.jwt_manager.verify_token_or_raise(token)
        user_id = token_data.user_id

        # Ensure the profile is being created for the authenticated user
        if create_profile_request.profile.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create profiles for yourself",
            )

        # Convert request to internal model
        request_id = create_profile_request.request_id
        profile_internal = ProfileInternal(
            id=str(uuid.uuid4()),
            user_id=create_profile_request.profile.user_id,
            name=create_profile_request.profile.name,
        )
        # Call service layer to create profile
        created_profile = self.service.create_profile(request_id, profile_internal)
        # Convert internal model to response model
        response_profile = Profile(**created_profile.model_dump())

        return response_profile

    async def get_profile(
        self, profile_id: str, token: str = Depends(oauth2_scheme)
    ) -> Profile:
        """Get a profile by its ID.

        Args:
            profile_id: The ID of the profile to retrieve
            token: The JWT token from the Authorization header

        Returns:
            The requested profile

        Raises:
            HTTPException: If the token is invalid or the user is not authorized
        """
        # Validate token and get user ID
        token_data = self.jwt_manager.verify_token_or_raise(token)
        user_id = token_data.user_id

        internal_profile = self.service.get_profile(profile_id)

        # Ensure the user can only access their own profiles
        if internal_profile.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access this profile",
            )

        response_profile = Profile(**internal_profile.model_dump())
        return response_profile

    async def list_profiles(
        self,
        query_params: ProfileQueryParams = Depends(ProfileQueryParams.as_query_params),
        token: str = Depends(oauth2_scheme),
    ) -> List[Profile]:
        """List all profiles.

        Args:
            query_params: Optional query parameters for filtering
            token: The JWT token from the Authorization header

        Returns:
            A list of all profiles for the authenticated user

        Raises:
            HTTPException: If the token is invalid
        """
        # Validate token and get user ID
        token_data = self.jwt_manager.verify_token_or_raise(token)
        user_id = token_data.user_id

        # Override any user_id in query params to ensure users can only see their own profiles
        internal_query_params = ProfileQueryParamsInternal(
            user_id=user_id,  # Always use the authenticated user's ID
            name=query_params.name,
            limit=query_params.limit,
            offset=query_params.offset,
            sort_order=query_params.sort_order,
        )

        internal_profiles = self.service.list_profiles(internal_query_params)
        response_profiles = [Profile(**p.model_dump()) for p in internal_profiles]
        return response_profiles
