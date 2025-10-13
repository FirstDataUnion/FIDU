"""
OpenBao client for ChatLab service.
Handles secret retrieval from OpenBao with fallback to environment variables.
"""

import os
import logging
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass
import hvac
from hvac.exceptions import VaultError, InvalidPath

logger = logging.getLogger(__name__)


@dataclass
class OpenBaoConfig:
    """Configuration for OpenBao connection."""
    address: str
    token: str
    mount_path: str = "secret"
    secret_path: str = "fidu/chatlab"
    timeout: int = 30
    enabled: bool = True


@dataclass
class ChatLabSecrets:
    """Secrets required by ChatLab service."""
    google_client_id: str
    google_client_secret: str


class OpenBaoClient:
    """Client for interacting with OpenBao/Vault."""

    def __init__(self, config: OpenBaoConfig):
        self.config = config
        self.client: Optional[hvac.Client] = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Initialize the OpenBao client."""
        try:
            self.client = hvac.Client(
                url=self.config.address,
                token=self.config.token,
                timeout=self.config.timeout
            )
            logger.info("OpenBao client initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize OpenBao client: %s", e)
            self.client = None

    def test_connection(self) -> bool:
        """Test the connection to OpenBao."""
        if not self.client:
            logger.error("OpenBao client not initialized")
            return False

        try:
            # Check if the client is authenticated
            if not self.client.is_authenticated():
                logger.error("OpenBao authentication failed - check OPENBAO_TOKEN and OPENBAO_ADDRESS")
                return False

            # Authentication successful - connection is working
            logger.info("✅ OpenBao connection successful (authenticated)")
            
            # Optionally try to get health status for additional info
            # Note: Some hvac versions return empty/unparseable health responses
            try:
                health_response = self.client.sys.read_health_status()
                if hasattr(health_response, 'json'):
                    health = health_response.json()
                elif isinstance(health_response, dict):
                    health = health_response
                else:
                    # Can't parse health, but connection is working
                    return True
                
                if health.get("sealed", True):
                    logger.error("OpenBao is sealed")
                    return False
                
                logger.info("OpenBao version: %s", health.get("version", "unknown"))
            except (ValueError, AttributeError):
                # Health endpoint response couldn't be parsed, but connection is OK
                logger.debug("Health endpoint returned unparseable response (this is harmless)")
            except Exception as e:
                # Health check failed, but authentication worked, so connection is OK
                logger.debug("Health check failed: %s (connection is still OK)", e)
            
            return True

        except VaultError as e:
            logger.error("OpenBao connection test failed (VaultError): %s", e)
            logger.error("Check that OpenBao is running at: %s", self.config.address)
            return False
        except Exception as e:
            logger.error("Unexpected error testing OpenBao connection: %s", e)
            logger.error("OpenBao address: %s", self.config.address)
            return False

    def get_secrets(self) -> Optional[Dict[str, Any]]:
        """
        Retrieve secrets from OpenBao.
        
        Returns:
            Dictionary of secrets or None if retrieval fails
        """
        if not self.client:
            logger.error("OpenBao client not initialized")
            return None

        try:
            # For KV v2, the path format is: mount_path/data/secret_path
            full_path = f"{self.config.mount_path}/data/{self.config.secret_path}"
            
            response = self.client.read(full_path)

            if not response or "data" not in response:
                logger.error("No data found at path: %s", self.config.secret_path)
                return None

            # KV v2 wraps the actual secrets in a "data" field
            secrets_data = response["data"].get("data", {})
            
            if not secrets_data:
                logger.error("No secrets data found in response")
                return None

            return secrets_data

        except InvalidPath:
            logger.error("Secret path not found: %s", self.config.secret_path)
            return None
        except VaultError as e:
            logger.error("Failed to read secrets from OpenBao: %s", e)
            return None
        except Exception as e:
            logger.error("Unexpected error retrieving secrets: %s", e)
            return None

    def get_chatlab_secrets(self) -> Optional[ChatLabSecrets]:
        """
        Get ChatLab-specific secrets from OpenBao.
        
        Returns:
            ChatLabSecrets object or None if retrieval fails
        """
        secrets_data = self.get_secrets()
        if not secrets_data:
            return None

        try:
            return ChatLabSecrets(
                google_client_id=secrets_data.get("google_client_id", ""),
                google_client_secret=secrets_data.get("google_client_secret", "")
            )
        except Exception as e:
            logger.error("Failed to parse ChatLab secrets: %s", e)
            return None


def load_chatlab_secrets_from_openbao() -> ChatLabSecrets:
    """
    Load ChatLab secrets from OpenBao with fallback to environment variables.
    
    This function implements the fallback pattern from the Go implementation:
    1. Try to load from OpenBao if enabled
    2. Fall back to environment variables if OpenBao fails or is disabled
    
    Returns:
        ChatLabSecrets object with secrets from OpenBao or environment variables
    """
    # Check if OpenBao is enabled
    openbao_enabled = os.getenv("OPENBAO_ENABLED", "false").lower() == "true"
    
    if not openbao_enabled:
        logger.info("OpenBao integration disabled, using environment variables")
        return _load_secrets_from_env()

    # Get OpenBao configuration
    config = OpenBaoConfig(
        address=os.getenv("OPENBAO_ADDRESS", "http://localhost:8200"),
        token=os.getenv("OPENBAO_TOKEN", ""),
        mount_path=os.getenv("OPENBAO_MOUNT_PATH", "secret"),
        secret_path=os.getenv("OPENBAO_SECRET_PATH", "fidu/chatlab"),
        enabled=True
    )

    if not config.token:
        logger.warning("OPENBAO_TOKEN not set, falling back to environment variables")
        return _load_secrets_from_env()

    # Try to load from OpenBao
    try:
        client = OpenBaoClient(config)
        
        # Test connection
        if not client.test_connection():
            logger.warning("OpenBao connection test failed, falling back to environment variables")
            return _load_secrets_from_env()

        # Get secrets
        secrets = client.get_chatlab_secrets()
        if secrets and secrets.google_client_id and secrets.google_client_secret:
            return secrets
        else:
            logger.warning("OpenBao secrets incomplete, falling back to environment variables")
            return _load_secrets_from_env()

    except Exception as e:
        logger.error("Failed to load secrets from OpenBao: %s", e)
        logger.info("Falling back to environment variables")
        return _load_secrets_from_env()


def _load_secrets_from_env() -> ChatLabSecrets:
    """
    Load secrets from environment variables (fallback).
    
    Returns:
        ChatLabSecrets object with secrets from environment variables
    """
    return ChatLabSecrets(
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
        google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "")
    )

