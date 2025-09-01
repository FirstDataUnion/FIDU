# FIDU Chat Lab Refresh Token Migration

This document outlines the changes made to FIDU Chat Lab to support the new refresh token authentication system.

## Overview

FIDU Chat Lab has been migrated from a simple JWT token system to a more robust refresh token system that provides:
- Short-lived access tokens (default: 1 hour)
- Long-lived refresh tokens (default: 30 days)
- Automatic token refresh when access tokens expire
- Better user experience with longer sessions
- **Maintains all existing API behavior** - no breaking changes

## Changes Made

### 1. New Refresh Token Service (`src/apps/chat-lab/src/services/api/refreshTokenService.ts`)

#### Core Features
- **Centralized token management** for all API clients
- **Automatic token refresh** when access tokens expire
- **JWT expiration detection** with 5-minute safety buffer
- **Request retry logic** after successful token refresh
- **Graceful fallback** to login when refresh fails

#### Key Methods
- **`getAccessToken()`**: Gets current access token from localStorage
- **`getRefreshToken()`**: Gets current refresh token from localStorage
- **`refreshAccessToken()`**: Refreshes expired access token
- **`clearAllAuthTokens()`**: Clears all authentication data
- **`createAuthInterceptor()`**: Creates axios interceptors for automatic handling

### 2. Updated API Clients

#### FIDU Vault API Client (`apiClientFIDUVault.ts`)
- **Enhanced interceptors** with refresh token support
- **Automatic 401 handling** with token refresh and retry
- **Maintains existing API interface** - no breaking changes
- **Uses refresh token service** for centralized token management

#### NLP Workbench API Client (`apiClientNLPWorkbench.ts`)
- **Enhanced interceptors** with refresh token support
- **Automatic 401 handling** with token refresh and retry
- **Maintains existing API interface** - no breaking changes
- **Uses refresh token service** for centralized token management

#### Identity Service API Client (`apiClientIdentityService.ts`)
- **Enhanced fetch functions** with refresh token support
- **Automatic 401 handling** with token refresh and retry
- **Maintains existing API interface** - no breaking changes
- **Uses refresh token service** for centralized token management

### 3. Updated Auth API (`auth.ts`)
- **Modified function signatures** to support optional token parameters
- **Automatic token handling** when no token provided
- **Maintains backward compatibility** with existing code

## How It Works

### 1. **Token Storage Strategy**
- **Access Token**: Stored in `localStorage['auth_token']` (short-lived)
- **Refresh Token**: Stored in `localStorage['fiduRefreshToken']` (long-lived)
- **Token Expiration**: Stored in `localStorage['token_expires_in']`

### 2. **Automatic Token Refresh Flow**
1. **API Request** → Uses current access token
2. **401 Response** → Automatically attempts token refresh
3. **Token Refresh** → Uses refresh token to get new access token
4. **Request Retry** → Retries original request with new token
5. **Success** → User continues seamlessly
6. **Failure** → User redirected to login

### 3. **Error Handling**
- **Single 401**: Automatic token refresh and retry
- **Refresh Success**: Request retried automatically
- **Refresh Failure**: User logged out and redirected to login
- **Network Errors**: Graceful degradation with user feedback

## API Client Integration

### **Axios-based Clients** (FIDU Vault, NLP Workbench)
```typescript
// Request interceptor automatically adds current access token
this.client.interceptors.request.use((config) => {
  const token = refreshTokenService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor handles 401 errors automatically
this.client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      return this.handleUnauthorizedWithRefresh(error);
    }
    throw error;
  }
);
```

### **Fetch-based Clients** (Identity Service)
```typescript
// Automatic token refresh on 401 responses
if (res.status === 401) {
  try {
    await refreshTokenService.refreshAccessToken();
    // Retry with new token
    const newToken = refreshTokenService.getAccessToken();
    if (newToken) {
      const retryRes = await fetch(url, {
        headers: { Authorization: `Bearer ${newToken}` },
        // ... other options
      });
      // Handle response
    }
  } catch (refreshError) {
    // Handle refresh failure
  }
}
```

## Token Expiration Detection

### **JWT Decoding**
- **Automatic expiration check** using JWT payload
- **5-minute safety buffer** to prevent edge cases
- **Fallback behavior** when JWT decoding fails

### **Expiration Logic**
```typescript
private isTokenExpired(): boolean {
  const accessToken = this.getAccessToken();
  const refreshToken = this.getRefreshToken();
  
  if (!accessToken) return true;
  
  if (refreshToken) {
    try {
      const payload = this.decodeJWT(accessToken);
      if (payload && payload.exp) {
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        return Date.now() >= (payload.exp * 1000) - bufferTime;
      }
    } catch (error) {
      return true; // Assume expired if can't decode
    }
  }
  
  return false;
}
```

## Backward Compatibility

### **API Interface Preservation**
- **All existing methods** work exactly as before
- **No breaking changes** to function signatures
- **Optional token parameters** for enhanced flexibility
- **Automatic fallback** to stored tokens when none provided

### **Token Handling**
- **Automatic token management** when no token provided
- **Seamless upgrade** from old to new system
- **No user intervention** required

## Configuration

### **Environment Variables**
- **`IDENTITY_SERVICE_URL`**: Identity service endpoint
- **Fallback**: `https://identity.firstdataunion.org`

### **Token Storage Keys**
- **`auth_token`**: Current access token
- **`fiduRefreshToken`**: Long-lived refresh token
- **`token_expires_in`**: Token expiration time

## Testing

### **Test Coverage**
- **Unit tests** for all refresh token service methods
- **Mock implementations** for localStorage and fetch
- **Error scenario testing** for various failure modes
- **JWT decoding validation** for token expiration logic

### **Test File**
- `src/apps/chat-lab/src/services/api/__tests__/refreshTokenService.test.ts`

## Security Features

### **Token Security**
- **Short-lived access tokens** (1 hour default)
- **Long-lived refresh tokens** (30 days default)
- **Automatic expiration** with safety buffer
- **Secure storage** in localStorage

### **Session Management**
- **Automatic logout** when refresh tokens expire
- **Token rotation** on successful refresh
- **Secure cleanup** of all authentication data

## Error Scenarios

### **Common Issues**
1. **Token Refresh Failures**: Check network connectivity and identity service status
2. **Session Expiration**: Verify refresh token hasn't expired
3. **JWT Decoding Errors**: Check token format and validity
4. **Network Timeouts**: Handle gracefully with user feedback

### **Debug Information**
- **Console logs** for token refresh operations
- **Network monitoring** for refresh requests
- **Local storage inspection** for token values
- **Error tracking** for authentication failures

## Performance Considerations

### **Optimizations**
- **Single refresh promise** prevents multiple simultaneous refreshes
- **Token caching** in localStorage for quick access
- **Minimal network overhead** for token validation
- **Efficient retry logic** with single attempt

### **Memory Management**
- **Automatic cleanup** of expired tokens
- **Efficient storage** of token metadata
- **Minimal memory footprint** for service instance

## Future Enhancements

### **Planned Features**
- **Token rotation** for enhanced security
- **Device management** for multiple sessions
- **Session analytics** for usage patterns
- **Advanced security** with additional factors

### **Performance Improvements**
- **Background token refresh** to prevent expiration
- **Batch token operations** for efficiency
- **Connection pooling** for HTTP requests
- **Smart retry logic** with exponential backoff

## Migration Notes

### **For Developers**
- **No code changes required** for existing API calls
- **Enhanced error handling** with automatic retry
- **Better user experience** with seamless token refresh
- **Comprehensive testing** included

### **For Users**
- **Seamless experience** with no workflow changes
- **Longer sessions** without frequent logins
- **Automatic token management** - no manual intervention
- **Enhanced security** with token expiration

## Troubleshooting

### **Common Problems**
1. **Refresh Token Missing**: Check if `fiduRefreshToken` exists in localStorage
2. **Token Refresh Fails**: Verify identity service is accessible
3. **Session Expires Quickly**: Check refresh token expiration
4. **API Calls Fail**: Verify access token is being set correctly

### **Debug Steps**
1. **Check localStorage** for token values
2. **Monitor network requests** for refresh calls
3. **Check console logs** for error messages
4. **Verify identity service** status and configuration

## Conclusion

The refresh token migration provides FIDU Chat Lab with:
- **Better User Experience**: Longer sessions without frequent logins
- **Enhanced Security**: Short-lived access tokens with automatic refresh
- **Improved Reliability**: Graceful handling of token expiration
- **Zero Breaking Changes**: All existing APIs continue to work
- **Future-Proof Architecture**: Foundation for advanced authentication features

The migration maintains full backward compatibility while introducing modern authentication patterns that improve both security and user experience. All existing API clients now automatically handle token refresh, providing a seamless experience for users and developers alike.
