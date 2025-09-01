"""Authentication middleware with refresh token support."""

import os
import json
import logging
from typing import Optional
from fastapi import Request, HTTPException, Response
from fastapi.responses import RedirectResponse
from .auth_client import auth_client, get_user_from_identity_service

logger = logging.getLogger(__name__)

IDENTITY_SERVICE_DEFAULT_URL = "https://identity.firstdataunion.org"


async def authenticate_request(request: Request) -> Optional[str]:
    """
    Authenticate a request using access token and refresh token if needed.
    
    Returns:
        str: User ID if authentication is successful
        None: If authentication fails
    """
    try:
        # Get access token from cookies or headers
        access_token = request.cookies.get("auth_token")
        if not access_token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                access_token = auth_header[7:]
        
        if not access_token:
            return None
        
        # Get refresh token from cookies
        refresh_token = request.cookies.get("refresh_token")
        
        # Set tokens in the auth client for potential refresh
        if refresh_token:
            # We don't know the exact expiration, so we'll assume it's expired if we need to refresh
            auth_client.set_tokens(access_token, refresh_token, 0)
        
        # Try to get user with current token
        try:
            user = await get_user_from_identity_service(access_token)
            if user:
                return user.id
        except HTTPException as e:
            if e.status_code == 401 and refresh_token:
                # Token expired, try to refresh
                logger.info("Access token expired, attempting refresh")
                if await auth_client.token_manager.refresh_access_token():
                    # Get new access token
                    new_access_token = auth_client.token_manager.get_valid_access_token()
                    if new_access_token:
                        # Try to get user with new token
                        try:
                            user = await get_user_from_identity_service(new_access_token)
                            if user:
                                # Update the cookie with new access token
                                # Note: This will be handled by the response middleware
                                return user.id
                        except HTTPException:
                            pass
        
        return None
        
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        return None


async def refresh_token_middleware(request: Request, call_next):
    """
    Middleware to handle automatic token refresh and cookie updates.
    """
    # Process the request
    response = await call_next(request)
    
    # Check if we need to update the access token cookie
    if hasattr(auth_client.token_manager, 'access_token') and auth_client.token_manager.access_token:
        current_token = request.cookies.get("auth_token")
        if current_token != auth_client.token_manager.access_token:
            # Token was refreshed, update the cookie
            response.set_cookie(
                key="auth_token",
                value=auth_client.token_manager.access_token,
                path="/",
                max_age=3600,  # 1 hour
                samesite="lax"
            )
    
    return response


def require_auth(func):
    """
    Decorator to require authentication for a route.
    Redirects to home page if not authenticated.
    """
    async def wrapper(self, request: Request, *args, **kwargs):
        user_id = await authenticate_request(request)
        if not user_id:
            return RedirectResponse(url="/", status_code=302)
        return await func(self, request, *args, **kwargs)
    return wrapper


def get_current_user_id(request: Request) -> Optional[str]:
    """
    Extract the current user ID from the request.
    This is a synchronous version for use in route dependencies.
    """
    # This is a simplified version - in practice, you might want to make this async
    # or use a different approach for route dependencies
    access_token = request.cookies.get("auth_token")
    if not access_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            access_token = auth_header[7:]
    
    if access_token:
        # For now, return a placeholder - in a real implementation,
        # you'd want to decode the JWT or make an async call
        return "user_id_placeholder"
    
    return None
