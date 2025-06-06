"""
FIDU Core Profiles Package

This package provides profile management functionality for the FIDU system.
"""

from .schema import Profile
from .store import ProfileStore
from .service import ProfileService
from .api import ProfileAPI

__all__ = ["Profile", "ProfileStore", "ProfileService", "ProfileAPI"]
