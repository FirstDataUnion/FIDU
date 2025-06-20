"""Service layer for profiles."""

from typing import List
from .schema import Profile
from .store import ProfileStoreInterface


class ProfileService:
    """Service layer for profile operations."""

    def __init__(self, store: ProfileStoreInterface) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer for profiles
        """
        self.store = store

    def create_profile(self, profile: Profile) -> Profile:
        """Create a new profile.

        Args:
            profile: The profile to create

        Returns:
            The created profile
        """
        return self.store.store_profile(profile)

    def get_profile(self, profile_id: str) -> Profile:
        """Get a profile by its ID.

        Args:
            profile_id: The ID of the profile to retrieve

        Returns:
            The requested profile
        """
        return self.store.get_profile(profile_id)

    def get_profiles_by_user_id(self, user_id: str) -> List[Profile]:
        """Get all profiles for a specific user.

        Args:
            user_id: The ID of the user whose profiles to retrieve

        Returns:
            A list of profiles for the specified user
        """
        return self.store.get_profiles_by_user_id(user_id)

    def list_profiles(self) -> List[Profile]:
        """List all profiles.

        Returns:
            A list of all profiles
        """
        return self.store.list_profiles()
