"""
Backend Encryption Service
Integrates with the identity service to encrypt/decrypt refresh tokens using user-specific keys.
This mirrors the frontend EncryptionService but works server-side.
"""

import base64
import logging
import os
import secrets

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)


class IdentityServiceUnauthorizedError(Exception):
    """Exception raised when authentication fails to the identity service."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


class BackendEncryptionService:
    """Server-side encryption service for refresh tokens."""

    def __init__(self):
        self.identity_service_url = os.getenv(
            "IDENTITY_SERVICE_URL", "https://identity.firstdataunion.org"
        )
        logger.info(
            "BackendEncryptionService initialized with identity service URL: %s",
            self.identity_service_url,
        )

    async def get_user_encryption_key(self, user_id: str, auth_token: str) -> str:
        """
        Get user-specific encryption key from identity service.
        """
        # Validate auth_token is not empty
        if not auth_token or not auth_token.strip():
            raise ValueError(f"Empty or invalid auth token provided for user {user_id}")

        try:
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
                    raise IdentityServiceUnauthorizedError(
                        "Authentication to identity service failed"
                    )

                if response.status_code == 404:
                    # Key doesn't exist, create one
                    return await self.create_user_encryption_key(user_id, auth_token)

                if not response.is_success:
                    raise RuntimeError(
                        f"Failed to fetch encryption key: {response.status_code}"
                    )

                data = response.json()
                key = data["encryption_key"]["key"]

                return key

        except Exception as e:
            logger.error("Failed to get encryption key for user %s: %s", user_id, e)
            raise

    async def create_user_encryption_key(self, user_id: str, auth_token: str) -> str:
        """
        Create a new encryption key for the user.
        """
        # Validate auth_token is not empty
        if not auth_token or not auth_token.strip():
            raise ValueError(f"Empty or invalid auth token provided for user {user_id}")

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
                    if response.status_code == 401:
                        raise IdentityServiceUnauthorizedError("Authentication failed")
                    raise RuntimeError(
                        f"Failed to create encryption key: {response.status_code}"
                    )

                data = response.json()
                key = data["encryption_key"]["key"]

                return key

        except Exception as e:
            logger.error("Failed to create encryption key for user %s: %s", user_id, e)
            raise

    def encrypt_refresh_token(self, token: str, encryption_key: str) -> str:
        """
        Encrypt refresh token using user-specific encryption key.
        Uses AES-256-GCM encryption compatible with frontend Web Crypto API.
        """
        try:
            # Convert base64 key to bytes
            key_bytes = base64.b64decode(encryption_key)

            # Generate random nonce (12 bytes for GCM)
            nonce = secrets.token_bytes(12)

            # Create AESGCM cipher
            aesgcm = AESGCM(key_bytes)

            # Encrypt the token
            ciphertext = aesgcm.encrypt(nonce, token.encode("utf-8"), None)

            # Combine nonce + ciphertext and encode as base64
            # Format: base64(nonce + ciphertext)
            encrypted_data = base64.b64encode(nonce + ciphertext).decode("utf-8")

            logger.info("Encrypted refresh token using AES-256-GCM")
            return encrypted_data

        except Exception as e:
            logger.error("Failed to encrypt refresh token: %s", e)
            raise RuntimeError(f"Failed to encrypt refresh token: {e}") from e

    def decrypt_refresh_token(self, encrypted_token: str, encryption_key: str) -> str:
        """
        Decrypt refresh token using user-specific encryption key.
        Uses AES-256-GCM decryption compatible with frontend Web Crypto API.
        """
        try:
            # Convert base64 key to bytes
            key_bytes = base64.b64decode(encryption_key)

            # Decode the encrypted data
            encrypted_data = base64.b64decode(encrypted_token)

            # Extract nonce (first 12 bytes) and ciphertext (rest)
            nonce = encrypted_data[:12]
            ciphertext = encrypted_data[12:]

            # Create AESGCM cipher
            aesgcm = AESGCM(key_bytes)

            # Decrypt the token
            decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
            decrypted_token = decrypted_bytes.decode("utf-8")

            logger.info("Decrypted refresh token using AES-256-GCM")
            return decrypted_token

        except Exception as e:
            logger.error("Failed to decrypt refresh token: %s", e)
            raise RuntimeError(f"Failed to decrypt refresh token: {e}") from e


# Global instance
encryption_service = BackendEncryptionService()
