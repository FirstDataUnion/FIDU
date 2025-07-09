"""NLP Workbench API proxy handler."""

import os
import httpx
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse
import logging
from .config import proxy_config

logger = logging.getLogger(__name__)


class NLPWorkbenchProxy:
    """Proxy handler for NLP Workbench API requests."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the proxy with optional API key."""
        config = proxy_config.get_nlp_workbench_config()
        self.base_url = config["base_url"]
        self.api_key = api_key or config["api_key"]
        self.timeout = config["timeout"]
        
        if not self.api_key:
            logger.warning(
                "NLP Workbench API key not set. Please set "
                "VITE_NLP_WORKBENCH_AGENT_API_KEY environment variable.")
    
    def _rewrite_path(self, path: str) -> str:
        """Rewrite the path from /api/nlp-workbench/* to /api/public/*."""
        return path.replace("/api/nlp-workbench", "/api/public")
    
    def _get_headers(self, original_headers: Dict[str, str]) -> Dict[str, str]:
        """Get headers for the proxy request, including API key."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": original_headers.get("user-agent", "FIDU-Proxy/1.0"),
        }
        
        # Add API key if available
        if self.api_key:
            headers["x-api-key"] = self.api_key

        # Pass API Key from original request if available
        if "x-api-key" in original_headers:
            headers["x-api-key"] = original_headers["x-api-key"]
        
        return headers
    
    async def proxy_request(self, request: Request) -> StreamingResponse:
        """Proxy a request to the NLP Workbench API."""
        # Get the path after /api/nlp-workbench
        path = request.url.path
        if not path.startswith("/api/nlp-workbench"):
            raise HTTPException(status_code=400, detail="Invalid proxy path")
        
        # Rewrite the path
        target_path = self._rewrite_path(path)
        target_url = f"{self.base_url}{target_path}"
        
        # Get query parameters
        query_params = str(request.url.query)
        if query_params:
            target_url += f"?{query_params}"
        
        # Get request body
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
            except Exception as e:
                logger.error(f"Error reading request body: {e}")
                raise HTTPException(status_code=400, detail="Error reading request body")
        
        # Get headers
        headers = self._get_headers(dict(request.headers))

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Make the request to the target API
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body,
                    follow_redirects=True
                )
                
                # Create a streaming response
                async def stream_response():
                    async for chunk in response.aiter_bytes():
                        yield chunk
                
                return StreamingResponse(
                    stream_response(),
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.headers.get("content-type")
                )
                
        except httpx.TimeoutException:
            logger.error(f"Timeout while proxying request to {target_url}")
            raise HTTPException(status_code=504, detail="Gateway timeout")
        except httpx.RequestError as e:
            logger.error(f"Error proxying request to {target_url}: {e}")
            raise HTTPException(status_code=502, detail="Bad gateway")
        except Exception as e:
            logger.error(f"Unexpected error while proxying request: {e}")
            raise HTTPException(status_code=500, detail="Internal server error") 