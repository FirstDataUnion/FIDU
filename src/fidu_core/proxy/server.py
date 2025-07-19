"""Standalone proxy server for external API requests."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .router import create_proxy_router
from .config import get_proxy_config


def create_proxy_app() -> FastAPI:
    """Create a standalone FastAPI app for proxy functionality."""
    app = FastAPI(
        title="FIDU Proxy Server",
        description="Proxy server for external API requests",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS
    config = get_proxy_config().get_proxy_server_config()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config["cors_origins"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add proxy router
    proxy_router = create_proxy_router()
    app.include_router(proxy_router)

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": "proxy"}

    return app


def run_proxy_server(host: str = None, port: int = None):
    """Run the standalone proxy server."""
    app = create_proxy_app()

    config = get_proxy_config().get_proxy_server_config()
    host = host or config["host"]
    port = port or config["port"]

    print(f"Proxy server running on http://{host}:{port}")
    print(f"Docs: http://{host}:{port}/docs")
    print(f"Health: http://{host}:{port}/health")

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_proxy_server()
