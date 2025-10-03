/**
 * Google Drive Authentication Service
 * Handles OAuth 2.0 flow for Google Drive access
 */

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

  constructor(config: GoogleDriveAuthConfig) {
    this.config = config;
    this.loadStoredTokens();
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    // Check if we're returning from OAuth callback
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
    const authUrl = this.buildAuthUrl();
    window.location.href = authUrl;
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
    const state = crypto.randomUUID();
    sessionStorage.setItem('google_oauth_state', state);
    return state;
  }

  private async handleOAuthCallback(code: string): Promise<void> {
    // Verify state parameter
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get('state');
    const storedState = sessionStorage.getItem('google_oauth_state');
    
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    
    sessionStorage.removeItem('google_oauth_state');

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code);
    this.tokens = tokens;
    this.storeTokens(tokens);

    // Fetch user info
    await this.fetchUserInfo();
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
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope
    };
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
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin,
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
