"""Main application module for the FIDU Local App."""

import sqlite3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fidu_core.data_packets import (
    DataPacketService,
    DataPacketAPI,
    LocalSqlDataPacketStore,
)
from fidu_core.profiles import ProfileService, ProfileAPI, LocalSqlProfileStore
from fidu_core.users import UserService, UserAPI
from fidu_core.front_end.api import FrontEndAPI
from fidu_core.users.store import LocalSqlUserStore

app = FastAPI(
    title="FIDU Core API",
    description="API for interacting with the FIDU Core Application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Set up templates and static files
templates = Jinja2Templates(directory="src/fidu_core/front_end/templates")
app.mount(
    "/static", StaticFiles(directory="src/fidu_core/front_end/static"), name="static"
)
# For now we will always use the local DB, but eventually we'll inspect config here
# to set-up the appropriate storage layer.
with sqlite3.connect("fidu.db") as conn:

    # Create storage layer objects

    profile_store = LocalSqlProfileStore(conn)
    user_store = LocalSqlUserStore(conn)
    data_packet_store = LocalSqlDataPacketStore(conn)

    # Create service layer objects
    data_packet_service = DataPacketService(data_packet_store)
    profile_service = ProfileService(profile_store)
    user_service = UserService(user_store)

    # Create API layer objects
    # this will set up the following endpoints for the app:
    # - POST /api/v1/data-packets
    # - GET /api/v1/data-packets/{data_packet_id}
    data_packet_api = DataPacketAPI(app, data_packet_service)
    profile_api = ProfileAPI(app, profile_service)
    user_api = UserAPI(app, user_service)

    # Initiate the front end, which will serve a simple frontend for logging in and out
    # and a basic profile page
    front_end_api = FrontEndAPI(app, user_api, data_packet_api)

    # TODO: insert a basic preferences file to be read and written to by the API class

    # Configure CORS for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production, replace with specific origins
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# TODO move this to frontend api file
@app.get("/")
async def home(request: Request):
    """Serve the home page."""
    return templates.TemplateResponse("index.html", {"request": request})


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
