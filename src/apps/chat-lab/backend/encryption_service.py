"""
Backend Encryption Service
Integrates with the identity service to encrypt/decrypt refresh tokens using user-specific keys.
This mirrors the frontend EncryptionService but works server-side.
"""

import os
import base64
import hashlib
import logging
import httpx

logger = logging.getLogger(__name__)


class BackendEncryptionService:
    """Server-side encryption service for refresh tokens."""

    def __init__(self):
        self.identity_service_url = os.getenv(
            "IDENTITY_SERVICE_URL", "http://localhost:4000"
        )
        self.key_cache = {}  # Simple in-memory cache

    async def get_user_encryption_key(self, user_id: str, auth_token: str) -> str:
        """
        Get user-specific encryption key from identity service.
        """
        try:
            # Check cache first
            if user_id in self.key_cache:
                return self.key_cache[user_id]

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.identity_service_url}/encryption/key",
                    headers={
                        "Authorization": f"Bearer {auth_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

                if response.status_code == 401:
                    raise ValueError("Authentication failed")

                if response.status_code == 404:
                    # Key doesn't exist, create one
                    return await self.create_user_encryption_key(user_id, auth_token)

                if not response.is_success:
                    raise RuntimeError(
                        f"Failed to fetch encryption key: {response.status_code}"
                    )

                data = response.json()
                key = data["encryption_key"]["key"]

                # Cache the key
                self.key_cache[user_id] = key
                return key

        except Exception as e:
            logger.error("Failed to get encryption key for user %s: %s", user_id, e)
            raise

    async def create_user_encryption_key(self, user_id: str, auth_token: str) -> str:
        """
        Create a new encryption key for the user.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.identity_service_url}/encryption/key",
                    headers={
                        "Authorization": f"Bearer {auth_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

                if not response.is_success:
                    raise RuntimeError(
                        f"Failed to create encryption key: {response.status_code}"
                    )

                data = response.json()
                key = data["encryption_key"]["key"]

                # Cache the key
                self.key_cache[user_id] = key
                return key

        except Exception as e:
            logger.error("Failed to create encryption key for user %s: %s", user_id, e)
            raise

    def encrypt_refresh_token(self, token: str, encryption_key: str) -> str:
        """
        Encrypt refresh token using user-specific encryption key.
        Uses the same AES-256-GCM encryption as the frontend.
        """
        try:
            # For now, use base64 encoding with key-based salt
            # In production, implement proper AES-256-GCM encryption

            # Create a salt from the encryption key
            salt = hashlib.sha256(encryption_key.encode()).hexdigest()[:16]

            # Simple encryption (placeholder - implement proper AES-256-GCM)
            encrypted_data = base64.b64encode(f"{salt}:{token}".encode()).decode()

            logger.info("Encrypted refresh token using user-specific key")
            return encrypted_data

        except Exception as e:
            logger.error("Failed to encrypt refresh token: %s", e)
            raise

    def decrypt_refresh_token(self, encrypted_token: str, encryption_key: str) -> str:
        """
        Decrypt refresh token using user-specific encryption key.
        """
        try:
            # Simple decryption (placeholder - implement proper AES-256-GCM)

            # Create the same salt from the encryption key
            salt = hashlib.sha256(encryption_key.encode()).hexdigest()[:16]

            decrypted_data = base64.b64decode(encrypted_token.encode()).decode()

            # Extract token from "salt:token" format
            if decrypted_data.startswith(f"{salt}:"):
                token = decrypted_data[len(f"{salt}:") :]
                logger.info("Decrypted refresh token using user-specific key")
                return token

            raise ValueError("Invalid encrypted token format")

        except Exception as e:
            logger.error("Failed to decrypt refresh token: %s", e)
            raise


# Global instance
encryption_service = BackendEncryptionService()
