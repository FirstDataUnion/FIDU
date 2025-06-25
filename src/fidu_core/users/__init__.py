"""
FIDU Core Users Package

This package provides user management functionality for the FIDU system.
"""

from .schema import User, LoginRequest, LoginResponse
from .store import UserStoreInterface
from .service import UserService
from .api import UserAPI
from .exceptions import (
    UserNotFoundError,
    UserAlreadyExistsError,
    UserValidationError,
    UserPermissionError,
    UserError,
)

__all__ = [
    "User",
    "UserStoreInterface",
    "UserService",
    "UserAPI",
    "LoginRequest",
    "LoginResponse",
    "UserNotFoundError",
    "UserAlreadyExistsError",
    "UserValidationError",
    "UserPermissionError",
    "UserError",
]
