import { FiduAuthService } from '../FiduAuthService';

// Mock fetch globally
global.fetch = jest.fn();

const createResponse = (overrides: Partial<Response> & { json?: () => Promise<any> }) => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
  ...overrides,
}) as unknown as Response;

describe('FiduAuthService', () => {
  let authService: FiduAuthService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    authService = new FiduAuthService();
  });

  describe('hasRefreshToken', () => {
    it('should return true when refresh token exists', async () => {
      // Mock successful token retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        }),
      } as Response);

      const result = await authService.hasRefreshToken();
      expect(result).toBe(true);
    });

    it('should return false when no refresh token exists', async () => {
      // Mock response with no refresh token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-access-token',
          refresh_token: null,
          expires_in: 3600,
        }),
      } as Response);

      const result = await authService.hasRefreshToken();
      expect(result).toBe(false);
    });

    it('should return false when tokens request fails', async () => {
      // Mock failed request
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await authService.hasRefreshToken();
      expect(result).toBe(false);
    });

    it('should return false when tokens request throws error', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await authService.hasRefreshToken();
      expect(result).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      // hasRefreshToken -> getTokens
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));

      // refresh request
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      }));

      const result = await authService.refreshAccessToken();
      expect(result).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/fidu/refresh-access-token'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should handle 401 error gracefully (no refresh token)', async () => {
      // hasRefreshToken -> tokens with refresh
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));

      // Mock 401 response (no refresh token) - refresh call
      mockFetch.mockResolvedValueOnce(createResponse({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: 'No refresh token found in cookies for dev environment',
        }),
      }));
      localStorage.setItem('auth_token', 'stale');
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));

      // Mock 500 error
      mockFetch.mockResolvedValueOnce(createResponse({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error',
        }),
        text: () => Promise.resolve('Internal server error'),
      }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to refresh FIDU access token:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to refresh FIDU access token:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getAccessToken', () => {
    it('should return existing access token when valid', async () => {
      // Mock successful token retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'valid-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        }),
      } as Response);

      const result = await authService.getAccessToken();
      expect(result).toBe('valid-access-token');
    });

    it('should refresh token when no access token but refresh token exists', async () => {
      // Mock tokens response with no access token
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: null,
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        }),
      }));

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await authService.getAccessToken();
      
      expect(result).toBe('new-access-token');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should return null when no tokens exist', async () => {
      // Mock tokens response with no tokens
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: null,
          refresh_token: null,
          expires_in: 0,
        }),
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await authService.getAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      // Mock error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await authService.getAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Error retrieving FIDU auth tokens:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('environment handling', () => {
    it('should use correct environment in API calls', async () => {
      // Create service with dev environment
      const devAuthService = new FiduAuthService();
      
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));
      
      // Mock successful refresh
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      }));

      await devAuthService.refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('env=local'),
        expect.any(Object)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({
          access_token: 'cached-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        }),
      }));

      // Mock malformed JSON
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('Invalid JSON'),
      }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to refresh FIDU access token:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle empty response body', async () => {
      // Mock empty response
      mockFetch.mockResolvedValueOnce(createResponse({
        json: () => Promise.resolve({}),
      }));

      const result = await authService.refreshAccessToken();
      expect(result).toBeNull();
    });

  });
});
