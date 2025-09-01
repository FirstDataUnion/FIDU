/**
 * Refresh Token Service for FIDU Chat Grabber
 * 
 * This service handles automatic token refresh when access tokens expire.
 * It can be integrated into existing API clients without changing their interface.
 */

class RefreshTokenService {
  constructor() {
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.identityServiceUrl = this.getIdentityServiceUrl();
  }

  /**
   * Get the identity service URL from configuration
   */
  getIdentityServiceUrl() {
    // Try to get from configuration, fallback to default
    if (typeof getFiduIdentityServiceUrl === 'function') {
      let url = null;
      getFiduIdentityServiceUrl((identityUrl) => {
        url = identityUrl;
      });
      if (url) return url;
    }
    return 'https://identity.firstdataunion.org';
  }

  /**
   * Get the current access token from storage
   */
  async getAccessToken() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // In extension context, use chrome.storage
        chrome.storage.local.get(['fidu_auth_token'], (result) => {
          resolve(result.fidu_auth_token || null);
        });
      } else {
        // In content script context, use localStorage
        resolve(localStorage.getItem('fidu_auth_token') || null);
      }
    });
  }

  /**
   * Get the current refresh token from storage
   */
  async getRefreshToken() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // In extension context, use chrome.storage
        chrome.storage.local.get(['fiduRefreshToken'], (result) => {
          resolve(result.fiduRefreshToken || null);
        });
      } else {
        // In content script context, use localStorage
        resolve(localStorage.getItem('fiduRefreshToken') || null);
      }
    });
  }

  /**
   * Check if the current access token is expired
   */
  async isTokenExpired() {
    const accessToken = await this.getAccessToken();
    const refreshToken = await this.getRefreshToken();
    
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
  decodeJWT(token) {
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
  async refreshAccessToken() {
    const refreshToken = await this.getRefreshToken();
    
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
        const errorData = await response.json().catch(() => ({
          error: 'unknown',
          message: 'Failed to refresh token'
        }));
        
        throw new Error(errorData.message || `Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from refresh endpoint');
      }

      // Update the access token in storage
      await this.storeAccessToken(data.access_token);
      
      // Update token expiration if provided
      if (data.expires_in) {
        await this.storeTokenExpiration(data.expires_in);
      }

      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Store the access token in the appropriate storage
   */
  async storeAccessToken(token) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // In extension context, use chrome.storage
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'fidu_auth_token': token }, resolve);
      });
    } else {
      // In content script context, use localStorage
      localStorage.setItem('fidu_auth_token', token);
    }
  }

  /**
   * Store token expiration in the appropriate storage
   */
  async storeTokenExpiration(expiresIn) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // In extension context, use chrome.storage
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'token_expires_in': expiresIn.toString() }, resolve);
      });
    } else {
      // In content script context, use localStorage
      localStorage.setItem('token_expires_in', expiresIn.toString());
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken() {
    // If we're already refreshing, wait for that promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    // Check if token is expired
    if (await this.isTokenExpired()) {
      // Start refresh process
      this.isRefreshing = true;
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.isRefreshing = false;
        this.refreshPromise = null;
      });

      return this.refreshPromise;
    }

    // Token is still valid, return it
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    return accessToken;
  }

  /**
   * Handle 401 responses by attempting token refresh and retrying the request
   */
  async handleUnauthorized(originalRequest, retryCount = 0) {
    try {
      // Try the original request first
      return await originalRequest();
    } catch (error) {
      // Check if it's a 401 error and we haven't retried yet
      if (error?.status === 401 && retryCount === 0) {
        try {
          // Attempt to refresh the token
          await this.refreshAccessToken();
          
          // Retry the request once
          return await originalRequest();
        } catch (refreshError) {
          console.error('Token refresh failed, logging out user:', refreshError);
          
          // Clear all auth tokens and redirect to login
          await this.clearAllAuthTokens();
          
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
  async clearAllAuthTokens() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // In extension context, use chrome.storage
      await new Promise((resolve) => {
        chrome.storage.local.remove([
          'fidu_auth_token',
          'fiduRefreshToken',
          'token_expires_in',
          'fidu_user_data',
          'fidu_selected_profile',
          'selectedProfileId'
        ], resolve);
      });
    } else {
      // In content script context, use localStorage
      localStorage.removeItem('fidu_auth_token');
      localStorage.removeItem('fiduRefreshToken');
      localStorage.removeItem('token_expires_in');
      localStorage.removeItem('fidu_user_data');
      localStorage.removeItem('fidu_selected_profile');
      localStorage.removeItem('selectedProfileId');
    }
  }

  /**
   * Create a fetch wrapper that automatically handles token refresh
   */
  createAuthenticatedFetch() {
    return async (url, options = {}) => {
      const originalRequest = async () => {
        const token = await this.getValidAccessToken();
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
        };

        const response = await fetch(url, {
          ...options,
          headers
        });

        if (response.status === 401) {
          // Create an error object that mimics fetch response
          const error = new Error('Unauthorized');
          error.status = 401;
          error.response = response;
          throw error;
        }

        return response;
      };

      return this.handleUnauthorized(originalRequest);
    };
  }
}

// Create and export a singleton instance
const refreshTokenService = new RefreshTokenService();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RefreshTokenService;
}

// Make available globally for content scripts and extension
if (typeof window !== 'undefined') {
  window.refreshTokenService = refreshTokenService;
}

// Also make available in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.refreshTokenService = refreshTokenService;
}
