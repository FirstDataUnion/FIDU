# FIDU Proxy Module

This module provides proxy functionality for external API requests, specifically designed to replicate VITE proxy behavior in a FastAPI server.

## Features

- **NLP Workbench Proxy**: Proxies requests from `/api/nlp-workbench/*` to `https://wb.nlp-processing.com/api/public/*`
- **API Key Management**: Automatically adds API keys to proxied requests
- **Standalone Server**: Can be run as a separate service
- **Configurable**: Easy to customize via environment variables

## Usage

### Integrated with Main FastAPI App

The proxy is automatically included in the main FastAPI application. Requests to `/api/nlp-workbench/*` will be proxied to the NLP Workbench API.

### Standalone Proxy Server

To run the proxy as a separate service:

```bash
# Run from the project root
python -m src.fidu_core.proxy.server

# Or with custom host/port
python -m src.fidu_core.proxy.server --host 0.0.0.0 --port 4001
```

## Configuration

### Environment Variables

- `VITE_NLP_WORKBENCH_AGENT_API_KEY`: API key for NLP Workbench (required)
- `FIDU_PROXY_HOST`: Host for standalone proxy server (default: 127.0.0.1)
- `FIDU_PROXY_PORT`: Port for standalone proxy server (default: 4001)
- `FIDU_PROXY_TIMEOUT`: Request timeout in seconds (default: 30)
- `FIDU_PROXY_CORS_ORIGINS`: Comma-separated list of allowed CORS origins (default: *)

### Example Configuration

```bash
export VITE_NLP_WORKBENCH_AGENT_API_KEY="your-api-key-here"
export FIDU_PROXY_HOST="0.0.0.0"
export FIDU_PROXY_PORT="4001"
export FIDU_PROXY_CORS_ORIGINS="http://localhost:3000,http://localhost:4000"
```

## Architecture

### Components

1. **NLPWorkbenchProxy**: Handles individual proxy requests
2. **create_proxy_router()**: Creates FastAPI router for proxy endpoints
3. **ProxyConfig**: Manages configuration settings
4. **create_proxy_app()**: Creates standalone FastAPI app

### Separation Strategy

The proxy module is designed to be easily separated into its own service:

1. **Current State**: Integrated into main FastAPI app
2. **Future State**: Run as separate service on different port
3. **Migration**: Update frontend API client base URL to point to proxy service

### Frontend Integration

The frontend API client (`apiClientNLPWorkbench.ts`) is already configured to use `/api/nlp-workbench` as the base URL, which works with both:

- Integrated proxy (current setup)
- Standalone proxy server (future setup)

## API Endpoints

### Health Check
- `GET /health` - Returns service health status

### Proxy Endpoints
- `GET /api/nlp-workbench/*` - Proxy GET requests
- `POST /api/nlp-workbench/*` - Proxy POST requests
- `PUT /api/nlp-workbench/*` - Proxy PUT requests
- `DELETE /api/nlp-workbench/*` - Proxy DELETE requests
- `PATCH /api/nlp-workbench/*` - Proxy PATCH requests

## Error Handling

The proxy includes comprehensive error handling:

- **400 Bad Request**: Invalid proxy path or request body
- **502 Bad Gateway**: Target API unreachable
- **504 Gateway Timeout**: Request timeout
- **500 Internal Server Error**: Unexpected errors

## Logging

All proxy requests and errors are logged using Python's logging module. Check the application logs for detailed information about proxy operations.

## Security Considerations

1. **API Key Protection**: API keys are only added server-side, never exposed to the client
2. **CORS Configuration**: Configure allowed origins in production
3. **Request Validation**: All requests are validated before proxying
4. **Timeout Protection**: Prevents hanging requests

## Future Enhancements

1. **Rate Limiting**: Add rate limiting for proxy requests
2. **Caching**: Implement response caching for frequently requested data
3. **Authentication**: Add authentication for proxy endpoints
4. **Monitoring**: Add metrics and monitoring for proxy performance
5. **Load Balancing**: Support for multiple target servers 