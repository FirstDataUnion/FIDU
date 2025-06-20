"""Storage layer for profiles."""

from abc import abstractmethod, ABCMeta
from typing import List
from ..schema import Profile


class ProfileStoreInterface(metaclass=ABCMeta):
    """Interface for profile storage."""

    @classmethod
    def __subclasshook__(cls, subclass):
        """Check if a class is a subclass of ProfileStoreInterface."""
        return (
            hasattr(subclass, "store_profile")
            and callable(subclass.store_profile)
            and hasattr(subclass, "get_profile")
            and callable(subclass.get_profile)
            and hasattr(subclass, "get_profiles_by_user_id")
            and callable(subclass.get_profiles_by_user_id)
            and hasattr(subclass, "list_profiles")
            and callable(subclass.list_profiles)
        )

    @abstractmethod
    def store_profile(self, profile: Profile) -> Profile:
        """Store a profile in the system."""
        raise NotImplementedError

    @abstractmethod
    def get_profile(self, profile_id: str) -> Profile:
        """Get a profile from the system by its ID."""
        raise NotImplementedError

    @abstractmethod
    def get_profiles_by_user_id(self, user_id: str) -> List[Profile]:
        """Get all profiles for a specific user."""
        raise NotImplementedError

    @abstractmethod
    def list_profiles(self) -> List[Profile]:
        """List all profiles in the system."""
        raise NotImplementedError
