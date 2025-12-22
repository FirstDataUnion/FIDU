/**
 * Google Drive Authentication Service
 * Handles OAuth 2.0 flow for Google Drive access
 */

import {
  getFiduAuthService,
  AuthenticationRequiredError,
  TokenAcquisitionTimeoutError,
} from './FiduAuthService';
import { detectRuntimeEnvironment } from '../../utils/environment';

// Custom error for insufficient OAuth scopes
export class InsufficientScopesError extends Error {
  public grantedScopes: string[];
  public requiredScopes: string[];
  
  constructor(message: string, grantedScopes: string[], requiredScopes: string[]) {
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
  private config: GoogleDriveAuthConfig;
  private tokens: GoogleDriveTokens | null = null;
  private user: GoogleDriveUser | null = null;
  private refreshPromise: Promise<string> | null = null;
  private isAuthenticating: boolean = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private validationInterval: NodeJS.Timeout | null = null;

  constructor(config: GoogleDriveAuthConfig) {
    this.config = config;
    this.loadStoredTokens();
    this.loadUserInfo();
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    // Check if we're on the OAuth callback page - if so, skip initialization
    // The OAuth callback page will handle the callback processing directly
    if (window.location.pathname.includes('/oauth-callback')) {
      console.log('🔄 On OAuth callback page, skipping initialization to avoid conflicts');
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

    // Primary approach: Always attempt to restore from HTTP-only cookies first
    // This is more secure and persistent than localStorage
    console.log('🔄 Attempting primary authentication restoration from HTTP-only cookies...');
    const restored = await this.restoreFromCookies();
    
    if (restored) {
      console.log('✅ Successfully restored authentication from HTTP-only cookies');
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
      console.log('🔄 Cookie restoration failed, validating existing tokens...');
      const now = Date.now();
      const fiveMinutesFromNow = now + (5 * 60 * 1000);
      
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
              if (error instanceof Error && error.message.includes('invalid_grant')) {
                console.error('Refresh token has expired or been revoked. User needs to re-authenticate.');
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
                console.error('Failed to refresh after validation failure:', refreshError);
                // Clear tokens if refresh fails
                this.clearStoredTokens();
                this.tokens = null;
                this.user = null;
              }
            }
          }
    } else {
      console.log('❌ No authentication found in cookies or memory - user needs to authenticate');
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
    const fiveMinutesFromNow = now + (5 * 60 * 1000);
    
    return this.tokens.expiresAt > fiveMinutesFromNow;
  }

  /**
   * Get current access token (refreshes if needed, restores if missing)
   */
  async getAccessToken(): Promise<string> {
    // If tokens missing, try to restore from cookies first
    if (!this.tokens) {
      console.log('🔄 Tokens missing from memory, attempting to restore from cookies...');
      const restored = await this.restoreFromCookies();
      if (!restored || !this.tokens) {
        throw new Error('User not authenticated. Please reconnect Google Drive.');
      }
      // After restoration, tokens should be set, continue with normal flow
    }

    // At this point, tokens should exist, but TypeScript needs confirmation
    if (!this.tokens) {
      throw new Error('Tokens not available after restoration. Please reconnect Google Drive.');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);
    
    if (this.tokens.expiresAt <= fiveMinutesFromNow) {
      if (!this.tokens.refreshToken) {
        // Try one more time to restore from cookies
        console.log('🔄 Refresh token missing, attempting cookie restoration...');
        const restored = await this.restoreFromCookies();
        if (!restored || !this.tokens) {
          throw new Error('Token expired and no refresh token available. Please reconnect Google Drive.');
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
          // If refresh fails, try to restore from cookies as fallback
          console.warn('⚠️ Token refresh failed, attempting cookie restoration as fallback:', error);
          const restored = await this.restoreFromCookies();
          if (!restored) {
            throw new Error('Failed to refresh token. Please reconnect Google Drive.');
          }
          // After restoration, retry getting access token
          return this.getAccessToken();
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
      const fiduTokenService = getFiduAuthService();
      try {
        await fiduTokenService.ensureAccessToken({
          onWait: () => console.log('🔐 Ensuring FIDU session before starting Google OAuth flow...'),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          await fiduTokenService.clearTokens();
          try {
            const [{ store }, { logout }] = await Promise.all([
              import('../../store'),
              import('../../store/slices/authSlice'),
            ]);
            store.dispatch(logout());
          } catch (dispatchError) {
            console.warn('Failed to dispatch logout after auth loss:', dispatchError);
          }
          throw new Error('FIDU authentication required before connecting Google Drive. Please log in again.');
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          throw new Error('Timed out while preparing authentication. Please try again.');
        }
        throw error;
      }

      // Check if we need to force consent (when we don't have a refresh token)
      const needsRefreshToken = forceReauth || !(await this.hasStoredRefreshToken());
      
      if (needsRefreshToken) {
        console.log('🔄 No refresh token found, using consent prompt to ensure we get one');
      } else {
        console.log('🔄 Refresh token exists, using select_account for better UX');
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
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

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
      expiresAt: this.tokens?.expiresAt || null
    };
  }

  /**
   * Ensure user is authenticated, attempting restoration if needed
   * This is an async version of isAuthenticated() that attempts restoration
   * Use this when you need to guarantee authentication state
   */
  async ensureAuthenticated(): Promise<boolean> {
    // Fast path: if tokens exist and valid, return immediately
    if (this.tokens && this.tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
      return true;
    }
    
    // Slow path: try to restore from cookies
    if (!this.tokens || this.tokens.expiresAt <= Date.now() + 5 * 60 * 1000) {
      try {
        console.log('🔄 Authentication not valid, attempting restoration...');
        const restored = await this.restoreFromCookies();
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
   * Get authentication status with async restoration attempt
   * Use this when you need accurate auth state
   */
  async getAuthStatusAsync(): Promise<{
    isAuthenticated: boolean;
    user: GoogleDriveUser | null;
    expiresAt: number | null;
  }> {
    const authenticated = await this.ensureAuthenticated();
    return {
      isAuthenticated: authenticated,
      user: this.user,
      expiresAt: this.tokens?.expiresAt || null
    };
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
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(accessToken));
      
      if (response.ok) {
        const data = await response.json();
        if (data.scope) {
          const scopes = data.scope.split(' ').filter((s: string) => s.length > 0);
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
      state: this.generateState()
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
        statesMatch: state === storedState 
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
      const tokens = await this.exchangeCodeForTokens(code);
      console.log('✅ Token exchange successful');
      
      this.tokens = tokens;
      this.storeTokens(tokens);

      // Fetch user info (will update Google email if FIDU auth is ready)
      console.log('🔄 Fetching user info...');
      await this.fetchUserInfo();
      
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

  private async exchangeCodeForTokens(code: string): Promise<GoogleDriveTokens> {
    // Try to use backend endpoint for secure token exchange (production)
    // Falls back to direct Google OAuth for local development
    const basePath = window.location.pathname.includes('/fidu-chat-lab') 
      ? '/fidu-chat-lab' 
      : '';
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      let fiduAuthToken: string | null = null;
      try {
        fiduAuthToken = await getFiduAuthService().ensureAccessToken({
          onWait: () => console.log('🔐 Ensuring FIDU auth before exchanging OAuth code...'),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          throw new Error('FIDU authentication expired before completing Google Drive setup. Please log in again.');
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          throw new Error('Timed out while preparing FIDU authentication for Google Drive. Please try again.');
        }
        throw error;
      }

      if (fiduAuthToken) {
        headers['Authorization'] = `Bearer ${fiduAuthToken}`;
        console.log('🔑 Including FIDU auth token in OAuth exchange request');
      }
      
      const response = await fetch(`${basePath}/api/oauth/exchange-code`, {
        method: 'POST',
        headers,
        credentials: 'include', // Include HTTP-only cookies
        body: JSON.stringify({
          code: code,
          redirect_uri: this.config.redirectUri,
          environment: detectRuntimeEnvironment(),
        }),
        // Short timeout to quickly detect if backend is unavailable
        signal: this.createTimeoutSignal(5000),
      });

      if (response.ok) {
        const data = await response.json();
        
        const tokens = {
          accessToken: data.access_token,
          refreshToken: 'stored-in-cookie', // Refresh token is now in HTTP-only cookie
          expiresAt: Date.now() + (data.expires_in * 1000),
          scope: data.scope
        };
        
        // Validate that we received the required scopes
        this.validateScopes(tokens.scope);
        
        console.log('✅ Token exchange via backend (secure)');
        return tokens;
      }
      
      // Backend returned error (400/500) - don't fall back, this is a backend issue
      if (response.status >= 400) {
        const errorText = await response.text();
        throw new Error(`Backend OAuth error (${response.status}): ${errorText}`);
      }
    } catch (error: any) {
      // Only fall back on network/timeout errors
      // Backend errors should be thrown, not trigger fallback
      if (error.name === 'AbortError' || error.name === 'TypeError' || 
          error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn('⚠️ Backend not available (timeout/network), falling back to direct OAuth');
        return this.exchangeCodeForTokensDirect(code);
      }
      
      // Propagate backend errors
      throw error;
    }

    // Shouldn't reach here
    throw new Error('Unexpected state in token exchange');
  }

  /**
   * Create a timeout signal for fetch requests
   * Provides fallback for browsers without AbortSignal.timeout support
   */
  private createTimeoutSignal(ms: number): AbortSignal {
    // Use native timeout if available (Chrome/Edge/Firefox 103+, Safari 16+)
    if (typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    
    // Fallback for older browsers
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }

  /**
   * Direct token exchange with Google (fallback for local development)
   * Only used when backend is not available
   * 
   * SECURITY WARNING: This method exposes client secret in the browser.
   * Only use for local development. Never deploy with VITE_GOOGLE_CLIENT_SECRET
   * set in production environment variables.
   */
  private async exchangeCodeForTokensDirect(code: string): Promise<GoogleDriveTokens> {
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      throw new Error(
        'Backend unavailable and VITE_GOOGLE_CLIENT_SECRET not set. ' +
        'Either start the backend server or set VITE_GOOGLE_CLIENT_SECRET for local development.'
      );
    }

    // CRITICAL: Warn if using direct OAuth in production build
    if (import.meta.env.PROD) {
      console.error(
        '🚨 SECURITY WARNING: Using direct OAuth in production build!\n' +
        'This means VITE_GOOGLE_CLIENT_SECRET is set in production environment.\n' +
        'Client secret should NEVER be in production builds.\n' +
        'Backend should handle OAuth in production for security.'
      );
      
      // Optional: Fail fast if strict mode enabled
      if (import.meta.env.VITE_DISABLE_INSECURE_FALLBACK === 'true') {
        throw new Error(
          'Insecure OAuth fallback is disabled in production. ' +
          'Backend must be available for secure token exchange.'
        );
      }
    }

    console.log('🔧 Using direct OAuth exchange (development mode)');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Direct token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    const tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope
    };
    
    // Validate that we received the required scopes
    this.validateScopes(tokens.scope);
    
    return tokens;
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
    // Try to use backend endpoint for secure token refresh (production)
    // Falls back to direct Google OAuth for local development
    const basePath = window.location.pathname.includes('/fidu-chat-lab') 
      ? '/fidu-chat-lab' 
      : '';
    
    // Detect environment for cookie isolation using shared utility
    const environment = detectRuntimeEnvironment();
    
    try {
      const fiduTokenService = getFiduAuthService();
      
      // Check if we have a FIDU refresh token before attempting to get access token
      const hasFiduRefreshToken = await fiduTokenService.hasRefreshToken();
      if (!hasFiduRefreshToken) {
        console.log('ℹ️ No FIDU refresh token available - skipping secure token refresh');
        throw new Error('No FIDU refresh token available for secure token refresh');
      }
      
      let fiduAuthToken: string | null = null;
      try {
        fiduAuthToken = await fiduTokenService.ensureAccessToken({
          onWait: () => console.log('🔐 Ensuring FIDU auth before Google token refresh...'),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          throw new Error('FIDU authentication expired before refreshing Google Drive tokens. Please log in again.');
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          throw new Error('Timed out while preparing FIDU auth for Google Drive token refresh. Please try again.');
        }
        throw error;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Include FIDU auth token if available
      if (fiduAuthToken) {
        headers['Authorization'] = `Bearer ${fiduAuthToken}`;
        console.log('🔑 Including FIDU auth token in token refresh request');
      }
      
      const response = await fetch(`${basePath}/api/oauth/refresh-token?env=${environment}`, {
        method: 'POST',
        headers,
        credentials: 'include', // Include HTTP-only cookies
        // Short timeout to quickly detect if backend is unavailable
        signal: this.createTimeoutSignal(5000),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update tokens
        this.tokens!.accessToken = data.access_token;
        this.tokens!.expiresAt = Date.now() + (data.expires_in * 1000);
        
        // Update scope if provided (may not always be included in refresh response)
        if (data.scope) {
          this.tokens!.scope = data.scope;
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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.error || 'Unknown error';
        
        // Check if this is a refresh token expiration/revocation error
        if (response.status === 401 && (errorMessage.includes('expired') || errorMessage.includes('revoked'))) {
          console.error('❌ Refresh token has expired or been revoked. User needs to re-authenticate.');
          this.clearStoredTokens();
          this.tokens = null;
          this.user = null;
          throw new Error('Refresh token expired or revoked. Please re-authenticate with Google Drive.');
        }
        
        // Handle 503 Service Unavailable errors
        if (response.status === 503) {
          // Check if it's a configuration error (non-recoverable)
          if (errorMessage.includes('not configured') || errorMessage.includes('OAuth not configured')) {
            console.error('❌ Backend OAuth not configured. Cannot refresh token.');
            // Don't clear tokens - this is a backend configuration issue, not an auth issue
            // Throw a specific error that can be caught upstream
            throw new ConfigurationError('Backend OAuth not configured. Please contact support.');
          }
          
          // Generic 503 - might be temporary, allow retry
          console.warn('⚠️ Backend service unavailable (503). This may be temporary.');
          throw new ServiceUnavailableError(`Backend service unavailable: ${errorMessage}`);
        }
        
        // Other 4xx/5xx errors - don't fall back to direct OAuth
        throw new Error(`Backend token refresh error (${response.status}): ${errorMessage}`);
      }
    } catch (error: any) {
      // Don't fall back on configuration errors - these are permanent
      if (error instanceof ConfigurationError) {
        throw error;
      }
      
      // Don't fall back on service unavailable errors - let caller decide on retry
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }
      
      // Only fall back on network/timeout errors
      if (error.name === 'AbortError' || error.name === 'TypeError' ||
          error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn('⚠️ Backend not available (timeout/network), falling back to direct OAuth');
        return this.refreshTokenDirect();
      }
      
      // Propagate other backend errors
      throw error;
    }

    // Shouldn't reach here
    throw new Error('Unexpected state in token refresh');
  }

  /**
   * Direct token refresh with Google (fallback for local development)
   * Only used when backend is not available
   * 
   * SECURITY WARNING: This method exposes client secret in the browser.
   * Only use for local development.
   */
  private async refreshTokenDirect(): Promise<string> {
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      throw new Error(
        'Backend unavailable and VITE_GOOGLE_CLIENT_SECRET not set. ' +
        'Either start the backend server or set VITE_GOOGLE_CLIENT_SECRET for local development.'
      );
    }

    // Warn if using direct OAuth in production
    if (import.meta.env.PROD) {
      console.error(
        '🚨 SECURITY WARNING: Using direct token refresh in production build!'
      );
    }

    console.log('🔧 Using direct token refresh (development mode)');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        refresh_token: this.tokens!.refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      // Check if this is a refresh token expiration/revocation error
      if (error.includes('invalid_grant') || error.includes('invalid refresh_token')) {
        console.error('❌ Refresh token has expired or been revoked. User needs to re-authenticate.');
        this.clearStoredTokens();
        this.tokens = null;
        this.user = null;
        throw new Error('Refresh token expired or revoked. Please re-authenticate with Google Drive.');
      }
      
      throw new Error(`Direct token refresh failed: ${error}`);
    }

    const data = await response.json();
    
    // Update tokens
    this.tokens!.accessToken = data.access_token;
    this.tokens!.expiresAt = Date.now() + (data.expires_in * 1000);
    
    // Store updated tokens
    this.storeTokens(this.tokens!);

    // Start proactive refresh after successful refresh
    this.startProactiveRefresh();

    return data.access_token;
  }

  private async fetchUserInfo(): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await response.json();
    this.user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture
    };
    
    // Persist user info to localStorage
    this.storeUserInfo(this.user);
    
    // Update Google email in identity service (if FIDU auth is ready)
    // This will skip silently if auth isn't ready to avoid triggering logout
    await this.updateGoogleEmailInIdentityService(userData.email);
  }

  /**
   * Update Google email in identity service
   * Called after successful Google Drive authentication
   * Safely skips update if FIDU authentication isn't ready to avoid triggering logout
   */
  private async updateGoogleEmailInIdentityService(googleEmail: string): Promise<void> {
    try {
      const fiduAuthService = getFiduAuthService();
      
      // Check if FIDU auth is ready before attempting API call
      // The axios interceptor will trigger logout if AuthenticationRequiredError is thrown,
      // so we need to verify auth is ready first
      if (!(await fiduAuthService.isAuthenticated())) {
        console.log('ℹ️ FIDU authentication not ready - skipping Google email update');
        return;
      }
      
      // Dynamically import to avoid circular dependencies
      const { identityServiceAPIClient } = await import('../api/apiClientIdentityService');
      await identityServiceAPIClient.updateGoogleEmail(googleEmail);
      console.log('✅ Google email updated in identity service:', googleEmail);
    } catch (error: any) {
      // Silently handle auth errors - these can trigger logout if not caught
      // This is expected during initialization/login when FIDU auth isn't ready yet
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('authentication required') ||
          errorMessage.includes('please log in again') ||
          errorMessage.includes('user not authenticated') ||
          errorMessage.includes('authenticationrequirederror') ||
          error.name === 'AuthenticationRequiredError'
        ) {
          console.log('ℹ️ FIDU authentication not ready - Google email update will be retried later');
          return;
        }
      }
      
      // Handle 401 errors (API errors)
      if (error?.status === 401 || error?.response?.status === 401) {
        console.log('ℹ️ Received 401 from identity service - FIDU auth may not be ready');
        return;
      }
      
      // Log other errors but don't throw - this is a non-critical operation
      console.warn('⚠️ Failed to update Google email in identity service:', error);
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
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
    });

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
        console.log('🔄 Clearing stale localStorage tokens in favor of HTTP-only cookies');
        localStorage.removeItem('google_drive_tokens');
        localStorage.removeItem('google_drive_user');
      }
      
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
      this.clearStoredTokens();
    }
  }

  /**
   * Check if we have a stored refresh token in cookies
   */
  private async hasStoredRefreshToken(): Promise<boolean> {
    try {
      const tokens = await this.loadTokensFromCookies();
      return !!(tokens?.refreshToken);
    } catch (error) {
      console.warn('Error checking for stored refresh token:', error);
      return false;
    }
  }

  /**
   * Load Google Drive tokens from HTTP-only cookies
   */
  private async loadTokensFromCookies(): Promise<GoogleDriveTokens | null> {
    try {
      const basePath = window.location.pathname.includes('/fidu-chat-lab') 
        ? '/fidu-chat-lab' 
        : '';
      
      // Detect environment for cookie isolation using shared utility
      const environment = detectRuntimeEnvironment();
      
      const fiduTokenService = getFiduAuthService();
      
      // Check if we have a FIDU refresh token before attempting to get access token
      const hasFiduRefreshToken = await fiduTokenService.hasRefreshToken();
      if (!hasFiduRefreshToken) {
        console.log('ℹ️ No FIDU refresh token available - skipping secure token retrieval');
        return null;
      }
      
      let fiduAuthToken: string | null = null;
      try {
        fiduAuthToken = await fiduTokenService.ensureAccessToken({
          onWait: () => console.log('🔐 Ensuring FIDU auth before retrieving Google Drive tokens...'),
        });
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          console.warn('FIDU authentication required before restoring Google Drive tokens.');
          return null;
        }
        if (error instanceof TokenAcquisitionTimeoutError) {
          console.warn('Timed out while preparing FIDU authentication for Google Drive token retrieval.');
          return null;
        }
        throw error;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Include FIDU auth token if available
      if (fiduAuthToken) {
        headers['Authorization'] = `Bearer ${fiduAuthToken}`;
        console.log('🔑 Including FIDU auth token in token retrieval request');
      }
      
      const response = await fetch(`${basePath}/api/oauth/get-tokens?env=${environment}`, {
        method: 'GET',
        headers,
        credentials: 'include', // Include HTTP-only cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.has_tokens && data.refresh_token) {
          console.log('✅ Google Drive refresh token retrieved from HTTP-only cookies');
          
          // Create a token object with the refresh token
          // We'll need to refresh to get the access token
          return {
            accessToken: '', // Will be populated by refresh
            refreshToken: data.refresh_token,
            expiresAt: 0, // Will be updated by refresh
            scope: '', // Will be updated by refresh
          };
        } else {
          console.log('ℹ️ No Google Drive tokens found in HTTP-only cookies');
          return null;
        }
      } else {
        console.warn('⚠️ Failed to retrieve Google Drive tokens from cookies:', response.status);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error retrieving Google Drive tokens from cookies:', error);
      return null;
    }
  }

  /**
   * Attempt to restore authentication from HTTP-only cookies
   * This is called when the app becomes visible or during initialization
   */
  async restoreFromCookies(): Promise<boolean> {
    try {
      console.log('🔄 Attempting to restore authentication from HTTP-only cookies...');
      
      // First, try to load tokens from cookies
      const tokensFromCookies = await this.loadTokensFromCookies();
      
      if (!tokensFromCookies) {
        console.log('❌ No Google Drive tokens found in HTTP-only cookies');
        return false;
      }
      
      // Set the tokens in memory
      this.tokens = tokensFromCookies;
      
      // Now try to refresh the access token using the loaded refresh token
      const newAccessToken = await this.refreshAccessToken();
      
      if (newAccessToken) {
        // Load user info if we don't have it (will update Google email if FIDU auth is ready)
        if (!this.user) {
          await this.fetchUserInfo();
        }
        
        // Start proactive refresh after restoration
        this.startProactiveRefresh();
        
        return true;
      } else {
        return false;
      }
      
    } catch (error) {
      console.log('❌ Failed to restore from cookies:', error);
      return false;
    }
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
  async restoreFromCookiesWithRetry(maxRetries: number = 3): Promise<boolean> {
    if (!this.isOnline()) {
      console.log('🔄 Offline - skipping cookie restoration');
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Cookie restoration attempt ${attempt}/${maxRetries}`);
        const success = await this.restoreFromCookies();
        
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
          console.error('❌ Configuration error - cannot retry:', error.message);
          return false;
        }
        
        // Check if this is a service unavailable error that might be temporary
        if (error instanceof ServiceUnavailableError && attempt < maxRetries) {
          console.warn(`⚠️ Service unavailable (attempt ${attempt}/${maxRetries}):`, error.message);
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.warn(`❌ Cookie restoration attempt ${attempt} failed:`, error);
        
        // If this is the last attempt or a non-retryable error, fail
        if (attempt === maxRetries || error instanceof ConfigurationError) {
          console.error('❌ All cookie restoration attempts failed');
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

  private storeTokens(tokens: GoogleDriveTokens): void {
    try {
      // Validate token structure before storing
      if (!tokens.accessToken || typeof tokens.expiresAt !== 'number') {
        console.error('Invalid token structure, not storing');
        return;
      }
      
      // Primary storage: HTTP-only cookies (handled by backend)
      // Only store access token in localStorage for immediate use (not refresh token)
      const tokenData = {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope
        // Note: refreshToken is NOT stored in localStorage - it's in HTTP-only cookies
      };

      localStorage.setItem('google_drive_tokens', JSON.stringify(tokenData));
      console.log('✅ Stored Google Drive access token in localStorage (refresh token in HTTP-only cookie)');
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
    const refreshAt = expiresAt - (10 * 60 * 1000); // 10 minutes before expiry
    const timeUntilRefresh = refreshAt - now;
    
    if (timeUntilRefresh <= 0) {
      // Refresh immediately
      console.log('🔄 Token expires soon, refreshing immediately...');
      this.refreshAccessToken()
        .then(() => {
          console.log('✅ Token refreshed proactively');
          this.startProactiveRefresh(); // Schedule next refresh
        })
        .catch((error) => {
          console.error('❌ Proactive token refresh failed:', error);
          // Retry after shorter interval on failure (5 minutes)
          this.refreshTimer = setTimeout(() => {
            this.startProactiveRefresh();
          }, 5 * 60 * 1000);
        });
      return;
    }
    
    // Schedule refresh
    console.log(`🔄 Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken()
        .then(() => {
          console.log('✅ Token refreshed proactively');
          this.startProactiveRefresh(); // Schedule next refresh
        })
        .catch((error) => {
          console.error('❌ Proactive token refresh failed:', error);
          // Retry after shorter interval on failure (5 minutes)
          setTimeout(() => {
            this.startProactiveRefresh();
          }, 5 * 60 * 1000);
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
    this.validationInterval = setInterval(async () => {
      try {
        if (!this.tokens) {
          // Try to restore
          console.log('🔄 Periodic check: tokens missing, attempting restoration...');
          const restored = await this.restoreFromCookies();
          if (restored) {
            console.log('✅ Periodic check: tokens restored');
            this.startProactiveRefresh(); // Start proactive refresh after restoration
          }
          return;
        }
        
        // If token expires in less than 10 minutes, refresh proactively
        const now = Date.now();
        const tenMinutesFromNow = now + (10 * 60 * 1000);
        
        if (this.tokens.expiresAt <= tenMinutesFromNow) {
          console.log('🔄 Periodic check: token expires soon, refreshing...');
          try {
            await this.refreshAccessToken();
            console.log('✅ Periodic check: token refreshed');
          } catch (error) {
            console.warn('⚠️ Periodic check: token refresh failed, attempting restoration:', error);
            // Try to restore from cookies
            await this.restoreFromCookies();
          }
        }
      } catch (error) {
        console.error('❌ Periodic validation error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
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
   * Logout from Google Drive by clearing tokens and HTTP-only cookies
   */
  async logout(): Promise<void> {
    try {
      console.log('🔄 Logging out from Google Drive...');
      
      // Stop proactive refresh and periodic validation
      this.stopProactiveRefresh();
      this.stopPeriodicValidation();
      
      // Clear local tokens
      this.clearStoredTokens();
      this.tokens = null;
      this.user = null;
      
      // Clear HTTP-only cookie via backend
      const basePath = window.location.pathname.includes('/fidu-chat-lab') 
        ? '/fidu-chat-lab' 
        : '';
      
      try {
        await fetch(`${basePath}/api/oauth/logout`, {
          method: 'POST',
          credentials: 'include', // Include HTTP-only cookies
        });
        console.log('✅ HTTP-only cookie cleared via backend');
      } catch (error) {
        console.warn('Failed to clear HTTP-only cookie via backend:', error);
        // Continue with logout even if backend call fails
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
    console.warn('Failed to fetch Google Client ID from backend, falling back to env:', error);
    
    // Fall back to environment variable
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google Client ID not configured in backend or environment variables');
    }
    return clientId;
  }
}

export async function getGoogleDriveAuthService(): Promise<GoogleDriveAuthService> {
  if (!authServiceInstance) {
    // Fetch client ID from backend (which may come from OpenBao)
    const clientId = await fetchGoogleClientId();

    const config: GoogleDriveAuthConfig = {
      clientId,
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/fidu-chat-lab/oauth-callback`,
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.file', // Required for shared workspaces
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };

    authServiceInstance = new GoogleDriveAuthService(config);
  }

  return authServiceInstance;
}
