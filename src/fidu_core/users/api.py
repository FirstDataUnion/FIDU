"""API endpoints for user management."""

from typing import List
from fastapi import FastAPI
from .schema import User
from .service import UserService


class UserAPI:
    """API endpoints for user management."""

    def __init__(self, app: FastAPI, service: UserService) -> None:
        """Initialize the API layer.

        Args:
            app: The FastAPI app to mount the API on
            service: The service layer for user operations
        """
        self.service = service
        self.app = app
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        self.app.add_api_route(
            "/api/v1/users",
            self.create_user,
            methods=["POST"],
            response_model=User,
            tags=["users"],
        )
        self.app.add_api_route(
            "/api/v1/users/{user_id}",
            self.get_user,
            methods=["GET"],
            response_model=User,
            tags=["users"],
        )
        self.app.add_api_route(
            "/api/v1/users",
            self.list_users,
            methods=["GET"],
            response_model=List[User],
            tags=["users"],
        )

    async def create_user(self, user: User) -> User:
        """Create a new user.

        Args:
            user: The user to create

        Returns:
            The created user
        """
        return self.service.create_user(user)

    async def get_user(self, user_id: str) -> User:
        """Get a user by their ID.

        Args:
            user_id: The ID of the user to retrieve

        Returns:
            The requested user
        """
        return self.service.get_user(user_id)

    async def list_users(self) -> List[User]:
        """List all users.

        Returns:
            A list of all users
        """
        return self.service.list_users()
