"""Main application module for the FIDU Local App."""

from threading import Timer
import webbrowser
import sys
import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fidu_core.data_packets import (
    DataPacketService,
    DataPacketAPI,
    LocalSqlDataPacketStore,
)
from fidu_core.profiles import ProfileService, ProfileAPI, LocalSqlProfileStore
from fidu_core.users import UserService, UserAPI
from fidu_core.front_end.api import FrontEndAPI
from fidu_core.users.store import LocalSqlUserStore
from fidu_core.utils.db import close_connection
from fidu_core.proxy.router import create_proxy_router


def get_base_path():
    """Get the base path for the application, handling PyInstaller bundling."""
    if getattr(sys, 'frozen', False):
        # Running in a PyInstaller bundle
        return Path(sys._MEIPASS)
    else:
        # Running in normal Python environment
        # In development, we need to go up to the project root
        return Path(__file__).parent.parent.parent


# Get the base path
BASE_PATH = get_base_path()

# Define paths relative to the base path
if getattr(sys, 'frozen', False):
    # PyInstaller mode - files are directly in the bundle
    ACM_LAB_BUILD_DIR = BASE_PATH / "apps" / "acm-front-end" / "dist"
else:
    # Development mode - files are in src/ directory
    ACM_LAB_BUILD_DIR = BASE_PATH / "src" / "apps" / "acm-front-end" / "dist"

ACM_LAB_INDEX_FILE = ACM_LAB_BUILD_DIR / "index.html"

app = FastAPI(
    title="FIDU Core API",
    description="API for interacting with the FIDU Core Application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# pylint: disable=too-few-public-methods
class DatabaseCleanupMiddleware(BaseHTTPMiddleware):
    """Middleware to clean up database connections after each request."""

    async def dispatch(self, request: Request, call_next):
        """Process the request and clean up connections afterward."""
        response = await call_next(request)
        # Clean up the database connection for this thread
        close_connection()
        return response


# Set up templates and static files
if getattr(sys, 'frozen', False):
    # PyInstaller mode - files are directly in the bundle
    templates = Jinja2Templates(directory=str(BASE_PATH / "fidu_core" / "front_end" / "templates"))
    app.mount(
        "/static", StaticFiles(directory=str(BASE_PATH / "fidu_core" / "front_end" / "static")), name="static"
    )
else:
    # Development mode - files are in src/ directory
    templates = Jinja2Templates(directory=str(BASE_PATH / "src" / "fidu_core" / "front_end" / "templates"))
    app.mount(
        "/static", StaticFiles(directory=str(BASE_PATH / "src" / "fidu_core" / "front_end" / "static")), name="static"
    )

# Mount the React app's static assets at /acm-lab
if ACM_LAB_BUILD_DIR.exists():
    app.mount("/acm-lab", StaticFiles(directory=str(ACM_LAB_BUILD_DIR)), name="acm-lab")

# Create storage layer objects using connection factory pattern
# Each store will get its own thread-local connection when needed
profile_store = LocalSqlProfileStore()
user_store = LocalSqlUserStore()
data_packet_store = LocalSqlDataPacketStore()

# Create service layer objects
user_service = UserService(user_store)
profile_service = ProfileService(profile_store)
data_packet_service = DataPacketService(data_packet_store, profile_service)

# Create API layer objects (for external API access)
data_packet_api = DataPacketAPI(app, data_packet_service)
profile_api = ProfileAPI(app, profile_service)
user_api = UserAPI(app, user_service)

# Initiate the front end, which will serve a simple frontend for logging in and out
# and a basic profile page - now using service layers directly
front_end_api = FrontEndAPI(app, user_service, data_packet_service, profile_service)

# Add proxy router for external API requests
# This is used to proxy requests from the ACM-Lab to external APIs as we are serving
# the ACM-Lab from the same server as the FIDU Core API for now. When this changes, 
# we can remove this. 
proxy_router = create_proxy_router()
app.include_router(proxy_router)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-API-Key"],  # Explicitly allow X-API-Key header
)

# Add database cleanup middleware
app.add_middleware(DatabaseCleanupMiddleware)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/acm-lab")
async def serve_acm_lab():
    """Serve the ACM Lab React app."""
    if not ACM_LAB_INDEX_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="""ACM Lab frontend not built.
             Please run 'npm run build' in the acm-front-end directory.""",
        )
    return FileResponse(ACM_LAB_INDEX_FILE)


@app.get("/acm-lab/{path:path}")
async def serve_acm_lab_path(path: str):
    """Serve the ACM Lab React app for client-side routing."""
    # Check if the path is for a static asset
    static_file_path = ACM_LAB_BUILD_DIR / path
    if static_file_path.exists() and static_file_path.is_file():
        return FileResponse(static_file_path)

    # For all other paths, serve the React app's index.html for client-side routing
    if not ACM_LAB_INDEX_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="""ACM Lab frontend not built. Please run 'npm run build' in
             the acm-front-end directory.""",
        )
    return FileResponse(ACM_LAB_INDEX_FILE)


def open_browser():
    """Open the browser to the local app."""
    webbrowser.open("http://127.0.0.1:4000")


if __name__ == "__main__":
    import uvicorn

    print("Running on http://127.0.0.1:4000")
    print("Docs: http://127.0.0.1:4000/docs")
    print("Redoc: http://127.0.0.1:4000/redoc")
    print("OpenAPI: http://127.0.0.1:4000/openapi.json")
    print("ACM Lab: http://127.0.0.1:4000/acm-lab")
    Timer(1, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=4000)
