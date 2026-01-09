# API Services Architecture

This directory contains API client implementations and service layers for integrating with external services in the FIDU Chat Lab application.

## Directory Structure

```
services/api/
├── apiClients.ts              # Base API client types and error handling
├── apiClientFIDUVault.ts      # FIDU Vault API client
├── apiClientIdentityService.ts # Identity Service API client
├── apiClientNLPWorkbench.ts   # NLP Workbench API client
├── apiKeyService.ts           # API key management service
├── auth.ts                    # Authentication API wrapper
├── conversations.ts           # Conversation API service
├── contexts.ts                # Context API service
├── prompts.ts                 # Prompt API service
└── systemPrompts.ts           # System prompt API service
```

## API Client Architecture

### Base Types (`apiClients.ts`)

**Purpose**: Common types and error handling for all API clients

**Key Components:**
- **`ApiError`** - Custom error class with status codes
- **`ApiResponse<T>`** - Standardized response wrapper
- **`ErrorResponse`** - Error response structure

```typescript
export class ApiError extends Error {
  public status: number;
  public data?: any;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}
```

### FIDU Vault API Client (`apiClientFIDUVault.ts`)

**Purpose**: Client for local FIDU Vault instance API

**Configuration:**
- **Base URL**: `http://127.0.0.1:4000/api/v1`
- **Timeout**: 10 seconds
- **Content-Type**: `application/json`

**Key Features:**
- Automatic token refresh integration
- Request/response interceptors
- Error handling and retry logic
- TypeScript integration

**Usage:**
```typescript
import { fiduVaultAPIClient } from './apiClientFIDUVault';

// GET request
const response = await fiduVaultAPIClient.get<DataType>('/endpoint');

// POST request
const response = await fiduVaultAPIClient.post<DataType>('/endpoint', data);
```

### Identity Service API Client (`apiClientIdentityService.ts`)

**Purpose**: Client for FIDU Identity Service

**Configuration:**
- **Base URL**: Environment-dependent (dev/prod)
- **Timeout**: 10 seconds
- **Authentication**: Bearer token

**Key Features:**
- Dynamic base URL configuration
- Profile management operations
- User authentication endpoints
- Token-based authentication

**Endpoints:**
- **`/users/me`** - Get current user
- **`/profiles`** - Profile management
- **`/auth/login`** - User authentication
- **`/auth/register`** - User registration

### NLP Workbench API Client (`apiClientNLPWorkbench.ts`)

**Purpose**: Client for AI model execution and prompt processing

**Key Features:**
- Model execution requests
- Execution status tracking
- Result retrieval
- Multiple AI provider support

**Execution Flow:**
1. **Submit Request** - Send prompt and configuration
2. **Track Status** - Monitor execution progress
3. **Retrieve Results** - Get final output

**Supported Providers:**
- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)

## Service Layer

### API Key Service (`apiKeyService.ts`)

**Purpose**: Centralized API key management across different storage backends

**Key Features:**
- **Multi-backend Support**: Works with local FIDU Vault and cloud storage
- **Caching**: 5-minute cache for performance
- **Provider Support**: OpenAI, Anthropic, Google
- **Error Handling**: Graceful handling of missing keys

**Supported Providers:**
```typescript
type SupportedProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';
```

**Usage:**
```typescript
const apiKeyService = new APIKeyService();

// Get API key for provider
const apiKey = await apiKeyService.getAPIKeyForProvider('openai');

// Check if API key is available
const isAvailable = await apiKeyService.isAPIKeyAvailable('anthropic');
```

**Storage Mode Handling:**
- **Local Mode**: Fetches from FIDU Vault API with caching
- **Cloud Mode**: Uses UnifiedStorageService for cloud storage

### Authentication Service (`auth.ts`)

**Purpose**: High-level authentication operations

**Key Operations:**
- **`getCurrentUser`** - Get authenticated user information
- **`createProfile`** - Create new user profile
- **`updateProfile`** - Update existing profile
- **`deleteProfile`** - Remove user profile

**Usage:**
```typescript
import { authApi } from './auth';

const user = await authApi.getCurrentUser(token);
const profile = await authApi.createProfile('Profile Name', token);
```

### Conversation Service (`conversations.ts`)

**Purpose**: Conversation data management and transformation

**Key Features:**
- **Data Transformation**: Converts between API and local formats
- **UUID Generation**: Deterministic UUIDs for consistency
- **Message Handling**: Complete message lifecycle management
- **Original Prompt Support**: Preserves prompt context and system prompts

**Data Flow:**
1. **API → Local**: Transform FIDU Vault data packets to local conversation format
2. **Local → API**: Transform local conversations to data packets for storage
3. **Message Processing**: Handle message arrays and attachments

**Key Operations:**
- **`createConversation`** - Create new conversation with messages
- **`updateConversation`** - Update existing conversation
- **`getAll`** - Fetch conversations with filtering and pagination
- **`getById`** - Get specific conversation
- **`getMessages`** - Retrieve messages for conversation

**Transformation Functions:**
- **`transformDataPacketToConversation`** - API → Local format
- **`transformConversationToDataPacket`** - Local → API format
- **`transformConversationToDataPacketUpdate`** - Update format

### Context Service (`contexts.ts`)

**Purpose**: Context management for conversation knowledge bases

**Key Features:**
- **Factory Pattern**: `createContextsApi()` for flexible instantiation
- **Data Transformation**: Context format conversion
- **Tag Management**: Automatic tag handling
- **Profile Integration**: Profile-specific context management

**Key Operations:**
- **`getAll`** - Fetch contexts with pagination
- **`createContext`** - Create new context
- **`updateContext`** - Update existing context
- **`deleteContext`** - Remove context

**Data Structure:**
```typescript
interface ContextDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    context_title: string;
    context_body: string;
    token_count: number;
  };
}
```

### FIDU Authentication (`FiduAuthService`)

**Purpose**: Centralized FIDU authentication token management with automatic refresh and retry logic

**Key Architecture Principles:**
- **Access Token Storage**: FIDU access tokens exist **only in memory** within `FiduAuthService`
  - Never stored in localStorage, sessionStorage, or cookies
  - Entire lifecycle (acquisition, refresh, clearing) managed exclusively by `FiduAuthService`
- **Refresh Token Storage**: FIDU refresh tokens exist **only in HTTP-only cookies**
  - Managed by the backend server for security
  - Not accessible to JavaScript code
- **Interceptor-Based Authentication**: All API calls requiring FIDU auth use axios interceptors provided by `FiduAuthService`
  - Ensures consistent behavior across all call sites
  - First 401 on any request triggers automatic token refresh and request retry
  - If the token refresh returns 401, or if the retried request returns 401, automatic logout is triggered

**Key Features:**
- **Automatic Token Refresh**: Handles token expiration and refresh transparently
- **401 Error Handling**: First 401 on any request triggers automatic token refresh and request retry
- **Request Retry**: Failed requests are automatically retried after token refresh
- **Logout on Auth Failure**: If the token refresh returns 401, or if the retried request returns 401, automatic logout is triggered
- **Memory-Only Access Tokens**: Access tokens never persist to storage, improving security

**Usage:**
```typescript
import { getFiduAuthService } from '../auth/FiduAuthService';

// Create auth interceptor for API clients
const authInterceptor = getFiduAuthService().createAuthInterceptor();

// Add auth interceptor first (request, response, and error interceptors)
client.interceptors.request.use(
  authInterceptor.request,
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  authInterceptor.response,
  authInterceptor.error
);

// these interceptors run after the authInterceptor
// response is run if authInterceptor resolves and error if it rejects
client.interceptors.response.use(
  client_specific_interceptor.response,
  client_specific_interceptor.error
)
```

**Important Notes:**
- **Never access access tokens directly** - always use `FiduAuthService` methods
- **Never store access tokens** in localStorage, sessionStorage, or anywhere else
- **All FIDU-authenticated API calls** must use the interceptors provided by `FiduAuthService`
- **Token refresh and clearing** happens automatically through interceptors - no manual intervention needed

## Design Patterns

### 1. Client-Service Separation
- **API Clients**: Low-level HTTP communication
- **Services**: High-level business logic and data transformation
- **Clear Boundaries**: Separation of concerns

### 2. Data Transformation
- **Bidirectional**: API ↔ Local format conversion
- **Type Safety**: Full TypeScript integration
- **Validation**: Data integrity checks

### 3. Error Handling
- **Centralized**: Consistent error handling across clients
- **User-friendly**: Clear error messages
- **Recovery**: Automatic retry and fallback mechanisms

### 4. Caching Strategy
- **API Keys**: 5-minute cache for performance
- **Smart Invalidation**: Cache invalidation on updates
- **Memory Management**: Automatic cleanup

### 5. Authentication Flow
- **Token Management**: Access tokens live only in memory in `FiduAuthService`, refresh tokens in HTTP-only cookies
- **Interceptor Pattern**: All FIDU-authenticated calls use `FiduAuthService` interceptors for consistent behavior
- **Automatic Refresh**: First 401 on any request triggers automatic token refresh and request retry
- **Automatic Logout**: If the token refresh returns 401, or if the retried request returns 401, automatic logout is triggered
- **Security**: Access tokens never persist to storage, reducing attack surface

## Configuration Management

### Environment-based Configuration

**Development:**
```typescript
VITE_IDENTITY_SERVICE_URL=https://dev.identity.firstdataunion.org
VITE_GATEWAY_URL=https://dev.gateway.firstdataunion.org
```

**Production:**
```typescript
VITE_IDENTITY_SERVICE_URL=https://identity.firstdataunion.org
VITE_GATEWAY_URL=https://gateway.firstdataunion.org
```

### Dynamic URL Resolution

```typescript
// Identity Service URL
const identityUrl = getIdentityServiceUrl();

// Gateway URL
const gatewayUrl = getGatewayUrl();
```

## Error Handling Strategy

### API Error Types

1. **Network Errors**: Connection failures, timeouts
2. **Authentication Errors**: Invalid tokens, expired sessions
3. **Validation Errors**: Invalid request data
4. **Server Errors**: Backend service failures
5. **Not Found Errors**: Resource not found (404)

### Error Recovery

1. **Automatic Retry**: For transient network errors
2. **Token Refresh**: For authentication failures
3. **Fallback Values**: For optional data
4. **User Notification**: Clear error messages

## Performance Optimization

### Caching Strategy

1. **API Keys**: 5-minute cache with automatic invalidation
2. **Request Deduplication**: Prevent duplicate requests
3. **Response Caching**: Cache frequently accessed data
4. **Memory Management**: Automatic cleanup of expired cache

### Request Optimization

1. **Pagination**: Efficient data loading
2. **Filtering**: Server-side filtering to reduce payload
3. **Compression**: Gzip compression for large responses
4. **Timeout Management**: Appropriate timeouts for different operations

## Testing Strategy

### Unit Testing

1. **Service Tests**: Test business logic and transformations
2. **Client Tests**: Test HTTP communication
3. **Error Handling**: Test error scenarios
4. **Mocking**: Mock external dependencies

### Integration Testing

1. **API Integration**: Test with real API endpoints
2. **Authentication Flow**: Test token refresh
3. **Data Transformation**: Test data conversion
4. **Error Scenarios**: Test error handling

## Security Considerations

### API Key Management

1. **Secure Storage**: Encrypted storage in cloud mode
2. **Access Control**: Profile-based access
3. **Key Rotation**: Support for key updates
4. **Audit Logging**: Track key usage

### Authentication Security

1. **Token Security**: 
   - Access tokens stored only in memory (never in localStorage/sessionStorage/cookies)
   - Refresh tokens stored in HTTP-only cookies (not accessible to JavaScript)
   - Entire token lifecycle managed by `FiduAuthService`
2. **Refresh Logic**: Secure token refresh mechanism with automatic retry
3. **Session Management**: Proper session handling with automatic logout on auth failure
4. **CORS Configuration**: Appropriate CORS settings
5. **Consistent Behavior**: All FIDU auth handled through interceptors, ensuring consistent security across all API calls

## Future Enhancements

### Planned Improvements

1. **Request/Response Interceptors**: Enhanced middleware support
2. **Offline Support**: Offline-first architecture
3. **Real-time Updates**: WebSocket integration
4. **Advanced Caching**: More sophisticated caching strategies

### Architecture Evolution

1. **GraphQL Integration**: Consider GraphQL for complex queries
2. **Microservice Architecture**: Service decomposition
3. **API Versioning**: Version management for API changes
4. **Rate Limiting**: Client-side rate limiting

## Contributing

When working with API services:

1. Follow established patterns and conventions
2. Use TypeScript for all API interfaces
3. Add appropriate error handling
4. Include comprehensive tests
5. Document API changes
6. Consider performance implications

## Resources

- [Axios Documentation](https://axios-http.com/docs/intro)
- [TypeScript API Patterns](https://www.typescriptlang.org/docs/handbook/2/functions.html)
- [REST API Best Practices](https://restfulapi.net/)
- [Error Handling Patterns](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
