"""
FastAPI server for FIDU Chat Lab with metrics support.
Serves static files and forwards metrics to VictoriaMetrics.
"""

import os
import logging
import time
import asyncio
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

            # Return tokens to frontend (client secret never exposed)
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_in": token_data["expires_in"],
                "scope": token_data["scope"],
            }

    except HTTPException:
        raise
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error("OAuth code exchange failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post(f"{BASE_PATH}/api/oauth/refresh-token")
async def refresh_oauth_token(request: Request):
    """
    Refresh an OAuth access token (server-side only).

    This keeps the client secret secure on the server. The frontend sends
    the refresh token, and this endpoint handles the secure refresh with Google.

    Request body:
        - refresh_token: Google refresh token

    Returns:
        - access_token: New Google access token
        - expires_in: Token expiration time in seconds
    """
    try:
        data = await request.json()
        refresh_token = data.get("refresh_token")

        if not refresh_token:
            raise HTTPException(status_code=400, detail="Missing refresh_token")

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
