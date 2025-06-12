"""Password hashing and verification service using Argon2id."""

from typing import Optional
import argon2
from argon2.exceptions import VerifyMismatchError

# Configure Argon2id with secure defaults
ARGON2_PARAMS = {
    "time_cost": 3,  # Number of iterations
    "memory_cost": 65536,  # Memory usage in KiB (64MB)
    "parallelism": 4,  # Number of parallel threads
    "hash_len": 32,  # Length of the hash in bytes
    "salt_len": 16,  # Length of the salt in bytes
}


class PasswordHasher:
    """Service for secure password hashing and verification using Argon2id."""

    def __init__(self, params: Optional[dict] = None) -> None:
        """Initialize the password hasher with optional custom parameters."""
        self.params = params or ARGON2_PARAMS
        self.ph = argon2.PasswordHasher(
            time_cost=self.params["time_cost"],
            memory_cost=self.params["memory_cost"],
            parallelism=self.params["parallelism"],
            hash_len=self.params["hash_len"],
            salt_len=self.params["salt_len"],
        )

    def hash_password(self, password: str) -> str:
        """
        Hash a password using Argon2id.

        Args:
            password: The plain text password to hash

        Returns:
            The hashed password string
        """
        return self.ph.hash(password)

    def verify_password(self, password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.

        Args:
            password: The plain text password to verify
            hashed_password: The hashed password to verify against

        Returns:
            True if the password matches, False otherwise
        """
        try:
            self.ph.verify(hashed_password, password)
            return True
        except VerifyMismatchError:
            return False
        except argon2.exceptions.InvalidHash:
            return False

    def needs_rehash(self, hashed_password: str) -> bool:
        """
        Check if a password hash needs to be rehashed.
        This is useful when you update your hashing parameters.

        Args:
            hashed_password: The hashed password to check

        Returns:
            True if the hash needs to be rehashed, False otherwise
        """
        return self.ph.check_needs_rehash(hashed_password)
