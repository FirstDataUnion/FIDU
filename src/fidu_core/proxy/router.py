"""Proxy router for external API requests."""

from fastapi import APIRouter, Request, Depends
from .nlp_workbench_proxy import NLPWorkbenchProxy
from typing import Optional
import os


def get_nlp_workbench_proxy() -> NLPWorkbenchProxy:
    """Dependency to get NLP Workbench proxy instance."""
    return NLPWorkbenchProxy()


def create_proxy_router() -> APIRouter:
    """Create a router for proxy endpoints."""
    router = APIRouter(prefix="/api", tags=["proxy"])
    
    @router.api_route("/nlp-workbench/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def nlp_workbench_proxy(
        request: Request,
        path: str,
        proxy: NLPWorkbenchProxy = Depends(get_nlp_workbench_proxy)
    ):
        """Proxy requests to NLP Workbench API."""

        print(f"NLP Workbench proxy request: {request.method} {request.url.path}")

        # Handle OPTIONS requests for CORS preflight
        if request.method == "OPTIONS":
            from fastapi.responses import Response
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
                    "Access-Control-Max-Age": "86400",
                }
            )
        
        return await proxy.proxy_request(request)
    
    return router 