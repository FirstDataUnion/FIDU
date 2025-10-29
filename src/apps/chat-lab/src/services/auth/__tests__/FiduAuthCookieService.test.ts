import { FiduAuthCookieService } from '../FiduAuthCookieService';

// Mock fetch globally
global.fetch = jest.fn();

describe('FiduAuthCookieService', () => {
  let authService: FiduAuthCookieService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new FiduAuthCookieService();
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
      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      } as Response);

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
      // Mock 401 response (no refresh token) - refresh call
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: 'No refresh token found in cookies for dev environment',
        }),
      } as Response);

      // Mock clear tokens call (automatically called when refresh fails with 401)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ FIDU refresh token is invalid - clearing all tokens'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🗑️ Clearing FIDU auth tokens for')
      );
      
      // Should make 2 API calls: refresh (fails) + clear tokens
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle other HTTP errors', async () => {
      // Mock 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error',
        }),
      } as Response);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Failed to refresh FIDU access token:',
        500
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error refreshing FIDU access token:',
        expect.any(Error)
      );
      
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: null,
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        }),
      } as Response);

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      } as Response);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await authService.getAccessToken();
      
      expect(result).toBe('new-access-token');
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔄 No access token found, attempting refresh...'
      );
      
      consoleSpy.mockRestore();
    });

    it('should return null when no tokens exist', async () => {
      // Mock tokens response with no tokens
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: null,
          refresh_token: null,
          expires_in: 0,
        }),
      } as Response);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await authService.getAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'ℹ️ No FIDU auth tokens found in HTTP-only cookies for local environment'
      );
      
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
      const devAuthService = new FiduAuthCookieService();
      
      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      } as Response);

      await devAuthService.refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('env=local'),
        expect.any(Object)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle malformed JSON response', async () => {
      // Mock malformed JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await authService.refreshAccessToken();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error refreshing FIDU access token:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle empty response body', async () => {
      // Mock empty response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await authService.refreshAccessToken();
      expect(result).toBeUndefined();
    });

    it('should handle concurrent refresh attempts', async () => {
      // Mock successful responses for both calls
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      } as Response);

      // Start two concurrent refresh attempts
      const promise1 = authService.refreshAccessToken();
      const promise2 = authService.refreshAccessToken();

      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe('test-token');
      expect(result2).toBe('test-token');
      // Both calls will make API requests (no deduplication in current implementation)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
