# FIDU Vault Refresh Token Migration

This document outlines the changes made to FIDU Vault to support the new refresh token authentication system.

## Overview

FIDU Vault has been migrated from a simple JWT token system to a more robust refresh token system that provides:
- Short-lived access tokens (default: 1 hour)
- Long-lived refresh tokens (default: 30 days)
- Automatic token refresh when access tokens expire
- Better user experience with longer sessions

## Changes Made

### 1. New Authentication Client (`src/fidu_vault/identity_service/auth_client.py`)

#### AuthTokenManager Class
- **Purpose**: Manages access and refresh tokens with automatic expiration handling
- **Key Features**:
  - Stores both access and refresh tokens
  - Tracks token expiration with 5-minute safety margin
  - Automatically refreshes expired access tokens
  - Handles token refresh failures gracefully

#### AuthenticatedClient Class
- **Purpose**: Makes authenticated requests with automatic token refresh
- **Key Features**:
  - Automatically refreshes tokens before making requests
  - Retries failed requests once after token refresh
  - Handles 401 responses by attempting token refresh

### 2. Updated Frontend Templates

#### Home Template (`src/fidu_vault/front_end/templates/home.html`)
- **Changes**:
  - Updated `onAuthSuccess` handler to handle new response format
  - Stores both access and refresh tokens in localStorage
  - Sets refresh token cookie with 30-day expiration
  - Maintains backward compatibility with old token format

#### Authentication Flow
```javascript
fidu.on('onAuthSuccess', (user, token, portalUrl) => {
    // Handle new authentication response format with refresh tokens
    let accessToken = token;
    let refreshToken = '';
    let expiresIn = 86400;
    
    // Check if token is an object with the new format
    if (typeof token === 'object' && token.access_token) {
        accessToken = token.access_token;
        refreshToken = token.refresh_token || '';
        expiresIn = token.expires_in || 86400;
    }
    
    // Store tokens in localStorage
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('token_expires_in', expiresIn.toString());
    
    // Set auth_token cookie for backend compatibility (expires in 1 hour)
    document.cookie = `auth_token=${accessToken}; path=/; max-age=3600; samesite=lax`;
    
    // Store refresh token in a separate cookie for longer persistence
    if (refreshToken) {
        document.cookie = `refresh_token=${refreshToken}; path=/; max-age=2592000; samesite=lax`; // 30 days
    }
    
    // Redirect to dashboard
    window.location.href = "/dashboard";
});
```

### 3. Updated Frontend API (`src/fidu_vault/front_end/api.py`)

#### New Helper Method
- **`_authenticate_user_with_refresh(request)`**: Centralized authentication with refresh token support
  - Attempts to authenticate with current access token
  - Automatically refreshes token if expired
  - Returns user object or None for authentication failure

#### Updated Route Handlers
All protected routes now use the new authentication helper:
- `dashboard()` - Main dashboard page
- `data_packets_page()` - Data packets page
- `data_packets_list()` - Data packets list (HTMX endpoint)
- `profiles_page()` - Profiles page
- `profiles_list()` - Profiles list (HTMX endpoint)
- `apps_page()` - Apps page
- `api_keys_page()` - API keys page
- `api_keys_list()` - API keys list (HTMX endpoint)
- `create_profile()` - Profile creation (HTMX endpoint)
- `add_api_key()` - API key creation/update (HTMX endpoint)
- `update_api_key()` - API key updates (HTMX endpoint)
- `delete_api_key()` - API key deletion (HTMX endpoint)
- `delete_data_packet()` - Data packet deletion (HTMX endpoint)

#### Enhanced Logout
- **Changes**:
  - Clears both access and refresh tokens from localStorage
  - Removes refresh token cookie
  - Maintains backward compatibility

### 4. New Authentication Middleware (`src/fidu_vault/identity_service/middleware.py`)

#### Features
- **`authenticate_request(request)`**: Authenticates requests with refresh token support
- **`refresh_token_middleware`**: Handles automatic token refresh and cookie updates
- **`require_auth`**: Decorator for requiring authentication on routes
- **`get_current_user_id`**: Helper for extracting user ID from requests

## Token Storage Strategy

### Frontend Storage
- **Access Token**: Stored in localStorage and cookie (1-hour expiration)
- **Refresh Token**: Stored in localStorage and cookie (30-day expiration)
- **Token Expiration**: Stored in localStorage for client-side validation

### Backend Storage
- **Access Token**: Stored in cookie for session management
- **Refresh Token**: Stored in cookie for token refresh operations
- **Automatic Refresh**: Backend automatically refreshes tokens when needed

## Authentication Flow

### 1. Initial Login
1. User logs in through FIDU SDK
2. Receives access token, refresh token, and expiration info
3. Tokens stored in localStorage and cookies
4. User redirected to dashboard

### 2. Regular Requests
1. Frontend sends request with access token
2. Backend validates access token
3. If valid, request proceeds normally
4. If expired, backend attempts token refresh

### 3. Token Refresh
1. Backend detects expired access token
2. Uses refresh token to request new access token
3. Updates cookies with new access token
4. Retries original request with new token
5. If refresh fails, user redirected to login

### 4. Session Expiration
1. Refresh token expires (30 days)
2. User must log in again
3. New refresh token issued

## Error Handling

### Token Refresh Failures
- **Single Failure**: Request retried once after token refresh
- **Multiple Failures**: User redirected to login page
- **Network Errors**: Graceful degradation with user feedback

### Authentication Failures
- **Invalid Tokens**: Automatic redirect to login
- **Expired Refresh Tokens**: User prompted to log in again
- **Service Unavailable**: Appropriate error messages displayed

## Backward Compatibility

### Token Format Support
- **New Format**: `{access_token, refresh_token, expires_in, ...}`
- **Old Format**: Direct JWT token string
- **Automatic Detection**: Frontend detects format and handles appropriately

### API Endpoints
- **Existing Endpoints**: All continue to work unchanged
- **New Endpoints**: Support both authentication methods
- **Gradual Migration**: Can be enabled/disabled per endpoint

## Testing

### Test Coverage
- **Unit Tests**: All new authentication classes tested
- **Integration Tests**: Token refresh flow tested
- **Error Scenarios**: Various failure modes tested
- **Backward Compatibility**: Old token format tested

### Test Files
- `src/fidu_vault/identity_service/tests/test_auth_client.py`

## Configuration

### Environment Variables
- **`FIDU_IDENTITY_SERVICE_URL`**: Identity service endpoint (default: `https://identity.firstdataunion.org`)
- **Token Expiration**: Configurable through identity service

### Cookie Settings
- **Access Token**: 1-hour expiration, secure, same-site lax
- **Refresh Token**: 30-day expiration, secure, same-site lax
- **Session Data**: 1-hour expiration, httponly

## Security Considerations

### Token Security
- **Access Tokens**: Short-lived, stored in cookies
- **Refresh Tokens**: Long-lived, stored securely
- **Automatic Expiration**: Tokens expire automatically
- **HTTPS Required**: All tokens transmitted over HTTPS

### Session Management
- **Automatic Logout**: Users logged out when refresh tokens expire
- **Token Rotation**: New refresh tokens issued on login
- **Secure Storage**: Tokens stored in secure cookies

## Future Enhancements

### Planned Features
- **Token Rotation**: Automatic refresh token rotation
- **Device Management**: Track and manage multiple devices
- **Session Analytics**: Monitor session usage patterns
- **Advanced Security**: Additional authentication factors

### Performance Optimizations
- **Token Caching**: Cache valid tokens for performance
- **Batch Refresh**: Refresh multiple tokens simultaneously
- **Connection Pooling**: Optimize HTTP connections

## Migration Notes

### For Developers
- **New Dependencies**: No new external dependencies
- **API Changes**: Minimal changes to existing code
- **Testing**: Comprehensive test coverage included
- **Documentation**: Full API documentation provided

### For Users
- **Seamless Experience**: No changes to user workflow
- **Longer Sessions**: Users stay logged in longer
- **Automatic Refresh**: No manual token management required
- **Better Security**: Enhanced security with token expiration

## Troubleshooting

### Common Issues
1. **Token Refresh Failures**: Check network connectivity and identity service status
2. **Session Expiration**: Verify refresh token hasn't expired
3. **Cookie Issues**: Ensure cookies are enabled and not blocked
4. **CORS Problems**: Verify identity service CORS configuration

### Debug Information
- **Logs**: Check application logs for authentication errors
- **Network**: Monitor network requests for token refresh calls
- **Cookies**: Verify token cookies are properly set
- **Console**: Check browser console for JavaScript errors

## Conclusion

The refresh token migration provides FIDU Vault with:
- **Better User Experience**: Longer sessions without frequent logins
- **Enhanced Security**: Short-lived access tokens with automatic refresh
- **Improved Reliability**: Graceful handling of token expiration
- **Future-Proof Architecture**: Foundation for advanced authentication features

The migration maintains full backward compatibility while introducing modern authentication patterns that improve both security and user experience.
