"""API endpoints for profile management."""

import uuid
import logging
from typing import List
from fastapi import FastAPI, Depends, HTTPException
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
            raise HTTPException(status_code=404, detail=str(exc))

        @self.app.exception_handler(ProfileIDAlreadyExistsError)
        async def handle_profile_id_already_exists(
            request, exc: ProfileIDAlreadyExistsError
        ):
            raise HTTPException(status_code=400, detail=str(exc))

        @self.app.exception_handler(ProfileUserAlreadyHasProfileError)
        async def handle_profile_user_already_has_profile(
            request, exc: ProfileUserAlreadyHasProfileError
        ):
            raise HTTPException(status_code=400, detail=str(exc))

        @self.app.exception_handler(ProfileError)
        # pylint: disable=unused-argument
        async def handle_profile_error(request, exc: ProfileError):
            logger.error("Internal profile error: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc))

    async def create_profile(
        self, create_profile_request: CreateProfileRequest
    ) -> Profile:
        """Create a new profile.

        Args:
            create_profile_request: The request to create a new profile

        Returns:
            The created profile
        """

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

    async def get_profile(self, profile_id: str) -> Profile:
        """Get a profile by its ID.

        Args:
            profile_id: The ID of the profile to retrieve

        Returns:
            The requested profile
        """
        internal_profile = self.service.get_profile(profile_id)
        response_profile = Profile(**internal_profile.model_dump())
        return response_profile

    async def list_profiles(
        self,
        query_params: ProfileQueryParams = Depends(ProfileQueryParams.as_query_params),
    ) -> List[Profile]:
        """List all profiles.

        Args:
            query_params: Optional query parameters for filtering (currently not used)

        Returns:
            A list of all profiles
        """

        # TODO: user_id is a placeholder for now, we need to get the current user from the token
        internal_query_params = ProfileQueryParamsInternal(
            user_id=query_params.user_id if query_params.user_id else "*",
            name=query_params.name,
            limit=query_params.limit,
            offset=query_params.offset,
            sort_order=query_params.sort_order,
        )

        internal_profiles = self.service.list_profiles(internal_query_params)
        response_profiles = [Profile(**p.model_dump()) for p in internal_profiles]
        return response_profiles
