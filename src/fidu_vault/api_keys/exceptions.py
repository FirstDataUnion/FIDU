"""Exceptions for the API Keys module."""


class APIKeyError(Exception):
    """Base exception for API key operations."""


class APIKeyNotFoundError(APIKeyError):
    """Raised when an API key is not found."""


class APIKeyValidationError(APIKeyError):
    """Raised when API key validation fails."""


class APIKeyDuplicateError(APIKeyError):
    """Raised when attempting to create a duplicate API key."""
