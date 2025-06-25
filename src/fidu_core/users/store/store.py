"""Storage layer for users."""

from abc import abstractmethod, ABCMeta
from typing import List
from ..schema import UserInternal


class UserStoreInterface(metaclass=ABCMeta):
    """Interface for user storage."""

    @classmethod
    def __subclasshook__(cls, subclass):
        """Check if a class is a subclass of UserStoreInterface."""
        return (
            hasattr(subclass, "store_user")
            and callable(subclass.store_user)
            and hasattr(subclass, "get_user")
            and callable(subclass.get_user)
            and hasattr(subclass, "get_user_by_email")
            and callable(subclass.get_user_by_email)
        )

    @abstractmethod
    def store_user(self, request_id: str, user: UserInternal) -> UserInternal:
        """Store a user in the system."""
        raise NotImplementedError

    @abstractmethod
    def get_user(self, user_id: str) -> UserInternal:
        """Get a user from the system by their ID."""
        raise NotImplementedError

    @abstractmethod
    def get_user_by_email(self, email: str) -> UserInternal:
        """Get a user from the system by their email."""
        raise NotImplementedError

    @abstractmethod
    def list_users(self) -> List[UserInternal]:
        """List all users in the system."""
        raise NotImplementedError
