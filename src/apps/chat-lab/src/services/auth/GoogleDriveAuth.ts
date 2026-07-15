/**
 * Google Drive Authentication Service
 * Handles OAuth 2.0 flow for Google Drive access
 */
import axios from 'axios';
import { type AxiosInstance, AxiosError } from 'axios';
import {
  getFiduAuthService,
  AuthenticationRequiredError,
  TokenAcquisitionTimeoutError,
  TokenRefreshError,
} from './FiduAuthService';
import {
  detectRuntimeEnvironment,
  getGoogleClientId,
  getGoogleRedirectUri,
} from '../../utils/environment';

// Custom error for insufficient OAuth scopes
export class InsufficientScopesError extends Error {
  public grantedScopes: string[];
  public requiredScopes: string[];

  constructor(
    message: string,
    grantedScopes: string[],
    requiredScopes: string[]
  ) {
    super(message);
    this.name = 'InsufficientScopesError';
    this.grantedScopes = grantedScopes;
    this.requiredScopes = requiredScopes;
  }
}

// Custom error for backend configuration issues (non-recoverable)
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Custom error for temporary service unavailable (may be recoverable with retry)
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export interface GoogleDriveAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  testHostName?: string;
}

export interface GoogleDriveTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
}

export interface GoogleDriveUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleDriveAuthService {
  private client: AxiosInstance;
  private config: GoogleDriveAuthConfig;
  private tokens: GoogleDriveTokens | null = null;
  private user: GoogleDriveUser | null = null;
  private refreshPromise: Promise<string> | null = null;
  private isAuthenticating: boolean = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private explicitlyDisconnected: boolean = false; // Flag to prevent restoration after explicit disconnect

  constructor(config: GoogleDriveAuthConfig) {
    let baseURL;
    if (config.testHostName && detectRuntimeEnvironment() === 'dev') {
      baseURL = config.testHostName;
    } else {
      baseURL = window.location.pathname.includes('/fidu-chat-lab')
        ? '/fidu-chat-lab'
        : '';
    }
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
    this.setUpInterceptors();
    this.config = config;
    this.loadStoredTokens();
    this.loadUserInfo();
  }

  private setUpInterceptors(): void {
    const authInterceptor = getFiduAuthService().createAuthInterceptor();

    // Request interceptor
    this.client.interceptors.request.use(authInterceptor.request);

    // Response interceptor
    this.client.interceptors.response.use(
      authInterceptor.response,
      authInterceptor.error
    );

    // Return response for non-auth errors to allow the individual methods to handle them
    // If there is something all methods should do, it should be added here.
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error instanceof AxiosError && error.response) {
          return error.response;
        }
        throw error;
      }
    );
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    // Check if we're on the OAuth callback page - if so, skip initialization
    // The OAuth callback page will handle the callback processing directly
    if (window.location.pathname.includes('/oauth-callback')) {
      console.log(
        '🔄 On OAuth callback page, skipping initialization to avoid conflicts'
      );
      return;
    }

    // Check if we're returning from OAuth callback (but not on callback page)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (code) {
      await this.handleOAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Primary approach: restore Google refresh token from identity service vault
    console.log(
      '🔄 Attempting primary authentication restoration from identity service vault...'
    );
    const restored = await this.restoreFromVault();

    if (restored) {
      console.log(
        '✅ Successfully restored authentication from identity service vault'
      );
      // Ensure user info is loaded (will update Google email if FIDU auth is ready)
      if (!this.user) {
        await this.getUser();
      }
      // Start proactive refresh and periodic validation after successful restoration
      this.startProactiveRefresh();
      this.startPeriodicValidation();
      return;
    }

    // Fallback: If we have tokens in memory (from previous session), validate them
    if (this.tokens && this.tokens.refreshToken) {
      console.log(
        '🔄 Cookie restoration failed, validating existing tokens...'
      );
      const now = Date.now();
      const fiveMinutesFromNow = now + 5 * 60 * 1000;

      // Proactively refresh tokens that are close to expiring
      if (this.tokens.expiresAt <= fiveMinutesFromNow) {
        try {
          console.log('Token expires soon, refreshing automatically');
          await this.refreshAccessToken();
          // After successful refresh, start proactive refresh and periodic validation
          this.startProactiveRefresh();
          this.startPeriodicValidation();
        } catch (error) {
          console.warn('Failed to refresh token during initialization:', error);
          // Check if this is a refresh token expiration issue
          if (
            error instanceof Error
            && error.message.includes('invalid_grant')
          ) {
            console.error(
              'Refresh token has expired or been revoked. User needs to re-authenticate.'
            );
            this.clearStoredTokens();
            this.tokens = null;
            this.user = null;
          }
          // Let the app handle the unauthenticated state
        }
      } else {
        // Even if token is valid, verify it's still working by checking user info
        try {
          await this.validateToken();
          // If validation succeeds, ensure user info is loaded (will update Google email if FIDU auth is ready)
          if (!this.user) {
            await this.getUser();
          }
          // Start proactive refresh and periodic validation for valid tokens
          this.startProactiveRefresh();
          this.startPeriodicValidation();
        } catch (error) {
          console.warn('Token validation failed, attempting refresh:', error);
          try {
            await this.refreshAccessToken();
            // After successful refresh, load user info (will update Google email if FIDU auth is ready)
            if (!this.user) {
              await this.getUser();
            }
            // Start proactive refresh and periodic validation after successful refresh
            this.startProactiveRefresh();
            this.startPeriodicValidation();
          } catch (refreshError) {
            console.error(
              'Failed to refresh after validation failure:',
              refreshError
            );
            // Clear tokens if refresh fails
            this.clearStoredTokens();
            this.tokens = null;
            this.user = null;
          }
        }
      }
    } else {
      console.log(
        '❌ No authentication found in vault or memory - user needs to authenticate'
      );
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.tokens) {
      return false;
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const now = Date.now();
    const fiveMinutesFromNow = now + 5 * 60 * 1000;

    return this.tokens.expiresAt > fiveMinutesFromNow;
  }

  /**
   * Get current access token (refreshes if needed, restores if missing)
   */
  async getAccessToken(retry: boolean = true): Promise<string> {
    // If tokens missing, try to restore from identity service vault first
    if (!this.tokens) {
      console.log(
        '🔄 Tokens missing from memory, attempting to restore from identity service vault...'
      );
      const restored = await this.restoreFromVault();
      if (!restored || !this.tokens) {
        throw new Error(
          'User not authenticated. Please reconnect Google Drive.'
        );
      }
      // After restoration, tokens should be set, continue with normal flow
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const now = Date.now();
    const fiveMinutesFromNow = now + 5 * 60 * 1000;

    if (this.tokens.expiresAt <= fiveMinutesFromNow) {
      if (!this.tokens.refreshToken) {
        // Try one more time to restore from cookies
        console.log(
          '🔄 Refresh token missing, attempting vault restoration...'
        );
        const restored = await this.restoreFromVault();
        if (!restored || !this.tokens) {
          throw new Error(
            'Token expired and no refresh token available. Please reconnect Google Drive.'
          );
        }
        // After restoration, check again
        if (this.tokens.expiresAt <= fiveMinutesFromNow) {
          // Still need to refresh
          this.tokens.accessToken = await this.refreshAccessToken();
        }
      } else {
        // Refresh token
        try {
          this.tokens.accessToken = await this.refreshAccessToken();
        } catch (error) {
          if (
            error instanceof AuthenticationRequiredError
            || error instanceof TokenRefreshError
            || error instanceof ServiceUnavailableError
          ) {
            throw error;
          }
          // If refresh fails, try to restore from cookies as fallback
          console.warn(
            '⚠️ Token refresh failed, attempting vault restoration as fallback:',
            error
          );
          const restored = await this.restoreFromVault();
          if (!restored || !retry) {
            throw new Error(
              'Failed to refresh token. Please reconnect Google Drive.'
            );
          }
          // After restoration, retry getting access token
          return this.getAccessToken(false);
        }
      }
    }

    // Final check before returning
    if (!this.tokens) {
      throw new Error('Tokens not available. Please reconnect Google Drive.');
    }

    return this.tokens.accessToken;
  }

  /**
   * Get the OAuth client ID (needed for Google Picker appId)
   */
  getClientId(): string {
    return this.config.clientId;
  }

  /**
   * Force re-authentication with Google Drive (useful for refreshing tokens)
   */
  async reAuthenticate(): Promise<void> {
    console.log('🔄 Forcing re-authentication with Google Drive...');
    await this.authenticate(true);
  }

  /**
   * Start OAuth flow
   */
  async authenticate(forceReauth: boolean = false): Promise<void> {
    // Prevent multiple simultaneous OAuth flows
    if (this.isAuthenticating) {
      console.log('🔄 OAuth flow already in progress, skipping...');
      return;
    }

    this.isAuthenticating = true;
    try {
      const fiduAuthService = getFiduAuthService();
      try {
        // Don't show the user the Google OAuth flow if we won't be able to do anything with it
        await fiduAuthService.ensureAccessToken({
          onWait: () =>
            console.log(
              '🔐 Ensuring FIDU session before starting Google OAuth flow...'
            ),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          await fiduAuthService.clearTokens();
          try {
            const [{ store }, { logout }] = await Promise.all([
              import('../../store'),
              import('../../store/slices/authSlice'),
            ]);
            store.dispatch(logout());
          } catch (dispatchError) {
            console.warn(
              'Failed to dispatch logout after auth loss:',
              dispatchError
            );
          }
          throw new Error(
            'FIDU authentication required before connecting Google Drive. Please log in again.'
          );
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          throw new Error(
            'Timed out while preparing authentication. Please try again.'
          );
        }
        throw error;
      }

      // Check if we need to force consent (when we don't have a refresh token)
      const needsRefreshToken =
        forceReauth || !(await this.hasStoredRefreshToken());

      if (needsRefreshToken) {
        console.log(
          '🔄 No refresh token found, using consent prompt to ensure we get one'
        );
      } else {
        console.log(
          '🔄 Refresh token exists, using select_account for better UX'
        );
      }

      // Generate authorization URL with smart prompt selection
      const authUrl = this.buildAuthUrl(needsRefreshToken);
      console.log('🔄 Starting OAuth flow, redirecting to:', authUrl);

      window.location.href = authUrl;
    } catch (error) {
      this.isAuthenticating = false;
      throw error;
    }
  }

  /**
   * Process OAuth callback specifically for the callback page
   */
  async processOAuthCallback(): Promise<void> {
    console.log('🔄 Processing OAuth callback for callback page...');

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code found in callback URL');
    }

    await this.handleOAuthCallback(code);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  /**
   * Validate that the current access token is still valid
   * by making a lightweight API call
   */
  private async validateToken(): Promise<void> {
    const accessToken = this.tokens?.accessToken;
    if (!accessToken) {
      throw new Error('No access token available for validation');
    }

    // Make a lightweight call to verify token is still valid
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Token validation failed: ${response.status}`);
    }
  }

  /**
   * Get user information
   */
  async getUser(): Promise<GoogleDriveUser> {
    if (!this.user) {
      await this.fetchUserInfo();
    }
    return this.user!;
  }

  /**
   * Get cached user information without fetching (synchronous)
   */
  getCachedUser(): GoogleDriveUser | null {
    return this.user;
  }

  /**
   * Revoke access and clear tokens
   */
  async revokeAccess(): Promise<void> {
    if (this.tokens?.accessToken) {
      try {
        await this.revokeToken(this.tokens.accessToken);
      } catch (error) {
        console.warn('Failed to revoke token:', error);
      }
    }

    this.tokens = null;
    this.user = null;
    this.clearStoredTokens();
  }

  /**
   * Disconnect Google Drive (revoke only Google Drive tokens, leave FIDU auth intact)
   * This is a safer alternative to revokeAccess() that explicitly only handles Google Drive tokens
   * and does not trigger any logout flows that might affect FIDU authentication.
   */
  async disconnectGoogleDrive(): Promise<void> {
    console.log(
      '🔄 Disconnecting Google Drive (preserving FIDU authentication)...'
    );

    // Set flag to prevent restoration attempts
    this.explicitlyDisconnected = true;

    // Stop proactive refresh and periodic validation
    this.stopProactiveRefresh();
    this.stopPeriodicValidation();

    // Revoke Google OAuth token if we have one
    if (this.tokens?.accessToken) {
      try {
        await this.revokeToken(this.tokens.accessToken);
        console.log('✅ Google OAuth token revoked');
      } catch (error) {
        console.warn(
          '⚠️ Failed to revoke Google token (continuing anyway):',
          error
        );
        // Continue even if revocation fails - we'll still clear local state
      }
    }

    // Clear Google Drive tokens from memory
    this.tokens = null;
    this.user = null;

    // Clear Google Drive tokens from localStorage (only Google Drive tokens)
    this.clearStoredTokens();

    // Clear HTTP-only Google Drive cookies via backend (legacy cleanup only)
    const basePath = window.location.pathname.includes('/fidu-chat-lab')
      ? '/fidu-chat-lab'
      : '';
    const environment = detectRuntimeEnvironment();

    try {
      const { identityServiceAPIClient } =
        await import('../api/apiClientIdentityService');
      await identityServiceAPIClient.disconnectGoogleIntegration();
      console.log(
        '✅ Google Drive integration removed from identity service vault'
      );
    } catch (error) {
      console.warn(
        '⚠️ Failed to disconnect Google Drive from identity service (continuing anyway):',
        error
      );
    }

    try {
      await fetch(`${basePath}/api/oauth/logout?env=${environment}`, {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookies
      });
      console.log('✅ Legacy Google Drive HTTP-only cookies cleared');
    } catch (error) {
      console.warn(
        '⚠️ Failed to clear legacy Google Drive HTTP-only cookies (continuing anyway):',
        error
      );
      // Continue even if cookie clearing fails
    }

    console.log('✅ Google Drive disconnected (FIDU authentication preserved)');
  }

  /**
   * Get authentication status for UI
   */
  getAuthStatus(): {
    isAuthenticated: boolean;
    user: GoogleDriveUser | null;
    expiresAt: number | null;
  } {
    return {
      isAuthenticated: this.isAuthenticated(), // Keep sync for immediate UI updates
      user: this.user,
      expiresAt: this.tokens?.expiresAt || null,
    };
  }

  /**
   * Ensure user is authenticated, attempting restoration if needed
   * This is an async version of isAuthenticated() that attempts restoration
   * Use this when you need to guarantee authentication state
   */
  async ensureAuthenticated(): Promise<boolean> {
    // If explicitly disconnected, don't attempt restoration
    if (this.explicitlyDisconnected) {
      console.log(
        'ℹ️ Google Drive was explicitly disconnected, skipping restoration'
      );
      return false;
    }

    // Fast path: if tokens exist and valid, return immediately
    if (this.tokens && this.tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
      return true;
    }

    // Slow path: try to restore from identity service vault
    if (!this.tokens || this.tokens.expiresAt <= Date.now() + 5 * 60 * 1000) {
      try {
        console.log('🔄 Authentication not valid, attempting restoration...');
        const restored = await this.restoreFromVault();
        if (restored) {
          console.log('✅ Authentication restored successfully');
          return true;
        }
        console.log('❌ Could not restore authentication');
        return false;
      } catch (error) {
        console.warn('⚠️ Failed to restore authentication:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get granted OAuth scopes
   * First tries to get from stored tokens, then falls back to Token Info API
   */
  async getGrantedScopes(): Promise<string[]> {
    // First, try to get from stored tokens
    if (this.tokens?.scope) {
      const scopes = this.tokens.scope.split(' ').filter(s => s.length > 0);
      if (scopes.length > 0) {
        return scopes;
      }
    }

    // If no scope in tokens, verify via Token Info API
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='
          + encodeURIComponent(accessToken)
      );

      if (response.ok) {
        const data = await response.json();
        if (data.scope) {
          const scopes = data.scope
            .split(' ')
            .filter((s: string) => s.length > 0);
          // Update stored tokens with scope for future use
          if (this.tokens) {
            this.tokens.scope = data.scope;
            this.storeTokens(this.tokens);
          }
          return scopes;
        }
      }
    } catch (error) {
      console.warn('Failed to verify scopes via Token Info API:', error);
    }

    return [];
  }

  /**
   * Check if a specific scope is granted
   */
  async hasScope(scope: string): Promise<boolean> {
    const grantedScopes = await this.getGrantedScopes();
    return grantedScopes.includes(scope);
  }

  /**
   * Check if drive.file scope is granted (required for shared workspaces)
   */
  async hasDriveFileScope(): Promise<boolean> {
    return await this.hasScope('https://www.googleapis.com/auth/drive.file');
  }

  /**
   * Request additional scopes (triggers re-authentication with new scopes)
   */
  async requestAdditionalScopes(additionalScopes: string[]): Promise<void> {
    const currentScopes = this.config.scopes;
    const newScopes = [...new Set([...currentScopes, ...additionalScopes])];

    // Update config with new scopes
    this.config.scopes = newScopes;

    // Force re-authentication to get new scopes
    await this.authenticate(true);
  }

  // Private methods

  private buildAuthUrl(forceConsent: boolean = false): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      // Smart prompt selection:
      // - 'consent': Forces consent screen and ensures refresh token (use when we need one)
      // - 'select_account': Better UX, uses existing consent (use when we have refresh token)
      prompt: forceConsent ? 'consent' : 'select_account',
      state: this.generateState(),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private generateState(): string {
    // Check if we already have a state parameter stored
    const existingState = sessionStorage.getItem('google_oauth_state');
    if (existingState) {
      console.log('🔄 Reusing existing OAuth state:', existingState);
      return existingState;
    }

    const state = crypto.randomUUID();
    sessionStorage.setItem('google_oauth_state', state);
    console.log('🔄 Generated new OAuth state:', state);
    return state;
  }

  private async handleOAuthCallback(code: string): Promise<void> {
    console.log('🔄 Starting OAuth callback handling...');

    try {
      // Verify state parameter
      const urlParams = new URLSearchParams(window.location.search);
      const state = urlParams.get('state');
      const storedState = sessionStorage.getItem('google_oauth_state');

      console.log('🔍 State validation:', {
        receivedState: state,
        storedState: storedState,
        statesMatch: state === storedState,
      });

      if (!state || !storedState) {
        console.error('❌ Missing state parameter or stored state');
        throw new Error('Invalid state parameter - missing state');
      }

      if (state !== storedState) {
        console.error('❌ State parameter mismatch');
        throw new Error('Invalid state parameter - mismatch');
      }

      // Only clear state after successful validation
      sessionStorage.removeItem('google_oauth_state');
      console.log('✅ State parameter validated successfully');

      // Exchange code for tokens
      console.log('🔄 Exchanging code for tokens...');
      const { tokens, refreshTokenFromExchange, storedInVault } =
        await this.exchangeCodeForTokens(code);
      console.log('✅ Token exchange successful', {
        hasRefreshTokenFromExchange: !!refreshTokenFromExchange,
        storedInVault,
      });

      let refreshToken = refreshTokenFromExchange;
      if (!refreshToken) {
        const { identityServiceAPIClient } =
          await import('../api/apiClientIdentityService');
        refreshToken =
          (await identityServiceAPIClient.getGoogleRefreshToken()) ?? undefined;
      }

      if (!refreshToken) {
        throw new Error(
          'Google did not return a refresh token. Please reconnect and accept all permissions.'
        );
      }

      tokens.refreshToken = refreshToken;
      this.tokens = tokens;
      this.storeTokens(tokens);

      // Reset explicitly disconnected flag since user has successfully reconnected
      this.explicitlyDisconnected = false;

      console.log('🔄 Fetching Google account profile...');
      const googleUser = await this.fetchGoogleUserProfile(tokens.accessToken);
      this.user = googleUser;
      this.storeUserInfo(googleUser);

      console.log(
        '🔄 Storing Google refresh token in identity service vault...'
      );
      await this.storeRefreshTokenInVault(
        refreshToken,
        googleUser.email,
        tokens.scope,
        { required: true }
      );

      const { identityServiceAPIClient } =
        await import('../api/apiClientIdentityService');
      const persistedToken =
        await identityServiceAPIClient.getGoogleRefreshToken();
      if (!persistedToken) {
        throw new Error(
          'Google Drive connection could not be saved to your account. Please try connecting again.'
        );
      }
      console.log('✅ Verified Google refresh token in identity service vault');

      // Start proactive refresh and periodic validation after successful OAuth
      this.startProactiveRefresh();
      this.startPeriodicValidation();

      console.log('✅ OAuth callback completed successfully');
    } catch (error) {
      console.error('❌ OAuth callback failed:', error);
      throw error;
    } finally {
      // Always reset authentication flag
      this.isAuthenticating = false;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    tokens: GoogleDriveTokens;
    refreshTokenFromExchange?: string;
    storedInVault: boolean;
  }> {
    // Use backend endpoint for secure token exchange
    try {
      await getFiduAuthService().ensureAccessToken({
        onWait: () =>
          console.log('🔐 Ensuring FIDU auth before exchanging OAuth code...'),
      });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw new Error(
          'FIDU authentication expired before completing Google Drive setup. Please log in again.'
        );
      }
      if (error instanceof TokenAcquisitionTimeoutError) {
        throw new Error(
          'Timed out while preparing FIDU authentication for Google Drive. Please try again.'
        );
      }
      throw error;
    }

    const response = await this.client.post('/api/oauth/exchange-code', {
      code: code,
      redirect_uri: this.config.redirectUri,
      environment: detectRuntimeEnvironment(),
    });

    if (response.status === 200) {
      const data =
        typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data;

      const refreshTokenFromExchange =
        typeof data.refresh_token === 'string'
        && data.refresh_token.trim() !== ''
          ? data.refresh_token
          : undefined;
      const storedInVault = data.stored_in_vault === true;

      console.log('🔍 OAuth exchange response:', {
        hasRefreshToken: !!refreshTokenFromExchange,
        storedInVault,
        hasProviderEmail: !!data.provider_email,
      });

      const tokens: GoogleDriveTokens = {
        accessToken: data.access_token,
        refreshToken: refreshTokenFromExchange,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      };

      if (!refreshTokenFromExchange && !storedInVault) {
        console.warn(
          '⚠️ No refresh token returned from OAuth exchange - user may need to re-authorize with consent'
        );
      }

      // Validate that we received the required scopes
      this.validateScopes(tokens.scope);

      console.log('✅ Token exchange via backend (secure)');
      return { tokens, refreshTokenFromExchange, storedInVault };
    }

    // Backend returned error (400/500)  don't fall back, this is a backend issue
    if (response.status >= 400) {
      const errorText = response.data?.message || 'Unknown error';
      throw new Error(`Backend OAuth error (${response.status}): ${errorText}`);
    }

    // Shouldn't reach here
    throw new Error('Unexpected state in token exchange');
  }

  /**
   * Validate that all required scopes were granted
   */
  private validateScopes(grantedScopeString: string): void {
    console.log('🔍 Validating granted scopes...');
    console.log('Granted scopes string:', grantedScopeString);

    const grantedScopes = grantedScopeString.split(' ');
    const requiredScopes = this.config.scopes;

    console.log('Granted scopes array:', grantedScopes);
    console.log('Required scopes array:', requiredScopes);

    const missingScopes = requiredScopes.filter(
      required => !grantedScopes.includes(required)
    );

    if (missingScopes.length > 0) {
      console.error('❌ Missing required scopes:', missingScopes);
      console.error('Granted scopes:', grantedScopes);
      console.error('Required scopes:', requiredScopes);

      throw new InsufficientScopesError(
        'User did not grant all required permissions. Please check all permission checkboxes when authorizing the app.',
        grantedScopes,
        requiredScopes
      );
    }

    console.log('✅ All required scopes are present');
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken;
    } catch (error) {
      // If refresh fails, clear tokens and throw
      console.error('Token refresh failed:', error);
      this.tokens = null;
      this.clearStoredTokens();
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    // Detect environment for cookie isolation using shared utility
    const environment = detectRuntimeEnvironment();

    const fiduTokenService = getFiduAuthService();

    try {
      await fiduTokenService.ensureAccessToken({
        onWait: () =>
          console.log('🔐 Ensuring FIDU auth before Google token refresh...'),
      });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw new Error(
          'FIDU authentication expired before refreshing Google Drive tokens. Please log in again.'
        );
      }
      if (error instanceof TokenAcquisitionTimeoutError) {
        throw new Error(
          'Timed out while preparing FIDU auth for Google Drive token refresh. Please try again.'
        );
      }
      throw error;
    }

    const response = await this.client.post(
      `/api/oauth/refresh-token?env=${environment}`,
      {
        refresh_token: this.tokens!.refreshToken,
      }
    );

    if (response.status === 200) {
      const data = response.data;

      // Update tokens
      this.tokens!.accessToken = data.access_token;
      this.tokens!.expiresAt = Date.now() + data.expires_in * 1000;

      // Update scope if provided (may not always be included in refresh response)
      if (data.scope) {
        this.tokens!.scope = data.scope;
      }

      if (data.refresh_token) {
        this.tokens!.refreshToken = data.refresh_token;
        await this.storeRefreshTokenInVault(
          data.refresh_token,
          this.user?.email,
          this.tokens!.scope
        );
      }

      // Store updated tokens
      this.storeTokens(this.tokens!);

      // Start proactive refresh after successful refresh
      this.startProactiveRefresh();

      console.log('✅ Token refresh via backend (secure)');
      return data.access_token;
    }

    // Backend returned error (400/500) - check error type
    if (response.status >= 400) {
      const errorData = response.data;
      const errorMessage =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || errorData?.error || 'Unknown error';

      // Handle 503 Service Unavailable errors
      if (response.status === 503) {
        // Check if it's a configuration error (non-recoverable)
        if (
          errorMessage.includes('not configured')
          || errorMessage.includes('OAuth not configured')
        ) {
          console.error(
            '❌ Backend OAuth not configured. Cannot refresh token.'
          );
          // Don't clear tokens - this is a backend configuration issue, not an auth issue
          // Throw a specific error that can be caught upstream
          throw new ConfigurationError(
            'Backend OAuth not configured. Please contact support.'
          );
        }

        // Generic 503 - might be temporary, allow retry
        console.warn(
          '⚠️ Backend service unavailable (503). This may be temporary.'
        );
        throw new ServiceUnavailableError(
          `Backend service unavailable: ${errorMessage}`
        );
      }

      // Other 4xx/5xx errors - don't fall back to direct OAuth
      throw new Error(
        `Backend token refresh error (${response.status}): ${errorMessage}`
      );
    }

    // Shouldn't reach here
    throw new Error('Unexpected state in token refresh');
  }

  private async fetchGoogleUserProfile(
    accessToken: string
  ): Promise<GoogleDriveUser> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Google account profile');
    }

    const userData = await response.json();
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
    };
  }

  private async fetchUserInfo(): Promise<void> {
    const accessToken = await this.getAccessToken();

    const user = await this.fetchGoogleUserProfile(accessToken);
    this.user = user;

    // Persist user info to localStorage
    this.storeUserInfo(this.user);
  }

  /**
   * Store Google refresh token in the identity service provider token vault.
   */
  private async storeRefreshTokenInVault(
    refreshToken: string,
    providerEmail?: string,
    scopes?: string,
    options: { required?: boolean } = {}
  ): Promise<void> {
    const { required = false } = options;

    if (!refreshToken?.trim()) {
      if (required) {
        throw new Error('Missing Google refresh token for vault storage');
      }
      return;
    }

    const fiduAuthService = getFiduAuthService();

    try {
      await fiduAuthService.ensureAccessToken({
        onWait: () =>
          console.log(
            '🔐 Ensuring FIDU auth before storing Google refresh token in vault...'
          ),
      });
    } catch (error) {
      if (required) {
        if (error instanceof AuthenticationRequiredError) {
          throw new Error(
            'FIDU authentication required before storing Google Drive connection. Please log in again.'
          );
        }
        throw error;
      }

      console.log(
        'ℹ️ FIDU authentication not ready - skipping Google vault store'
      );
      return;
    }

    const accessTokenForStore = fiduAuthService.getMemoryAccessToken();
    if (!accessTokenForStore?.trim()) {
      const message =
        'FIDU access token unavailable while saving Google Drive connection';
      if (required) {
        throw new Error(message);
      }
      console.warn(`⚠️ ${message}`);
      return;
    }

    const { identityServiceAPIClient } =
      await import('../api/apiClientIdentityService');

    const email = providerEmail || this.user?.email;
    if (!email) {
      const message =
        'Cannot store Google refresh token in vault without provider email';
      if (required) {
        throw new Error(message);
      }
      console.warn(`⚠️ ${message}`);
      return;
    }

    try {
      await identityServiceAPIClient.storeGoogleIntegration({
        refresh_token: refreshToken,
        provider_email: email,
        scopes: scopes || this.config.scopes.join(' '),
      });
      console.log('✅ Google refresh token stored in identity service vault');
    } catch (error: any) {
      if (required) {
        const message =
          error?.response?.data?.message
          || error?.response?.data?.error
          || error?.message
          || 'Failed to store Google refresh token in identity service vault';
        throw new Error(message);
      }

      console.warn(
        '⚠️ Failed to store Google refresh token in identity service vault:',
        error
      );
    }
  }

  private storeUserInfo(user: GoogleDriveUser): void {
    try {
      localStorage.setItem('google_drive_user', JSON.stringify(user));
      console.log('Stored Google Drive user info to localStorage');
    } catch (error) {
      console.warn('Failed to store user info:', error);
    }
  }

  private loadUserInfo(): void {
    try {
      const stored = localStorage.getItem('google_drive_user');
      if (stored) {
        this.user = JSON.parse(stored);
        console.log('Loaded Google Drive user info from localStorage');
      }
    } catch (error) {
      console.warn('Failed to load user info:', error);
      this.user = null;
    }
  }

  private async revokeToken(token: string): Promise<void> {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${token}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to revoke token');
    }
  }

  private loadStoredTokens(): void {
    try {
      // Primary method: Check for HTTP-only cookies by attempting token restoration
      // This is more secure and persistent than localStorage
      console.log('🔄 Checking for authentication via HTTP-only cookies...');

      // We'll attempt cookie restoration during initialization
      // For now, just clear any stale localStorage tokens
      const stored = localStorage.getItem('google_drive_tokens');
      if (stored) {
        console.log(
          '🔄 Clearing stale localStorage tokens in favor of HTTP-only cookies'
        );
        localStorage.removeItem('google_drive_tokens');
        localStorage.removeItem('google_drive_user');
      }
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
      this.clearStoredTokens();
    }
  }

  /**
   * Check if we have a stored refresh token in the identity service vault
   */
  private async hasStoredRefreshToken(): Promise<boolean> {
    try {
      const { identityServiceAPIClient } =
        await import('../api/apiClientIdentityService');
      const refreshToken =
        await identityServiceAPIClient.getGoogleRefreshToken();
      return !!refreshToken;
    } catch (error) {
      console.warn('Error checking for stored Google refresh token:', error);
      return false;
    }
  }

  /**
   * Load Google Drive refresh token from the identity service vault
   */
  private async loadTokensFromVault(): Promise<GoogleDriveTokens | null> {
    try {
      const fiduTokenService = getFiduAuthService();

      try {
        await fiduTokenService.ensureAccessToken({
          onWait: () =>
            console.log(
              '🔐 Ensuring FIDU auth before retrieving Google Drive tokens...'
            ),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          console.warn(
            '⚠️ [GoogleDrive] FIDU authentication required before restoring Google Drive tokens.'
          );
          return null;
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          console.warn(
            '⚠️ [GoogleDrive] Timed out while preparing FIDU authentication for Google Drive token retrieval.'
          );
          return null;
        }
        throw error;
      }

      const { identityServiceAPIClient } =
        await import('../api/apiClientIdentityService');
      const refreshToken =
        await identityServiceAPIClient.getGoogleRefreshToken();

      if (refreshToken) {
        console.log(
          '✅ Google Drive refresh token retrieved from identity service vault'
        );

        return {
          accessToken: '',
          refreshToken,
          expiresAt: 0,
          scope: '',
        };
      }

      console.log('ℹ️ No Google Drive tokens found in identity service vault');
      return null;
    } catch (error) {
      console.warn(
        '⚠️ Error retrieving Google Drive tokens from identity service vault:',
        error
      );
      return null;
    }
  }

  /**
   * Attempt to restore authentication from the identity service vault
   */
  async restoreFromVault(): Promise<boolean> {
    if (this.explicitlyDisconnected) {
      console.log(
        'ℹ️ Google Drive was explicitly disconnected, skipping vault restoration'
      );
      return false;
    }

    try {
      console.log(
        '🔄 Attempting to restore authentication from identity service vault...'
      );

      const tokensFromVault = await this.loadTokensFromVault();

      if (!tokensFromVault) {
        console.log(
          '❌ No Google Drive tokens found in identity service vault'
        );
        return false;
      }

      this.tokens = tokensFromVault;

      const newAccessToken = await this.refreshAccessToken();

      if (newAccessToken) {
        this.explicitlyDisconnected = false;

        if (!this.user) {
          await this.fetchUserInfo();
        }

        this.startProactiveRefresh();

        return true;
      }

      return false;
    } catch (error) {
      console.log('❌ Failed to restore from identity service vault:', error);
      return false;
    }
  }

  /** @deprecated Use restoreFromVault */
  async restoreFromCookies(): Promise<boolean> {
    return this.restoreFromVault();
  }

  /**
   * Check if we're currently online and can make network requests
   */
  private isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Enhanced restoration that handles network state
   */
  async restoreFromVaultWithRetry(maxRetries: number = 3): Promise<boolean> {
    if (!this.isOnline()) {
      console.log('🔄 Offline - skipping vault restoration');
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Vault restoration attempt ${attempt}/${maxRetries}`);
        const success = await this.restoreFromVault();

        if (success) {
          return true;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        // Check if this is a non-retryable error (configuration issue)
        if (error instanceof ConfigurationError) {
          console.error(
            '❌ Configuration error - cannot retry:',
            error.message
          );
          return false;
        }

        // Check if this is a service unavailable error that might be temporary
        if (error instanceof ServiceUnavailableError && attempt < maxRetries) {
          console.warn(
            `⚠️ Service unavailable (attempt ${attempt}/${maxRetries}):`,
            error.message
          );
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.warn(`❌ Vault restoration attempt ${attempt} failed:`, error);

        // If this is the last attempt or a non-retryable error, fail
        if (attempt === maxRetries || error instanceof ConfigurationError) {
          console.error('❌ All vault restoration attempts failed');
          return false;
        }

        // Wait before next retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return false;
  }

  /** @deprecated Use restoreFromVaultWithRetry */
  async restoreFromCookiesWithRetry(maxRetries: number = 3): Promise<boolean> {
    return this.restoreFromVaultWithRetry(maxRetries);
  }

  private storeTokens(tokens: GoogleDriveTokens): void {
    try {
      // Validate token structure before storing
      if (!tokens.accessToken || typeof tokens.expiresAt !== 'number') {
        console.error('Invalid token structure, not storing');
        return;
      }

      // Only store access token in localStorage for immediate use (not refresh token)
      const tokenData = {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      };

      localStorage.setItem('google_drive_tokens', JSON.stringify(tokenData));
      console.log(
        '✅ Stored Google Drive access token in localStorage (refresh token in identity service vault)'
      );
    } catch (error) {
      console.warn('Failed to store tokens:', error);
      // If localStorage is full or blocked, we'll need to handle this gracefully
      // Log the error
    }
  }

  private clearStoredTokens(): void {
    localStorage.removeItem('google_drive_tokens');
    localStorage.removeItem('google_drive_user');
  }

  /**
   * Start proactive token refresh timer
   * Refreshes tokens 10 minutes before expiration
   */
  private startProactiveRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.tokens || !this.tokens.refreshToken) {
      // No tokens to refresh
      return;
    }

    // Calculate time until refresh (refresh when 10 minutes left)
    const now = Date.now();
    const expiresAt = this.tokens.expiresAt;
    const refreshAt = expiresAt - 10 * 60 * 1000; // 10 minutes before expiry
    const timeUntilRefresh = refreshAt - now;

    if (timeUntilRefresh <= 0) {
      // Refresh immediately
      console.log('🔄 Token expires soon, refreshing immediately...');
      this.refreshAccessToken()
        .then(() => {
          console.log('✅ Token refreshed proactively');
          this.startProactiveRefresh(); // Schedule next refresh
        })
        .catch(error => {
          console.error('❌ Proactive token refresh failed:', error);
          // Retry after shorter interval on failure (5 minutes)
          this.refreshTimer = setTimeout(
            () => {
              this.startProactiveRefresh();
            },
            5 * 60 * 1000
          );
        });
      return;
    }

    // Schedule refresh
    console.log(
      `🔄 Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`
    );
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken()
        .then(() => {
          console.log('✅ Token refreshed proactively');
          this.startProactiveRefresh(); // Schedule next refresh
        })
        .catch(error => {
          console.error('❌ Proactive token refresh failed:', error);
          // Retry after shorter interval on failure (5 minutes)
          setTimeout(
            () => {
              this.startProactiveRefresh();
            },
            5 * 60 * 1000
          );
        });
    }, timeUntilRefresh);
  }

  /**
   * Stop proactive refresh timer
   */
  private stopProactiveRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Start periodic token validation
   * Checks every 5 minutes and refreshes if needed
   */
  private startPeriodicValidation(): void {
    // Clear existing interval
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    // Check every 5 minutes
    this.validationInterval = setInterval(
      async () => {
        try {
          if (!this.tokens) {
            // Try to restore
            console.log(
              '🔄 Periodic check: tokens missing, attempting restoration...'
            );
            const restored = await this.restoreFromVault();
            if (restored) {
              console.log('✅ Periodic check: tokens restored');
              this.startProactiveRefresh(); // Start proactive refresh after restoration
            }
            return;
          }

          // If token expires in less than 10 minutes, refresh proactively
          const now = Date.now();
          const tenMinutesFromNow = now + 10 * 60 * 1000;

          if (this.tokens.expiresAt <= tenMinutesFromNow) {
            console.log('🔄 Periodic check: token expires soon, refreshing...');
            try {
              await this.refreshAccessToken();
              console.log('✅ Periodic check: token refreshed');
            } catch (error) {
              console.warn(
                '⚠️ Periodic check: token refresh failed, attempting restoration:',
                error
              );
              // Try to restore from identity service vault
              await this.restoreFromVault();
            }
          }
        } catch (error) {
          console.error('❌ Periodic validation error:', error);
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  /**
   * Stop periodic validation
   */
  private stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  /**
   * Logout from Google Drive by clearing tokens and vault integration
   */
  async logout(): Promise<void> {
    try {
      console.log('🔄 Logging out from Google Drive...');

      this.stopProactiveRefresh();
      this.stopPeriodicValidation();

      this.clearStoredTokens();
      this.tokens = null;
      this.user = null;

      try {
        const { identityServiceAPIClient } =
          await import('../api/apiClientIdentityService');
        await identityServiceAPIClient.disconnectGoogleIntegration();
        console.log(
          '✅ Google Drive integration removed from identity service vault'
        );
      } catch (error) {
        console.warn(
          'Failed to disconnect Google Drive from identity service:',
          error
        );
      }

      const basePath = window.location.pathname.includes('/fidu-chat-lab')
        ? '/fidu-chat-lab'
        : '';
      const environment = detectRuntimeEnvironment();

      try {
        await fetch(`${basePath}/api/oauth/logout?env=${environment}`, {
          method: 'POST',
          credentials: 'include',
        });
        console.log('✅ Legacy Google Drive cookies cleared via backend');
      } catch (error) {
        console.warn('Failed to clear legacy Google Drive cookies:', error);
      }

      console.log('✅ Google Drive logout completed');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let authServiceInstance: GoogleDriveAuthService | null = null;

/**
 * Fetch Google Client ID from backend configuration
 */
async function fetchGoogleClientId(): Promise<string> {
  try {
    const basePath = window.location.pathname.includes('/fidu-chat-lab')
      ? '/fidu-chat-lab'
      : '';
    const response = await fetch(`${basePath}/api/config`);

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }

    const data = await response.json();
    if (!data.googleClientId) {
      throw new Error('Google Client ID not in config response');
    }

    console.log('✅ Google Client ID fetched from backend');
    return data.googleClientId;
  } catch (error) {
    console.warn(
      'Failed to fetch Google Client ID from backend, falling back to env:',
      error
    );

    // Fall back to environment variable
    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error(
        'Google Client ID not configured in backend or environment variables'
      );
    }
    return clientId;
  }
}

export async function getGoogleDriveAuthService(
  testHostName?: string
): Promise<GoogleDriveAuthService> {
  if (!authServiceInstance) {
    // Fetch client ID from backend (which may come from OpenBao)
    const clientId = await fetchGoogleClientId();

    const config: GoogleDriveAuthConfig = {
      clientId,
      redirectUri:
        getGoogleRedirectUri()
        || `${window.location.origin}/fidu-chat-lab/oauth-callback`,
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.file', // Required for shared workspaces
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      testHostName,
    };

    authServiceInstance = new GoogleDriveAuthService(config);
  }

  return authServiceInstance;
}
