"""API endpoints for profile management."""

from typing import List
from fastapi import FastAPI
from .schema import Profile
from .service import ProfileService


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
            "/api/v1/users/{user_id}/profiles",
            self.get_profiles_by_user_id,
            methods=["GET"],
            response_model=List[Profile],
            tags=["profiles"],
        )
        self.app.add_api_route(
            "/api/v1/profiles",
            self.list_profiles,
            methods=["GET"],
            response_model=List[Profile],
            tags=["profiles"],
        )

    async def create_profile(self, profile: Profile) -> Profile:
        """Create a new profile.

        Args:
            profile: The profile to create

        Returns:
            The created profile
        """
        return self.service.create_profile(profile)

    async def get_profile(self, profile_id: str) -> Profile:
        """Get a profile by its ID.

        Args:
            profile_id: The ID of the profile to retrieve

        Returns:
            The requested profile
        """
        return self.service.get_profile(profile_id)

    async def get_profiles_by_user_id(self, user_id: str) -> List[Profile]:
        """Get all profiles for a specific user.

        Args:
            user_id: The ID of the user whose profiles to retrieve

        Returns:
            A list of profiles for the specified user
        """
        return self.service.get_profiles_by_user_id(user_id)

    async def list_profiles(self) -> List[Profile]:
        """List all profiles.

        Returns:
            A list of all profiles
        """
        return self.service.list_profiles()
