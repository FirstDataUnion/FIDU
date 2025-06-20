"""Service layer for user management."""

from typing import List
from .schema import UserInternal
from .store import UserStoreInterface


class UserService:
    """Service layer for user operations."""

    def __init__(self, store: UserStoreInterface) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer for users
        """
        self.store = store

    def create_user(self, user: UserInternal) -> UserInternal:
        """Create a new user.

        Args:
            user: The user to create

        Returns:
            The created user
        """
        return self.store.store_user(user)

    def get_user(self, user_id: str) -> UserInternal:
        """Get a user by their ID.

        Args:
            user_id: The ID of the user to retrieve

        Returns:
            The requested user
        """
        return self.store.get_user(user_id)

    def get_user_by_email(self, email: str) -> UserInternal:
        """Get a user by their email.

        Args:
            email: The email of the user to retrieve

        Returns:
            The requested user
        """
        return self.store.get_user_by_email(email)

    def list_users(self) -> List[UserInternal]:
        """List all users.

        Returns:
            A list of all users
        """
        return self.store.list_users()
