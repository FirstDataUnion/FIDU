"""Main application module for the FIDU Local App."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fidu_core.data_packets.api import app as data_packets_app


app = FastAPI(title="FIDU Local App")

# Mount the data packets API
# TODO: Not sure I want to mount the separate APIs like this and add 'api' to the paths,
# might pass the app to the separate API classes and they can initial the endpoints there.
app.mount("/data-packets", data_packets_app)

# TODO: Initialise dummy storage layer and pass it to the API class(?)

# TODO: insert a basic preferences file to be read and written to by the API class

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint returning a welcome message."""
    return {"message": "Welcome to FIDU Local App"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
