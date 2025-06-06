"""Storage layer for users."""

from typing import Dict, List
from .schema import User


class UserStore:
    """In-memory storage for users."""

    def __init__(self) -> None:
        """Initialize the storage layer."""
        self.user_store: Dict[str, User] = {}

    def store_user(self, user: User) -> User:
        """Store a user in the system."""
        self.user_store[user.id] = user
        return user

    def get_user(self, user_id: str) -> User:
        """Get a user from the system by their ID."""
        return self.user_store[user_id]

    def get_user_by_email(self, email: str) -> User:
        """Get a user from the system by their email."""
        for user in self.user_store.values():
            if user.email == email:
                return user
        raise KeyError(f"No user found with email {email}")

    def list_users(self) -> List[User]:
        """List all users in the system."""
        return list(self.user_store.values())
