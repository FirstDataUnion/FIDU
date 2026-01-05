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
import { getFiduAuthService } from '../services/auth/FiduAuthService';
import { beginLogout, currentLogoutSource, markAuthenticated } from '../services/auth/logoutCoordinator';
import { getEnvironmentInfo } from '../utils/environment';

const AUTH_RESTORE_TIMEOUT_MS = 6000;

interface NormalizedTokens {
  accessToken: string;
  refreshToken: string;
}

// TODO: We control the ID Service, SDK and frontend, so we shouldn't need this
function normalizeAuthTokens(
  token: string | { access_token?: string; refresh_token?: string } | null,
  providedRefreshToken?: string
): NormalizedTokens {
  if (token && typeof token === 'object' && token.access_token) {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || token.access_token,
    };
  }

  const accessToken = typeof token === 'string' ? token : '';
  let refreshToken = providedRefreshToken?.trim() || '';

  if (!refreshToken) {
    refreshToken = localStorage.getItem('fiduRefreshToken') || accessToken;
  }

  return {
    accessToken,
    refreshToken: refreshToken || accessToken,
  };
}

async function persistAuthenticatedSession(
  fiduAuthService: ReturnType<typeof getFiduAuthService>,
  user: any,
  tokens: NormalizedTokens
): Promise<void> {
  const success = await fiduAuthService.setTokens(tokens.accessToken, tokens.refreshToken, user);

  if (!success) {
    throw new Error('Failed to store auth tokens in HTTP-only cookies');
  }

  markAuthenticated();

  localStorage.setItem('auth_token', tokens.accessToken);
  localStorage.setItem('user', JSON.stringify(user));

  document.cookie = `auth_token=${tokens.accessToken}; path=/; max-age=3600; samesite=lax`;
}

async function attemptCloudStorageRestoration(): Promise<boolean> {
  const envInfo = getEnvironmentInfo();

  if (envInfo.storageMode !== 'cloud') {
    return false;
  }

  try {
    const { getAuthManager } = await import('../services/auth/AuthManager');
    const { store } = await import('../store');
    const authManager = getAuthManager(store.dispatch);

    let restored = await authManager.checkAndRestore();

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

    if (restored) {
      try {
        const { getUnifiedStorageService } = await import('../services/storage/UnifiedStorageService');
        const storageService = getUnifiedStorageService();
        await storageService.reinitialize();
        return false;
      } catch (storageError) {
        console.warn('Failed to reinitialize storage, will redirect to OAuth:', storageError);
        return true;
      }
    }
  } catch (error) {
    console.warn('Failed to restore Google Drive authentication:', error);
  }

  return false;
}

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
      const tokens = normalizeAuthTokens(token, refreshToken);

      const user = await fetchCurrentUser(tokens.accessToken);

      await persistAuthenticatedSession(fiduAuthService, user, tokens);

      const requireOAuthRedirect = await attemptCloudStorageRestoration();

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
      fiduAuthService.clearAllAuthTokens();
      console.error('Error during authentication:', error);
      onError('Authentication succeeded, but failed to fetch user info. Please try again.');
    }
  }, [dispatch, onError]);

  const handleAuthError = useCallback((_err: any) => {
    // Clear any existing auth data to prevent loops
    getFiduAuthService().clearAllAuthTokens();
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
      getFiduAuthService().clearAllAuthTokens();
    });
  }, [dispatch, isAuthenticated]);

  return {
    handleAuthSuccess,
    handleAuthError,
    handleLogout,
  };
}

