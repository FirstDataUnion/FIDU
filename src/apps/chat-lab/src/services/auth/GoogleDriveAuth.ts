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

    // If we have tokens, try to refresh them if they're close to expiring
    if (this.tokens && this.tokens.refreshToken) {
      const now = Date.now();
      const fiveMinutesFromNow = now + (5 * 60 * 1000);
      
      if (this.tokens.expiresAt <= fiveMinutesFromNow) {
        try {
          console.log('Token expires soon, refreshing automatically');
          await this.refreshAccessToken();
        } catch (error) {
          console.warn('Failed to refresh token during initialization:', error);
          // Let the app handle the unauthenticated state
        }
      }
      
      // Load user info if we have valid tokens but no user data
      if (this.isAuthenticated() && !this.user) {
        try {
          await this.getUser();
        } catch (error) {
          console.warn('Failed to load user info during initialization:', error);
          // Let the app handle the missing user info
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
      prompt: 'consent',
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
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.getClientSecret(),
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
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
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.getClientSecret(),
        refresh_token: this.tokens!.refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
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
  }

  private async revokeToken(token: string): Promise<void> {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to revoke token');
    }
  }

  private getClientSecret(): string {
    // In a real app, you'd get this from environment variables
    // Add to config
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('Google Client Secret not configured');
    }
    return clientSecret;
  }

  private loadStoredTokens(): void {
    try {
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
          } else {
            console.log('Stored Google Drive tokens are expired, clearing');
            this.clearStoredTokens();
          }
        } else {
          console.warn('Invalid token structure in storage, clearing');
          this.clearStoredTokens();
        }
      }
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
  }
}

// Singleton instance
let authServiceInstance: GoogleDriveAuthService | null = null;

export function getGoogleDriveAuthService(): GoogleDriveAuthService {
  if (!authServiceInstance) {
    const config: GoogleDriveAuthConfig = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/fidu-chat-lab/oauth-callback`,
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };

    if (!config.clientId) {
      throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID environment variable.');
    }

    authServiceInstance = new GoogleDriveAuthService(config);
  }

  return authServiceInstance;
}
