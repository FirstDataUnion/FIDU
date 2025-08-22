# API Keys Module

The API Keys module provides secure storage and management of AI model provider API keys within FIDU Vault.

## Overview

This module allows users to:
- Store API keys for various AI model providers securely
- Organize keys by user (one key per provider per user)
- Retrieve keys programmatically for use in applications

## Supported Providers

The following AI model providers are supported:

- **Google/Gemini**: `google_api_key`
- **OpenAI**: `openai_api_key`
- **Anthropic**: `anthropic_api_key`
- **Groq**: `groq_api_key`
- **Cohere**: `cohere_api_key`
- **Hugging Face**: `huggingface_api_key`
- **Replicate**: `replicate_api_key`
- **Together**: `together_api_key`
- **Fireworks**: `fireworks_api_key`
- **Perplexity**: `perplexity_api_key`
- **Microsoft**: `microsoft_api_key`

## Architecture

The module follows the same layered architecture as other FIDU Vault modules:

### Schema Layer (`schema.py`)
- `APIKeyCreate`: Model for creating new API keys
- `APIKeyUpdate`: Model for updating existing API keys
- `APIKey`: Response model for API key data
- `APIKeyQueryParams`: Query parameters for filtering and pagination

### Store Layer (`store.py`)
- `APIKeyStore`: Abstract base class for storage implementations
- `LocalSqlAPIKeyStore`: SQLite-based implementation

### Service Layer (`service.py`)
- `APIKeyService`: Business logic for API key operations

### API Layer (`api.py`)
- `APIKeyAPI`: REST API endpoints for external access

## Database Schema

The `api_keys` table stores:

- `id`: Unique identifier (UUID)
- `provider`: AI model provider name
- `api_key`: The actual API key value
- `user_id`: Associated user ID
- `create_timestamp`: Creation timestamp
- `update_timestamp`: Last update timestamp

## Security Features

- API keys are stored in the local SQLite database
- Access is controlled through FIDU identity service authentication
- Keys are associated with specific users
- Duplicate key prevention per provider/user combination

## Usage Examples

### Creating an API Key

```python
from fidu_vault.api_keys.schema import APIKeyCreate

api_key = APIKeyCreate(
    provider="openai",
    api_key="sk-1234567890",
    user_id="user-123"
)
```

### Retrieving API Keys

```python
# Get by provider
api_key = service.get_api_key_by_provider(
    provider="openai",
    user_id="user-123"
)

# List with filters
api_keys = service.list_api_keys(
    APIKeyQueryParams(
        user_id="user-123",
        provider="openai"
    )
)
```

## API Endpoints

### REST API

- `POST /api/v1/api-keys` - Create new API key
- `GET /api/v1/api-keys/{id}` - Get API key by ID
- `PUT /api/v1/api-keys/{id}` - Update API key
- `DELETE /api/v1/api-keys/{id}` - Delete API key
- `GET /api/v1/api-keys` - List API keys with filters
- `GET /api/v1/api-keys/provider/{provider}` - Get by provider for authenticated user

### Frontend Routes

- `/api-keys` - Main API keys management page
- `/api-keys/add` - Add new API key (HTMX)
- `/api-keys/{id}/edit` - Edit API key form (HTMX)
- `/api-keys/{id}/update` - Update API key (HTMX)
- `/api-keys/{id}/delete` - Delete API key (HTMX)

## Testing

Run tests with pytest:

```bash
pytest src/fidu_vault/api_keys/tests/
```

## Future Enhancements

- Encryption at rest for API keys
- Key rotation and expiration
- Usage tracking and analytics
- Integration with external secret management services
- Support for additional provider types
- Bulk import/export functionality
