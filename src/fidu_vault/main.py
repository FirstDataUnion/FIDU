"""Main application module for the FIDU Local App."""

import os
import sys
import time
from pathlib import Path
import webbrowser
from threading import Timer
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fidu_vault.utils.db import close_connection, get_db_path, migrate_existing_db
from fidu_vault.data_packets import (
    DataPacketService,
    DataPacketAPI,
    LocalSqlDataPacketStore,
)
from fidu_vault.api_keys import (
    APIKeyService,
    APIKeyAPI,
    LocalSqlAPIKeyStore,
)
from fidu_vault.front_end.api import FrontEndAPI
from .versioning.version import get_vault_version
from .versioning.version_api import router as version_router


def get_base_path():
    """Get the base path for the application, handling PyInstaller bundling."""
    if getattr(sys, "frozen", False):
        # Running in a PyInstaller bundle
        return Path(sys._MEIPASS)  # pylint: disable=protected-access
    # Running in normal Python environment
    # In development, we need to go up to the project root
    return Path(__file__).parent.parent.parent


# pylint: disable=too-many-locals
# pylint: disable=too-many-statements
def create_app():
    """Create and configure the FastAPI application."""
    env = os.getenv("FIDU_ENV", "development")
    if env == "development":
        load_dotenv(override=True)
    else:
        load_dotenv()
    start_time = time.time()
    print(f"[{time.time() - start_time:.2f}s] Starting up FIDU Vault...")

    # Get the base path
    base_path = get_base_path()
    print(f"[{time.time() - start_time:.2f}s] Base path determined: {base_path}")

    # Log the database location
    db_path = get_db_path()
    print(f"[{time.time() - start_time:.2f}s] Database will be created at: {db_path}")

    # Attempt to migrate existing database if needed
    print(
        f"[{time.time() - start_time:.2f}s] Checking for existing database to migrate..."
    )
    if migrate_existing_db():
        print(f"[{time.time() - start_time:.2f}s] Database migration check completed")
    else:
        print(
            f"[{time.time() - start_time:.2f}s] Warning: Database migration encountered issues"
        )

    # Define paths relative to the base path
    if getattr(sys, "frozen", False):
        # PyInstaller mode - files are directly in the bundle
        chat_lab_build_dir = base_path / "apps" / "chat-lab" / "dist"
    else:
        # Development mode - files are in src/ directory
        chat_lab_build_dir = base_path / "src" / "apps" / "chat-lab" / "dist"

    chat_lab_index_file = chat_lab_build_dir / "index.html"
    print(f"[{time.time() - start_time:.2f}s] Paths configured")

    print(f"[{time.time() - start_time:.2f}s] Creating FastAPI app...")
    fast_api_app = FastAPI(
        title="FIDU Vault API",
        description="API for interacting with the FIDU Vault Application",
        version=get_vault_version(),
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

    print(f"[{time.time() - start_time:.2f}s] Setting up static files and templates...")
    # Set up templates and static files
    if getattr(sys, "frozen", False):
        # PyInstaller mode - files are directly in the bundle
        Jinja2Templates(
            directory=str(base_path / "fidu_vault" / "front_end" / "templates")
        )
        fast_api_app.mount(
            "/static",
            StaticFiles(
                directory=str(base_path / "fidu_vault" / "front_end" / "static")
            ),
            name="static",
        )
    else:
        # Development mode - files are in src/ directory
        Jinja2Templates(
            directory=str(base_path / "src" / "fidu_vault" / "front_end" / "templates")
        )
        fast_api_app.mount(
            "/static",
            StaticFiles(
                directory=str(base_path / "src" / "fidu_vault" / "front_end" / "static")
            ),
            name="static",
        )

    if chat_lab_build_dir.exists():
        print(
            f"""[{time.time() - start_time:.2f}s]
             FIDU Chat Lab frontend found at {chat_lab_build_dir}"""
        )
    else:
        print(
            f"""[{time.time() - start_time:.2f}s]
            Warning: FIDU Chat Lab frontend not found at {chat_lab_build_dir}"""
        )

    print(f"[{time.time() - start_time:.2f}s] Importing modules...")
    print(f"[{time.time() - start_time:.2f}s] Modules imported")

    # Create storage layer objects using connection factory pattern
    # Each store will get its own thread-local connection when needed
    print(f"[{time.time() - start_time:.2f}s] Creating stores...")
    data_packet_store = LocalSqlDataPacketStore()
    api_key_store = LocalSqlAPIKeyStore()
    print(f"[{time.time() - start_time:.2f}s] Stores created")

    # Create service layer objects
    print(f"[{time.time() - start_time:.2f}s] Creating services...")
    data_packet_service = DataPacketService(data_packet_store)
    api_key_service = APIKeyService(api_key_store)
    print(f"[{time.time() - start_time:.2f}s] Services created")

    # Create API layer objects (for external API access)
    print(f"[{time.time() - start_time:.2f}s] Creating APIs...")
    DataPacketAPI(fast_api_app, data_packet_service)
    APIKeyAPI(fast_api_app, api_key_service)

    # Add version API
    fast_api_app.include_router(version_router)
    print(f"[{time.time() - start_time:.2f}s] APIs created")

    # Initiate the front end, which will serve a simple frontend for logging in and out
    # and a basic profile page - now using service layers directly
    print(f"[{time.time() - start_time:.2f}s] Creating front end API...")
    FrontEndAPI(fast_api_app, data_packet_service, api_key_service)
    print(f"[{time.time() - start_time:.2f}s] Front end API created")

    # Configure CORS for local development
    print(f"[{time.time() - start_time:.2f}s] Configuring CORS...")

    # Define allowed origins for local FIDU applications
    allowed_origins = [
        "http://localhost:4000",  # FIDU Vault frontend & Chat Lab
        "http://127.0.0.1:4000",  # FIDU Vault frontend & Chat Lab (alternative)
        "http://127.0.0.1:5173",  # Chat Lab frontend (dev mode)
        "http://localhost:5173",  # Chat Lab frontend (dev mode, altate)
        "chrome-extension://*",  # Chrome extension (any extension ID)
    ]

    fast_api_app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],  # Allow all headers for local development
    )

    # Add database cleanup middleware
    print(f"[{time.time() - start_time:.2f}s] Adding database cleanup middleware...")
    fast_api_app.add_middleware(DatabaseCleanupMiddleware)

    @fast_api_app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    @fast_api_app.get("/fidu-chat-lab")
    async def serve_fidu_chat_lab():
        """Serve the FIDU Chat Lab React app."""
        if not chat_lab_index_file.exists():
            raise HTTPException(
                status_code=404,
                detail="""FIDU Chat Lab frontend not built.
                 Please run 'npm run build' in the chat-lab directory.""",
            )
        return FileResponse(chat_lab_index_file)

    @fast_api_app.get("/fidu-chat-lab/{path:path}")
    async def serve_fidu_chat_lab_path(path: str):
        """Serve the FIDU Chat Lab React app for client-side routing."""
        # Check if the path is for a static asset
        static_file_path = chat_lab_build_dir / path
        if static_file_path.exists() and static_file_path.is_file():
            return FileResponse(static_file_path)

        # For all other paths, serve the React app's index.html for client-side routing
        if not chat_lab_index_file.exists():
            raise HTTPException(
                status_code=404,
                detail="""FIDU Chat Lab frontend not built. Please run 'npm run build' in
                 the chat-lab directory.""",
            )
        return FileResponse(chat_lab_index_file)

    print(f"[{time.time() - start_time:.2f}s] Application setup complete!")
    return fast_api_app


def open_browser():
    """Open the browser to the local app."""
    webbrowser.open("http://127.0.0.1:4000")


# Create the app instance for uvicorn to find
app = create_app()

if __name__ == "__main__":
    import uvicorn

    print("Running on http://127.0.0.1:4000")
    print("Docs: http://127.0.0.1:4000/docs")
    print("Redoc: http://127.0.0.1:4000/redoc")
    print("OpenAPI: http://127.0.0.1:4000/openapi.json")
    print("FIDU Chat Lab: http://127.0.0.1:4000/fidu-chat-lab")
    Timer(1, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=4000)
