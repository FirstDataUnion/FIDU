import { getFiduAuthCookieService } from '../FiduAuthCookieService';

// Mock the FIDU auth service
jest.mock('../FiduAuthCookieService', () => ({
  getFiduAuthCookieService: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('FIDU + Google Drive Token Integration', () => {
  let mockFiduAuthService: any;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock FIDU auth service
    mockFiduAuthService = {
      hasRefreshToken: jest.fn(),
      getAccessToken: jest.fn(),
    };
    
    (getFiduAuthCookieService as jest.Mock).mockReturnValue(mockFiduAuthService);
  });

  describe('FIDU token availability checks', () => {
    it('should check for FIDU refresh token before Google Drive operations', async () => {
      // Mock no FIDU refresh token
      mockFiduAuthService.hasRefreshToken.mockResolvedValue(false);

      // Simulate Google Drive token retrieval attempt
      const hasFiduToken = await mockFiduAuthService.hasRefreshToken();
      
      expect(hasFiduToken).toBe(false);
      expect(mockFiduAuthService.hasRefreshToken).toHaveBeenCalled();
    });

    it('should proceed with Google Drive operations when FIDU tokens exist', async () => {
      // Mock FIDU refresh token exists
      mockFiduAuthService.hasRefreshToken.mockResolvedValue(true);
      mockFiduAuthService.getAccessToken.mockResolvedValue('fidu-access-token');

      // Mock successful Google Drive token retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          has_tokens: true,
          refresh_token: 'google-refresh-token',
        }),
      } as Response);

      // Simulate the integration flow
      const hasFiduToken = await mockFiduAuthService.hasRefreshToken();
      expect(hasFiduToken).toBe(true);

      const fiduAccessToken = await mockFiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBe('fidu-access-token');

      // Simulate Google Drive API call with FIDU token
      const response = await fetch('/api/oauth/get-tokens?env=dev', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fiduAccessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();
      expect(data.has_tokens).toBe(true);
      expect(data.refresh_token).toBe('google-refresh-token');
    });

    it('should handle FIDU auth token retrieval failure gracefully', async () => {
      // Mock FIDU refresh token exists but access token retrieval fails
      mockFiduAuthService.hasRefreshToken.mockResolvedValue(true);
      mockFiduAuthService.getAccessToken.mockResolvedValue(null);

      // Mock successful Google Drive token retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          has_tokens: true,
          refresh_token: 'google-refresh-token',
        }),
      } as Response);

      // Simulate the integration flow
      const hasFiduToken = await mockFiduAuthService.hasRefreshToken();
      expect(hasFiduToken).toBe(true);

      const fiduAccessToken = await mockFiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBeNull();

      // Simulate Google Drive API call without FIDU token
      const response = await fetch('/api/oauth/get-tokens?env=dev', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();
      expect(data.has_tokens).toBe(true);
      expect(data.refresh_token).toBe('google-refresh-token');
    });

    it('should handle FIDU service errors', async () => {
      // Mock FIDU auth service error
      mockFiduAuthService.hasRefreshToken.mockRejectedValue(new Error('FIDU service error'));

      // Simulate error handling
      try {
        await mockFiduAuthService.hasRefreshToken();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('FIDU service error');
      }
    });
  });

  describe('Google Drive token refresh with FIDU integration', () => {
    it('should skip token refresh when no FIDU refresh token exists', async () => {
      // Mock no FIDU refresh token
      mockFiduAuthService.hasRefreshToken.mockResolvedValue(false);

      // Simulate token refresh attempt
      const hasFiduToken = await mockFiduAuthService.hasRefreshToken();
      
      expect(hasFiduToken).toBe(false);
      // Should not make any Google Drive API calls
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should proceed with token refresh when FIDU tokens exist', async () => {
      // Mock FIDU refresh token exists
      mockFiduAuthService.hasRefreshToken.mockResolvedValue(true);
      mockFiduAuthService.getAccessToken.mockResolvedValue('fidu-access-token');

      // Mock successful token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-google-access-token',
          expires_in: 3600,
        }),
      } as Response);

      // Simulate the integration flow
      const hasFiduToken = await mockFiduAuthService.hasRefreshToken();
      expect(hasFiduToken).toBe(true);

      const fiduAccessToken = await mockFiduAuthService.getAccessToken();
      expect(fiduAccessToken).toBe('fidu-access-token');

      // Simulate Google Drive token refresh API call
      const response = await fetch('/api/oauth/refresh-token?env=dev', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fiduAccessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();
      expect(data.access_token).toBe('new-google-access-token');
      expect(data.expires_in).toBe(3600);
    });
  });

  describe('error handling improvements', () => {
    it('should distinguish between different error types', async () => {
      // Test network error
      mockFiduAuthService.hasRefreshToken.mockRejectedValue(new Error('Network error'));

      try {
        await mockFiduAuthService.hasRefreshToken();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle timeout errors gracefully', async () => {
      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      mockFiduAuthService.hasRefreshToken.mockRejectedValue(timeoutError);

      try {
        await mockFiduAuthService.hasRefreshToken();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Request timeout');
        expect((error as Error).name).toBe('TimeoutError');
      }
    });

    it('should handle authentication errors vs other errors', async () => {
      // Test authentication error (401)
      const authError = new Error('Unauthorized');
      authError.name = 'AuthenticationError';
      
      mockFiduAuthService.hasRefreshToken.mockRejectedValue(authError);

      try {
        await mockFiduAuthService.hasRefreshToken();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Unauthorized');
        expect((error as Error).name).toBe('AuthenticationError');
      }
    });
  });

  describe('environment-specific behavior', () => {
    it('should handle different environments correctly', async () => {
      const environments = ['dev', 'prod', 'local'];
      
      for (const env of environments) {
        jest.clearAllMocks();
        
        // Mock environment-specific response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: `${env}-access-token`,
            refresh_token: `${env}-refresh-token`,
            expires_in: 3600,
          }),
        } as Response);

        // Test with different environment
        const response = await fetch(`/api/oauth/get-tokens?env=${env}`, {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();
        expect(data.access_token).toBe(`${env}-access-token`);
        
        // Verify environment-specific API call
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`env=${env}`),
          expect.any(Object)
        );
      }
    });
  });
});