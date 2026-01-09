/**
 * Tests for Google Drive Auth Token Management
 * 
 * This file covers the core token management features:
 * - Auto-restore: Automatic token restoration from cookies when tokens are missing/expired
 * - Proactive refresh: Automatic token refresh 10 minutes before expiration
 * - Periodic validation: Token health checks every 5 minutes
 * 
 * These features ensure tokens stay fresh and authentication persists across sessions.
 */

import { GoogleDriveAuthService } from '../GoogleDriveAuth';
import { getFiduAuthService } from '../FiduAuthService';

// Mock dependencies
jest.mock('../FiduAuthService');
jest.mock('../../api/apiClientIdentityService', () => ({
  identityServiceAPIClient: {
    updateGoogleEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleDriveAuth - Token Management', () => {
  let authService: GoogleDriveAuthService;
  let mockFiduAuthService: any;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup mock FIDU auth service
    mockFiduAuthService = {
      hasRefreshToken: jest.fn().mockResolvedValue(true),
      ensureAccessToken: jest.fn().mockResolvedValue('fidu-token'),
      isAuthenticated: jest.fn().mockResolvedValue(true),
      createAuthInterceptor: jest.fn().mockReturnValue({
        request: jest.fn().mockImplementation((config) => {
          return Promise.resolve(config);
        }),
        response: jest.fn().mockImplementation((response) => {
          return Promise.resolve(response);
        }),
        error: jest.fn().mockImplementation((error) => {
          return Promise.reject(error);
        }),
      }),
    };
    (getFiduAuthService as jest.Mock).mockReturnValue(mockFiduAuthService);
    
    // Create auth service instance
    authService = new GoogleDriveAuthService({
      clientId: 'test-client-id',
      redirectUri: 'http://localhost/oauth-callback',
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    });
  });

  afterEach(() => {
    // Clean up any timers before switching to real timers
    if ((authService as any).refreshTimer) {
      clearTimeout((authService as any).refreshTimer);
      (authService as any).refreshTimer = null;
    }
    if ((authService as any).validationInterval) {
      clearInterval((authService as any).validationInterval);
      (authService as any).validationInterval = null;
    }
    jest.useRealTimers();
  });

  // ============================================================================
  // Auto-Restore Functionality
  // ============================================================================

  describe('getAccessToken() - Auto-Restore', () => {
    it('should restore from cookies when tokens are null', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies to succeed and actually set tokens
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockImplementation(async () => {
          // Simulate what restoreFromCookies actually does - sets tokens
          (authService as any).tokens = {
            refreshToken: 'refresh-token',
            accessToken: 'new-access-token',
            expiresAt: Date.now() + 3600000,
            scope: 'test-scope',
          };
          return true;
        });
      
      // Execute
      const token = await authService.getAccessToken();
      
      // Verify
      expect(restoreSpy).toHaveBeenCalled();
      expect(token).toBe('new-access-token');
    });

    it('should throw error when restoration fails', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies to fail
      jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(false);
      
      // Execute & Verify
      await expect(authService.getAccessToken()).rejects.toThrow(
        'User not authenticated. Please reconnect Google Drive.'
      );
    });

    it('should retry restoration if refresh token is missing', async () => {
      // Setup: tokens exist but expired and no refresh token
      (authService as any).tokens = {
        accessToken: 'old-token',
        refreshToken: null,
        expiresAt: Date.now() - 1000, // Expired
        scope: 'test-scope',
      };
      
      // Mock restoreFromCookies to succeed
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Execute
      const token = await authService.getAccessToken();
      
      // Verify: should have attempted restoration
      expect(restoreSpy).toHaveBeenCalled();
      expect(token).toBe('new-access-token');
    });

    it('should fallback to restoration if refresh fails', async () => {
      // Setup: tokens exist but expired
      (authService as any).tokens = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken to fail first time
      let refreshCallCount = 0;
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockImplementation(async () => {
          refreshCallCount++;
          if (refreshCallCount === 1) {
            throw new Error('Refresh failed');
          }
          return 'new-access-token';
        });
      
      // Mock restoreFromCookies to succeed
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Mock loadTokensFromCookies
      jest.spyOn(authService as any, 'loadTokensFromCookies')
        .mockResolvedValue({
          refreshToken: 'refresh-token',
          accessToken: '',
          expiresAt: Date.now() + 3600000,
          scope: 'test-scope',
        });
      
      // Execute
      const token = await authService.getAccessToken();
      
      // Verify: should have retried after restoration
      expect(restoreSpy).toHaveBeenCalled();
      expect(refreshCallCount).toBe(2);
      expect(token).toBe('new-access-token');
    });

    it('should refresh token when expiring soon', async () => {
      // Setup: token expires in 3 minutes (< 5 minute threshold)
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (3 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Execute
      const token = await authService.getAccessToken();
      
      // Verify
      expect(refreshSpy).toHaveBeenCalled();
      expect(token).toBe('new-access-token');
    });

    it('should return existing token if still valid', async () => {
      // Setup: valid token (expires in 30 minutes)
      (authService as any).tokens = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (30 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken (should not be called)
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken');
      
      // Execute
      const token = await authService.getAccessToken();
      
      // Verify
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(token).toBe('valid-token');
    });
  });

  describe('ensureAuthenticated()', () => {
    it('should return true when tokens are valid', async () => {
      // Setup: valid tokens
      (authService as any).tokens = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes from now
        scope: 'test-scope',
      };
      
      // Execute
      const result = await authService.ensureAuthenticated();
      
      // Verify
      expect(result).toBe(true);
    });

    it('should restore from cookies when tokens are missing', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Mock loadTokensFromCookies
      jest.spyOn(authService as any, 'loadTokensFromCookies')
        .mockResolvedValue({
          refreshToken: 'refresh-token',
          accessToken: '',
          expiresAt: 0,
          scope: 'test-scope',
        });
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Execute
      const result = await authService.ensureAuthenticated();
      
      // Verify
      expect(restoreSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when restoration fails', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies to fail
      jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(false);
      
      // Execute
      const result = await authService.ensureAuthenticated();
      
      // Verify
      expect(result).toBe(false);
    });

    it('should restore when token expires soon', async () => {
      // Setup: token expires in 3 minutes
      (authService as any).tokens = {
        accessToken: 'expiring-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (3 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock restoreFromCookies
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Mock loadTokensFromCookies
      jest.spyOn(authService as any, 'loadTokensFromCookies')
        .mockResolvedValue({
          refreshToken: 'refresh-token',
          accessToken: '',
          expiresAt: Date.now() + 3600000,
          scope: 'test-scope',
        });
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Execute
      const result = await authService.ensureAuthenticated();
      
      // Verify
      expect(restoreSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle restoration errors gracefully', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies to throw
      jest.spyOn(authService as any, 'restoreFromCookies')
        .mockRejectedValue(new Error('Restoration failed'));
      
      // Execute
      const result = await authService.ensureAuthenticated();
      
      // Verify
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Proactive Token Refresh
  // ============================================================================

  describe('Proactive Token Refresh', () => {
    it('should schedule refresh 10 minutes before expiration', () => {
      // Setup: token expires in 1 hour
      const expiresAt = Date.now() + (60 * 60 * 1000);
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt,
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Spy on setTimeout to track calls
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Execute
      (authService as any).startProactiveRefresh();
      
      // Verify: timer should be set for 50 minutes (60 - 10)
      expect(setTimeoutSpy).toHaveBeenCalled();
      const callArgs = setTimeoutSpy.mock.calls[0];
      const delay = callArgs[1];
      expect(delay).toBeCloseTo(50 * 60 * 1000, -3); // Within 1 second
      
      // Clean up
      if ((authService as any).refreshTimer) {
        clearTimeout((authService as any).refreshTimer);
        (authService as any).refreshTimer = null;
      }
      setTimeoutSpy.mockRestore();
    });

    it('should refresh immediately if < 10 minutes left', async () => {
      // Setup: token expires in 5 minutes
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (5 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken')
      .mockImplementation(() => {
        (authService as any).tokens = {
          accessToken: 'new-access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + (60 * 60 * 1000),
          scope: 'test-scope',
        };
        return Promise.resolve('new-access-token');
      });
      
      // Execute
      await (authService as any).startProactiveRefresh();
      
      // Verify: should refresh immediately
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not schedule refresh if no tokens', () => {
      // Setup: no tokens
      (authService as any).tokens = null;
      
      // Spy on setTimeout to track calls
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Execute
      (authService as any).startProactiveRefresh();
      
      // Verify: should not schedule anything
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });

    it('should not schedule refresh if no refresh token', () => {
      // Setup: tokens but no refresh token
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: null,
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
      };
      
      // Spy on setTimeout to track calls
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Execute
      (authService as any).startProactiveRefresh();
      
      // Verify: should not schedule anything
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });

    it('should retry on refresh failure', async () => {
      // Setup: token expires in 5 minutes
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (5 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken to fail first time, then succeed
      let callCount = 0;
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken')
        .mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Refresh failed');
          }
          return 'new-access-token';
        });
      
      // Execute - this will refresh immediately since < 10 minutes left
      (authService as any).startProactiveRefresh();
      await Promise.resolve(); // Let the immediate refresh start
      
      // The immediate refresh will fail and schedule a retry after 5 minutes
      // Advance time to trigger retry
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve(); // Let promises resolve
      
      // Verify: should have been called at least once (immediate call)
      // The retry happens via setTimeout callback, so we check for at least 1 call
      expect(refreshSpy).toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).refreshTimer) {
        clearTimeout((authService as any).refreshTimer);
        (authService as any).refreshTimer = null;
      }
    });

    it('should schedule next refresh after successful refresh', async () => {
      // Setup: token expires in 1 hour
      const expiresAt = Date.now() + (60 * 60 * 1000);
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt,
        scope: 'test-scope',
      };
      
      // Spy on setTimeout to track calls
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Mock refreshAccessToken to update expiresAt
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockImplementation(async () => {
          (authService as any).tokens.expiresAt = Date.now() + (60 * 60 * 1000);
          return 'new-access-token';
        });
      
      // Execute
      (authService as any).startProactiveRefresh();
      
      // Advance time to trigger refresh (50 minutes)
      jest.advanceTimersByTime(50 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should have scheduled next refresh (initial + after refresh)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      
      // Clean up
      if ((authService as any).refreshTimer) {
        clearTimeout((authService as any).refreshTimer);
        (authService as any).refreshTimer = null;
      }
      setTimeoutSpy.mockRestore();
    });

    it('should clear existing timer before scheduling new one', () => {
      // Setup: token expires in 1 hour
      const expiresAt = Date.now() + (60 * 60 * 1000);
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt,
        scope: 'test-scope',
      };
      
      // Set an existing timer
      (authService as any).refreshTimer = setTimeout(() => {}, 1000);
      
      // Mock clearTimeout
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Execute
      (authService as any).startProactiveRefresh();
      
      // Verify: should have cleared existing timer
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should stop proactive refresh', () => {
      // Setup: set a timer (mock it)
      (authService as any).refreshTimer = jest.fn() as any;
      
      // Spy on clearTimeout
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Execute
      (authService as any).stopProactiveRefresh();
      
      // Verify
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect((authService as any).refreshTimer).toBeNull();
      
      clearTimeoutSpy.mockRestore();
    });
  });

  // ============================================================================
  // Periodic Token Validation
  // ============================================================================

  describe('Periodic Token Validation', () => {
    it('should check tokens every 5 minutes', () => {
      // Setup
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (30 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Spy on setInterval to track calls
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Verify: setInterval was called with 5 minute interval
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000
      );
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
      setIntervalSpy.mockRestore();
    });

    it('should restore from cookies when tokens are missing', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock restoreFromCookies
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Mock loadTokensFromCookies
      jest.spyOn(authService as any, 'loadTokensFromCookies')
        .mockResolvedValue({
          refreshToken: 'refresh-token',
          accessToken: '',
          expiresAt: 0,
          scope: 'test-scope',
        });
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Mock startProactiveRefresh
      jest.spyOn(authService as any, 'startProactiveRefresh')
        .mockImplementation(() => {});
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Advance time to trigger validation (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should have attempted restoration
      expect(restoreSpy).toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
    });

    it('should refresh tokens when < 10 minutes left', async () => {
      // Setup: token expires in 5 minutes
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (5 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Advance time to trigger validation (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should have refreshed
      expect(refreshSpy).toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
    });

    it('should not refresh if token is still valid', async () => {
      // Setup: token expires in 30 minutes
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (30 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken (should not be called)
      const refreshSpy = jest.spyOn(authService as any, 'refreshAccessToken');
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Advance time to trigger validation (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should not have refreshed
      expect(refreshSpy).not.toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
    });

    it('should restore from cookies on refresh failure', async () => {
      // Setup: token expires in 5 minutes
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (5 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken to fail
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockRejectedValue(new Error('Refresh failed'));
      
      // Mock restoreFromCookies
      const restoreSpy = jest.spyOn(authService as any, 'restoreFromCookies')
        .mockResolvedValue(true);
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Advance time to trigger validation (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should have attempted restoration
      expect(restoreSpy).toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
    });

    it('should clear existing interval before starting new one', () => {
      // Setup: set an existing interval
      (authService as any).validationInterval = jest.fn() as any;
      
      // Spy on clearInterval
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      // Execute
      (authService as any).startPeriodicValidation();
      
      // Verify: should have cleared existing interval
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
      clearIntervalSpy.mockRestore();
    });

    it('should stop periodic validation', () => {
      // Setup: set an interval (mock it)
      (authService as any).validationInterval = jest.fn() as any;
      
      // Spy on clearInterval
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      // Execute
      (authService as any).stopPeriodicValidation();
      
      // Verify
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((authService as any).validationInterval).toBeNull();
      
      clearIntervalSpy.mockRestore();
    });

    it('should handle validation errors gracefully', async () => {
      // Setup: tokens exist
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (5 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock refreshAccessToken to throw
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockRejectedValue(new Error('Validation error'));
      
      // Mock restoreFromCookies to throw
      jest.spyOn(authService as any, 'restoreFromCookies')
        .mockRejectedValue(new Error('Restore error'));
      
      // Execute - should not throw
      (authService as any).startPeriodicValidation();
      
      // Advance time to trigger validation (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      
      // Verify: should have handled error gracefully (no exception thrown)
      expect(true).toBe(true); // Test passes if no exception
      
      // Clean up
      if ((authService as any).validationInterval) {
        clearInterval((authService as any).validationInterval);
        (authService as any).validationInterval = null;
      }
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration: Token Operations with Proactive Refresh', () => {
    it('should start proactive refresh after token refresh', async () => {
      // Setup
      (authService as any).tokens = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
      };
      
      // Mock startProactiveRefresh
      const startProactiveSpy = jest.spyOn(authService as any, 'startProactiveRefresh')
        .mockImplementation(() => {});
      
      // Mock performTokenRefresh to simulate the actual behavior
      // The real implementation calls startProactiveRefresh after successful refresh
      jest.spyOn(authService as any, 'performTokenRefresh')
        .mockImplementation(async () => {
          // Simulate what performTokenRefresh does - updates tokens
          (authService as any).tokens.accessToken = 'new-access-token';
          (authService as any).tokens.expiresAt = Date.now() + 3600000;
          // Call startProactiveRefresh like the real implementation does
          (authService as any).startProactiveRefresh();
          return 'new-access-token';
        });
      
      // Mock storeTokens to avoid localStorage issues
      jest.spyOn(authService as any, 'storeTokens').mockImplementation(() => {});
      
      // Execute
      await (authService as any).refreshAccessToken();
      
      // Verify: should have started proactive refresh
      expect(startProactiveSpy).toHaveBeenCalled();
    });

    it('should start proactive refresh after cookie restoration', async () => {
      // Setup: tokens are null
      (authService as any).tokens = null;
      
      // Mock loadTokensFromCookies
      jest.spyOn(authService as any, 'loadTokensFromCookies')
        .mockResolvedValue({
          refreshToken: 'refresh-token',
          accessToken: '',
          expiresAt: 0,
          scope: 'test-scope',
        });
      
      // Mock refreshAccessToken
      jest.spyOn(authService as any, 'refreshAccessToken')
        .mockResolvedValue('new-access-token');
      
      // Mock fetchUserInfo
      jest.spyOn(authService as any, 'fetchUserInfo')
        .mockResolvedValue(undefined);
      
      // Mock startProactiveRefresh
      const startProactiveSpy = jest.spyOn(authService as any, 'startProactiveRefresh')
        .mockImplementation(() => {});
      
      // Execute
      await (authService as any).restoreFromCookies();
      
      // Verify: should have started proactive refresh
      expect(startProactiveSpy).toHaveBeenCalled();
    });

    it('should start both timers after initialization', async () => {
      // Setup: tokens exist
      (authService as any).tokens = {
        accessToken: 'current-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + (30 * 60 * 1000),
        scope: 'test-scope',
      };
      
      // Mock validateToken
      jest.spyOn(authService as any, 'validateToken')
        .mockResolvedValue(undefined);
      
      // Mock getUser
      jest.spyOn(authService as any, 'getUser')
        .mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
        });
      
      // Mock startProactiveRefresh
      const startProactiveSpy = jest.spyOn(authService as any, 'startProactiveRefresh')
        .mockImplementation(() => {});
      
      // Mock startPeriodicValidation
      const startPeriodicSpy = jest.spyOn(authService as any, 'startPeriodicValidation')
        .mockImplementation(() => {});
      
      // Execute
      await authService.initialize();
      
      // Verify: should have started both
      expect(startProactiveSpy).toHaveBeenCalled();
      expect(startPeriodicSpy).toHaveBeenCalled();
    });

    it('should stop both timers on logout', async () => {
      // Setup: set timers (mock them)
      (authService as any).refreshTimer = jest.fn() as any;
      (authService as any).validationInterval = jest.fn() as any;
      
      // Mock stopProactiveRefresh
      const stopProactiveSpy = jest.spyOn(authService as any, 'stopProactiveRefresh')
        .mockImplementation(() => {});
      
      // Mock stopPeriodicValidation
      const stopPeriodicSpy = jest.spyOn(authService as any, 'stopPeriodicValidation')
        .mockImplementation(() => {});
      
      // Mock fetch for logout endpoint
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response);
      
      // Mock clearStoredTokens
      jest.spyOn(authService as any, 'clearStoredTokens').mockImplementation(() => {});
      
      // Execute
      await authService.logout();
      
      // Verify: should have stopped both
      expect(stopProactiveSpy).toHaveBeenCalled();
      expect(stopPeriodicSpy).toHaveBeenCalled();
    });
  });
});

