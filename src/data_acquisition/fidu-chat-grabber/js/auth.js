/**
 * FIDU Chat Grabber - Authentication Service
 * 
 * Responsible for:
 * - User authentication with FIDU Vault
 * - Token management and storage
 * - Authenticated API calls
 * - Profile management
 */

class AuthService {
  constructor() {
    // Initialize with a default URL, will be updated when config is loaded
    this.baseUrl = 'https://identity.firstdataunion.org';
    this.tokenKey = 'fidu_auth_token';
    this.userKey = 'fidu_user_data';
    this.selectedProfileKey = 'fidu_selected_profile';
    
    // Initialize the base URL from settings
    this.initializeBaseUrl();
  }
  
  /**
   * Initialize the base URL from Chrome storage settings
   */
  async initializeBaseUrl() {
    try {
      if (typeof getFiduIdentityServiceUrl === 'function') {
        getFiduIdentityServiceUrl((url) => {
          this.baseUrl = url;
        });
      }
    } catch (error) {
      console.error('Failed to initialize base URL:', error);
    }
  }

  /**
   * Get the current base URL from storage (always fresh)
   * @returns {Promise<string>} - Current base URL
   */
  async getCurrentBaseUrl() {
    return new Promise((resolve) => {
      // Check if we're in a content script context
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // In content script context, use default URL since we can't access settings
        resolve(this.baseUrl);
        return;
      }
      
      if (typeof getFiduIdentityServiceUrl === 'function') {
        getFiduIdentityServiceUrl((url) => {
          resolve(url);
        });
      } else {
        // Fallback to default if getFiduIdentityServiceUrl is not available
        resolve(this.baseUrl);
      }
    });
  }

  /**
   * Logout user and clear stored data
   */
  async logout() {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.selectedProfileKey);
        localStorage.removeItem('selectedProfileId');
        return { success: true };
      }
      
      await chrome.storage.local.remove([this.tokenKey, this.userKey, this.selectedProfileKey, 'selectedProfileId']);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {Promise<boolean>} - True if authenticated
   */
  async isAuthenticated() {
    try {
      const token = await this.getToken();
      if (!token) {
        return false;
      }

      // Check if we're in a content script context
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // In content script context, just check if we have a token and user data
        // Don't make network requests due to CORS restrictions
        const userData = localStorage.getItem(this.userKey);
        return !!(token && userData);
      }

      // In extension context (popup, background, options), we can make network requests
      // Get the current base URL (always fresh)
      const currentBaseUrl = await this.getCurrentBaseUrl();

      // Verify token is still valid by making a test request
      const response = await fetch(`${currentBaseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  /**
   * Get current user data
   * @returns {Promise<Object|null>} - User data or null
   */
  async getCurrentUser() {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        const userData = localStorage.getItem(this.userKey);
        return userData ? JSON.parse(userData) : null;
      }
      
      const result = await chrome.storage.local.get([this.userKey]);
      return result[this.userKey] || null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Get stored authentication token
   * @returns {Promise<string|null>} - Token or null
   */
  async getToken() {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        return localStorage.getItem(this.tokenKey) || null;
      }
      
      const result = await chrome.storage.local.get([this.tokenKey]);
      return result[this.tokenKey] || null;
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

    /**
   * Store authentication data
   * @param {string} token - JWT token
   * @param {Object} user - User data
   */
  async storeAuthData(token, user) {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        return;
      }
      
      await chrome.storage.local.set({
        [this.tokenKey]: token,
        [this.userKey]: user
      });
      
      // Notify background script about auth status change if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          await chrome.runtime.sendMessage({ action: 'authStatusChanged', event: 'login' });
        } catch (error) {
          console.error('Error notifying background script of auth change after login:', error);
        }
      }
    } catch (error) {
      console.error('Store auth data error:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated API request
   * @param {string} url - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - API response
   */
  async authenticatedRequest(url, options = {}) {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

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
        // Token expired or invalid, clear stored data
        await this.logout();
        
        // Wait a moment for storage to be cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Notify background script about auth status change if we're in extension context
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            await chrome.runtime.sendMessage({ action: 'authStatusChanged', event: 'logout' });
          } catch (error) {
            console.error('Error notifying background script of auth change:', error);
          }
        }
        
        throw new Error('Authentication expired. Please login again.');
      }

      return response;
    } catch (error) {
      console.error('Authenticated request error:', error);
      throw error;
    }
  }

  /**
   * Get all profiles for the current user
   * @returns {Promise<Object>} - Profiles result
   */
  async getProfiles() {
    try {
      const currentBaseUrl = await this.getCurrentBaseUrl();
      const response = await this.authenticatedRequest(`${currentBaseUrl}/profiles`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const profiles = await response.json();
      return {
        success: true,
        profiles: profiles
      };
    } catch (error) {
      console.error('Get profiles error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new profile
   * @param {string} name - Profile name
   * @returns {Promise<Object>} - Create profile result
   */
  async createProfile(name) {
    try {
      const currentBaseUrl = await this.getCurrentBaseUrl();
      const response = await this.authenticatedRequest(`${currentBaseUrl}/profile`, {
        method: 'POST',
        body: JSON.stringify({
          display_name: name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const profile = await response.json();
      return {
        success: true,
        profile: profile
      };
    } catch (error) {
      console.error('Create profile error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the currently selected profile
   * @returns {Promise<Object|null>} - Selected profile or null
   */
  async getSelectedProfile() {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        const profileData = localStorage.getItem(this.selectedProfileKey);
        return profileData ? JSON.parse(profileData) : null;
      }
      
      const result = await chrome.storage.local.get([this.selectedProfileKey]);
      return result[this.selectedProfileKey] || null;
    } catch (error) {
      console.error('Get selected profile error:', error);
      return null;
    }
  }

    /**
   * Set the selected profile
   * @param {Object} profile - Profile object to select
   */
  async setSelectedProfile(profile) {
    try {
      // Check if we're in a content script context (no direct access to chrome.storage)
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Use localStorage as fallback for content scripts
        localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
        localStorage.setItem('selectedProfileId', profile.id);
        return;
      }
      
      await chrome.storage.local.set({
        [this.selectedProfileKey]: profile,
        'selectedProfileId': profile.id
      });
      
      // Notify background script about auth status change if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          await chrome.runtime.sendMessage({ action: 'authStatusChanged', event: 'profile_change' });
        } catch (error) {
          console.error('Error notifying background script of auth change after profile change:', error);
        }
      }
    } catch (error) {
      console.error('Set selected profile error:', error);
      throw error;
    }
  }

  /**
   * Get the selected profile ID for use in data packets
   * @returns {Promise<string|null>} - Profile ID or null
   */
  async getSelectedProfileId() {
    try {
      const profile = await this.getSelectedProfile();
      return profile ? profile.id : null;
    } catch (error) {
      console.error('Get selected profile ID error:', error);
      return null;
    }
  }

  /**
   * Generate a unique request ID
   * @returns {string} - Request ID
   */
  generateRequestId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Update the base URL for API calls
   * @param {string} url - New base URL
   */
  setBaseUrl(url) {
    this.baseUrl = url;
  }
}

// Create a singleton instance
const authService = new AuthService();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
} 

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.authService = authService;
}