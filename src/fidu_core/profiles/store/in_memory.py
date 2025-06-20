"""In-memory storage for profiles."""

from typing import Dict, List
from .store import ProfileStoreInterface
from ..schema import Profile


class InMemoryProfileStore(ProfileStoreInterface):
    """In-memory storage for profiles."""

    def __init__(self) -> None:
        """Initialize the storage layer."""
        self.profile_store: Dict[str, Profile] = {}

    def store_profile(self, profile: Profile) -> Profile:
        """Store a profile in the system."""
        self.profile_store[profile.id] = profile
        return profile

    def get_profile(self, profile_id: str) -> Profile:
        """Get a profile from the system by its ID."""
        if profile_id not in self.profile_store:
            raise KeyError(f"No profile found with ID {profile_id}")
        return self.profile_store[profile_id]

    def get_profiles_by_user_id(self, user_id: str) -> List[Profile]:
        """Get all profiles for a specific user."""
        return [p for p in self.profile_store.values() if p.user_id == user_id]

    def list_profiles(self) -> List[Profile]:
        """List all profiles in the system."""
        return list(self.profile_store.values())
