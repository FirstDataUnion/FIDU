# API Key Integration with FIDU Vault

This document describes the new API key integration feature that automatically includes user API keys from FIDU Vault when making requests to NLPWorkbench agents.

## Overview

The Chat Lab now automatically fetches and includes appropriate API keys from FIDU Vault when sending requests to NLPWorkbench agents. This eliminates the need for users to manually configure API keys in the Chat Lab interface.

## Supported Providers

The integration supports the following AI model providers:

- **OpenAI** (`openai`) - Uses `openai_api_key` field
- **Anthropic** (`anthropic`) - Uses `anthropic_api_key` field  
- **Google** (`google`) - Uses `google_api_key` field

## How It Works

### 1. API Key Service (`apiKeyService.ts`)

The `APIKeyService` class handles:
- Fetching API keys from FIDU Vault API
- Caching API keys for 5 minutes to reduce API calls
- Mapping provider names to correct field names
- Error handling for missing or invalid API keys

### 2. Enhanced NLPWorkbench Client (`apiClientNLPWorkbench.ts`)

The `NLPWorkbenchAPIClient` has been enhanced with:
- `enhanceRequestWithAPIKey()` method that automatically adds API keys to requests
- All agent execution methods now include appropriate API keys
- Graceful fallback when API keys are not available

### 3. Request Format

When an API key is available, requests to NLPWorkbench are enhanced with the appropriate field:

```typescript
// Original request
{ input: "Hello, how are you?" }

// Enhanced request with API key
{ 
  input: "Hello, how are you?",
  openai_api_key: "sk-your-openai-key-here"  // For OpenAI agents
}
```

## Usage

### Automatic Integration

The integration is automatic - no changes are needed to existing code:

```typescript
// This will automatically include the OpenAI API key if available
const result = await nlpWorkbenchAPIClient.executeChatGPT40GeneralAgent("Hello!");
```

### Manual API Key Checking

You can check if API keys are available:

```typescript
import { apiKeyService } from './apiKeyService';

// Check if OpenAI API key is available
const isAvailable = await apiKeyService.isAPIKeyAvailable('openai');

// Get the actual API key (if needed)
const apiKey = await apiKeyService.getAPIKeyForProvider('openai');
```

## API Endpoints Used

The integration uses the following FIDU Vault API endpoints:

- `GET /api/v1/api-keys/provider/{provider}/value` - Fetch API key with value for a specific provider

## Error Handling

- If an API key is not found for a provider, the request proceeds without it
- API key fetching errors are logged but don't prevent agent execution
- 404 errors (key not found) are handled gracefully
- Network errors are logged and cached to avoid repeated failed requests

## Caching

API keys are cached for 5 minutes to:
- Reduce API calls to FIDU Vault
- Improve performance
- Handle temporary network issues gracefully

Cache can be cleared manually:

```typescript
// Clear cache for specific provider
apiKeyService.clearCache('openai');

// Clear all cached API keys
apiKeyService.clearCache();
```

## Security Considerations

- API keys are fetched securely using authenticated requests to FIDU Vault
- Keys are only included in requests to NLPWorkbench (not logged or stored locally)
- Cache is in-memory only and cleared on page refresh
- API key values are never exposed in console logs (only field names)

## Testing

See `apiKeyIntegrationTest.ts` for examples of how to test the integration.

## Migration Notes

- Existing code continues to work without changes
- API keys are automatically included when available
- No breaking changes to existing API interfaces
- Backward compatible with existing agent execution methods
