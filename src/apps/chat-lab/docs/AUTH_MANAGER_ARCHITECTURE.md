# Authentication Manager Architecture

## Overview

The `AuthManager` is a centralized service that coordinates all authentication operations for FIDU Chat Lab. It was introduced to solve race conditions, duplicate auth attempts, and fragmented auth state management.

## Problem Statement

### Before AuthManager

The previous authentication architecture had several issues:

1. **Multiple Entry Points**: Auth initialization was triggered from:
   - `CloudStorageAdapter.initialize()` → `authService.initialize()`
   - `checkGoogleDriveAuthStatus()` Redux thunk → `authService.initialize()`
   - `handleVisibilityChange()` → `authService.restoreFromCookiesWithRetry()`
   - Page-level polling (every 30s) → `checkGoogleDriveAuthStatus()`

2. **No Coordination**: Each caller independently called the auth service without checking if another operation was in progress

3. **State Fragmentation**: Auth state lived in three places:
   - Auth service instance (tokens, user info)
   - Redux `unifiedStorage.googleDrive` state
   - Storage adapter's internal auth reference

4. **Race Conditions**: Multiple concurrent auth operations could:
   - Make redundant API calls
   - Update state out of order
   - Leave UI in inconsistent states
   - Cause "No data until page reload" bugs

### Symptoms

- Logs showing 4-5 concurrent "Attempting primary authentication restoration" messages
- Data not loading on page refresh (requiring navigation away and back)
- Redundant token refresh calls
- "Waiting for Google Drive authentication" infinite loops

## Solution: Centralized AuthManager

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AuthManager                           │
│  (Singleton - Single Source of Truth)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  State Management:                                           │
│  - isInitializing: boolean                                   │
│  - isRestoring: boolean                                      │
│  - initializationPromise: Promise | null                     │
│  - lastAuthCheck: number (for debouncing)                    │
│                                                              │
│  Core Methods:                                               │
│  - initialize(): Single app startup initialization           │
│  - checkAndRestore(): Debounced auth check/restore          │
│  - reAuthenticate(): Force full re-auth (post-OAuth)        │
│  - getAuthStatus(): Get current auth state                   │
│                                                              │
│  Event System:                                               │
│  - subscribe(event, callback): Event-driven updates          │
│  - Event types: 'auth-changed', 'auth-lost', 'auth-restored'│
│                                                              │
│  Redux Integration:                                          │
│  - syncToRedux(): Automatic state synchronization           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ coordinates
                            ▼
        ┌──────────────────────────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐              ┌──────────────────────┐
│ FiduAuthService  │              │ GoogleDriveAuthService│
│ (HTTP Cookies)   │              │ (OAuth + HTTP Cookies)│
└──────────────────┘              └──────────────────────┘
```

### Key Features

1. **Operation Locking**
   - Prevents concurrent initialization attempts
   - Shares initialization promise across multiple callers
   - Debounces rapid check/restore operations (2 second window)

2. **Event-Driven Architecture**
   ```typescript
   authManager.subscribe('auth-restored', (status) => {
     // React to auth changes
     // e.g., trigger data sync, update UI
   });
   ```

3. **Automatic Redux Sync**
   - All auth state changes automatically update Redux
   - Single source of truth prevents state inconsistencies

4. **Smart Lifecycle Handling**
   - Visibility changes trigger coordinated restoration
   - Periodic checks reduced from 30s to 60s
   - Network reconnection handled gracefully

## Implementation Details

### App Initialization Flow

```typescript
// In App.tsx - Storage initialization effect
const storageService = getUnifiedStorageService();
await storageService.initialize();

if (storageMode === 'cloud') {
  const authManager = getAuthManager(dispatch);
  const googleDriveAuthService = await getGoogleDriveAuthService();
  authManager.setGoogleDriveAuthService(googleDriveAuthService);
  
  // Single initialization call
  await authManager.initialize();
}
```

### Visibility Change Handling

```typescript
// In App.tsx - Visibility change effect
const handleVisibilityChange = async () => {
  if (!document.hidden) {
    // Restore settings
    await dispatch(fetchSettings()).unwrap();
    
    // Use AuthManager for coordinated auth check
    const authManager = getAuthManager(dispatch);
    await authManager.checkAndRestore(); // Debounced, prevents duplicates
  }
};
```

### OAuth Callback Flow

```typescript
// In OAuthCallbackPage.tsx
const authService = await getGoogleDriveAuthService();
await authService.processOAuthCallback();

if (authService.isAuthenticated()) {
  // Use AuthManager to complete authentication
  const authManager = getAuthManager(dispatch);
  await authManager.reAuthenticate(); // Syncs all state
  
  // Storage reinitialize for data sync
  await storageService.reinitialize();
}
```

### Manual Login Flow

```typescript
// In FiduAuthLogin.tsx - After successful FIDU login
if (envInfo.storageMode === 'cloud') {
  const authManager = getAuthManager(dispatch);
  const restored = await authManager.checkAndRestore();
  
  if (restored) {
    // Redirect to OAuth callback gate for data sync
    window.location.href = '/fidu-chat-lab/oauth-callback?postLogin=1';
  }
}
```

### CloudStorageAdapter Changes

```typescript
// Before: Called authService.initialize() directly
async initialize(): Promise<void> {
  this.authService = await getGoogleDriveAuthService();
  await this.authService.initialize(); // ❌ Duplicate call
  // ...
}

// After: Just gets service, AuthManager handles initialization
async initialize(): Promise<void> {
  this.authService = await getGoogleDriveAuthService();
  // AuthManager already initialized it ✅
  
  if (!this.authService.isAuthenticated()) {
    return; // Wait for AuthManager to complete auth
  }
  
  await this.initializeWithAuthentication();
}
```

## Benefits

### 1. No More Race Conditions
- Only one initialization in progress at a time
- Duplicate calls wait for existing operation to complete
- Debouncing prevents rapid-fire auth checks

### 2. Predictable State Management
- Single source of truth for auth state
- Automatic Redux synchronization
- Event subscribers notified of all changes

### 3. Reduced Server Load
- Periodic checks reduced from 30s to 60s
- Debouncing prevents redundant API calls
- Shared initialization promises eliminate duplicates

### 4. Better User Experience
- Faster app startup (fewer redundant operations)
- Data loads on first try (no page reload needed)
- Clear loading states (no infinite "Waiting for auth" loops)

### 5. Easier Debugging
- All auth operations logged with `[AuthManager]` prefix
- Clear event flow visible in console
- Single file to inspect for auth logic

## Metrics

### Before AuthManager
- 4-5 concurrent "Attempting primary authentication restoration" logs
- 30 second auth check interval
- Data required page reload after refresh
- Multiple redundant token refresh calls

### After AuthManager
- 1 "Starting centralized authentication initialization" log
- 60 second auth check interval (50% reduction)
- Data loads on first page load
- Single coordinated token refresh

## Future Enhancements

### Potential Additions

1. **Retry Strategies**
   - Exponential backoff for failed auth attempts
   - Maximum retry limits

2. **Offline Support**
   - Queue auth operations during network outages
   - Replay queue when network returns

3. **Advanced Events**
   - `auth-token-refreshed`
   - `auth-session-expired`
   - `auth-permissions-changed`

4. **Storage Adapter Subscriptions**
   - CloudStorageAdapter subscribes to auth events
   - Automatic sync trigger on `auth-restored`

5. **Metrics & Monitoring**
   - Track auth operation duration
   - Monitor duplicate call attempts (should be 0)
   - Alert on auth failures

## Migration Guide

### For New Code

Always use `AuthManager` for auth operations:

```typescript
import { getAuthManager } from './services/auth/AuthManager';

// In a component or service
const authManager = getAuthManager(dispatch);

// Check if authenticated
const status = authManager.getAuthStatus();
if (status.isAuthenticated) {
  // Do something
}

// Check and restore auth (safe to call frequently)
await authManager.checkAndRestore();

// Subscribe to auth changes
const unsubscribe = authManager.subscribe('auth-restored', (status) => {
  console.log('Auth restored!', status);
});
```

### What NOT to Do

❌ **Don't call `authService.initialize()` directly**
```typescript
// Bad
const authService = await getGoogleDriveAuthService();
await authService.initialize(); // Use AuthManager instead
```

❌ **Don't check auth status without debouncing**
```typescript
// Bad - can cause rapid-fire checks
setInterval(() => {
  dispatch(checkGoogleDriveAuthStatus());
}, 5000);

// Good - AuthManager handles debouncing
setInterval(async () => {
  const authManager = getAuthManager(dispatch);
  await authManager.checkAndRestore();
}, 60000);
```

❌ **Don't manually sync to Redux**
```typescript
// Bad - AuthManager does this automatically
dispatch(setGoogleDriveAuth({ ... }));

// Good - Let AuthManager handle it
await authManager.initialize();
```

## Testing

### Unit Tests
```typescript
describe('AuthManager', () => {
  it('prevents concurrent initialization', async () => {
    const authManager = getAuthManager(mockDispatch);
    
    // Start two initializations simultaneously
    const init1 = authManager.initialize();
    const init2 = authManager.initialize();
    
    await Promise.all([init1, init2]);
    
    // Should only have initialized once
    expect(mockAuthService.initialize).toHaveBeenCalledTimes(1);
  });
  
  it('debounces rapid check/restore calls', async () => {
    const authManager = getAuthManager(mockDispatch);
    
    // Make rapid calls
    await authManager.checkAndRestore();
    await authManager.checkAndRestore(); // Should be skipped
    
    expect(mockAuthService.restoreFromCookies).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests
- Test full app initialization flow
- Test visibility change handling
- Test OAuth callback flow
- Test manual login flow

## Troubleshooting

### "AuthManager must be initialized with dispatch on first use"
**Cause**: Trying to get AuthManager without passing dispatch
**Solution**: Pass dispatch on first call: `getAuthManager(dispatch)`

### "Operation already in progress, skipping check"
**Cause**: Attempted auth check while initialization or restore in progress
**Solution**: This is normal - the operation will complete and state will sync

### "Skipping check (too soon since last check)"
**Cause**: Auth check attempted within 2 seconds of previous check
**Solution**: This is normal debouncing - prevents rapid-fire checks

### Still seeing duplicate auth calls
**Cause**: Old code path calling auth service directly
**Solution**: Search for `authService.initialize()` and replace with `AuthManager`

## Conclusion

The `AuthManager` provides a robust, centralized solution for authentication in FIDU Chat Lab. It eliminates race conditions, reduces server load, and provides a better user experience through coordinated auth operations and automatic state management.

**Key Takeaway**: Always use `AuthManager` for auth operations. Never call `authService.initialize()` directly.

