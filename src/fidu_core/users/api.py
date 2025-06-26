"""API endpoints for user management."""

import uuid
import logging
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fidu_core.security import PasswordHasher, JWTManager
from .schema import User, CreateUserRequest, UserInternal, LoginRequest, LoginResponse
from .service import UserService
from .exceptions import (
    UserNotFoundError,
    UserAlreadyExistsError,
    UserValidationError,
    UserPermissionError,
    UserError,
)


logger = logging.getLogger(__name__)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/users/login")


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
        self.password_hasher = PasswordHasher()
        self.jwt_manager = JWTManager()
        self._setup_exception_handlers()

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
            "/api/v1/users/login",
            self.login_user,
            methods=["POST"],
            response_model=LoginResponse,
            tags=["users"],
        )
        self.app.add_api_route(
            "/api/v1/users/current",
            self.get_current_user,
            methods=["GET"],
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

    def _setup_exception_handlers(self) -> None:
        """Set up exception handlers for converting service exceptions to HTTP responses."""

        @self.app.exception_handler(UserNotFoundError)
        async def handle_user_not_found(request, exc: UserNotFoundError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

        @self.app.exception_handler(UserAlreadyExistsError)
        async def handle_user_already_exists(request, exc: UserAlreadyExistsError):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

        @self.app.exception_handler(UserValidationError)
        async def handle_user_validation_error(request, exc: UserValidationError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

        @self.app.exception_handler(UserPermissionError)
        async def handle_user_permission_error(request, exc: UserPermissionError):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

        @self.app.exception_handler(UserError)
        # pylint: disable=unused-argument
        async def handle_user_error(request, exc: UserError):
            logger.error("User error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while processing the user",
            )

    async def get_current_user(self, token: str = Depends(oauth2_scheme)) -> User:
        """Get the current authenticated user.

        Args:
            token: The JWT token from the Authorization header

        Returns:
            The authenticated user

        Raises:
            HTTPException: If the token is invalid or the user is not found
        """
        token_data = self.jwt_manager.verify_token(token)
        if token_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = token_data.user_id
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            user = self.service.get_user(user_id)
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        return user

    async def create_user(self, create_user_request: CreateUserRequest) -> User:
        """Create a new user.

        Args:
            user: The user to create

        Returns:
            The created user
        """

        # First create the internal user with the password hashed.
        # plain text password makes it no further than this.

        # Convert to internal model
        internal_user = UserInternal(
            **create_user_request.user.model_dump(),
            id=str(uuid.uuid4()),
            password_hash=self.password_hasher.hash_password(
                create_user_request.password
            ),
        )

        # Create the user in service layer
        request_id = create_user_request.request_id
        internal_user = self.service.create_user(request_id, internal_user)

        # Convert to public user model
        user = User(**internal_user.model_dump())

        return user

    async def login_user(self, login_request: LoginRequest) -> LoginResponse:
        """Login a user.

        Args:
            login_request: The login request

        Returns:
            Login response with access token and user info

        Raises:
            HTTPException: If the email or password is invalid
        """

        try:
            internal_user = self.service.get_user_by_email(login_request.email)
        except UserNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        if not self.password_hasher.verify_password(
            login_request.password, internal_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Create access token
        access_token = self.jwt_manager.create_access_token(
            data={"sub": internal_user.id}
        )

        # Convert internal user to public user
        public_user = User(**internal_user.model_dump())

        return LoginResponse(
            access_token=access_token, token_type="bearer", user=public_user
        )

    async def get_user(self, user_id: str) -> User:
        """Get a user by their ID.

        Args:
            user_id: The ID of the user to retrieve

        Returns:
            The requested user
        """

        internal_user = self.service.get_user(user_id)

        return User(**internal_user.model_dump())

    async def list_users(self) -> List[User]:
        """List all users.

        Returns:
            A list of all users
        """

        internal_users = self.service.list_users()
        return [User(**user.model_dump()) for user in internal_users]
