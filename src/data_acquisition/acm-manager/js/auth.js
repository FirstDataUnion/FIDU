/**
 * ACM Manager - Authentication Service
 * 
 * Responsible for:
 * - User authentication with FIDU Core
 * - Token management and storage
 * - Authenticated API calls
 * - Profile management
 */

class AuthService {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:4000/api/v1';
    this.tokenKey = 'fidu_auth_token';
    this.userKey = 'fidu_user_data';
    this.selectedProfileKey = 'fidu_selected_profile';
  }

  /**
   * Login user with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} - Login result
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseUrl}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      // Store token and user data
      await this.storeAuthData(data.access_token, data.user);
      
      return {
        success: true,
        user: data.user,
        token: data.access_token
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register a new user
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @param {string} firstName - User's first name
   * @param {string} lastName - User's last name
   * @returns {Promise<Object>} - Registration result
   */
  async register(email, password, firstName, lastName) {
    try {
      const response = await fetch(`${this.baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: this.generateRequestId(),
          user: {
            email: email,
            first_name: firstName,
            last_name: lastName
          },
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      
      return {
        success: true,
        user: data
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logout user and clear stored data
   */
  async logout() {
    try {
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

      // Verify token is still valid by making a test request
      const response = await fetch(`${this.baseUrl}/users/current`, {
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
      await chrome.storage.local.set({
        [this.tokenKey]: token,
        [this.userKey]: user
      });
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
      const response = await this.authenticatedRequest(`${this.baseUrl}/profiles`);
      
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
      const user = await this.getCurrentUser();
      if (!user) {
        throw new Error('User not found');
      }

      const response = await this.authenticatedRequest(`${this.baseUrl}/profiles`, {
        method: 'POST',
        body: JSON.stringify({
          request_id: this.generateRequestId(),
          profile: {
            user_id: user.id,
            name: name
          }
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
      await chrome.storage.local.set({
        [this.selectedProfileKey]: profile,
        'selectedProfileId': profile.id
      });
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