"""Configuration for proxy settings."""

import os
from typing import Dict, Any

class ProxyConfig:
    """Configuration class for proxy settings."""

    def __init__(self):
        """Initialize proxy configuration."""
        # NLP Workbench settings
        
        self.nlp_workbench_base_url = "https://wb.nlp-processing.com"
        self.nlp_workbench_api_key = os.getenv("VITE_NLP_WORKBENCH_AGENT_API_KEY")

        # Proxy server settings
        self.proxy_host = os.getenv("FIDU_PROXY_HOST", "127.0.0.1")
        self.proxy_port = int(os.getenv("FIDU_PROXY_PORT", "4001"))

        # Timeout settings
        self.request_timeout = int(os.getenv("FIDU_PROXY_TIMEOUT", "30"))

        # CORS settings
        self.cors_origins = os.getenv("FIDU_PROXY_CORS_ORIGINS", "*").split(",")

    def get_nlp_workbench_config(self) -> Dict[str, Any]:
        """Get NLP Workbench configuration."""
        return {
            "base_url": self.nlp_workbench_base_url,
            "api_key": self.nlp_workbench_api_key,
            "timeout": self.request_timeout,
        }

    def get_proxy_server_config(self) -> Dict[str, Any]:
        """Get proxy server configuration."""
        return {
            "host": self.proxy_host,
            "port": self.proxy_port,
            "cors_origins": self.cors_origins,
        }


# Singleton instance holder
_proxy_config_instance = None

def get_proxy_config() -> ProxyConfig:
    """Get the singleton ProxyConfig instance, creating it if necessary."""
    global _proxy_config_instance
    if _proxy_config_instance is None:
        _proxy_config_instance = ProxyConfig()
    return _proxy_config_instance
