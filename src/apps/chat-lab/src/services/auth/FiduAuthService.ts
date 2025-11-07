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
      return true;
    } catch (error) {
      console.error('❌ Error storing FIDU auth tokens:', error);
      return false;
    }
  }

  async getTokens(): Promise<FiduAuthTokens | null> {
    try {
      const response = await fetch(`${this.basePath}/api/auth/fidu/get-tokens?env=${this.environment}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to retrieve FIDU auth tokens:', response.status);
        return null;
      }

      const data: FiduAuthTokens = await response.json();

      if (data.access_token && data.access_token.trim() !== '') {
        this.cachedAccessToken = data.access_token;
      }

      if (typeof data.refresh_token === 'string') {
        this.cachedRefreshTokenAvailable = data.refresh_token.trim() !== '';
      }

      return data.access_token || data.refresh_token || data.user ? data : null;
    } catch (error) {
      console.warn('⚠️ Error retrieving FIDU auth tokens:', error);
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

  async getAccessToken(): Promise<string | null> {
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

      localStorage.setItem('auth_token', accessToken);
      if (typeof expiresIn === 'number') {
        localStorage.setItem('token_expires_in', String(expiresIn));
      }

      this.cachedAccessToken = accessToken;
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token_expires_in');
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


