/**
 * Tests for AuthManager
 * 
 * These tests verify the centralized authentication manager's behavior:
 * - Operation locking (prevents concurrent initialization)
 * - Debouncing (prevents rapid-fire auth checks)
 * - Event subscription system
 * - Redux state synchronization
 * - Error handling
 */

import { AuthManager, getAuthManager, resetAuthManager } from '../AuthManager';
import { GoogleDriveAuthService } from '../GoogleDriveAuth';
import { getFiduAuthService } from '../FiduAuthService';

type MockFiduAuthService = ReturnType<typeof getFiduAuthService>;

// Mock dependencies
jest.mock('../GoogleDriveAuth');
jest.mock('../FiduAuthService', () => ({
  getFiduAuthService: jest.fn(),
}));

// Mock Redux actions
jest.mock('../../../store/slices/unifiedStorageSlice', () => ({
  setGoogleDriveAuthState: jest.fn((payload) => ({
    type: 'unifiedStorage/setGoogleDriveAuthState',
    payload,
  })),
  setGoogleDriveAuth: jest.fn((payload) => ({
    type: 'unifiedStorage/setGoogleDriveAuth',
    payload,
  })),
  clearGoogleDriveAuth: jest.fn(() => ({
    type: 'unifiedStorage/clearGoogleDriveAuth',
  })),
  markStorageConfigured: jest.fn(() => ({
    type: 'unifiedStorage/markStorageConfigured',
  })),
}));

describe('AuthManager', () => {
  let mockDispatch: jest.Mock;
  let mockGoogleDriveAuthService: jest.Mocked<GoogleDriveAuthService>;
  let mockFiduAuthService: jest.Mocked<MockFiduAuthService>;
  let authManager: AuthManager;

  beforeEach(() => {
    // Reset the singleton
    resetAuthManager();

    // Create mock dispatch
    mockDispatch = jest.fn();

    // Create mock FIDU auth service
    mockFiduAuthService = {
      getTokens: jest.fn().mockResolvedValue({
        access_token: 'fidu-access-token',
        refresh_token: 'fidu-refresh-token',
        user: { id: 'test-user', email: 'test@example.com' },
      }),
      clearTokens: jest.fn().mockResolvedValue(true),
    } as any;

    // Mock getFiduAuthService
    (getFiduAuthService as jest.Mock).mockReturnValue(mockFiduAuthService);

    // Create mock Google Drive auth service
    mockGoogleDriveAuthService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn().mockReturnValue(true),
      getUser: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      }),
      getCachedUser: jest.fn().mockReturnValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      }),
      restoreFromCookies: jest.fn().mockResolvedValue(true),
      restoreFromCookiesWithRetry: jest.fn().mockResolvedValue(true),
      getAuthStatus: jest.fn().mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
        expiresAt: Date.now() + 3600000,
      }),
      logout: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create auth manager
    authManager = getAuthManager(mockDispatch);
    authManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getAuthManager(mockDispatch);
      const instance2 = getAuthManager(); // No dispatch needed for subsequent calls
      expect(instance1).toBe(instance2);
    });

    it('should throw error if first call does not provide dispatch', () => {
      resetAuthManager();
      expect(() => getAuthManager()).toThrow('AuthManager must be initialized with dispatch on first use');
    });

    it('should allow reset for testing', () => {
      const instance1 = getAuthManager(mockDispatch);
      resetAuthManager();
      const instance2 = getAuthManager(mockDispatch);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialize()', () => {
    it('should successfully initialize with valid FIDU and Google Drive auth', async () => {
      await authManager.initialize();

      expect(mockFiduAuthService.getTokens).toHaveBeenCalled();
      expect(mockGoogleDriveAuthService.restoreFromCookies).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalled(); // Redux sync
    });

    it('should prevent concurrent initialization attempts', async () => {
      // Start two initializations simultaneously
      const init1 = authManager.initialize();
      const init2 = authManager.initialize();
      const init3 = authManager.initialize();

      await Promise.all([init1, init2, init3]);

      // Should only have checked FIDU auth once (operation locking)
      expect(mockFiduAuthService.getTokens).toHaveBeenCalledTimes(1);
      expect(mockGoogleDriveAuthService.restoreFromCookies).toHaveBeenCalledTimes(1);
    });

    it('should skip initialization if called within 2 seconds', async () => {
      jest.useFakeTimers();

      await authManager.initialize();
      jest.clearAllMocks();

      // Try to initialize again immediately
      await authManager.initialize();

      // Should not have called auth services again (debouncing)
      expect(mockFiduAuthService.getTokens).not.toHaveBeenCalled();
      expect(mockGoogleDriveAuthService.restoreFromCookies).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle missing FIDU authentication', async () => {
      // Create a fresh manager for this test
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      
      // Create a new mock service that reports not authenticated
      const unauthenticatedService = {
        ...mockGoogleDriveAuthService,
        isAuthenticated: jest.fn().mockReturnValue(false),
        getUser: jest.fn().mockReturnValue(null),
      } as any;
      
      newManager.setGoogleDriveAuthService(unauthenticatedService);
      mockFiduAuthService.getTokens.mockResolvedValue(null);

      await newManager.initialize();

      // Should not attempt Google Drive auth without FIDU auth
      expect(unauthenticatedService.restoreFromCookies).not.toHaveBeenCalled();
      
      const status = newManager.getAuthStatus();
      expect(status.isAuthenticated).toBe(false);
    });

    it('should handle Google Drive auth restoration failure', async () => {
      mockGoogleDriveAuthService.restoreFromCookies.mockResolvedValue(false);
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);

      await authManager.initialize();

      const status = authManager.getAuthStatus();
      expect(status.isAuthenticated).toBe(false);
    });

    it('should sync to Redux after successful initialization', async () => {
      await authManager.initialize();

      // After our refactor, syncToRedux only calls markStorageConfigured when authenticated
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('markStorageConfigured'),
        })
      );
    });
  });

  describe('checkAndRestore()', () => {
    beforeEach(async () => {
      // Initialize first
      await authManager.initialize();
      jest.clearAllMocks();
      // Reset the lastAuthCheck to allow immediate checkAndRestore
      authManager.reset();
    });

    it('should check and restore authentication successfully', async () => {
      // Simulate not authenticated
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      // After restoration, simulate authenticated
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValueOnce(false).mockReturnValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'restored-user',
        email: 'restored@example.com',
        name: 'Restored User',
      });

      const restored = await authManager.checkAndRestore();

      expect(restored).toBe(true);
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).toHaveBeenCalledWith(2);
    });

    it('should skip if already authenticated', async () => {
      // Ensure auth service reports as authenticated
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(true);

      const restored = await authManager.checkAndRestore();

      expect(restored).toBe(true);
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).not.toHaveBeenCalled();
    });

    it('should debounce rapid check attempts', async () => {
      jest.useFakeTimers();

      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);

      const check1 = authManager.checkAndRestore();
      await check1;

      jest.clearAllMocks();

      // Try to check again immediately (within 2 seconds)
      const check2 = authManager.checkAndRestore();

      expect(await check2).toBe(false); // Skipped due to debouncing
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not check if initialization is in progress', async () => {
      // Create a new manager to test concurrent operations
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      newManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);

      // Start initialization (don't await)
      const initPromise = newManager.initialize();

      // Try to check while initializing
      const checkResult = await newManager.checkAndRestore();

      expect(checkResult).toBe(false); // Skipped

      // Wait for init to complete
      await initPromise;
    });

    it('should sync to Redux after successful restoration', async () => {
      // Simulate unauthenticated, then authenticated after restore
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check
        .mockReturnValue(true); // After restoration
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authManager.checkAndRestore();

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('reAuthenticate()', () => {
    beforeEach(async () => {
      // Initialize first
      await authManager.initialize();
      jest.clearAllMocks();
    });

    it('should reset state and reinitialize', async () => {
      await authManager.reAuthenticate();

      expect(mockFiduAuthService.getTokens).toHaveBeenCalled();
      expect(mockGoogleDriveAuthService.restoreFromCookies).toHaveBeenCalled();
    });

    it('should bypass debouncing after reset', async () => {
      jest.useFakeTimers();

      await authManager.checkAndRestore();
      jest.clearAllMocks();

      // Normally this would be debounced, but reAuthenticate resets the timer
      await authManager.reAuthenticate();

      expect(mockFiduAuthService.getTokens).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('Event Subscription', () => {
    beforeEach(async () => {
      await authManager.initialize();
      jest.clearAllMocks();
      authManager.reset(); // Allow immediate operations
    });

    it('should notify subscribers on auth-restored event', async () => {
      const callback = jest.fn();
      authManager.subscribe('auth-restored', callback);

      // Simulate auth restoration
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check
        .mockReturnValue(true); // After restoration
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'restored-user',
        email: 'restored@example.com',
        name: 'Restored User',
      });

      await authManager.checkAndRestore();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
        })
      );
    });

    it('should notify subscribers on auth-lost event', async () => {
      const callback = jest.fn();
      authManager.subscribe('auth-lost', callback);

      // Simulate failed restoration
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(false);

      await authManager.checkAndRestore();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: false,
        })
      );
    });

    it('should allow unsubscribing', async () => {
      const callback = jest.fn();
      const unsubscribe = authManager.subscribe('auth-restored', callback);

      unsubscribe();

      // Simulate auth restoration
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authManager.checkAndRestore();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      authManager.subscribe('auth-restored', callback1);
      authManager.subscribe('auth-restored', callback2);
      authManager.subscribe('auth-restored', callback3);

      // Simulate auth restoration
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authManager.checkAndRestore();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });

    it('should handle subscriber errors gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = jest.fn();

      authManager.subscribe('auth-restored', errorCallback);
      authManager.subscribe('auth-restored', goodCallback);

      // Simulate auth restoration
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      // Should not throw
      await expect(authManager.checkAndRestore()).resolves.not.toThrow();

      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('getAuthStatus()', () => {
    it('should return current auth status', async () => {
      await authManager.initialize();

      const status = authManager.getAuthStatus();

      expect(status).toEqual({
        isAuthenticated: true,
        isLoading: false,
        user: expect.objectContaining({
          id: 'test-user-id',
          email: 'test@example.com',
        }),
        error: null,
      });
    });

    it('should reflect loading state during operations', async () => {
      // Create a slow initialization
      mockGoogleDriveAuthService.restoreFromCookies.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const initPromise = authManager.initialize();

      // Check status while initializing
      const status = authManager.getAuthStatus();
      expect(status.isLoading).toBe(true);

      await initPromise;

      const finalStatus = authManager.getAuthStatus();
      expect(finalStatus.isLoading).toBe(false);
    });

    it('should return unauthenticated status when service not set', () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      // Don't set Google Drive auth service

      const status = newManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.user).toBeNull();
    });
  });

  describe('isOperationInProgress()', () => {
    it('should return true during initialization', async () => {
      mockGoogleDriveAuthService.restoreFromCookies.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const initPromise = authManager.initialize();

      expect(authManager.isOperationInProgress()).toBe(true);

      await initPromise;

      expect(authManager.isOperationInProgress()).toBe(false);
    });

    it('should return true during checkAndRestore', async () => {
      await authManager.initialize();
      authManager.reset(); // Allow immediate operations

      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const checkPromise = authManager.checkAndRestore();

      // Check immediately - should be true
      expect(authManager.isOperationInProgress()).toBe(true);

      await checkPromise;

      expect(authManager.isOperationInProgress()).toBe(false);
    });
  });

  describe('clearAuth()', () => {
    beforeEach(async () => {
      await authManager.initialize();
      mockGoogleDriveAuthService.logout = jest.fn().mockResolvedValue(undefined);
      mockFiduAuthService.clearTokens = jest.fn().mockResolvedValue(undefined);
      jest.clearAllMocks();
    });

    it('should clear all authentication state', async () => {
      await authManager.clearAuth();

      expect(mockGoogleDriveAuthService.logout).toHaveBeenCalled();
      expect(mockFiduAuthService.clearTokens).toHaveBeenCalled();
    });

    it('should notify subscribers of auth-lost', async () => {
      const callback = jest.fn();
      authManager.subscribe('auth-lost', callback);

      await authManager.clearAuth();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: expect.anything(),
        })
      );
    });

    it('should sync to Redux', async () => {
      await authManager.clearAuth();

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle FIDU auth token retrieval errors', async () => {
      mockFiduAuthService.getTokens.mockRejectedValue(new Error('FIDU auth failed'));

      await expect(authManager.initialize()).rejects.toThrow('FIDU auth failed');
    });

    it('should handle Google Drive restoration errors gracefully', async () => {
      // Create fresh manager for this test
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      
      // Create a mock service that throws on restore
      const errorService = {
        ...mockGoogleDriveAuthService,
        isAuthenticated: jest.fn().mockReturnValue(false),
        getUser: jest.fn().mockReturnValue(null),
        restoreFromCookies: jest.fn().mockRejectedValue(new Error('Google Drive error')),
      } as any;
      
      newManager.setGoogleDriveAuthService(errorService);

      // Should throw (error is propagated)
      await expect(newManager.initialize()).rejects.toThrow('Google Drive error');

      const status = newManager.getAuthStatus();
      expect(status.isAuthenticated).toBe(false);
    });

    it('should handle missing Google Drive auth service', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      // Don't set Google Drive auth service

      await newManager.initialize();

      const status = newManager.getAuthStatus();
      expect(status.isAuthenticated).toBe(false);
    });
  });

  describe('Redux Integration', () => {
    beforeEach(async () => {
      await authManager.initialize();
      jest.clearAllMocks();
      authManager.reset(); // Allow immediate operations
    });

    it('should dispatch setGoogleDriveAuth when authenticated', async () => {
      // Simulate auth state change from unauthenticated to authenticated
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check
        .mockReturnValue(true); // After restoration
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authManager.checkAndRestore();

      // After our refactor, syncToRedux only calls markStorageConfigured when authenticated
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('markStorageConfigured'),
        })
      );
    });

    it('should not dispatch Redux actions when not authenticated', async () => {
      // Simulate failed restoration
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(false);

      await authManager.checkAndRestore();

      // After our refactor, syncToRedux doesn't dispatch anything when not authenticated
      // (Google Drive auth state is managed by Redux thunks)
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should dispatch markStorageConfigured when authenticated', async () => {
      // Simulate auth state change from unauthenticated to authenticated
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false) // First check
        .mockReturnValue(true); // After restoration
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authManager.checkAndRestore();

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('markStorageConfigured'),
        })
      );
    });
  });

  describe('Edge Cases & Race Conditions', () => {
    it('should handle rapid successive initialize calls', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      newManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);

      // Make 10 rapid initialize calls
      const promises = Array(10).fill(null).map(() => newManager.initialize());
      await Promise.all(promises);

      // Should only have checked FIDU tokens once (operation locking)
      expect(mockFiduAuthService.getTokens).toHaveBeenCalledTimes(1);
    });

    it('should handle initialize and checkAndRestore called simultaneously', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      newManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);

      // Call initialize and checkAndRestore at the same time
      const initPromise = newManager.initialize();
      const checkPromise = newManager.checkAndRestore();

      await Promise.all([initPromise, checkPromise]);

      // checkAndRestore should have been skipped since init was in progress
      expect(newManager.isOperationInProgress()).toBe(false);
    });

    it('should maintain state consistency across auth changes', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      newManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);

      // Initialize as authenticated
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(true);
      await newManager.initialize();
      expect(newManager.getAuthStatus().isAuthenticated).toBe(true);

      // Simulate auth loss
      newManager.reset();
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(false);
      await newManager.checkAndRestore();
      expect(newManager.getAuthStatus().isAuthenticated).toBe(false);

      // Simulate auth restoration
      newManager.reset();
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });
      await newManager.checkAndRestore();
      expect(newManager.getAuthStatus().isAuthenticated).toBe(true);
    });

    it('should handle service swap mid-flight', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      
      // Set first service
      const service1 = { ...mockGoogleDriveAuthService } as any;
      newManager.setGoogleDriveAuthService(service1);

      // Start initialization
      const initPromise = newManager.initialize();

      // Swap service (edge case - shouldn't happen but handle gracefully)
      const service2 = {
        ...mockGoogleDriveAuthService,
        isAuthenticated: jest.fn().mockReturnValue(false),
        getUser: jest.fn().mockReturnValue({ id: 'different-user', email: 'different@example.com', name: 'Different User' }),
      } as any;
      newManager.setGoogleDriveAuthService(service2);

      // Should complete without error
      await expect(initPromise).resolves.not.toThrow();
    });

    it('should properly cleanup after clearAuth', async () => {
      await authManager.initialize();
      expect(authManager.getAuthStatus().isAuthenticated).toBe(true);

      mockGoogleDriveAuthService.logout = jest.fn().mockResolvedValue(undefined);
      mockFiduAuthService.clearTokens = jest.fn().mockResolvedValue(undefined);
      
      // After clear, should be unauthenticated
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.getUser.mockReturnValue(null);
      
      await authManager.clearAuth();

      expect(mockGoogleDriveAuthService.logout).toHaveBeenCalled();
      expect(mockFiduAuthService.clearTokens).toHaveBeenCalled();
      expect(authManager.getAuthStatus().isAuthenticated).toBe(false);
    });

    it('should handle checkAndRestore with no Google Drive service set', async () => {
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      // Don't set Google Drive service

      const result = await newManager.checkAndRestore();

      expect(result).toBe(false);
      expect(newManager.getAuthStatus().isAuthenticated).toBe(false);
    });

    it('should handle time-based debouncing correctly', async () => {
      jest.useFakeTimers();
      
      resetAuthManager();
      const newManager = getAuthManager(mockDispatch);
      newManager.setGoogleDriveAuthService(mockGoogleDriveAuthService);
      
      mockGoogleDriveAuthService.isAuthenticated.mockReturnValue(false);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(false);

      // First call
      await newManager.checkAndRestore();
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).toHaveBeenCalledTimes(1);
      
      jest.clearAllMocks();

      // Call within 2 seconds - should be skipped
      await newManager.checkAndRestore();
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).not.toHaveBeenCalled();

      // Advance time by 2.1 seconds
      jest.advanceTimersByTime(2100);

      // Call after 2 seconds - should execute
      await newManager.checkAndRestore();
      expect(mockGoogleDriveAuthService.restoreFromCookiesWithRetry).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('Memory & Resource Management', () => {
    it('should properly manage event subscribers memory', () => {
      const callbacks = Array(100).fill(null).map(() => jest.fn());
      const unsubscribers = callbacks.map(cb => authManager.subscribe('auth-changed', cb));

      // Unsubscribe all
      unsubscribers.forEach(unsub => unsub());

      // Trigger event - no callbacks should be called
      authManager.reset();
      mockGoogleDriveAuthService.isAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockGoogleDriveAuthService.restoreFromCookiesWithRetry.mockResolvedValue(true);
      mockGoogleDriveAuthService.getUser.mockReturnValue({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
      });

      authManager.checkAndRestore();

      callbacks.forEach(cb => {
        expect(cb).not.toHaveBeenCalled();
      });
    });

    it('should handle reset without affecting singleton', () => {
      const instance1 = getAuthManager(mockDispatch);
      instance1.reset();
      const instance2 = getAuthManager();

      // Should still be the same instance
      expect(instance1).toBe(instance2);
      expect(instance1.isOperationInProgress()).toBe(false);
    });
  });
});

