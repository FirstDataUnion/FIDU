/**
 * Refresh Token Service for FIDU Chat Lab
 * 
 * This service handles automatic token refresh when access tokens expire.
 * It can be integrated into existing API clients without changing their interface.
 */

import {
  getFiduAuthService,
  AuthenticationRequiredError,
  TokenAcquisitionTimeoutError,
} from '../auth/FiduAuthService';
import { beginLogout, completeLogout, currentLogoutSource } from '../auth/logoutCoordinator';

export interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface TokenRefreshError {
  error: string;
  message: string;
}

class RefreshTokenService {
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;
  private readonly identityServiceUrl: string;

  constructor() {
    // Get identity service URL from environment or use default
    this.identityServiceUrl = this.getIdentityServiceUrl();
  }

  private getIdentityServiceUrl(): string {
    // Try to get from environment, fallback to default
    if (typeof window !== 'undefined') {
      const envUrl = (window as any).__FIDU_ENV__?.IDENTITY_SERVICE_URL;
      if (envUrl) return envUrl;
    }
    return 'https://identity.firstdataunion.org';
  }

  /**
   * Get the current access token from localStorage
   */
  getAccessToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Get the current refresh token from localStorage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('fiduRefreshToken');
  }

  /**
   * Check if the current access token is expired
   * We'll use a simple heuristic: if we have a refresh token, assume the access token might be expired
   */
  private isTokenExpired(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    
    // If no access token, it's expired
    if (!accessToken) return true;
    
    // If we have a refresh token, check if access token is expired
    if (refreshToken) {
      try {
        // Decode JWT to check expiration
        const payload = this.decodeJWT(accessToken);
        if (payload && payload.exp) {
          // Add 5 minute buffer for safety
          const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
          return Date.now() >= (payload.exp * 1000) - bufferTime;
        }
      } catch (error) {
        // If we can't decode the JWT, assume it's expired
        console.warn('Could not decode JWT token, assuming expired:', error);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Decode a JWT token to extract payload
   */
  private decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.identityServiceUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const errorData: TokenRefreshError = await response.json().catch(() => ({
          error: 'unknown',
          message: 'Failed to refresh token'
        }));
        
        throw new Error(errorData.message || `Token refresh failed: ${response.status}`);
      }

      const data: TokenRefreshResponse = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from refresh endpoint');
      }

      // Update the access token in localStorage
      localStorage.setItem('auth_token', data.access_token);
      
      // Update token expiration if provided
      if (data.expires_in) {
        localStorage.setItem('token_expires_in', data.expires_in.toString());
      }

      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string> {
    // If we're already refreshing, wait for that promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    // Check if token is expired
    if (this.isTokenExpired()) {
      // Start refresh process
      this.isRefreshing = true;
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.isRefreshing = false;
        this.refreshPromise = null;
      });

      return this.refreshPromise;
    }

    // Token is still valid, return it
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    return accessToken;
  }

  /**
   * Handle 401 responses by attempting token refresh and retrying the request
   */
  async handleUnauthorized<T>(
    originalRequest: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      // Try the original request first
      return await originalRequest();
    } catch (error: any) {
      // Check if it's a 401 error and we haven't retried yet
      if (error?.response?.status === 401 && retryCount === 0) {
        try {
          // Attempt to refresh the token
          await this.refreshAccessToken();
          
          // Retry the request once
          return await originalRequest();
        } catch (refreshError) {
          console.error('Token refresh failed, logging out user:', refreshError);
          
          // Clear all auth tokens and dispatch logout action
          this.clearAllAuthTokens();
          
          // Dispatch logout action to update Redux state
          this.dispatchLogout();
          
          throw new Error('Authentication required. Please log in again.');
        }
      }
      
      // Re-throw the original error if it's not a 401 or we've already retried
      throw error;
    }
  }

  /**
   * Clear all authentication tokens and data
   */
  clearAllAuthTokens(): void {
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
   * Dispatch logout action to update Redux state
   * This ensures the UI properly reflects the authentication state change
   */
  private dispatchLogout(): void {
    try {
      const started = beginLogout('auto');
      if (!started) {
        const source = currentLogoutSource();
        console.log('🔁 Logout already in progress, skipping duplicate auto-dispatch', { source });
        return;
      }
      // Import the store dynamically to avoid circular dependencies
      import('../../store').then(({ store }) => {
        // Import the logout action dynamically
        import('../../store/slices/authSlice').then(({ logout }) => {
          store.dispatch(logout()).catch((error) => {
            console.error('Logout dispatch failed:', error);
            // Ensure logout coordinator is reset even if dispatch fails
            completeLogout();
            // Fallback to page reload if logout fails
            window.location.reload();
          });
        }).catch((error) => {
          console.warn('Failed to import logout action:', error);
          // Ensure logout coordinator is reset
          completeLogout();
          // Fallback to page reload if Redux dispatch fails
          window.location.reload();
        });
      }).catch((error) => {
        console.warn('Failed to import store:', error);
        // Ensure logout coordinator is reset
        completeLogout();
        // Fallback to page reload if Redux dispatch fails
        window.location.reload();
      });
    } catch (error) {
      console.warn('Failed to dispatch logout action:', error);
      // Ensure logout coordinator is reset
      completeLogout();
      // Fallback to page reload if Redux dispatch fails
      window.location.reload();
    }
  }

  /**
   * Create an axios interceptor that automatically handles token refresh
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
          const token = await getFiduAuthService().ensureAccessToken({
            onWait: () => console.log('🔐 Ensuring FIDU auth before identity service request...'),
          });

        if (token) {
            headers.Authorization = `Bearer ${token}`;
            return config;
          }
        } catch (error) {
          if (error instanceof AuthenticationRequiredError) {
            this.clearAllAuthTokens();
            this.dispatchLogout();
            return Promise.reject(error);
          }

          if (error instanceof TokenAcquisitionTimeoutError) {
            return Promise.reject(error);
          }

          console.warn('Failed to ensure FIDU auth token before request:', error);
        }

        const fallbackToken = this.getAccessToken();
        if (fallbackToken) {
          headers.Authorization = `Bearer ${fallbackToken}`;
        }

        return config;
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
            const newToken = await this.refreshAccessToken();
            
            // Update the authorization header
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Retry the original request
            return this.retryRequest(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed, logging out user:', refreshError);
            
            // Clear all auth tokens and dispatch logout action
            this.clearAllAuthTokens();
            
            // Dispatch logout action to update Redux state
            this.dispatchLogout();
            
            return Promise.reject(new Error('Authentication required. Please log in again.'));
          }
        }
        
        return Promise.reject(error);
      }
    };
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

// Create and export a singleton instance
export const refreshTokenService = new RefreshTokenService();

// Export the class for testing or custom instances
export { RefreshTokenService };
