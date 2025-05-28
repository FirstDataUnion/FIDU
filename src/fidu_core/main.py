"""Main application module for the FIDU Local App."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fidu_core.data_packets.store import DataPacketStore
from fidu_core.data_packets.service import DataPacketService
from fidu_core.data_packets.api import DataPacketAPI

app = FastAPI(
    title="FIDU Core API",
    description="API for interacting with the FIDU Core Application",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Create storage layer objects
data_packet_store = DataPacketStore()

# Create service layer objects
data_packet_service = DataPacketService(data_packet_store)

# Create API layer objects
# this will set up the following endpoints for the app:
# - POST /api/v1/data-packets
# - GET /api/v1/data-packets/{data_packet_id}
data_packet_api = DataPacketAPI(app, data_packet_service)

# TODO: insert a basic preferences file to be read and written to by the API class

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    print("Running on http://127.0.0.1:8000")
    print("Docs: http://127.0.0.1:8000/docs")
    print("Redoc: http://127.0.0.1:8000/redoc")
    print("OpenAPI: http://127.0.0.1:8000/openapi.json")
    uvicorn.run(app, host="127.0.0.1", port=8000)
