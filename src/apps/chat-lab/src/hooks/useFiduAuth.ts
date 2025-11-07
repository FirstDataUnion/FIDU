/**
 * Hook to handle FIDU authentication flow
 * 
 * Manages:
 * - OAuth callbacks and token storage
 * - Google Drive authentication restoration
 * - Login success/error/logout event handling
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { initializeAuth, logout } from '../store/slices/authSlice';
import { fetchCurrentUser } from '../services/api/apiClientIdentityService';
import { refreshTokenService } from '../services/api/refreshTokenService';
import { isEmailAllowed, getAllowedEmails } from '../utils/emailAllowlist';
import { getFiduAuthService } from '../services/auth/FiduAuthService';
import { beginLogout, currentLogoutSource, markAuthenticated } from '../services/auth/logoutCoordinator';
import { getEnvironmentInfo } from '../utils/environment';

const AUTH_RESTORE_TIMEOUT_MS = 6000;

interface UseFiduAuthReturn {
  handleAuthSuccess: (user: any, token: string | any, portalUrl: any, refreshToken?: string) => Promise<void>;
  handleAuthError: (err: any) => void;
  handleLogout: () => void;
}

export function useFiduAuth(onError: (message: string) => void): UseFiduAuthReturn {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const handleAuthSuccess = useCallback(async (
    _user: any,
    token: string | any,
    _portalUrl: any,
    refreshToken?: string
  ) => {
    try {
      const fiduAuthService = getFiduAuthService();
      
      // Extract access token and refresh token
      let accessToken: string;
      let refreshTokenValue: string;
      
      if (typeof token === 'object' && token !== null && token.access_token) {
        // New format: token is an object
        accessToken = token.access_token;
        refreshTokenValue = token.refresh_token || token.access_token;
      } else {
        // Standard format: token is a string
        accessToken = token as string;
        
        // Use the refresh token parameter if provided
        if (refreshToken && refreshToken.trim() !== '') {
          refreshTokenValue = refreshToken;
        } else {
          // Fallback: Get from localStorage
          refreshTokenValue = localStorage.getItem('fiduRefreshToken') || accessToken;
        }
      }
      
      // Fetch user info from identity service
      const user = await fetchCurrentUser(accessToken);
      
      // Check email allowlist (development only)
      if (!isEmailAllowed(user.email)) {
        await fiduAuthService.clearTokens();
        refreshTokenService.clearAllAuthTokens();
        
        const allowedEmails = getAllowedEmails();
        const emailListStr = allowedEmails ? allowedEmails.join(', ') : 'configured list';
        onError(
          `Access restricted. Your email (${user.email}) is not authorized for this development environment. ` +
          `Authorized emails: ${emailListStr}. Please contact an administrator for access.`
        );
        return;
      }
      
      // Store tokens in HTTP-only cookies
      const success = await fiduAuthService.setTokens(accessToken, refreshTokenValue, user);
      
      if (!success) {
        throw new Error('Failed to store auth tokens in HTTP-only cookies');
      }

      markAuthenticated();
      
      // Keep localStorage as fallback for backward compatibility
      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Set auth_token cookie for backend compatibility
      document.cookie = `auth_token=${accessToken}; path=/; max-age=3600; samesite=lax`;
      
      // Handle Google Drive authentication in cloud mode
      const envInfo = getEnvironmentInfo();
      let requireOAuthRedirect = false;
      
      if (envInfo.storageMode === 'cloud') {
        try {
          const { getAuthManager } = await import('../services/auth/AuthManager');
          const { store } = await import('../store');
          const authManager = getAuthManager(store.dispatch);
          
          // Check and restore Google Drive authentication
          let restored = await authManager.checkAndRestore();

          // If not restored but operation is in progress, wait for completion
          if (!restored && authManager.isOperationInProgress()) {
            restored = await new Promise<boolean>((resolve) => {
              let settled = false;
              let unsubscribeRestored: (() => void) | null = null;
              let unsubscribeLost: (() => void) | null = null;
              let timeoutId: number | null = null;

              const finish = (value: boolean) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) window.clearTimeout(timeoutId);
                if (unsubscribeRestored) unsubscribeRestored();
                if (unsubscribeLost) unsubscribeLost();
                resolve(value);
              };

              unsubscribeRestored = authManager.subscribe('auth-restored', () => finish(true));
              unsubscribeLost = authManager.subscribe('auth-lost', () => finish(false));
              timeoutId = window.setTimeout(() => finish(false), AUTH_RESTORE_TIMEOUT_MS);
            });
          }

          // Try to reinitialize storage if restored
          if (restored) {
            try {
              const { getUnifiedStorageService } = await import('../services/storage/UnifiedStorageService');
              const storageService = getUnifiedStorageService();
              await storageService.reinitialize();
            } catch (storageError) {
              console.warn('Failed to reinitialize storage, will redirect to OAuth:', storageError);
              requireOAuthRedirect = true;
            }
          }
        } catch (error) {
          console.warn('Failed to restore Google Drive authentication:', error);
        }
      }

      // Re-initialize Redux auth state
      await dispatch(initializeAuth());

      // Redirect to OAuth callback if needed
      if (requireOAuthRedirect) {
        window.location.href = '/fidu-chat-lab/oauth-callback?postLogin=1';
      }
    } catch (error) {
      // Clear tokens if authentication fails
      const fiduAuthService = getFiduAuthService();
      await fiduAuthService.clearTokens();
      refreshTokenService.clearAllAuthTokens();
      console.error('Error during authentication:', error);
      onError('Authentication succeeded, but failed to fetch user info. Please try again.');
    }
  }, [dispatch, onError]);

  const handleAuthError = useCallback((_err: any) => {
    // Clear any existing auth data to prevent loops
    refreshTokenService.clearAllAuthTokens();
    onError('Authentication failed. Please try again.');
  }, [onError]);

  const handleLogout = useCallback(() => {
    // Check if user is already logged out - if so, no need to trigger logout
    // This prevents the SDK from triggering unnecessary logout during initialization
    if (!isAuthenticated) {
      console.log('ℹ️ [FIDU SDK] User already logged out, skipping unnecessary logout');
      return;
    }

    const started = beginLogout('auto');
    if (!started) {
      const source = currentLogoutSource();
      console.log('🔁 [FIDU SDK] Logout already in progress, skipping', { source });
      return;
    }

    dispatch(logout()).catch(() => {
      refreshTokenService.clearAllAuthTokens();
    });
  }, [dispatch, isAuthenticated]);

  return {
    handleAuthSuccess,
    handleAuthError,
    handleLogout,
  };
}

