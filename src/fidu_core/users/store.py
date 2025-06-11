"""Storage layer for users."""

from typing import Dict, List
from datetime import datetime
from .schema import UserInternal


class UserStore:
    """In-memory storage for users."""

    def __init__(self) -> None:
        """Initialize the storage layer."""
        self.user_store: Dict[str, UserInternal] = {}

    def store_user(self, user: UserInternal) -> UserInternal:
        """Store a user in the system."""
        user.updated_at = datetime.now()
        user.created_at = datetime.now()
        self.user_store[user.id] = user

        return user

    def get_user(self, user_id: str) -> UserInternal:
        """Get a user from the system by their ID."""
        return self.user_store[user_id]

    def get_user_by_email(self, email: str) -> UserInternal:
        """Get a user from the system by their email."""
        for user in self.user_store.values():
            if user.email == email:
                return user
        raise KeyError(f"No user found with email {email}")

    def list_users(self) -> List[UserInternal]:
        """List all users in the system."""
        return list(self.user_store.values())
