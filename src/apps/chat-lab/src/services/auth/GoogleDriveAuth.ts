/**
 * Google Drive Authentication Service
 * Handles OAuth 2.0 flow for Google Drive access
 */

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

    // If we have tokens, validate and refresh them proactively
    if (this.tokens && this.tokens.refreshToken) {
      const now = Date.now();
      const fiveMinutesFromNow = now + (5 * 60 * 1000);
      
      // Proactively refresh tokens that are close to expiring
      if (this.tokens.expiresAt <= fiveMinutesFromNow) {
        try {
          console.log('Token expires soon, refreshing automatically');
          await this.refreshAccessToken();
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
          // If validation succeeds, ensure user info is loaded
          if (!this.user) {
            await this.getUser();
          }
        } catch (error) {
          console.warn('Token validation failed, attempting refresh:', error);
          try {
            await this.refreshAccessToken();
            // After successful refresh, load user info
            if (!this.user) {
              await this.getUser();
            }
          } catch (refreshError) {
            console.error('Failed to refresh after validation failure:', refreshError);
            // Clear tokens if refresh fails
            this.clearStoredTokens();
            this.tokens = null;
            this.user = null;
          }
        }
      }
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
   * Get current access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('User not authenticated');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);
    
    if (this.tokens.expiresAt <= fiveMinutesFromNow) {
      if (!this.tokens.refreshToken) {
        throw new Error('Token expired and no refresh token available');
      }
      
      // Refresh token
      this.tokens.accessToken = await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Start OAuth flow
   */
  async authenticate(): Promise<void> {
    // Prevent multiple simultaneous OAuth flows
    if (this.isAuthenticating) {
      console.log('🔄 OAuth flow already in progress, skipping...');
      return;
    }
    
    this.isAuthenticating = true;
    try {
      const authUrl = this.buildAuthUrl();
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
      isAuthenticated: this.isAuthenticated(),
      user: this.user,
      expiresAt: this.tokens?.expiresAt || null
    };
  }

  // Private methods

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      // Use 'select_account' instead of 'consent' to avoid forcing re-auth every time
      // This allows users to stay logged in unless they explicitly revoke access
      prompt: 'select_account',
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

      // Fetch user info
      console.log('🔄 Fetching user info...');
      await this.fetchUserInfo();
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
      const response = await fetch(`${basePath}/api/oauth/exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include HTTP-only cookies
        body: JSON.stringify({
          code: code,
          redirect_uri: this.config.redirectUri,
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
    
    try {
      const response = await fetch(`${basePath}/api/oauth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include HTTP-only cookies
        // Short timeout to quickly detect if backend is unavailable
        signal: this.createTimeoutSignal(5000),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update tokens
        this.tokens!.accessToken = data.access_token;
        this.tokens!.expiresAt = Date.now() + (data.expires_in * 1000);
        
        // Store updated tokens
        this.storeTokens(this.tokens!);

        console.log('✅ Token refresh via backend (secure)');
        return data.access_token;
      }
      
      // Backend returned error (400/500) - don't fall back
      if (response.status >= 400) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if this is a refresh token expiration/revocation error
        if (response.status === 401 && errorData.error?.includes('expired')) {
          console.error('❌ Refresh token has expired or been revoked. User needs to re-authenticate.');
          this.clearStoredTokens();
          this.tokens = null;
          this.user = null;
          throw new Error('Refresh token expired or revoked. Please re-authenticate with Google Drive.');
        }
        
        throw new Error(`Backend token refresh error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      // Only fall back on network/timeout errors
      if (error.name === 'AbortError' || error.name === 'TypeError' ||
          error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn('⚠️ Backend not available (timeout/network), falling back to direct OAuth');
        return this.refreshTokenDirect();
      }
      
      // Propagate backend errors
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
      // Try localStorage first (for development/fallback)
      const stored = localStorage.getItem('google_drive_tokens');
      if (stored) {
        const parsedTokens = JSON.parse(stored);
        
        // Validate token structure
        if (parsedTokens && 
            typeof parsedTokens.accessToken === 'string' && 
            typeof parsedTokens.expiresAt === 'number' &&
            parsedTokens.accessToken.length > 0) {
          
          // Check if token is not already expired
          if (parsedTokens.expiresAt > Date.now()) {
            this.tokens = parsedTokens;
            console.log('✅ Loaded Google Drive tokens from localStorage');
            return;
          } else {
            console.log('Stored Google Drive tokens are expired, clearing');
            this.clearStoredTokens();
          }
        } else {
          console.warn('Invalid token structure in storage, clearing');
          this.clearStoredTokens();
        }
      }
      
      // If no localStorage tokens, check if we have HTTP-only cookies
      // by attempting a token refresh (this will work if refresh token is in cookie)
      console.log('No localStorage tokens found, checking for HTTP-only cookie...');
      
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
      this.clearStoredTokens();
    }
  }

  private storeTokens(tokens: GoogleDriveTokens): void {
    try {
      // Validate token structure before storing
      if (!tokens.accessToken || typeof tokens.expiresAt !== 'number') {
        console.error('Invalid token structure, not storing');
        return;
      }
      
      localStorage.setItem('google_drive_tokens', JSON.stringify(tokens));
      console.log('Stored Google Drive tokens to localStorage');
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
   * Logout from Google Drive by clearing tokens and HTTP-only cookies
   */
  async logout(): Promise<void> {
    try {
      console.log('🔄 Logging out from Google Drive...');
      
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
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };

    authServiceInstance = new GoogleDriveAuthService(config);
  }

  return authServiceInstance;
}
