# Refresh Token Test Suite

This directory contains comprehensive tests for the refresh token functionality in the FIDU Chat Lab application. These tests ensure that the automatic token refresh mechanism works correctly and prevents regressions.

## Test Files Overview

### 1. `refreshTokenService.test.ts`
**Purpose**: Unit tests for the core refresh token service functionality.

**Coverage**:
- Token retrieval and storage
- JWT token expiration checking
- Token refresh API calls
- Error handling for refresh failures
- Token cleanup functionality
- Auth interceptor creation and behavior

**Key Test Scenarios**:
- ✅ Successful token refresh
- ✅ Failed token refresh with proper error handling
- ✅ JWT expiration detection
- ✅ Concurrent refresh request handling
- ✅ Token cleanup on failure
- ✅ Request/response interceptor behavior

### 2. `apiClientInterceptors.test.ts`
**Purpose**: Unit tests for API client interceptor integration.

**Coverage**:
- FiduVaultAPIClient interceptor setup
- NLPWorkbenchAPIClient interceptor setup
- IdentityServiceAPIClient interceptor setup
- Error handling in interceptors
- Integration with refresh token service

**Key Test Scenarios**:
- ✅ Interceptor setup and configuration
- ✅ Request header injection
- ✅ 401 error handling
- ✅ Non-401 error passthrough
- ✅ Auth interceptor integration

### 3. `tokenRefreshIntegration.test.ts`
**Purpose**: Integration tests for the complete token refresh flow.

**Coverage**:
- End-to-end token refresh scenarios
- Multiple concurrent 401 error handling
- Network error handling
- Request retry logic
- Token storage updates

**Key Test Scenarios**:
- ✅ Automatic token refresh and request retry
- ✅ Concurrent 401 error handling (single refresh)
- ✅ Failed refresh with token cleanup
- ✅ Network error handling
- ✅ Non-401 error passthrough
- ✅ Request interceptor integration

### 4. `conversations.test.ts` (Updated)
**Purpose**: Updated existing API tests to include refresh token behavior.

**New Coverage**:
- 401 error handling in conversations API
- Token refresh integration
- Error scenarios with refresh token service

**Key Test Scenarios**:
- ✅ 401 errors with automatic token refresh
- ✅ Refresh token failure handling
- ✅ Non-401 error passthrough
- ✅ Successful requests without refresh

### 5. `authSlice.test.ts` (Updated)
**Purpose**: Updated Redux auth slice tests to include refresh token integration.

**New Coverage**:
- Token cleanup in error scenarios
- Logout action with refresh token service
- Consistent token clearing across error types

**Key Test Scenarios**:
- ✅ Token cleanup in initializeAuth errors
- ✅ Logout action with refresh token service
- ✅ Consistent token clearing across error scenarios

## Running the Tests

### Run All Refresh Token Tests
```bash
cd src/apps/chat-lab
npm test -- --testPathPattern="refreshToken|apiClientInterceptors|tokenRefreshIntegration"
```

### Run Individual Test Files
```bash
# Refresh token service tests
npm test -- --testPathPattern="refreshTokenService.test.ts"

# API client interceptor tests
npm test -- --testPathPattern="apiClientInterceptors.test.ts"

# Integration tests
npm test -- --testPathPattern="tokenRefreshIntegration.test.ts"

# Updated conversations tests
npm test -- --testPathPattern="conversations.test.ts"

# Updated auth slice tests
npm test -- --testPathPattern="authSlice.test.ts"
```

### Run with Coverage
```bash
npm test -- --coverage --testPathPattern="refreshToken|apiClientInterceptors|tokenRefreshIntegration"
```

### Run the Test Script
```bash
cd src/apps/chat-lab/src/services/api/__tests__
./runRefreshTokenTests.sh
```

## Test Scenarios Covered

### ✅ Happy Path Scenarios
1. **Successful Token Refresh**: Valid refresh token → new access token → retry request
2. **Concurrent 401 Handling**: Multiple 401 errors → single refresh → all requests retried
3. **Valid Token Requests**: Requests with valid tokens → no refresh needed

### ✅ Error Scenarios
1. **Refresh Token Expired**: 401 error → refresh fails → clear tokens → reload page
2. **Network Errors**: 401 error → network failure → clear tokens → reload page
3. **Invalid Refresh Response**: 401 error → invalid response → clear tokens → reload page
4. **Non-401 Errors**: Other errors → no refresh attempted → error passed through

### ✅ Edge Cases
1. **Already Retried**: 401 error with `_retry: true` → no refresh attempted
2. **No Refresh Token**: 401 error → no refresh token → clear tokens → reload page
3. **Malformed JWT**: Invalid token format → assume expired → refresh attempted
4. **Concurrent Refresh**: Multiple refresh attempts → single refresh call

## Mocking Strategy

### Global Mocks
- `fetch`: Mocked for token refresh API calls
- `localStorage`: Mocked for token storage operations
- `window.location.reload`: Mocked for page reload on auth failure
- `axios`: Mocked for request retry functionality

### Service Mocks
- `refreshTokenService`: Mocked for interceptor tests
- `authApi`: Mocked for auth slice tests
- API clients: Mocked for integration tests

## Test Data

### Mock Tokens
- **Valid Access Token**: JWT with future expiration
- **Expired Access Token**: JWT with past expiration
- **Refresh Token**: Valid refresh token for API calls
- **Malformed Token**: Invalid JWT format

### Mock API Responses
- **Successful Refresh**: Valid token refresh response
- **Failed Refresh**: Various error responses (400, 401, 500)
- **Network Error**: Fetch rejection scenarios

## Coverage Goals

- **Lines**: >95% coverage for refresh token service
- **Functions**: 100% coverage for all public methods
- **Branches**: >90% coverage for conditional logic
- **Statements**: >95% coverage for all statements

## Regression Prevention

These tests prevent the following regressions:

1. **Token Refresh Not Working**: Ensures 401 errors trigger refresh
2. **Infinite Refresh Loops**: Prevents multiple concurrent refreshes
3. **Token Not Cleared**: Ensures cleanup on refresh failure
4. **Request Not Retried**: Ensures successful refresh retries request
5. **Non-401 Errors Triggering Refresh**: Prevents unnecessary refresh attempts
6. **Inconsistent Token Cleanup**: Ensures all services use same cleanup method

## Maintenance

### Adding New Tests
When adding new refresh token functionality:

1. Add unit tests to `refreshTokenService.test.ts`
2. Add integration tests to `tokenRefreshIntegration.test.ts`
3. Update existing API client tests if needed
4. Update this documentation

### Updating Tests
When modifying refresh token behavior:

1. Update relevant test files
2. Ensure all scenarios are covered
3. Run full test suite to prevent regressions
4. Update coverage goals if needed

## Troubleshooting

### Common Test Issues
1. **Mock Not Working**: Check mock setup and cleanup
2. **Async Test Failures**: Ensure proper async/await usage
3. **State Pollution**: Use `beforeEach`/`afterEach` cleanup
4. **Timing Issues**: Use proper async test patterns

### Debug Commands
```bash
# Run tests with verbose output
npm test -- --verbose --testPathPattern="refreshTokenService.test.ts"

# Run tests with debug output
npm test -- --testPathPattern="refreshTokenService.test.ts" --detectOpenHandles

# Run specific test case
npm test -- --testNamePattern="should successfully refresh access token"
```
