import type { User } from '../../types';

export interface FiduAuthTokens {
  access_token?: string;
  refresh_token?: string;
  user?: User;
}

export interface FiduTokenRefreshResponse {
  access_token: string;
  expires_in: number;
}

export class FiduAuthCookieService {
  private basePath: string;
  private environment: string;

  constructor() {
    this.basePath = window.location.pathname.includes('/fidu-chat-lab') 
      ? '/fidu-chat-lab' 
      : '';
    
    // Detect environment based on hostname
    this.environment = this.detectEnvironment();
  }

  /**
   * Detect the current environment (dev, prod, local)
   */
  private detectEnvironment(): string {
    const hostname = window.location.hostname;
    
    if (hostname.includes('dev.')) {
      return 'dev';
    } else if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'local';
    } else {
      return 'prod';
    }
  }

  /**
   * Store FIDU auth tokens in HTTP-only cookies
   * Following industry best practices for token management
   */
  async setTokens(accessToken: string, refreshToken: string, user: User): Promise<boolean> {
    try {
      console.log(`🔑 Storing FIDU auth tokens in HTTP-only cookies for ${this.environment} environment...`);
      
      const response = await fetch(`${this.basePath}/api/auth/fidu/set-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include HTTP-only cookies
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          user: user,
          environment: this.environment,
        }),
      });

      if (response.ok) {
        console.log('✅ FIDU auth tokens stored in HTTP-only cookies');
        return true;
      } else {
        console.error('❌ Failed to store FIDU auth tokens:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error storing FIDU auth tokens:', error);
      return false;
    }
  }

  /**
   * Retrieve FIDU auth tokens from HTTP-only cookies
   */
  async getTokens(): Promise<FiduAuthTokens | null> {
    try {
      console.log(`🔑 Retrieving FIDU auth tokens from HTTP-only cookies for ${this.environment} environment...`);
      
      const response = await fetch(`${this.basePath}/api/auth/fidu/get-tokens?env=${this.environment}`, {
        method: 'GET',
        credentials: 'include', // Include HTTP-only cookies
      });

      if (response.ok) {
        const data: FiduAuthTokens = await response.json();
        
        if (data.access_token || data.refresh_token || data.user) {
          console.log(`✅ FIDU auth tokens retrieved from HTTP-only cookies for ${this.environment} environment`);
          return data;
        } else {
          console.log(`ℹ️ No FIDU auth tokens found in HTTP-only cookies for ${this.environment} environment`);
          return null;
        }
      } else {
        console.warn('⚠️ Failed to retrieve FIDU auth tokens:', response.status);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error retrieving FIDU auth tokens:', error);
      return null;
    }
  }

  /**
   * Refresh FIDU access token using refresh token from HTTP-only cookies
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      console.log(`🔄 Refreshing FIDU access token for ${this.environment} environment...`);
      
      const response = await fetch(`${this.basePath}/api/auth/fidu/refresh-access-token?env=${this.environment}`, {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookies
      });

      if (response.ok) {
        const data: FiduTokenRefreshResponse = await response.json();
        console.log('✅ FIDU access token refreshed successfully');
        return data.access_token;
      } else if (response.status === 401) {
        // No refresh token available - this is expected when user hasn't logged in
        console.log('ℹ️ No FIDU refresh token found in cookies - user needs to log in');
        return null;
      } else {
        console.error('❌ Failed to refresh FIDU access token:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ Error refreshing FIDU access token:', error);
      return null;
    }
  }

  /**
   * Clear all FIDU auth tokens from HTTP-only cookies
   */
  async clearTokens(): Promise<boolean> {
    try {
      console.log(`🗑️ Clearing FIDU auth tokens for ${this.environment} environment...`);
      
      const response = await fetch(`${this.basePath}/api/auth/fidu/clear-tokens?env=${this.environment}`, {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookies
      });

      if (response.ok) {
        console.log('✅ FIDU auth tokens cleared successfully');
        return true;
      } else {
        console.error('❌ Failed to clear FIDU auth tokens:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error clearing FIDU auth tokens:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated by checking for tokens in cookies
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      return !!(tokens?.access_token || tokens?.refresh_token);
    } catch (error) {
      console.warn('Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Check if we have a FIDU refresh token stored in cookies
   */
  async hasRefreshToken(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      return !!(tokens?.refresh_token);
    } catch (error) {
      console.warn('Error checking for refresh token:', error);
      return false;
    }
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const tokens = await this.getTokens();
      
      // Check that access_token exists and is not empty
      if (tokens?.access_token && tokens.access_token.trim() !== '') {
        return tokens.access_token;
      }
      
      // If no access token but we have a refresh token, try to refresh
      if (tokens?.refresh_token && tokens.refresh_token.trim() !== '') {
        console.log('🔄 No access token found, attempting refresh...');
        return await this.refreshAccessToken();
      }
      
      console.log('ℹ️ No valid access or refresh token available');
      return null;
    } catch (error) {
      console.warn('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Migrate tokens from localStorage to HTTP-only cookies
   * This is a one-time migration for existing users
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      // Check if we already have tokens in cookies
      const cookieTokens = await this.getTokens();
      if (cookieTokens?.access_token) {
        console.log('✅ FIDU auth tokens already in HTTP-only cookies, skipping migration');
        return true;
      }

      // Check localStorage for existing tokens
      const localAccessToken = localStorage.getItem('auth_token');
      const localUser = localStorage.getItem('user');
      
      if (!localAccessToken || !localUser) {
        console.log('ℹ️ No FIDU auth tokens found in localStorage to migrate');
        return false;
      }

      console.log('🔄 Migrating FIDU auth tokens from localStorage to HTTP-only cookies...');
      
      // Parse user data
      const user = JSON.parse(localUser);
      
      // For migration, we'll use the access token as both access and refresh token
      // In a real implementation, you'd need to get the actual refresh token from FIDU
      const success = await this.setTokens(localAccessToken, localAccessToken, user);
      
      if (success) {
        console.log('✅ Successfully migrated FIDU auth tokens to HTTP-only cookies');
        
        // Clear localStorage tokens after successful migration
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_profile');
        
        return true;
      } else {
        console.error('❌ Failed to migrate FIDU auth tokens to HTTP-only cookies');
        return false;
      }
    } catch (error) {
      console.error('❌ Error migrating FIDU auth tokens:', error);
      return false;
    }
  }
}

// Singleton instance
let fiduAuthCookieService: FiduAuthCookieService | null = null;

export const getFiduAuthCookieService = (): FiduAuthCookieService => {
  if (!fiduAuthCookieService) {
    fiduAuthCookieService = new FiduAuthCookieService();
  }
  return fiduAuthCookieService;
};
