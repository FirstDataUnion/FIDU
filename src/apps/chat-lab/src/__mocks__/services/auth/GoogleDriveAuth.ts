// Mock for GoogleDriveAuth to avoid import.meta.env issues in tests
export const getGoogleDriveAuthService = jest.fn();

// Mock the GoogleDriveAuthService class
export class GoogleDriveAuthService {
  constructor() {}

  async initialize() {
    return Promise.resolve();
  }

  getAuthStatus() {
    return {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    };
  }

  async authenticate() {
    return Promise.resolve();
  }

  async refreshToken() {
    return Promise.resolve();
  }

  async revokeToken() {
    return Promise.resolve();
  }

  async getUserInfo() {
    return Promise.resolve(null);
  }
}

// Default export
export default GoogleDriveAuthService;
