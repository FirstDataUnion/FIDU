"""
FastAPI server for FIDU Chat Lab with metrics support.
Serves static files and forwards metrics to VictoriaMetrics.
"""

# pylint: disable=too-many-lines

# pylint: disable=import-error

import os
import logging
import time
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("/tmp/fidu-chat-lab.log")],
)
logger = logging.getLogger(__name__)


def _load_env_file_if_present() -> None:
    """Load environment variables from a local .env file without extra deps.

    We look for .env files in the chat-lab directory so the backend can run
    locally with the same values used by the frontend, without requiring
    manual export in the shell.
    """
    candidate_files = [
        Path(__file__).parent.parent / ".env.development.local",
        Path(__file__).parent.parent / ".env.development",
        Path(__file__).parent.parent / ".env",
    ]

    for env_path in candidate_files:
        if env_path.exists():
            try:
                with env_path.open("r", encoding="utf-8") as f:
                    for raw_line in f:
                        line = raw_line.strip()
                        if not line or line.startswith("#"):
                            continue
                        # Support simple KEY=VALUE lines; ignore export prefix
                        if line.startswith("export "):
                            line = line[len("export ") :]
                        if "=" not in line:
                            continue
                        key, value = line.split("=", 1)
                        key = key.strip()
                        # Strip surrounding quotes if present
                        value = value.strip().strip('"').strip("'")
                        if key and value and key not in os.environ:
                            os.environ[key] = value
                logger.info("Loaded environment variables from %s", env_path)
                return
            except (IOError, OSError, ValueError, KeyError) as exc:
                logger.warning("Failed to load .env file %s: %s", env_path, exc)
                # Try next candidate


# Load .env file BEFORE importing encryption_service so it can read the correct IDENTITY_SERVICE_URL
_load_env_file_if_present()

# Log the Identity Service URL that will be used (for debugging)
identity_service_url = os.getenv(
    "IDENTITY_SERVICE_URL", "https://identity.firstdataunion.org"
)
logger.info("Identity Service URL configured: %s", identity_service_url)

# Now import encryption_service after environment is loaded
# pylint: disable=wrong-import-position
from encryption_service import (  # type: ignore[import-not-found]
    encryption_service,
    IdentityServiceUnauthorizedError,
)

# Configuration from environment
PORT = int(os.getenv("PORT", "8080"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")  # dev or prod
BASE_PATH = "/fidu-chat-lab"
VM_URL = os.getenv("VM_URL", "http://localhost:8428/api/v1/import/prometheus")
METRICS_FLUSH_INTERVAL = int(os.getenv("METRICS_FLUSH_INTERVAL", "30"))  # seconds

# Load secrets from OpenBao or environment variables
# (pylint doesn't like the global so demands UPPER_CASE name)
chatlab_secrets: Optional[ChatLabSecrets] = None  # pylint: disable=invalid-name

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

    except IdentityServiceUnauthorizedError as e:
        logger.error("Failed to encrypt refresh token due to 401: %s", e)
        raise
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

    except IdentityServiceUnauthorizedError as e:
        logger.error("Failed to decrypt refresh token due to 401: %s", e)
        raise
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
    First tries to get user ID from FIDU auth cookies, then falls back to other methods.
    """
    # Get environment from the request (we'll detect it from the request path)
    environment = "prod"  # Default
    if "dev.chatlab" in str(request.url):
        environment = "dev"
    elif "localhost" in str(request.url) or "127.0.0.1" in str(request.url):
        environment = "local"

    # Try to get user info from FIDU auth cookies
    # This is the most reliable method since we store user info there
    user_cookie_name = f"fidu_user{'_' + environment if environment != 'prod' else ''}"
    logger.debug("Looking for user cookie: %s", user_cookie_name)

    # Log all cookies for debugging
    all_cookies = request.cookies
    logger.debug("Available cookies: %s", list(all_cookies.keys()))

    user_cookie = get_cookie_value(request, user_cookie_name)

    if user_cookie:
        try:
            user_data = json.loads(user_cookie)
            user_id = (
                user_data.get("id")
                or user_data.get("user_id")
                or user_data.get("email")
            )
            if user_id:
                logger.debug("✅ Extracted user ID from FIDU auth cookies: %s", user_id)
                return str(user_id)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse user data from FIDU auth cookies: %s", e)

    # Fallback: use IP-based user identification (not recommended for production)
    client_ip = request.client.host if request.client else "unknown"
    fallback_user_id = f"user_{client_ip}"
    logger.warning(
        "⚠️ Using fallback user ID: %s (could not extract from FIDU auth cookies. "
        "Cookie name searched: %s)",
        fallback_user_id,
        user_cookie_name,
    )
    return fallback_user_id


def clear_cookie(response: Response, name: str):
    """Clear a cookie by setting it to expire.

    Must use the EXACT same domain/path/secure settings as when the cookie was set,
    otherwise the browser won't match and clear it.
    """
    response.set_cookie(
        key=name,
        value="",
        max_age=0,
        httponly=True,
        secure=ENVIRONMENT == "prod",  # Match the setting in set_secure_cookie
        samesite="strict",
        path="/",
        domain=(
            ".firstdataunion.org" if ENVIRONMENT == "prod" else None
        ),  # Match the setting in set_secure_cookie
    )


def clear_cookies_on_identity_service_401(response: Response):
    """Clear relevant cookies when the identity service returns a 401."""
    clear_cookie(response, "auth_token")
    # This might be too aggressive - a 401 just means that the auth token should be refreshed
    # but I still don't understand the entire flow well enough and this seems to work for now
    clear_cookie(response, "fidu_refresh_token")


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

    # Note: .env file is already loaded before module imports (see above)
    # This ensures encryption_service and other modules get the correct values

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
async def exchange_oauth_code(
    request: Request,
):  # pylint: disable=too-many-locals,too-many-statements
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
        environment = data.get("environment", "prod")  # Default to prod

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
            logger.info("Token response keys: %s", list(token_data.keys()))
            logger.info("Has refresh token: %s", bool(token_data.get("refresh_token")))

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
                logger.info("🔄 Storing refresh token in HTTP-only cookie...")
                # Get user ID for encryption
                user_id = get_user_id_from_request(request)
                auth_token = request.headers.get("Authorization", "").replace(
                    "Bearer ", ""
                )

                # Create environment-specific cookie name
                suffix = "_" + environment if environment != "prod" else ""
                cookie_name = f"google_refresh_token{suffix}"
                logger.info("Using cookie name: %s", cookie_name)

                # For OAuth exchange, we may not have an auth token yet
                # Use a simpler encryption approach for initial OAuth flow
                try:
                    if auth_token:
                        # If we have an auth token, use the full encryption
                        encrypted_token = await encrypt_refresh_token(
                            token_data["refresh_token"], user_id, auth_token
                        )
                    else:
                        # For OAuth exchange without auth token, use simpler encryption
                        # This allows storing the refresh token before full authentication
                        encryption_key = (
                            await encryption_service.get_user_encryption_key(
                                user_id,
                                "",  # Empty auth token for pre-auth refresh tokens
                            )
                        )
                        encrypted_token = encryption_service.encrypt_refresh_token(
                            token_data["refresh_token"], encryption_key
                        )
                        logger.info(
                            "Using simplified encryption for OAuth exchange refresh token"
                        )

                    set_secure_cookie(
                        fastapi_response,
                        cookie_name,
                        encrypted_token,
                        max_age=30 * 24 * 60 * 60,  # 30 days
                    )
                    logger.info(
                        "✅ Encrypted refresh token stored in HTTP-only cookie "
                        "for user %s in %s environment",
                        user_id,
                        environment,
                    )
                except IdentityServiceUnauthorizedError as e:
                    logger.error(
                        "Failed to encrypt refresh token during OAuth exchange due to 401: %s",
                        e,
                    )
                    failure_response = JSONResponse(
                        status_code=401,
                        content={"detail": "Authentication to identity service failed"},
                    )
                    clear_cookies_on_identity_service_401(failure_response)
                    return failure_response
                except Exception as e:
                    logger.error(
                        "Failed to encrypt refresh token during OAuth exchange: %s", e
                    )
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to encrypt refresh token securely",
                    ) from e
            else:
                logger.warning(
                    "⚠️ No refresh token provided by Google OAuth - "
                    "user may need to re-authorize with prompt=consent"
                )

            return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth code exchange failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/oauth/refresh-token")
# pylint: disable=too-many-locals
# pylint: disable=too-many-branches
# pylint: disable=too-many-statements
async def refresh_oauth_token(request: Request):
    """
    Refresh an OAuth access token (server-side only).

    This keeps the client secret secure on the server. The refresh token
    is automatically retrieved from HTTP-only cookies, making it more secure
    and persistent than localStorage.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - access_token: New Google access token
        - expires_in: Token expiration time in seconds
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Create environment-specific cookie name
        cookie_name = (
            f"google_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )

        # Get encrypted refresh token from HTTP-only cookie
        encrypted_token = get_cookie_value(request, cookie_name)

        if not encrypted_token:
            raise HTTPException(
                status_code=401,
                detail=f"No refresh token found in cookies for {environment} environment",
            )

        # Get user ID and auth token for decryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        # Decrypt the refresh token using appropriate method
        if auth_token:
            try:
                # If we have an auth token, use the full decryption
                refresh_token = await decrypt_refresh_token(
                    encrypted_token, user_id, auth_token
                )
            except IdentityServiceUnauthorizedError as e:
                logger.error("Failed to decrypt refresh token due to 401: %s", e)
                failure_response = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication to identity service failed"},
                )
                clear_cookies_on_identity_service_401(failure_response)
                return failure_response
            except Exception as e:
                logger.error("Failed to decrypt refresh token: %s", e)
                raise HTTPException(
                    status_code=401, detail="Invalid refresh token"
                ) from e
        else:
            # If no auth token, try simpler decryption approaches
            try:
                # Try encryption service with empty auth token
                encryption_key = await encryption_service.get_user_encryption_key(
                    user_id, ""  # Empty auth token for pre-auth refresh tokens
                )
                refresh_token = encryption_service.decrypt_refresh_token(
                    encrypted_token, encryption_key
                )
            except IdentityServiceUnauthorizedError as e:
                logger.error("Failed to decrypt refresh token due to 401: %s", e)
                failure_response = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication to identity service failed"},
                )
                clear_cookies_on_identity_service_401(failure_response)
                return failure_response
            except Exception as exc:
                # No fallback - if encryption fails, the token is invalid
                logger.error("Failed to decrypt refresh token with encryption service")
                raise HTTPException(
                    status_code=401, detail="Invalid or corrupted refresh token"
                ) from exc

        if not chatlab_secrets:
            logger.error(
                "chatlab_secrets not loaded - OAuth configuration missing. "
                "Check OpenBao connection and secret configuration."
            )
            raise HTTPException(
                status_code=503,
                detail="OAuth not configured on server: secrets not loaded. "
                "Please contact support.",
            )

        if not chatlab_secrets.google_client_secret:
            logger.error(
                "Google OAuth client secret not found in chatlab_secrets. "
                "Missing google_client_secret in OpenBao configuration."
            )
            raise HTTPException(
                status_code=503,
                detail="OAuth not configured on server: Google client secret "
                "missing. Please contact support.",
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
                    clear_cookie(fastapi_response, cookie_name)
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
async def logout_oauth(request: Request):
    """
    Logout from Google OAuth by clearing the refresh token cookie.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - success: Boolean indicating logout success
    """
    try:
        logger.info("Logging out from Google OAuth...")

        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Create environment-specific cookie name
        cookie_name = (
            f"google_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )

        # Create response to clear the cookie
        fastapi_response = JSONResponse(content={"success": True})
        clear_cookie(fastapi_response, cookie_name)

        logger.info("✅ Google OAuth logout successful")
        return fastapi_response

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth logout failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get(f"{BASE_PATH}/api/oauth/get-tokens")
async def get_oauth_tokens(request: Request):
    """
    Get Google Drive OAuth tokens from HTTP-only cookies.

    This endpoint retrieves the stored refresh token from cookies and returns
    it to the frontend for authentication restoration.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - refresh_token: Encrypted refresh token (if available)
        - has_tokens: Boolean indicating if tokens are available
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Create environment-specific cookie name
        cookie_name = (
            f"google_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )

        # Get encrypted refresh token from HTTP-only cookie
        encrypted_token = get_cookie_value(request, cookie_name)

        if not encrypted_token:
            logger.info(
                "No Google Drive refresh token found in cookies for %s environment",
                environment,
            )
            return JSONResponse(content={"has_tokens": False, "refresh_token": None})

        # Get user ID and auth token for decryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        # Decrypt the refresh token
        if auth_token:
            try:
                # If we have an auth token, use the full decryption
                refresh_token = await decrypt_refresh_token(
                    encrypted_token, user_id, auth_token
                )
            except IdentityServiceUnauthorizedError as e:
                logger.error(
                    "Failed to decrypt Google Drive refresh token due to 401: %s", e
                )
                failure_response = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication to identity service failed"},
                )
                clear_cookies_on_identity_service_401(failure_response)
                return failure_response
            except Exception as e:  # pylint: disable=broad-exception-caught
                logger.error("Failed to decrypt Google Drive refresh token: %s", e)
                # Clear the corrupted token cookie
                logger.warning("Google Drive refresh token is corrupted - clearing it")
                fastapi_response = JSONResponse(
                    status_code=500,
                    content={
                        "detail": "Invalid or corrupted refresh token - please re-authenticate"
                    },
                )
                clear_cookie(fastapi_response, cookie_name)
                return fastapi_response
        else:
            # If no auth token, try simpler decryption approaches
            try:
                # Try encryption service with empty auth token
                encryption_key = await encryption_service.get_user_encryption_key(
                    user_id, ""  # Empty auth token for pre-auth refresh tokens
                )
                refresh_token = encryption_service.decrypt_refresh_token(
                    encrypted_token, encryption_key
                )
            except IdentityServiceUnauthorizedError as e:
                logger.error(
                    "Failed to decrypt refresh token with encryption service due to 401: %s",
                    e,
                )
                failure_response = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication to identity service failed"},
                )
                clear_cookies_on_identity_service_401(failure_response)
                return failure_response
            except Exception as exc:
                # No fallback - if encryption fails, the token is invalid
                logger.error("Failed to decrypt refresh token with encryption service")
                raise HTTPException(
                    status_code=401, detail="Invalid or corrupted refresh token"
                ) from exc

        logger.info(
            "✅ Google Drive refresh token retrieved from HTTP-only cookie for %s environment",
            environment,
        )

        return JSONResponse(
            content={"has_tokens": True, "refresh_token": refresh_token}
        )

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to get Google Drive tokens: %s", e)
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

        # Validate auth token is present and not empty
        if not auth_token or auth_token.strip() == "":
            logger.warning(
                "Empty or missing auth token when setting tokens for user %s", user_id
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required: valid auth token must be provided",
            )

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

    except IdentityServiceUnauthorizedError as e:
        logger.error("Failed to set auth token due to 401: %s", e)
        failure_response = JSONResponse(
            status_code=401,
            content={"detail": "Authentication to identity service failed"},
        )
        clear_cookies_on_identity_service_401(failure_response)
        return failure_response
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

        # Validate auth token is present and not empty
        if not auth_token or auth_token.strip() == "":
            logger.warning(
                "Empty or missing auth token in request from user %s", user_id
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required: valid auth token must be provided",
            )

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

    except IdentityServiceUnauthorizedError as e:
        logger.error("Failed to get auth tokens due to 401: %s", e)
        failure_response = JSONResponse(
            status_code=401,
            content={"detail": "Authentication to identity service failed"},
        )
        clear_cookies_on_identity_service_401(failure_response)
        return failure_response
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to get auth tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/settings/set")
async def set_user_settings(request: Request):
    """
    Set user settings in HTTP-only cookie.

    Request body:
        - settings: User settings object
        - environment: Environment identifier (dev, prod, local)

    Returns:
        - success: Boolean indicating success
    """
    try:
        data = await request.json()
        settings = data.get("settings")
        environment = data.get("environment", "prod")

        if not settings:
            raise HTTPException(status_code=400, detail="Missing settings data")

        # Get user ID for encryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        # Create response
        fastapi_response = JSONResponse(content={"success": True})

        # Create environment-specific cookie name
        cookie_name = (
            f"user_settings{'_' + environment if environment != 'prod' else ''}"
        )

        # Encrypt and store settings in HTTP-only cookie
        # Require authentication for security - no fallback to unencrypted storage
        if not auth_token or auth_token.strip() == "":
            logger.warning(
                "No auth token provided for settings storage - rejecting request for security"
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required to store settings securely",
            )

        try:
            # Use full encryption with auth token for security
            encrypted_settings = await encrypt_refresh_token(
                json.dumps(settings), user_id, auth_token
            )
        except IdentityServiceUnauthorizedError as e:
            logger.error("Failed to encrypt settings due to 401: %s", e)
            failure_response = JSONResponse(
                status_code=401,
                content={"detail": "Authentication to identity service failed"},
            )
            clear_cookies_on_identity_service_401(failure_response)
            return failure_response
        except Exception as e:
            logger.error("Failed to encrypt settings: %s", e)
            raise HTTPException(
                status_code=500, detail="Failed to encrypt settings securely"
            ) from e
        set_secure_cookie(
            fastapi_response,
            cookie_name,
            encrypted_settings,
            max_age=30 * 24 * 60 * 60,  # 30 days
        )

        logger.info(
            "✅ User settings stored in HTTP-only cookie for user %s in %s environment",
            user_id,
            environment,
        )
        return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to set user settings: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get(f"{BASE_PATH}/api/settings/get")
async def get_user_settings(request: Request):
    """
    Get user settings from HTTP-only cookie.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - settings: User settings object (if available)
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Get user ID for decryption
        user_id = get_user_id_from_request(request)
        auth_token = request.headers.get("Authorization", "").replace("Bearer ", "")

        response_data = {}

        # Create environment-specific cookie name
        cookie_name = (
            f"user_settings{'_' + environment if environment != 'prod' else ''}"
        )

        # Get settings (encrypted) - require authentication for security
        if not auth_token or auth_token.strip() == "":
            logger.warning(
                "No auth token provided for settings retrieval - rejecting request for security"
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required to retrieve settings securely",
            )

        settings_cookie = get_cookie_value(request, cookie_name)
        if settings_cookie:
            try:
                # Use full decryption with auth token for security
                settings_data = await decrypt_refresh_token(
                    settings_cookie, user_id, auth_token
                )
                response_data["settings"] = json.loads(settings_data)
                logger.info(
                    "✅ User settings retrieved from HTTP-only cookie for user %s in %s environment",
                    user_id,
                    environment,
                )
            except IdentityServiceUnauthorizedError as e:
                logger.error(
                    "Failed to decrypt settings data for %s environment due to 401: %s",
                    environment,
                    e,
                )
                failure_response = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication to identity service failed"},
                )
                clear_cookies_on_identity_service_401(failure_response)
                return failure_response
            except (ValueError, RuntimeError, json.JSONDecodeError) as e:
                logger.warning(
                    "Failed to decrypt settings data for %s environment: %s",
                    environment,
                    e,
                )
        else:
            logger.info("No settings cookie found for %s environment", environment)

        return JSONResponse(content=response_data)

    except HTTPException:
        # Re-raise HTTPExceptions (like 401) without wrapping them
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to get user settings: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/auth/fidu/set-tokens")
async def set_fidu_auth_tokens(request: Request):
    """
    Set FIDU authentication tokens in HTTP-only cookies.

    This endpoint stores both access and refresh tokens securely in HTTP-only cookies
    following industry best practices for token management.

    Request body:
        - access_token: Short-lived access token (15-30 minutes)
        - refresh_token: Long-lived refresh token (30-90 days)
        - user: User information
        - environment: Environment identifier (dev, prod, local)

    Returns:
        - success: Boolean indicating success
    """
    try:
        data = await request.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        user = data.get("user")
        environment = data.get("environment", "prod")

        if not access_token:
            raise HTTPException(status_code=400, detail="Missing access token")

        if not refresh_token:
            raise HTTPException(status_code=400, detail="Missing refresh token")

        if not user:
            raise HTTPException(status_code=400, detail="Missing user information")

        logger.info("Setting FIDU auth tokens in HTTP-only cookies...")

        # Create response
        fastapi_response = JSONResponse(content={"success": True})

        # Create environment-specific cookie names
        access_cookie_name = (
            f"fidu_access_token{'_' + environment if environment != 'prod' else ''}"
        )
        refresh_cookie_name = (
            f"fidu_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )
        user_cookie_name = (
            f"fidu_user{'_' + environment if environment != 'prod' else ''}"
        )

        # Set access token cookie (short-lived: 30 minutes)
        set_secure_cookie(
            fastapi_response,
            access_cookie_name,
            access_token,
            max_age=30 * 60,  # 30 minutes
        )

        # Set refresh token cookie (long-lived: 90 days)
        set_secure_cookie(
            fastapi_response,
            refresh_cookie_name,
            refresh_token,
            max_age=90 * 24 * 60 * 60,  # 90 days
        )

        # Set user info cookie (long-lived: 90 days)
        set_secure_cookie(
            fastapi_response,
            user_cookie_name,
            json.dumps(user),
            max_age=90 * 24 * 60 * 60,  # 90 days
        )

        logger.info(
            "✅ FIDU auth tokens stored in HTTP-only cookies for %s environment",
            environment,
        )

        return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to set FIDU auth tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get(f"{BASE_PATH}/api/auth/fidu/get-tokens")
async def get_fidu_auth_tokens(request: Request):
    """
    Get FIDU authentication tokens from HTTP-only cookies.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - access_token: Current access token (if available)
        - refresh_token: Current refresh token (if available)
        - user: User information (if available)
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Create environment-specific cookie names
        access_cookie_name = (
            f"fidu_access_token{'_' + environment if environment != 'prod' else ''}"
        )
        refresh_cookie_name = (
            f"fidu_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )
        user_cookie_name = (
            f"fidu_user{'_' + environment if environment != 'prod' else ''}"
        )

        response_data = {}

        # Get access token
        access_token = get_cookie_value(request, access_cookie_name)
        if access_token and access_token.strip():
            response_data["access_token"] = access_token

        # Get refresh token
        refresh_token = get_cookie_value(request, refresh_cookie_name)
        if refresh_token and refresh_token.strip():
            response_data["refresh_token"] = refresh_token

        # Get user info
        user_cookie = get_cookie_value(request, user_cookie_name)
        if user_cookie and user_cookie.strip():
            try:
                response_data["user"] = json.loads(user_cookie)
            except json.JSONDecodeError:
                logger.warning(
                    "Failed to parse user cookie for %s environment", environment
                )

        logger.info(
            "✅ FIDU auth tokens retrieved from HTTP-only cookies for %s environment",
            environment,
        )

        return JSONResponse(content=response_data)

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to get FIDU auth tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/auth/fidu/refresh-access-token")
async def refresh_fidu_access_token(request: Request):
    """
    Refresh FIDU access token using refresh token from HTTP-only cookies.

    This endpoint uses the refresh token stored in HTTP-only cookies to get a new
    access token, following the standard OAuth2 refresh token flow.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - access_token: New access token
        - expires_in: Token expiration time in seconds
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        # Create environment-specific cookie names
        refresh_cookie_name = (
            f"fidu_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )

        # Get refresh token from HTTP-only cookie
        refresh_token = get_cookie_value(request, refresh_cookie_name)

        if not refresh_token:
            raise HTTPException(
                status_code=401,
                detail=f"No refresh token found in cookies for {environment} environment",
            )

        logger.info("Refreshing FIDU access token...")

        # Call FIDU identity service to refresh the token
        # This would typically involve calling your FIDU identity service
        # For now, we'll simulate the refresh process

        # Call FIDU identity service to refresh the token
        try:
            # Get identity service URL from encryption service
            id_service_url = encryption_service.identity_service_url
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{id_service_url}/refresh",
                    json={"refresh_token": refresh_token},
                    timeout=30.0,
                )

                if not response.is_success:
                    logger.error("FIDU token refresh failed: %s", response.status_code)

                    # If refresh failed with 401, the refresh token is invalid - clear it
                    if response.status_code == 401:
                        logger.warning(
                            "FIDU refresh token is invalid - clearing all tokens"
                        )
                        # Create access token cookie name to clear both tokens
                        env_suffix = "_" + environment if environment != "prod" else ""
                        access_cookie_name = f"fidu_access_token{env_suffix}"
                        fastapi_response = JSONResponse(
                            status_code=401,
                            content={
                                "detail": "Invalid refresh token - please log in again"
                            },
                        )
                        # Clear both access and refresh token cookies
                        clear_cookie(fastapi_response, refresh_cookie_name)
                        clear_cookie(fastapi_response, access_cookie_name)
                        return fastapi_response

                    raise HTTPException(
                        status_code=response.status_code, detail="Token refresh failed"
                    )

                token_data = response.json()
                logger.info("✅ FIDU access token refreshed successfully")

        except httpx.RequestError as e:
            logger.error("Network error during FIDU token refresh: %s", e)
            raise HTTPException(
                status_code=503, detail="Token refresh service unavailable"
            ) from e

        # Create response with new access token cookie
        response_data = {
            "access_token": token_data["access_token"],
            "expires_in": token_data["expires_in"],
        }

        fastapi_response = JSONResponse(content=response_data)

        # Set new access token cookie
        access_cookie_name = (
            f"fidu_access_token{'_' + environment if environment != 'prod' else ''}"
        )
        set_secure_cookie(
            fastapi_response,
            access_cookie_name,
            token_data["access_token"],
            max_age=token_data["expires_in"],  # Use actual expiration time
        )

        logger.info("✅ FIDU access token refreshed successfully")

        return fastapi_response

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to refresh FIDU access token: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/auth/refresh-all")
async def refresh_all_tokens(
    request: Request,
):  # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    """
    Batch refresh both FIDU and Google Drive tokens in a single request.

    This optimization reduces HTTP overhead by refreshing both token types
    simultaneously instead of requiring separate calls.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - fidu: Object with access_token and expires_in (if FIDU token exists)
        - google_drive: Object with access_token and expires_in (if Google token exists)
        - errors: Object with any errors that occurred
    """
    try:
        environment = request.query_params.get("env", "prod")

        result: Dict[str, Any] = {"fidu": None, "google_drive": None, "errors": {}}

        # Attempt to refresh FIDU token
        try:
            suffix = "_" + environment if environment != "prod" else ""
            fidu_refresh_cookie_name = f"fidu_refresh_token{suffix}"
            fidu_refresh_token = get_cookie_value(request, fidu_refresh_cookie_name)

            if fidu_refresh_token:
                logger.info("Refreshing FIDU access token in batch...")

                # Call FIDU identity service
                id_service_url = encryption_service.identity_service_url
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{id_service_url}/refresh",
                        json={"refresh_token": fidu_refresh_token},
                        timeout=30.0,
                    )

                    if response.is_success:
                        token_data = response.json()
                        result["fidu"] = {
                            "access_token": token_data["access_token"],
                            "expires_in": token_data["expires_in"],
                        }
                        logger.info("✅ FIDU token refreshed in batch")
                    else:
                        result["errors"][
                            "fidu"
                        ] = f"Refresh failed with status {response.status_code}"
                        logger.warning(
                            "FIDU token refresh failed in batch: %s",
                            response.status_code,
                        )
            else:
                logger.debug("No FIDU refresh token found for batch refresh")
        except Exception as e:  # pylint: disable=broad-exception-caught
            result["errors"]["fidu"] = str(e)
            logger.warning("FIDU token refresh failed in batch: %s", e)

        # Attempt to refresh Google Drive token
        try:
            suffix = "_" + environment if environment != "prod" else ""
            google_refresh_cookie_name = f"google_refresh_token{suffix}"
            encrypted_token = get_cookie_value(request, google_refresh_cookie_name)

            if encrypted_token:
                logger.info("Refreshing Google Drive access token in batch...")

                # Get user ID and auth token for decryption
                user_id = get_user_id_from_request(request)
                auth_token = request.headers.get("Authorization", "").replace(
                    "Bearer ", ""
                )

                # Decrypt the refresh token
                if auth_token:
                    refresh_token = await decrypt_refresh_token(
                        encrypted_token, user_id, auth_token
                    )
                else:
                    encryption_key = await encryption_service.get_user_encryption_key(
                        user_id, ""
                    )
                    refresh_token = encryption_service.decrypt_refresh_token(
                        encrypted_token, encryption_key
                    )

                # Refresh token using Google OAuth2
                if chatlab_secrets and chatlab_secrets.google_client_secret:
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

                        if response.is_success:
                            token_data = response.json()
                            result["google_drive"] = {
                                "access_token": token_data["access_token"],
                                "expires_in": token_data["expires_in"],
                            }
                            logger.info("✅ Google Drive token refreshed in batch")
                        else:
                            result["errors"][
                                "google_drive"
                            ] = f"Refresh failed with status {response.status_code}"
                            logger.warning(
                                "Google Drive token refresh failed in batch: %s",
                                response.status_code,
                            )
                else:
                    result["errors"]["google_drive"] = "OAuth not configured on server"
            else:
                logger.debug("No Google Drive refresh token found for batch refresh")
        except IdentityServiceUnauthorizedError as e:
            logger.error("Google Drive token refresh failed in batch due to 401: %s", e)
            failure_response = JSONResponse(
                status_code=401,
                content={"detail": "Authentication to identity service failed"},
            )
            clear_cookies_on_identity_service_401(failure_response)
            return failure_response
        except Exception as e:  # pylint: disable=broad-exception-caught
            result["errors"]["google_drive"] = str(e)
            logger.warning("Google Drive token refresh failed in batch: %s", e)

        # Create response with updated cookies
        fastapi_response = JSONResponse(content=result)

        # Set FIDU access token cookie if refreshed
        fidu_tokens = result.get("fidu")
        if fidu_tokens and isinstance(fidu_tokens, dict):
            fidu_access_cookie_name = (
                f"fidu_access_token{'_' + environment if environment != 'prod' else ''}"
            )
            set_secure_cookie(
                fastapi_response,
                fidu_access_cookie_name,
                fidu_tokens["access_token"],
                max_age=fidu_tokens["expires_in"],
            )

        # Google Drive tokens are not stored in cookies (only access token in localStorage)
        # So we don't need to set a cookie here

        logger.info(
            "✅ Batch token refresh complete (FIDU: %s, Google: %s)",
            "success" if result["fidu"] else "skipped",
            "success" if result["google_drive"] else "skipped",
        )

        return fastapi_response

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to batch refresh tokens: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/auth/fidu/clear-tokens")
async def clear_fidu_auth_tokens(request: Request):
    """
    Clear all FIDU authentication cookies.

    Query params:
        - env: Environment identifier (dev, prod, local)

    Returns:
        - success: Boolean indicating success
    """
    try:
        # Get environment from query params
        environment = request.query_params.get("env", "prod")

        logger.info("Clearing FIDU authentication cookies...")

        # Create response
        fastapi_response = JSONResponse(content={"success": True})

        # Create environment-specific cookie names
        access_cookie_name = (
            f"fidu_access_token{'_' + environment if environment != 'prod' else ''}"
        )
        refresh_cookie_name = (
            f"fidu_refresh_token{'_' + environment if environment != 'prod' else ''}"
        )
        user_cookie_name = (
            f"fidu_user{'_' + environment if environment != 'prod' else ''}"
        )

        # Clear all FIDU auth cookies
        clear_cookie(fastapi_response, access_cookie_name)
        clear_cookie(fastapi_response, refresh_cookie_name)
        clear_cookie(fastapi_response, user_cookie_name)

        logger.info(
            "✅ FIDU authentication cookies cleared for %s environment", environment
        )

        return fastapi_response

    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("Failed to clear FIDU auth tokens: %s", e)
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
