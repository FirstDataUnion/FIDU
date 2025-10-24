"""
FastAPI server for FIDU Chat Lab with metrics support.
Serves static files and forwards metrics to VictoriaMetrics.
"""

# pylint: disable=import-error

import os
import logging
import time
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import httpx
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from openbao_client import (  # type: ignore[import-not-found] # pylint: disable=import-error
    load_chatlab_secrets_from_openbao,
    ChatLabSecrets,
)
from encryption_service import encryption_service  # type: ignore[import-not-found]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("/tmp/fidu-chat-lab.log")],
)
logger = logging.getLogger(__name__)

# Configuration from environment
PORT = int(os.getenv("PORT", "8080"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")  # dev or prod
BASE_PATH = "/fidu-chat-lab"
VM_URL = os.getenv("VM_URL", "http://localhost:8428/api/v1/import/prometheus")
METRICS_FLUSH_INTERVAL = int(os.getenv("METRICS_FLUSH_INTERVAL", "30"))  # seconds

# Load secrets from OpenBao or environment variables
chatlab_secrets: Optional[ChatLabSecrets] = None

app = FastAPI(title=f"FIDU Chat Lab ({ENVIRONMENT})")

# Store client-side logs in memory
client_logs = []

# Prometheus metrics for the backend itself
backend_requests_total = Counter(
    "chatlab_backend_requests_total",
    "Total backend HTTP requests",
    ["environment", "method", "endpoint", "status"],
)

backend_request_duration = Histogram(
    "chatlab_backend_request_duration_seconds",
    "Backend HTTP request duration",
    ["environment", "method", "endpoint"],
)

# Client-side metrics forwarded from frontend
chatlab_errors_total = Counter(
    "chatlab_errors_total",
    "Total frontend errors",
    ["environment", "error_type", "page"],
)

chatlab_page_views_total = Counter(
    "chatlab_page_views_total", "Total page views", ["environment", "page"]
)

chatlab_messages_sent_total = Counter(
    "chatlab_messages_sent_total",
    "Total messages sent to AI models",
    ["environment", "model", "status"],
)

chatlab_google_api_requests_total = Counter(
    "chatlab_google_api_requests_total",
    "Total Google API requests",
    ["environment", "api", "operation", "status"],
)

chatlab_api_latency = Histogram(
    "chatlab_api_latency_seconds",
    "API call latency from frontend",
    ["environment", "endpoint"],
)

chatlab_active_users = Gauge(
    "chatlab_active_users", "Number of active users", ["environment"]
)

chatlab_health_status = Gauge(
    "chatlab_health_status",
    "Health status (1 = healthy, 0 = unhealthy)",
    ["environment"],
)

# Set initial health status
chatlab_health_status.labels(environment=ENVIRONMENT).set(1)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Encryption utilities for refresh tokens
async def encrypt_refresh_token(token: str, user_id: str, auth_token: str) -> str:
    """
    Encrypt refresh token using user-specific encryption key.
    This integrates with the existing ChatLab encryption system.
    """
    try:
        # Get user-specific encryption key from identity service
        encryption_key = await encryption_service.get_user_encryption_key(
            user_id, auth_token
        )

        # Encrypt the token using the user's key
        encrypted_data = encryption_service.encrypt_refresh_token(token, encryption_key)

        logger.info("Encrypted refresh token for user %s", user_id)
        return encrypted_data

    except Exception as e:
        logger.error("Failed to encrypt refresh token: %s", e)
        raise HTTPException(
            status_code=500, detail="Failed to encrypt refresh token"
        ) from e


async def decrypt_refresh_token(
    encrypted_token: str, user_id: str, auth_token: str
) -> str:
    """
    Decrypt refresh token using user-specific encryption key.
    """
    try:
        # Get user-specific encryption key from identity service
        encryption_key = await encryption_service.get_user_encryption_key(
            user_id, auth_token
        )

        # Decrypt the token using the user's key
        token = encryption_service.decrypt_refresh_token(
            encrypted_token, encryption_key
        )

        logger.info("Decrypted refresh token for user %s", user_id)
        return token

    except Exception as e:
        logger.error("Failed to decrypt refresh token: %s", e)
        raise HTTPException(
            status_code=500, detail="Failed to decrypt refresh token"
        ) from e


# Cookie management utilities
def set_secure_cookie(
    response: Response, name: str, value: str, max_age: int = 30 * 24 * 60 * 60
):
    """Set a secure HTTP-only cookie with environment-aware configuration."""
    # Validate cookie size (most browsers support 4KB per cookie)
    if len(value.encode("utf-8")) > 4000:
        logger.warning("Cookie %s exceeds recommended size limit", name)

    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=ENVIRONMENT == "prod",
        samesite="strict",
        path="/",
        domain=".firstdataunion.org" if ENVIRONMENT == "prod" else None,
    )
    logger.info(
        "Set secure cookie: %s (size: %d bytes)", name, len(value.encode("utf-8"))
    )


def get_cookie_value(request: Request, name: str) -> Optional[str]:
    """Get a cookie value from the request."""
    return request.cookies.get(name)


def get_user_id_from_request(request: Request) -> str:
    """
    Extract user ID from the request.
    This would typically come from JWT token or session.
    For now, we'll use a placeholder approach.
    """
    # TODO: Implement proper user ID extraction from JWT token
    # This could be from Authorization header or session cookie

    # Placeholder: use a default user ID for now
    # In production, extract from JWT token in Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        # Extract user ID from JWT token (simplified)
        # In production, you'd decode the JWT and extract the user_id claim
        return "default_user"  # Placeholder

    # Fallback: use IP-based user identification (not recommended for production)
    client_ip = request.client.host if request.client else "unknown"
    return f"user_{client_ip}"


def clear_cookie(response: Response, name: str):
    """Clear a cookie by setting it to expire."""
    response.set_cookie(
        key=name,
        value="",
        max_age=0,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )


# Add request logging and metrics middleware
@app.middleware("http")
async def log_and_metrics_middleware(request: Request, call_next):
    """Log all incoming requests and record metrics."""
    start_time = time.time()

    # Extract endpoint for metrics (simplified path)
    endpoint = request.url.path
    if endpoint.startswith(BASE_PATH):
        endpoint = endpoint[len(BASE_PATH) :]
    if "/" in endpoint[1:]:
        # Simplify dynamic routes
        parts = endpoint.split("/")
        if len(parts) > 2 and parts[1] in ["api", "assets"]:
            endpoint = f"/{parts[1]}/{parts[2]}"
        else:
            endpoint = f"/{parts[1]}" if len(parts) > 1 else endpoint

    logger.info("Request: %s %s", request.method, request.url)

    response = await call_next(request)

    process_time = time.time() - start_time
    logger.info("Response: %s - %.3fs", response.status_code, process_time)

    # Record backend metrics with environment label
    backend_requests_total.labels(
        environment=ENVIRONMENT,
        method=request.method,
        endpoint=endpoint,
        status=response.status_code,
    ).inc()

    backend_request_duration.labels(
        environment=ENVIRONMENT, method=request.method, endpoint=endpoint
    ).observe(process_time)

    return response


async def send_metrics_to_victoria():
    """Background task to send metrics to VictoriaMetrics."""
    while True:
        try:
            await asyncio.sleep(METRICS_FLUSH_INTERVAL)

            # Get Prometheus-formatted metrics
            metrics_data = generate_latest()

            # Send to VictoriaMetrics
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    VM_URL,
                    content=metrics_data,
                    headers={"Content-Type": CONTENT_TYPE_LATEST},
                    timeout=5.0,
                )

                if response.status_code == 204:
                    logger.info(
                        "✅ [%s] Successfully sent metrics to VictoriaMetrics",
                        ENVIRONMENT,
                    )
                else:
                    logger.warning(
                        "⚠️  [%s] VictoriaMetrics responded with status %s",
                        ENVIRONMENT,
                        response.status_code,
                    )

        except httpx.ConnectError:
            logger.error(
                "❌ [%s] Failed to connect to VictoriaMetrics - is it running on %s?",
                ENVIRONMENT,
                VM_URL,
            )
        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error(
                "❌ [%s] Error sending metrics to VictoriaMetrics: %s",
                ENVIRONMENT,
                e,
            )


@app.on_event("startup")
async def startup_event():
    """Start background tasks on startup."""
    global chatlab_secrets  # pylint: disable=global-statement
    logger.info("🚀 Starting FIDU Chat Lab (%s) metrics service", ENVIRONMENT)
    logger.info("📊 Environment: %s", ENVIRONMENT)
    logger.info("📍 VictoriaMetrics URL: %s", VM_URL)

    # Load secrets from OpenBao with fallback to environment variables
    try:
        logger.info("Loading secrets from OpenBao...")
        chatlab_secrets = load_chatlab_secrets_from_openbao()
        if chatlab_secrets.google_client_id:
            logger.info("✅ Secrets loaded successfully")
        else:
            logger.warning("⚠️  Secrets loaded but Google Client ID is empty")
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("❌ Failed to load secrets: %s", e)
        chatlab_secrets = None

    asyncio.create_task(send_metrics_to_victoria())


# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent
DIST_DIR = SCRIPT_DIR.parent / "dist"


@app.post(f"{BASE_PATH}/api/metrics")
async def receive_metrics(request: Request):
    """Receive batched metrics from frontend."""
    try:
        data = await request.json()
        metrics = data.get("metrics", [])

        logger.info(
            "📊 [%s] Received %d metrics from frontend", ENVIRONMENT, len(metrics)
        )

        # Process each metric with environment label
        for metric in metrics:
            metric_type = metric.get("type")
            labels = metric.get("labels", {})
            value = metric.get("value", 1)

            try:
                if metric_type == "error":
                    chatlab_errors_total.labels(
                        environment=ENVIRONMENT,
                        error_type=labels.get("error_type", "unknown"),
                        page=labels.get("page", "unknown"),
                    ).inc(value)

                elif metric_type == "page_view":
                    chatlab_page_views_total.labels(
                        environment=ENVIRONMENT, page=labels.get("page", "unknown")
                    ).inc(value)

                elif metric_type == "message_sent":
                    chatlab_messages_sent_total.labels(
                        environment=ENVIRONMENT,
                        model=labels.get("model", "unknown"),
                        status=labels.get("status", "success"),
                    ).inc(value)

                elif metric_type == "google_api_request":
                    chatlab_google_api_requests_total.labels(
                        environment=ENVIRONMENT,
                        api=labels.get("api", "unknown"),
                        operation=labels.get("operation", "unknown"),
                        status=labels.get("status", "success"),
                    ).inc(value)

                elif metric_type == "api_latency":
                    chatlab_api_latency.labels(
                        environment=ENVIRONMENT,
                        endpoint=labels.get("endpoint", "unknown"),
                    ).observe(value)

                elif metric_type == "active_users":
                    chatlab_active_users.labels(environment=ENVIRONMENT).set(value)

                else:
                    logger.warning("Unknown metric type: %s", metric_type)

            except Exception as e:  # pylint: disable=broad-exception-caught
                logger.error("Error processing metric %s: %s", metric_type, e)

        return {
            "status": "success",
            "processed": len(metrics),
            "environment": ENVIRONMENT,
        }

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to process metrics: %s", e)
        return JSONResponse(
            status_code=500, content={"status": "error", "message": str(e)}
        )


@app.get(f"{BASE_PATH}/api/metrics")
async def get_metrics():
    """Expose Prometheus-formatted metrics."""
    metrics_data = generate_latest()
    return Response(content=metrics_data, media_type=CONTENT_TYPE_LATEST)


@app.post(f"{BASE_PATH}/api/log")
async def log_client_message(request: Request):
    """Receive client-side logs."""
    try:
        data = await request.json()
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": data.get("level", "info"),
            "message": data.get("message", ""),
            "data": data.get("data", {}),
            "environment": ENVIRONMENT,
        }
        client_logs.append(log_entry)
        logger.info(
            "CLIENT [%s]: %s",
            ENVIRONMENT,
            log_entry["message"],
            extra={"client_data": log_entry["data"]},
        )

        # Keep only last 100 logs
        if len(client_logs) > 100:
            client_logs.pop(0)

        return {"status": "logged"}
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to log client message: %s", e)
        return {"status": "error", "message": str(e)}


@app.get(f"{BASE_PATH}/api/logs")
async def get_logs():
    """Get recent client-side logs."""
    return {
        "logs": client_logs[-50:],
        "environment": ENVIRONMENT,
    }  # Return last 50 logs


@app.get(f"{BASE_PATH}/api/config")
async def get_config():
    """
    Get client configuration.

    This endpoint provides the Google OAuth client ID to the frontend.
    The client secret is NEVER exposed - it stays server-side only.
    """
    if not chatlab_secrets:
        raise HTTPException(
            status_code=503,
            detail="Secrets not available - server may still be initializing",
        )

    if not chatlab_secrets.google_client_id:
        raise HTTPException(status_code=503, detail="Google Client ID not configured")

    return {
        "googleClientId": chatlab_secrets.google_client_id,
        "environment": ENVIRONMENT,
    }


@app.post(f"{BASE_PATH}/api/oauth/exchange-code")
async def exchange_oauth_code(request: Request):
    """
    Exchange OAuth authorization code for tokens (server-side only).

    This keeps the client secret secure on the server and never exposes it
    to the frontend. The frontend sends the authorization code, and this
    endpoint handles the secure exchange with Google.

    Request body:
        - code: OAuth authorization code from Google
        - redirect_uri: The redirect URI used in the OAuth flow

    Returns:
        - access_token: Google access token
        - refresh_token: Google refresh token (if granted)
        - expires_in: Token expiration time in seconds
        - scope: Granted OAuth scopes
    """
    try:
        data = await request.json()
        code = data.get("code")
        redirect_uri = data.get("redirect_uri")

        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")

        if not redirect_uri:
            raise HTTPException(status_code=400, detail="Missing redirect_uri")

        if not chatlab_secrets or not chatlab_secrets.google_client_secret:
            raise HTTPException(
                status_code=503, detail="OAuth not configured on server"
            )

        logger.info("Exchanging OAuth code for tokens...")

        # Exchange code for tokens using client secret (server-side only)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": chatlab_secrets.google_client_id,
                    "client_secret": chatlab_secrets.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                timeout=30.0,
            )

            if not response.is_success:
                error_text = response.text
                logger.error("Token exchange failed: %s", error_text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Token exchange failed: {error_text}",
                )

            token_data = response.json()

            logger.info("✅ OAuth token exchange successful")

            # Create response with HTTP-only cookie for refresh token
            response_data = {
                "access_token": token_data["access_token"],
                "expires_in": token_data["expires_in"],
                "scope": token_data["scope"],
            }

            # Create response object to set cookie
            fastapi_response = JSONResponse(content=response_data)

            # Store refresh token in encrypted HTTP-only cookie (30 days) if present
            if token_data.get("refresh_token"):
                # Get user ID and auth token for encryption
                user_id = get_user_id_from_request(request)
                auth_token = request.headers.get("Authorization", "").replace(
                    "Bearer ", ""
                )

                # Encrypt the refresh token using user-specific key
                encrypted_token = await encrypt_refresh_token(
                    token_data["refresh_token"], user_id, auth_token
                )

                set_secure_cookie(
                    fastapi_response,
                    "google_refresh_token",
                    encrypted_token,
                    max_age=30 * 24 * 60 * 60,  # 30 days
                )
                logger.info(
                    "✅ Encrypted refresh token stored in HTTP-only cookie for user %s",
                    user_id,
                )

            return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth code exchange failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/oauth/refresh-token")
async def refresh_oauth_token(request: Request):
    """
    Refresh an OAuth access token (server-side only).

    This keeps the client secret secure on the server. The refresh token
    is automatically retrieved from HTTP-only cookies, making it more secure
    and persistent than localStorage.

    Returns:
        - access_token: New Google access token
        - expires_in: Token expiration time in seconds
    """
    try:
        # Get encrypted refresh token from HTTP-only cookie
        encrypted_token = get_cookie_value(request, "google_refresh_token")

        if not encrypted_token:
            raise HTTPException(
                status_code=401, detail="No refresh token found in cookies"
            )

        # Get user ID and auth token for decryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        # Decrypt the refresh token using user-specific key
        refresh_token = await decrypt_refresh_token(
            encrypted_token, user_id, auth_token
        )

        if not chatlab_secrets or not chatlab_secrets.google_client_secret:
            raise HTTPException(
                status_code=503, detail="OAuth not configured on server"
            )

        logger.info("Refreshing OAuth access token...")

        # Refresh token using client secret (server-side only)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": chatlab_secrets.google_client_id,
                    "client_secret": chatlab_secrets.google_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=30.0,
            )

            if not response.is_success:
                error_text = response.text
                logger.error("Token refresh failed: %s", error_text)

                # If refresh token is invalid/expired, clear the cookie
                if (
                    "invalid_grant" in error_text
                    or "invalid refresh_token" in error_text
                ):
                    fastapi_response = JSONResponse(
                        status_code=401,
                        content={"error": "Refresh token expired or revoked"},
                    )
                    clear_cookie(fastapi_response, "google_refresh_token")
                    return fastapi_response

                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Token refresh failed: {error_text}",
                )

            token_data = response.json()

            logger.info("✅ OAuth token refresh successful")

            return {
                "access_token": token_data["access_token"],
                "expires_in": token_data["expires_in"],
            }

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth token refresh failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/oauth/logout")
async def logout_oauth():
    """
    Logout from Google OAuth by clearing the refresh token cookie.

    Returns:
        - success: Boolean indicating logout success
    """
    try:
        logger.info("Logging out from Google OAuth...")

        # Create response to clear the cookie
        fastapi_response = JSONResponse(content={"success": True})
        clear_cookie(fastapi_response, "google_refresh_token")

        logger.info("✅ Google OAuth logout successful")
        return fastapi_response

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth logout failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# Authentication cookie management endpoints
@app.post(f"{BASE_PATH}/api/auth/set-token")
async def set_auth_token(request: Request):
    """
    Set authentication token in HTTP-only cookie.

    Request body:
        - token: Authentication token
        - expires_in: Token expiration time in seconds
        - user: User information (optional)
        - profile: Current profile (optional)

    Returns:
        - success: Boolean indicating success
    """
    try:
        data = await request.json()
        token = data.get("token")
        expires_in = data.get("expires_in", 3600)  # Default 1 hour
        user = data.get("user")
        profile = data.get("profile")

        if not token:
            raise HTTPException(status_code=400, detail="Missing authentication token")

        # Get user ID for encryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        # Create response
        fastapi_response = JSONResponse(content={"success": True})

        # Set authentication token cookie
        set_secure_cookie(fastapi_response, "auth_token", token, max_age=expires_in)

        # Set refresh token cookie if provided
        if data.get("refresh_token"):
            encrypted_refresh = await encrypt_refresh_token(
                data["refresh_token"], user_id, auth_token
            )
            set_secure_cookie(
                fastapi_response,
                "fiduRefreshToken",
                encrypted_refresh,
                max_age=30 * 24 * 60 * 60,  # 30 days
            )

        # Set user info cookie if provided
        if user:
            encrypted_user = await encrypt_refresh_token(
                json.dumps(user), user_id, auth_token
            )
            set_secure_cookie(
                fastapi_response, "user", encrypted_user, max_age=expires_in
            )

        # Set profile cookie if provided
        if profile:
            encrypted_profile = await encrypt_refresh_token(
                json.dumps(profile), user_id, auth_token
            )
            set_secure_cookie(
                fastapi_response,
                "current_profile",
                encrypted_profile,
                max_age=expires_in,
            )

        logger.info(
            "✅ Authentication tokens set in HTTP-only cookies for user %s", user_id
        )
        return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to set auth token: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/auth/clear-tokens")
async def clear_auth_tokens():
    """
    Clear all authentication cookies.

    Returns:
        - success: Boolean indicating success
    """
    try:
        logger.info("Clearing all authentication cookies...")

        # Create response to clear all auth cookies
        fastapi_response = JSONResponse(content={"success": True})

        # Clear all authentication-related cookies
        auth_cookies = [
            "auth_token",
            "fiduRefreshToken",
            "token_expires_in",
            "user",
            "current_profile",
            "google_refresh_token",
        ]

        for cookie_name in auth_cookies:
            clear_cookie(fastapi_response, cookie_name)

        logger.info("✅ All authentication cookies cleared")
        return fastapi_response

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to clear auth tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get(f"{BASE_PATH}/api/auth/get-tokens")
async def get_auth_tokens(request: Request):
    """
    Get authentication tokens from HTTP-only cookies.

    Returns:
        - auth_token: Authentication token
        - refresh_token: Refresh token (if available)
        - user: User information (if available)
        - profile: Current profile (if available)
    """
    try:
        # Get user ID for decryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        response_data = {}

        # Get authentication token
        auth_token_cookie = get_cookie_value(request, "auth_token")
        if auth_token_cookie:
            response_data["auth_token"] = auth_token_cookie

        # Get refresh token (encrypted)
        refresh_token_cookie = get_cookie_value(request, "fiduRefreshToken")
        if refresh_token_cookie:
            try:
                refresh_token = await decrypt_refresh_token(
                    refresh_token_cookie, user_id, auth_token
                )
                response_data["refresh_token"] = refresh_token
            except (ValueError, RuntimeError) as e:
                logger.warning("Failed to decrypt refresh token: %s", e)

        # Get user info (encrypted)
        user_cookie = get_cookie_value(request, "user")
        if user_cookie:
            try:
                user_data = await decrypt_refresh_token(
                    user_cookie, user_id, auth_token
                )
                response_data["user"] = json.loads(user_data)
            except (ValueError, RuntimeError, json.JSONDecodeError) as e:
                logger.warning("Failed to decrypt user data: %s", e)

        # Get profile info (encrypted)
        profile_cookie = get_cookie_value(request, "current_profile")
        if profile_cookie:
            try:
                profile_data = await decrypt_refresh_token(
                    profile_cookie, user_id, auth_token
                )
                response_data["profile"] = json.loads(profile_data)
            except (ValueError, RuntimeError, json.JSONDecodeError) as e:
                logger.warning("Failed to decrypt profile data: %s", e)

        logger.info("Retrieved authentication data from cookies for user %s", user_id)
        return response_data

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to get auth tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check if dist directory exists and has files
        if not DIST_DIR.exists() or not any(DIST_DIR.iterdir()):
            chatlab_health_status.labels(environment=ENVIRONMENT).set(0)
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "service": "fidu-chat-lab",
                    "environment": ENVIRONMENT,
                    "reason": "dist directory missing",
                },
            )

        chatlab_health_status.labels(environment=ENVIRONMENT).set(1)
        return {
            "status": "healthy",
            "service": "fidu-chat-lab",
            "environment": ENVIRONMENT,
            "timestamp": datetime.now().isoformat(),
            "metrics_enabled": True,
        }
    except Exception as e:  # pylint: disable=broad-exception-caught
        chatlab_health_status.labels(environment=ENVIRONMENT).set(0)
        logger.error("Health check failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "fidu-chat-lab",
                "environment": ENVIRONMENT,
                "reason": str(e),
            },
        )


@app.get(f"{BASE_PATH}")
async def serve_chat_lab_root():
    """Serve the FIDU Chat Lab React app root."""
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="FIDU Chat Lab frontend not found.")
    return FileResponse(index_file)


@app.get(f"{BASE_PATH}/{{path:path}}")
async def serve_chat_lab_path(path: str):
    """Serve the FIDU Chat Lab React app for client-side routing."""
    # Check if the path is for a static asset
    static_file_path = DIST_DIR / path
    if static_file_path.exists() and static_file_path.is_file():
        return FileResponse(static_file_path)

    # For all other paths, serve the React app's index.html for client-side routing
    index_file = DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="FIDU Chat Lab frontend not found.")
    return FileResponse(index_file)


if __name__ == "__main__":
    print(f"Starting FIDU Chat Lab server ({ENVIRONMENT})")
    print(f"Port: {PORT}")
    print(f"Serving from: {DIST_DIR}")
    print(f"Health check: http://localhost:{PORT}/health")
    print(f"Metrics: http://localhost:{PORT}{BASE_PATH}/api/metrics")
    print(f"App URL: http://localhost:{PORT}{BASE_PATH}")
    print(f"VictoriaMetrics URL: {VM_URL}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
