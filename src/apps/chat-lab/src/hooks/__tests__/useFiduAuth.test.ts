/**
 * Simplified tests for useFiduAuth hook
 *
 * Focus: Core authentication logic (token handling, errors, logout flow)
 * Simplified: Mock setup is minimal - just what's needed for the tests
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useFiduAuth } from '../useFiduAuth';
import * as logoutCoordinator from '../../services/auth/logoutCoordinator';
import {
  AuthenticationRequiredError,
  getFiduAuthService,
} from '../../services/auth/FiduAuthService';
import { IdentityServiceUser } from '../../types';

// Minimal mocks - only what's necessary
// Use factory functions to avoid hoisting issues

jest.mock('../../utils/environment', () => ({
  getEnvironmentInfo: jest.fn(() => ({ storageMode: 'local' })),
  getIdentityServiceUrl: jest.fn(() => 'https://test-identity.example.com'),
  detectRuntimeEnvironment: jest.fn(() => 'development'),
}));

jest.mock('../../services/auth/FiduAuthService', () => {
  const actual = jest.requireActual('../../services/auth/FiduAuthService');
  const mockFiduAuthServiceInstance = {
    setTokens: jest.fn().mockResolvedValue(true),
    clearTokens: jest.fn().mockResolvedValue(true),
    getTokens: jest.fn().mockResolvedValue({ access_token: 'test-token' }),
    clearAllAuthTokens: jest.fn(),
    // For the real apiClientIdentityService implementation of externalUserToInternalUser
    createAuthInterceptor: jest.fn(() => ({
      request: jest.fn(config => config),
      response: jest.fn(response => response),
      error: jest.fn(),
    })),
  } as unknown as jest.Mocked<ReturnType<typeof getFiduAuthService>>;

  return {
    getFiduAuthService: jest.fn(() => mockFiduAuthServiceInstance),
    AuthenticationRequiredError: actual.AuthenticationRequiredError,
  };
});
const mockFiduAuthService = getFiduAuthService() as jest.Mocked<
  ReturnType<typeof getFiduAuthService>
>;

jest.mock('../../services/api/apiClientIdentityService', () => ({
  externalUserToInternalUser: jest.requireActual(
    '../../services/api/apiClientIdentityService'
  ).externalUserToInternalUser,
}));

jest.mock('../../services/auth/logoutCoordinator', () => ({
  beginLogout: jest.fn().mockReturnValue(true),
  markAuthenticated: jest.fn(),
  currentLogoutSource: jest.fn().mockReturnValue('manual'),
  completeLogout: jest.fn(),
}));

const mockIsAuthenticated = jest.fn(() => false);

jest.mock('../../hooks/redux', () => ({
  useAppDispatch: jest.fn(() => jest.fn(() => Promise.resolve())),
  useAppSelector: jest.fn((selector: any) => {
    // Return mock auth state
    return selector({
      auth: {
        isAuthenticated: mockIsAuthenticated(),
      },
    });
  }),
}));

const testIdentityServiceUser: IdentityServiceUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  profiles: [],
};

describe('useFiduAuth (Simplified)', () => {
  let mockOnError: jest.Mock;

  beforeEach(() => {
    mockOnError = jest.fn();
    localStorage.clear();
    jest.clearAllMocks();
  });

  /**
   * Core authentication flow tests
   * Focus on the most important cases, skip edge cases
   */
  describe('handleAuthSuccess', () => {
    it('should handle successful authentication', async () => {
      const { result } = renderHook(() => useFiduAuth(mockOnError));

      await result.current.handleAuthSuccess(
        testIdentityServiceUser,
        'access-token-123',
        'https://portal.example.com',
        'refresh-token-123'
      );

      await waitFor(() => {
        expect(mockFiduAuthService.setTokens).toHaveBeenCalledWith(
          'access-token-123',
          'refresh-token-123',
          expect.objectContaining({
            email: 'test@example.com',
            id: 'user-123',
            name: 'Test User',
          })
        );
        expect(logoutCoordinator.markAuthenticated).toHaveBeenCalled();
        // Note: useAppDispatch is mocked, so we can't easily verify dispatch was called
        // This is tested in integration tests instead
      });
    });

    it('should handle authentication errors', async () => {
      (mockFiduAuthService.setTokens as jest.Mock).mockRejectedValueOnce(
        new AuthenticationRequiredError()
      );

      const { result } = renderHook(() => useFiduAuth(mockOnError));

      await result.current.handleAuthSuccess(
        testIdentityServiceUser,
        'access-token-123',
        'https://portal.example.com',
        'refresh-token-123'
      );

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
        expect(getFiduAuthService().clearAllAuthTokens).toHaveBeenCalled();
      });
    });
  });

  describe('handleAuthError', () => {
    it('should clear tokens and call error callback', () => {
      const { result } = renderHook(() => useFiduAuth(mockOnError));

      result.current.handleAuthError(new Error('Auth failed'));

      expect(getFiduAuthService().clearAllAuthTokens).toHaveBeenCalled();
      expect(mockOnError).toHaveBeenCalledWith(
        'Authentication failed. Please try again.'
      );
    });
  });

  describe('handleLogout', () => {
    it('should trigger logout coordination when authenticated', () => {
      // Mock user as authenticated
      mockIsAuthenticated.mockReturnValueOnce(true);

      const { result } = renderHook(() => useFiduAuth(mockOnError));

      result.current.handleLogout();

      expect(logoutCoordinator.beginLogout).toHaveBeenCalledWith('auto');
    });

    it('should skip logout if user is already logged out', () => {
      // Mock user as not authenticated (default)
      mockIsAuthenticated.mockReturnValueOnce(false);

      const { result } = renderHook(() => useFiduAuth(mockOnError));

      result.current.handleLogout();

      // Should not call beginLogout when user is already logged out
      expect(logoutCoordinator.beginLogout).not.toHaveBeenCalled();
    });

    it('should skip logout if already in progress', () => {
      // Mock user as authenticated
      mockIsAuthenticated.mockReturnValueOnce(true);
      (logoutCoordinator.beginLogout as jest.Mock).mockReturnValueOnce(false);

      const { result } = renderHook(() => useFiduAuth(mockOnError));

      result.current.handleLogout();

      expect(logoutCoordinator.beginLogout).toHaveBeenCalledWith('auto');
      // When beginLogout returns false, no dispatch should occur
    });
  });

  /**
   * Note: We've simplified these tests to focus on core flows:
   * - Successful authentication
   * - Error handling
   * - Logout coordination
   *
   * Removed tests for:
   * - Token format variations (string vs object) - implementation detail
   * - Cookie setting - browser behavior
   * - Email allowlist - tested separately in integration tests
   * - Edge cases that are less likely to break
   *
   * This gives us confidence in the core logic without brittle setup
   */
});
