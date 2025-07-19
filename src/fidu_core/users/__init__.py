"""
FIDU Core Users Package

This package provides user management functionality for the FIDU system.
"""

from .schema import User, LoginRequest, LoginResponse

__all__ = [
    "User",
    "LoginRequest",
    "LoginResponse",
]
