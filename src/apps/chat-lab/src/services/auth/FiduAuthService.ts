import { AxiosError } from 'axios';
import type { User } from '../../types';
import { detectRuntimeEnvironment } from '../../utils/environment';
import {
  beginLogout,
  completeLogout,
  currentLogoutSource,
} from '../auth/logoutCoordinator';

export interface FiduAuthTokens {
  access_token?: string;
  refresh_token?: string;
  user?: User;
}

export interface EnsureAccessTokenOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  onWait?: () => void;
}

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication required. Please log in again.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class TokenAcquisitionTimeoutError extends Error {
  constructor(message = 'Timed out waiting for access token.') {
    super(message);
    this.name = 'TokenAcquisitionTimeoutError';
  }
}

export class TokenRefreshError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TokenRefreshError';
    this.status = status;
  }
}

/**
 * FiduAuthService - Centralized FIDU Authentication Service
 *
 * This service manages the entire lifecycle of FIDU authentication tokens with strict security principles:
 *
 * **Token Storage Architecture:**
 * - **Access Token**: Lives ONLY in memory (this.cachedAccessToken)
 *   - Never stored in localStorage, sessionStorage, or cookies
 *   - Entire lifecycle (acquisition, refresh, clearing) managed exclusively by this service
 *   - Automatically refreshed when expired preemptively or via interceptors
 *   - Cleared on logout or authentication failure
 *
 * - **Refresh Token**: Lives ONLY in HTTP-only cookies
 *   - Managed by the backend server for security
 *   - Not accessible to JavaScript code
 *   - Used to obtain new access tokens when they expire
 *
 * **Interceptor-Based Authentication:**
 * - All API calls requiring FIDU auth use axios interceptors provided by createAuthInterceptor()
 * - Ensures consistent behavior across all call sites
 * - First 401 on any request triggers automatic token refresh and request retry
 * - If the token refresh returns 401, or if the retried request returns 401, automatic logout is triggered
 *
 * **Key Methods:**
 * - setTokens(): Store tokens (access token cached in memory, refresh token in HTTP-only cookie)
 * - ensureAccessToken(): Ensure access token is available (from memory or via refresh)
 * - clearTokens(): Clear all tokens (memory cache and cookies)
 * - createAuthInterceptor(): Create axios interceptors for automatic token management
 *
 * **Important**: Never access or store FIDU access tokens outside of this service.
 * Always use the interceptors provided by createAuthInterceptor() for API calls.
 */
export class FiduAuthService {
  private basePath: string;
  private environment: string;

  private cachedAccessToken: string | null = null;
  private cachedRefreshTokenAvailable: boolean | null = null;
  private refreshPromise: Promise<void> | null = null;
  private lastRefreshError: Error | null = null;
  private tokenExpiresAt: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private validationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.basePath = window.location.pathname.includes('/fidu-chat-lab')
      ? '/fidu-chat-lab'
      : '';

    this.environment = detectRuntimeEnvironment();
  }

  /**
   * Store FIDU authentication tokens
   *
   * **Token Storage:**
   * - Access token: Stored in memory
   * - Refresh token: Stored in HTTP-only cookie by backend (not accessible to JavaScript)
   *
   * @param accessToken - FIDU access token (JWT)
   * @param refreshToken - FIDU refresh token
   * @param user - User information
   * @returns true if tokens were stored successfully
   */
  async setTokens(
    accessToken: string,
    refreshToken: string,
    user: User
  ): Promise<boolean> {
    try {
      console.log(
        `🔑 Storing FIDU auth tokens in HTTP-only cookies for ${this.environment} environment...`
      );

      const response = await fetch(
        `${this.basePath}/api/auth/fidu/set-tokens`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            user,
            environment: this.environment,
          }),
        }
      );

      if (!response.ok) {
        console.error('❌ Failed to store FIDU auth tokens:', response.status);
        return false;
      }

      console.log('✅ FIDU auth tokens stored in HTTP-only cookies');
      this.cachedAccessToken = accessToken;
      this.cachedRefreshTokenAvailable = refreshToken.trim() !== '';
      this.lastRefreshError = null;

      // Start proactive refresh and periodic validation
      this.startProactiveRefresh();
      this.startPeriodicValidation();

      return true;
    } catch (error) {
      console.error('❌ Error storing FIDU auth tokens:', error);
      return false;
    }
  }

  private async getTokens(): Promise<FiduAuthTokens | null> {
    try {
      const url = `${this.basePath}/api/auth/fidu/get-tokens?env=${this.environment}`;
      console.log(`🔄 [FiduAuth] Fetching tokens from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn(
          '⚠️ [FiduAuth] Failed to retrieve FIDU auth tokens:',
          response.status
        );
        return null;
      }

      const data: FiduAuthTokens = await response.json();
      console.log(`📦 [FiduAuth] Received token data:`, {
        hasAccessToken: !!(
          data.access_token && data.access_token.trim() !== ''
        ),
        hasRefreshToken: !!(
          data.refresh_token && data.refresh_token.trim() !== ''
        ),
        hasUser: !!data.user,
      });

      if (data.access_token && data.access_token.trim() !== '') {
        this.cachedAccessToken = data.access_token;
      }

      if (typeof data.refresh_token === 'string') {
        this.cachedRefreshTokenAvailable = data.refresh_token.trim() !== '';
      }

      const hasTokens = !!(
        data.access_token
        || data.refresh_token
        || data.user
      );
      return hasTokens ? data : null;
    } catch (error) {
      console.error(
        '❌ [FiduAuth] Error retrieving tokens from cookies:',
        error
      );
      return null;
    }
  }

  async hasRefreshToken(): Promise<boolean> {
    if (this.cachedRefreshTokenAvailable != null) {
      return this.cachedRefreshTokenAvailable;
    }

    const tokens = await this.getTokens();
    return !!tokens?.refresh_token;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return !!token;
    } catch (error) {
      console.warn('Error checking authentication status:', error);
      return false;
    }
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      await this.ensureAccessToken();
      return this.cachedAccessToken;
    } catch (error) {
      if (
        error instanceof AuthenticationRequiredError
        || error instanceof TokenAcquisitionTimeoutError
      ) {
        return null;
      }
      console.warn('Error getting access token:', error);
      return null;
    }
  }

  async ensureAccessToken(
    options: EnsureAccessTokenOptions = {}
  ): Promise<void> {
    const {
      forceRefresh = false,
      timeoutMs = 10000,
      onWait,
      maxAttempts = 3,
    } = options;

    if (
      !forceRefresh
      && this.cachedAccessToken
      && this.cachedAccessToken.trim() !== ''
    ) {
      return;
    }

    if (!forceRefresh) {
      const tokens = await this.getTokens();
      if (tokens?.access_token && tokens.access_token.trim() !== '') {
        return;
      }
    }

    if (this.refreshPromise) {
      if (onWait) onWait();
      await this.waitForPromise(this.refreshPromise, timeoutMs);
      return;
    }

    const refreshTask = this.refreshAccessTokenWithRetry(maxAttempts);
    this.refreshPromise = refreshTask
      .then(token => {
        this.cachedAccessToken = token;
        this.lastRefreshError = null;
      })
      .catch(error => {
        this.lastRefreshError = error;
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    if (onWait) onWait();
    await this.waitForPromise(this.refreshPromise, timeoutMs);
  }

  /**
   * Clear all FIDU authentication tokens
   *
   * **Clears:**
   * - Access token from memory (this.cachedAccessToken)
   * - Refresh token from HTTP-only cookies (via backend)
   * - All cached state
   *
   * @returns true if tokens were cleared successfully
   */
  async clearTokens(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.basePath}/api/auth/fidu/clear-tokens?env=${this.environment}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        console.error('❌ Failed to clear FIDU auth tokens:', response.status);
        return false;
      }

      this.resetCache();

      // Stop proactive refresh and periodic validation
      this.stopProactiveRefresh();
      this.stopPeriodicValidation();

      console.log('✅ FIDU auth tokens cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Error clearing FIDU auth tokens:', error);
      return false;
    }
  }

  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const cookieTokens = await this.getTokens();
      if (cookieTokens?.access_token) {
        return true;
      }

      const localAccessToken = localStorage.getItem('auth_token');
      const localUser = localStorage.getItem('user');

      if (!localAccessToken || !localUser) {
        return false;
      }

      const user = JSON.parse(localUser);
      const success = await this.setTokens(
        localAccessToken,
        localAccessToken,
        user
      );

      if (success) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_profile');
      }

      return success;
    } catch (error) {
      console.error('❌ Error migrating FIDU auth tokens:', error);
      return false;
    }
  }

  private async refreshAccessTokenWithRetry(maxAttempts = 3): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
      try {
        console.log(
          '🔐 Refreshing access token with retry... ',
          attempt,
          ' of ',
          maxAttempts
        );
        const token = await this.refreshAccessTokenInternal();
        return token;
      } catch (error) {
        lastError = error;

        if (error instanceof AuthenticationRequiredError) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const backoffMs = 300 * attempt;
          await this.delay(backoffMs);
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new TokenRefreshError('Unable to refresh FIDU access token');
  }

  private async refreshAccessTokenInternal(): Promise<string> {
    if (!(await this.hasRefreshToken())) {
      this.resetCache();
      throw new AuthenticationRequiredError('No FIDU refresh token available');
    }

    try {
      const response = await fetch(
        `${this.basePath}/api/auth/fidu/refresh-access-token?env=${this.environment}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (response.status === 401) {
        this.resetCache();
        throw new AuthenticationRequiredError(
          'Authentication failed while refreshing token.'
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new TokenRefreshError(
          `Token refresh failed with status ${response.status}: ${errorText || 'Unknown error'}`,
          response.status
        );
      }

      const data = await response.json();

      if (!data?.access_token) {
        throw new TokenRefreshError('Refresh response missing access token');
      }

      const accessToken: string = data.access_token;
      const expiresIn: number | undefined = data.expires_in;

      // Track expiration
      if (typeof expiresIn === 'number') {
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;
      }

      this.cachedAccessToken = accessToken;

      // Start proactive refresh with new expiration
      this.startProactiveRefresh();

      return accessToken;
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }

      if (error instanceof TokenRefreshError) {
        if (error.status && error.status >= 500) {
          throw error;
        }
        if (error.status && error.status >= 400) {
          throw new AuthenticationRequiredError(
            'Authentication failed while refreshing token.'
          );
        }
        throw error;
      }

      console.warn('Network error during token refresh:', error);
      throw new TokenRefreshError('Network error during token refresh');
    }
  }

  private async waitForPromise<T>(
    promise: Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return await promise;
    }

    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new TokenAcquisitionTimeoutError()), timeoutMs);
      }),
    ]);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  private resetCache(): void {
    this.cachedAccessToken = null;
    this.cachedRefreshTokenAvailable = null;
    this.lastRefreshError = null;
    this.tokenExpiresAt = null;
    this.deleteThingsThatShouldNotExist();
  }

  /**
   * Start proactive token refresh
   * Refreshes token 10 minutes before expiration
   */
  private startProactiveRefresh(): void {
    // Clear existing timer
    this.stopProactiveRefresh();

    if (!this.tokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const timeUntilExpiration = this.tokenExpiresAt - now;

    if (timeUntilExpiration <= tenMinutes) {
      // Less than 10 minutes remaining, refresh immediately
      console.log('🔄 Token expires soon, refreshing immediately...');
      this.refreshAccessTokenInternal().catch(error => {
        console.warn('⚠️ Proactive refresh failed:', error);
        // Retry after 1 minute
        setTimeout(() => {
          this.startProactiveRefresh();
        }, 60 * 1000);
      });
    } else {
      // Schedule refresh 10 minutes before expiration
      const delay = timeUntilExpiration - tenMinutes;
      console.log(
        `⏰ Scheduling proactive refresh in ${Math.round(delay / 1000 / 60)} minutes`
      );

      this.refreshTimer = setTimeout(() => {
        console.log('🔄 Proactive token refresh triggered');
        this.refreshAccessTokenInternal()
          .then(() => {
            // Restart proactive refresh with new expiration
            this.startProactiveRefresh();
          })
          .catch(error => {
            console.warn('⚠️ Proactive refresh failed:', error);
            // Retry after 1 minute
            setTimeout(() => {
              this.startProactiveRefresh();
            }, 60 * 1000);
          });
      }, delay);
    }
  }

  /**
   * Stop proactive token refresh
   */
  private stopProactiveRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Start periodic token validation
   * Checks token validity every 5 minutes
   */
  private startPeriodicValidation(): void {
    // Clear existing interval
    this.stopPeriodicValidation();

    console.log('🔄 Starting periodic token validation (every 5 minutes)');

    this.validationInterval = setInterval(
      async () => {
        try {
          const authenticated = await this.isAuthenticated();
          if (!authenticated) {
            console.warn('⚠️ Periodic validation: Authentication lost');
            // Could emit event here if needed
          } else {
            console.log('✅ Periodic validation: Authentication valid');
          }
        } catch (error) {
          console.warn('⚠️ Periodic validation error:', error);
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  /**
   * Stop periodic token validation
   */
  private stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  /**
   * Check if the current access token is expired
   * We'll use a simple heuristic: if we have a refresh token, assume the access token might be expired
   */
  private isAccessTokenExpired(): boolean {
    const accessToken = this.cachedAccessToken;

    // If no access token, it's expired
    if (!accessToken) return true;

    // If we have a refresh token, check if access token is expired
    try {
      // Decode JWT to check expiration
      const payload = this.decodeJWT(accessToken);
      if (payload && payload.exp) {
        // Add 5 minute buffer for safety
        const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        return Date.now() >= payload.exp * 1000 - bufferTime;
      }
    } catch (error) {
      // If we can't decode the JWT, assume it's expired
      console.warn('Could not decode JWT token, assuming expired:', error);
      return true;
    }

    return true;
  }

  /**
   * Decode a JWT token to extract payload
   */
  private decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  /**
   * Create axios interceptors for automatic FIDU authentication
   *
   * **Usage**: All API calls requiring FIDU auth should use these interceptors.
   *
   * **Example:**
   * ```typescript
   * const authInterceptor = getFiduAuthService().createAuthInterceptor();
   *
   * // Add auth interceptor first
   * client.interceptors.request.use(
   *   authInterceptor.request,
   *   (error) => Promise.reject(error)
   * );
   *
   * client.interceptors.response.use(
   *   authInterceptor.response,
   *   authInterceptor.error
   * );
   *
   * // Additional interceptors run after authInterceptor
   * client.interceptors.response.use(
   *   client_specific_interceptor.response,
   *   client_specific_interceptor.error
   * );
   * ```
   *
   * **Behavior:**
   * - Request interceptor: Ensures access token is available (from memory or via refresh) and adds to Authorization header
   * - Response interceptor: Passes through successful responses
   * - Error interceptor:
   *   - On 401: Automatically refreshes token and retries the request
   *   - If the token refresh returns 401, or if the retried request returns 401: Triggers automatic logout
   *
   * **Token Management:**
   * - Access token retrieved from memory (this.cachedAccessToken)
   * - Refresh token retrieved from HTTP-only cookies (via backend)
   * - All token operations happen automatically - no manual intervention needed
   *
   * @returns Object with request, response, and error interceptor functions
   */
  createAuthInterceptor() {
    return {
      // Request interceptor
      request: async (config: any) => {
        const headers = config.headers ?? (config.headers = {});
        const skipGuard = Boolean(config?.skipFiduAuthGuard);

        if (skipGuard) {
          return config;
        }

        try {
          await getFiduAuthService().ensureAccessToken({
            onWait: () =>
              console.log(
                '🔐 Ensuring FIDU auth before identity service request...'
              ),
          });
          const token = this.cachedAccessToken;

          if (token && token.trim() !== '') {
            headers.Authorization = `Bearer ${token}`;
            return config;
          }
        } catch (error) {
          if (error instanceof AuthenticationRequiredError) {
            this.clearAllAuthTokens();
            await this.dispatchLogout();
            return Promise.reject(error);
          }

          if (error instanceof TokenAcquisitionTimeoutError) {
            return Promise.reject(error);
          }

          console.warn(
            'Failed to ensure FIDU auth token before request:',
            error
          );
        }

        return Promise.reject(
          new Error('Authentication required. Please log in again.')
        );
      },

      // Response interceptor
      response: (response: any) => response,

      // Error interceptor
      error: async (error: any) => {
        const originalRequest = error.config;

        // If it's a 401 error and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Attempt to refresh the token
            const newToken = await this.refreshAccessTokenWithRetry();

            // Update the authorization header
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            // Retry the original request
            return await this.retryRequest(originalRequest);
          } catch (refreshError) {
            let errorToThrow = refreshError;
            if (
              refreshError instanceof AxiosError
              && refreshError.response?.status === 401
            ) {
              errorToThrow = new AuthenticationRequiredError(
                'Authentication failed while retrying with refreshed token.'
              );
            }
            if (errorToThrow instanceof AuthenticationRequiredError) {
              console.error(
                'Token refresh authentication failure, logging out user:',
                errorToThrow
              );
              this.clearAllAuthTokens();
              await this.dispatchLogout();
            } else {
              console.error('Token refresh network error:', errorToThrow);
            }

            throw errorToThrow;
          }
        }

        throw error;
      },
    };
  }

  /**
   * Dispatch logout action to update Redux state
   * This ensures the UI properly reflects the authentication state change
   */
  private async dispatchLogout(): Promise<void> {
    const started = beginLogout('auto');

    if (!started) {
      const source = currentLogoutSource();
      console.log(
        '🔁 Logout already in progress, skipping duplicate auto-dispatch',
        { source }
      );
      return;
    }

    try {
      const { store } = await import('../../store');
      const { logout } = await import('../../store/slices/authSlice');
      await store.dispatch(logout());
    } catch (error) {
      console.error('Logout dispatch failed:', error);
      completeLogout();
      window.location.reload();
    }
  }

  /**
   * Clear all authentication tokens and data
   */
  clearAllAuthTokens(): void {
    this.deleteThingsThatShouldNotExist();

    this.resetCache();
  }

  /**
   * Things that have previously been stored in localStorage or cookies but
   * shouldn't be there anymore. This is a cleanup step to ensure we're not
   * leaving things on people's machines forever.
   *
   * Added January 2026 - remove in... March? April? Once no regular users
   * have these left.
   */
  private deleteThingsThatShouldNotExist(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('fiduRefreshToken');
    localStorage.removeItem('token_expires_in');
    localStorage.removeItem('user');
    localStorage.removeItem('current_profile');
    localStorage.removeItem('fiduToken');

    // Clear cookies
    document.cookie = 'auth_token=; path=/; max-age=0; samesite=lax';
    document.cookie = 'refresh_token=; path=/; max-age=0; samesite=lax';
    document.cookie = 'fiduRefreshToken=; path=/; max-age=0; samesite=lax';
  }

  /**
   * Retry a failed request with new configuration
   */
  private async retryRequest(config: any): Promise<any> {
    // Import axios dynamically to avoid circular dependencies
    const { default: axios } = await import('axios');
    return axios(config);
  }
}

let fiduAuthServiceInstance: FiduAuthService | null = null;

export const getFiduAuthService = (): FiduAuthService => {
  if (!fiduAuthServiceInstance) {
    fiduAuthServiceInstance = new FiduAuthService();
  }
  return fiduAuthServiceInstance;
};
