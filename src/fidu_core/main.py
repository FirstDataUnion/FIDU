"""Main application module for the FIDU Local App."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# TODO: replace this with an initialtion of the API class (to be renamed) 
app = FastAPI(title="FIDU Local App")

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