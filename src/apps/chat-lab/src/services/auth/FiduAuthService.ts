import type { User } from '../../types';
import { detectRuntimeEnvironment } from '../../utils/environment';

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

export class FiduAuthService {
  private basePath: string;
  private environment: string;

  private cachedAccessToken: string | null = null;
  private cachedRefreshTokenAvailable: boolean | null = null;
  private refreshPromise: Promise<string | null> | null = null;
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

  async setTokens(accessToken: string, refreshToken: string, user: User): Promise<boolean> {
    try {
      console.log(`🔑 Storing FIDU auth tokens in HTTP-only cookies for ${this.environment} environment...`);

      const response = await fetch(`${this.basePath}/api/auth/fidu/set-tokens`, {
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
      });

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

  async getTokens(): Promise<FiduAuthTokens | null> {
    try {
      const url = `${this.basePath}/api/auth/fidu/get-tokens?env=${this.environment}`;
      console.log(`🔄 [FiduAuth] Fetching tokens from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 401) {
          console.warn(`⚠️ [FiduAuth] No tokens found in cookies (status: ${response.status}) - cookies may have expired or been cleared`);
        } else if (response.status >= 500) {
          console.error(`❌ [FiduAuth] Backend error retrieving tokens (status: ${response.status}) - this may be temporary`);
        } else {
          console.error(`❌ [FiduAuth] Failed to retrieve tokens from cookies (status: ${response.status})`);
        }
        return null;
      }

      const data: FiduAuthTokens = await response.json();
      console.log(`📦 [FiduAuth] Received token data:`, {
        hasAccessToken: !!(data.access_token && data.access_token.trim() !== ''),
        hasRefreshToken: !!(data.refresh_token && data.refresh_token.trim() !== ''),
        hasUser: !!data.user,
      });

      if (data.access_token && data.access_token.trim() !== '') {
        this.cachedAccessToken = data.access_token;
        console.log('✅ [FiduAuth] Access token retrieved from cookies');
      }

      if (typeof data.refresh_token === 'string') {
        this.cachedRefreshTokenAvailable = data.refresh_token.trim() !== '';
        if (this.cachedRefreshTokenAvailable) {
          console.log('✅ [FiduAuth] Refresh token found in cookies');
        } else {
          console.warn('⚠️ [FiduAuth] Refresh token field exists but is empty');
        }
      } else {
        console.warn('⚠️ [FiduAuth] No refresh_token field in response');
      }

      const hasTokens = !!(data.access_token || data.refresh_token || data.user);
      if (!hasTokens) {
        console.warn('⚠️ [FiduAuth] Tokens retrieved but all fields are empty - cookies may have expired');
      }

      return hasTokens ? data : null;
    } catch (error) {
      console.error('❌ [FiduAuth] Error retrieving tokens from cookies:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ [FiduAuth] Network error - backend may be unavailable');
      }
      return null;
    }
  }

  async hasRefreshToken(): Promise<boolean> {
    if (this.cachedRefreshTokenAvailable != null) {
      return this.cachedRefreshTokenAvailable;
    }

    try {
      const tokens = await this.getTokens();
      const hasRefresh = !!(tokens?.refresh_token && tokens.refresh_token.trim() !== '');
      
      if (hasRefresh) {
        console.log('✅ [FiduAuth] Refresh token found in cookies');
      } else {
        console.warn('⚠️ [FiduAuth] No refresh token found in cookies');
      }
      
      return hasRefresh;
    } catch (error) {
      console.error('❌ [FiduAuth] Error checking for refresh token:', error);
      return false;
    }
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

  /**
   * Ensure user is authenticated, attempting restoration if needed
   * This is an async version of isAuthenticated() that attempts restoration
   * Use this when you need to guarantee authentication state
   */
  async ensureAuthenticated(): Promise<boolean> {
    // Fast path: if we have a cached token, check if it's valid
    if (this.cachedAccessToken && this.cachedAccessToken.trim() !== '') {
      // Check if token is expired (if we have expiration info)
      if (this.tokenExpiresAt && this.tokenExpiresAt > Date.now() + (5 * 60 * 1000)) {
        return true;
      }
      // If no expiration info or token might be expired, continue to slow path
    }
    
    // Slow path: try to restore from cookies
    try {
      console.log('🔄 [FiduAuth] Attempting to restore authentication from cookies...');
      const tokens = await this.getTokens();
      
      if (!tokens) {
        console.warn('⚠️ [FiduAuth] No tokens found in cookies');
        return false;
      }
      
      // If we have an access token, use it
      if (tokens.access_token && tokens.access_token.trim() !== '') {
        console.log('✅ [FiduAuth] Access token found in cookies, restoring...');
        this.cachedAccessToken = tokens.access_token;
        return true;
      }
      
      // If refresh token exists, attempt refresh
      if (tokens.refresh_token && tokens.refresh_token.trim() !== '') {
        console.log('🔄 [FiduAuth] Access token missing but refresh token found, attempting refresh...');
        try {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            console.log('✅ [FiduAuth] Successfully refreshed access token');
            return true;
          }
          console.warn('⚠️ [FiduAuth] Token refresh returned null');
        } catch (refreshError) {
          console.error('❌ [FiduAuth] Token refresh failed:', refreshError);
          // Don't return false yet - check if it's a recoverable error
          if (refreshError instanceof AuthenticationRequiredError) {
            console.error('❌ [FiduAuth] Refresh token is invalid or expired');
            return false;
          }
          // For other errors (network, etc.), we might want to retry
          console.warn('⚠️ [FiduAuth] Refresh failed with recoverable error, will retry later');
          return false;
        }
      } else {
        console.warn('⚠️ [FiduAuth] No refresh token found in cookies');
      }
      
      return false;
    } catch (error) {
      console.error('❌ [FiduAuth] Failed to ensure authentication:', error);
      return false;
    }
  }

  /**
   * Get authentication status with async restoration attempt
   * Use this when you need accurate auth state
   */
  async getAuthStatusAsync(): Promise<{
    isAuthenticated: boolean;
    user: User | null;
    hasRefreshToken: boolean;
  }> {
    const authenticated = await this.ensureAuthenticated();
    
    if (authenticated) {
      const tokens = await this.getTokens();
      return {
        isAuthenticated: true,
        user: tokens?.user || null,
        hasRefreshToken: !!(tokens?.refresh_token),
      };
    }
    
    return {
      isAuthenticated: false,
      user: null,
      hasRefreshToken: false,
    };
  }

  async getAccessToken(): Promise<string | null> {
    // If tokens missing, try to restore from cookies first
    if (!this.cachedAccessToken) {
      console.log('🔄 Tokens missing from memory, attempting to restore from cookies...');
      const tokens = await this.getTokens();
      if (tokens?.access_token && tokens.access_token.trim() !== '') {
        this.cachedAccessToken = tokens.access_token;
        console.log('✅ Tokens restored from cookies');
        return tokens.access_token;
      }
      
      // If access token missing but refresh token exists, attempt refresh
      if (tokens?.refresh_token) {
        try {
          console.log('🔄 Access token missing but refresh token exists, attempting refresh...');
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            console.log('✅ Token refreshed successfully');
            return refreshed;
          }
        } catch (error) {
          console.warn('⚠️ Failed to refresh token during auto-restore:', error);
        }
      }
    }

    // Continue with existing logic
    try {
      return await this.ensureAccessToken();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError || error instanceof TokenAcquisitionTimeoutError) {
        return null;
      }
      console.warn('Error getting access token:', error);
      return null;
    }
  }

  async getAccessTokenOrThrow(options?: EnsureAccessTokenOptions): Promise<string> {
    const token = await this.ensureAccessToken(options);
    if (!token) {
      throw new AuthenticationRequiredError();
    }
    return token;
  }

  async ensureAccessToken(options: EnsureAccessTokenOptions = {}): Promise<string | null> {
    const { forceRefresh = false, timeoutMs = 10000, onWait, maxAttempts = 3 } = options;

    if (!forceRefresh && this.cachedAccessToken && this.cachedAccessToken.trim() !== '') {
      return this.cachedAccessToken;
    }

    if (!forceRefresh) {
      const tokens = await this.getTokens();
      if (tokens?.access_token && tokens.access_token.trim() !== '') {
        return tokens.access_token;
      }
    }

    if (this.refreshPromise) {
      if (onWait) onWait();
      return await this.waitForPromise(this.refreshPromise, timeoutMs);
    }

    const refreshTask = this.refreshAccessTokenWithRetry(maxAttempts);
    this.refreshPromise = refreshTask
      .then((token) => {
        this.cachedAccessToken = token;
        this.lastRefreshError = null;
        return token;
      })
      .catch((error) => {
        this.lastRefreshError = error;
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    if (onWait) onWait();
    return await this.waitForPromise(this.refreshPromise, timeoutMs);
  }

  async refreshAccessToken(): Promise<string | null> {
    try {
      const token = await this.refreshAccessTokenWithRetry();
      return token;
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return null;
      }
      console.error('❌ Failed to refresh FIDU access token:', error);
      return null;
    }
  }

  async clearTokens(): Promise<boolean> {
    try {
      const response = await fetch(`${this.basePath}/api/auth/fidu/clear-tokens?env=${this.environment}`, {
        method: 'POST',
        credentials: 'include',
      });

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
      const success = await this.setTokens(localAccessToken, localAccessToken, user);

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
      const response = await fetch(`${this.basePath}/api/auth/fidu/refresh-access-token?env=${this.environment}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.status === 401) {
        this.resetCache();
        throw new AuthenticationRequiredError('Authentication failed while refreshing token.');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new TokenRefreshError(
          `Token refresh failed with status ${response.status}: ${errorText || 'Unknown error'}`,
          response.status,
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
        this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
        localStorage.setItem('token_expires_at', String(this.tokenExpiresAt));
      }

      localStorage.setItem('auth_token', accessToken);
      if (typeof expiresIn === 'number') {
        localStorage.setItem('token_expires_in', String(expiresIn));
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
          throw new AuthenticationRequiredError('Authentication failed while refreshing token.');
        }
        throw error;
      }

      console.warn('Network error during token refresh:', error);
      throw new TokenRefreshError('Network error during token refresh');
    }
  }

  private async waitForPromise<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
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
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private resetCache(): void {
    this.cachedAccessToken = null;
    this.cachedRefreshTokenAvailable = null;
    this.lastRefreshError = null;
    this.tokenExpiresAt = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_expires_in');
    localStorage.removeItem('token_expires_at');
  }

  /**
   * Start proactive token refresh
   * Refreshes token 10 minutes before expiration
   */
  private startProactiveRefresh(): void {
    // Clear existing timer
    this.stopProactiveRefresh();
    
    if (!this.tokenExpiresAt) {
      // Try to get expiration from localStorage
      const storedExpiresAt = localStorage.getItem('token_expires_at');
      if (storedExpiresAt) {
        this.tokenExpiresAt = parseInt(storedExpiresAt, 10);
      } else {
        // No expiration info, can't schedule refresh
        return;
      }
    }
    
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const timeUntilExpiration = this.tokenExpiresAt - now;
    
    if (timeUntilExpiration <= tenMinutes) {
      // Less than 10 minutes remaining, refresh immediately
      console.log('🔄 Token expires soon, refreshing immediately...');
      this.refreshAccessToken().catch(error => {
        console.warn('⚠️ Proactive refresh failed:', error);
        // Retry after 1 minute
        setTimeout(() => {
          this.startProactiveRefresh();
        }, 60 * 1000);
      });
    } else {
      // Schedule refresh 10 minutes before expiration
      const delay = timeUntilExpiration - tenMinutes;
      console.log(`⏰ Scheduling proactive refresh in ${Math.round(delay / 1000 / 60)} minutes`);
      
      this.refreshTimer = setTimeout(() => {
        console.log('🔄 Proactive token refresh triggered');
        this.refreshAccessToken()
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
    
    this.validationInterval = setInterval(async () => {
      try {
        const authenticated = await this.ensureAuthenticated();
        if (!authenticated) {
          console.warn('⚠️ Periodic validation: Authentication lost');
          // Could emit event here if needed
        } else {
          console.log('✅ Periodic validation: Authentication valid');
        }
      } catch (error) {
        console.warn('⚠️ Periodic validation error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
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
}

let fiduAuthServiceInstance: FiduAuthService | null = null;

export const getFiduAuthService = (): FiduAuthService => {
  if (!fiduAuthServiceInstance) {
    fiduAuthServiceInstance = new FiduAuthService();
  }
  return fiduAuthServiceInstance;
};

// Legacy aliases to ease migration
export const getFiduTokenService = getFiduAuthService;
export const getFiduAuthCookieService = getFiduAuthService;
export { FiduAuthService as FiduAuthCookieService };


