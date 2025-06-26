"""Service layer for profiles."""

from typing import List
from .schema import ProfileQueryParamsInternal, ProfileInternal
from .store import ProfileStoreInterface


class ProfileService:
    """Service layer for profile operations."""

    def __init__(self, store: ProfileStoreInterface) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer for profiles
        """
        self.store = store

    def create_profile(
        self, request_id: str, profile: ProfileInternal
    ) -> ProfileInternal:
        """Create a new profile.

        Args:
            profile: The profile to create

        Returns:
            The created profile
        """
        return self.store.store_profile(request_id, profile)

    def get_profile(self, profile_id: str) -> ProfileInternal:
        """Get a profile by its ID.

        Args:
            profile_id: The ID of the profile to retrieve

        Returns:
            The requested profile
        """
        return self.store.get_profile(profile_id)

    def list_profiles(
        self, query_params: ProfileQueryParamsInternal
    ) -> List[ProfileInternal]:
        """List all profiles.

        Returns:
            A list of all profiles
        """
        return self.store.list_profiles(query_params)
