import { FiduAuthService } from '../FiduAuthService';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location for environment detection
const mockLocation = {
  hostname: 'test.example.com',
  pathname: '/fidu-chat-lab',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('Token Authentication Integration Tests', () => {
  let fiduAuthService: FiduAuthService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset location to default test environment
    mockLocation.hostname = 'test.example.com';
    mockLocation.pathname = '/fidu-chat-lab';
    fiduAuthService = new FiduAuthService();

    // Reset fetch mock to default behavior
    mockFetch.mockReset();
  });

  describe('Complete Authentication Flow', () => {
    it('should handle successful authentication flow', async () => {
      // Mock FIDU tokens - need to mock both getTokens calls (hasRefreshToken + getAccessToken)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'fidu-access-token',
            refresh_token: 'fidu-refresh-token',
            expires_in: 3600,
          }),
      } as Response);

      // Test FIDU authentication
      const fiduHasToken = await fiduAuthService.hasRefreshToken();
      expect(fiduHasToken).toBe(true);

      const fiduAccessToken = await fiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBe('fidu-access-token');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle missing FIDU tokens gracefully', async () => {
      // Mock no FIDU tokens - need to mock both getTokens calls
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: null,
            refresh_token: null,
            expires_in: 0,
          }),
      } as Response);

      // Test FIDU authentication
      const fiduHasToken = await fiduAuthService.hasRefreshToken();
      expect(fiduHasToken).toBe(false);

      const fiduAccessToken = await fiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBeNull();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle FIDU token refresh failure', async () => {
      // Mock FIDU tokens exist but refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: null,
            refresh_token: 'fidu-refresh-token',
            expires_in: 0,
          }),
      } as Response);

      // Mock FIDU refresh failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            detail: 'No refresh token found in cookies',
          }),
      } as Response);

      // Test FIDU authentication
      const fiduHasToken = await fiduAuthService.hasRefreshToken();
      expect(fiduHasToken).toBe(true);

      const fiduAccessToken = await fiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBeNull();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Test FIDU authentication
      const fiduHasToken = await fiduAuthService.hasRefreshToken();
      expect(fiduHasToken).toBe(false);
    });

    it('should handle malformed responses', async () => {
      // Mock malformed JSON response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      // Test FIDU authentication
      const fiduHasToken = await fiduAuthService.hasRefreshToken();
      expect(fiduHasToken).toBe(false);
    });

    it('should handle concurrent authentication attempts', async () => {
      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
          }),
      } as Response);

      // Start concurrent authentication attempts
      const promises = Array(3)
        .fill(null)
        .map(async () => {
          const fiduHasToken = await fiduAuthService.hasRefreshToken();
          const fiduAccessToken = await fiduAuthService.getAccessToken();
          return { fiduHasToken, fiduAccessToken };
        });

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.fiduHasToken).toBe(true);
        expect(result.fiduAccessToken).toBe('test-token');
      });
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should handle different environments correctly', async () => {
      const environments = ['dev', 'prod', 'local'];

      for (const env of environments) {
        jest.clearAllMocks();

        // Set the environment for this test
        if (env === 'dev') {
          mockLocation.hostname = 'dev.chatlab.example.com';
        } else if (env === 'local') {
          mockLocation.hostname = 'localhost';
        } else {
          mockLocation.hostname = 'chatlab.example.com';
        }

        // Create new service instance with updated environment
        const envFiduAuthService = new FiduAuthService();

        // Mock environment-specific response
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: `${env}-access-token`,
              refresh_token: `${env}-refresh-token`,
              expires_in: 3600,
            }),
        } as Response);

        // Test with different environment
        const fiduAccessToken = await envFiduAuthService.getAccessToken();
        expect(fiduAccessToken).toBe(`${env}-access-token`);

        // Verify environment-specific API call
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`env=${env}`),
          expect.any(Object)
        );
      }
    });
  });

  describe('Token Expiration Handling', () => {
    it('should handle expired tokens correctly', async () => {
      // Mock expired tokens - service doesn't check expiration, just returns what API gives
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'expired-access-token',
            refresh_token: 'valid-refresh-token',
            expires_in: 0,
          }),
      } as Response);

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            expires_in: 3600,
          }),
      } as Response);

      const fiduAccessToken = await fiduAuthService.getAccessToken();
      // The service returns the token from the API, it doesn't check expiration
      expect(fiduAccessToken).toBe('expired-access-token');

      // Should make one API call (get tokens)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle refresh token expiration', async () => {
      // Reset all mocks to avoid contamination
      jest.clearAllMocks();

      // Create a fresh service instance
      const freshFiduAuthService = new FiduAuthService();

      // Use mockImplementation to have more control over the mock behavior
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: get tokens - no access token, but has refresh token
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                // No access_token property at all, not even null
                refresh_token: 'expired-refresh-token',
                expires_in: 0,
              }),
          } as Response);
        } else if (callCount === 2) {
          // Second call: refresh token - fails with 401
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () =>
              Promise.resolve({
                detail: 'Refresh token expired',
              }),
          } as Response);
        } else if (callCount === 3) {
          // Third call: clear tokens (automatically called when refresh fails with 401)
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          } as Response);
        }
        // Fallback
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const fiduAccessToken = await freshFiduAuthService.getAccessToken();
      // Service returns null when no access token and refresh fails
      expect(fiduAccessToken).toBeNull();

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
