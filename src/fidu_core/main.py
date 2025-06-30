"""Main application module for the FIDU Local App."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
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
templates = Jinja2Templates(directory="src/fidu_core/front_end/templates")
app.mount(
    "/static", StaticFiles(directory="src/fidu_core/front_end/static"), name="static"
)

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

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add database cleanup middleware
app.add_middleware(DatabaseCleanupMiddleware)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    print("Running on http://127.0.0.1:4000")
    print("Docs: http://127.0.0.1:4000/docs")
    print("Redoc: http://127.0.0.1:4000/redoc")
    print("OpenAPI: http://127.0.0.1:4000/openapi.json")
    uvicorn.run(app, host="127.0.0.1", port=4000)
