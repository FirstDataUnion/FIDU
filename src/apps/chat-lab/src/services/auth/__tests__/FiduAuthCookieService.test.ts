import { FiduAuthService } from '../FiduAuthService';

// Mock fetch globally
global.fetch = jest.fn();

const createResponse = (
  overrides: Partial<Response> & { json?: () => Promise<any> }
) =>
  ({
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
    authService = new FiduAuthService();
  });

  describe('hasRefreshToken', () => {
    it('should return true when refresh token exists', async () => {
      // Mock successful token retrieval
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
        json: () =>
          Promise.resolve({
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

  describe('environment handling', () => {
    it('should use correct environment in API calls', async () => {
      // Create service with dev environment
      const devAuthService = new FiduAuthService();

      mockFetch.mockResolvedValueOnce(
        createResponse({
          json: () =>
            Promise.resolve({
              access_token: 'cached-token',
              refresh_token: 'refresh-token',
              expires_in: 3600,
            }),
        })
      );

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce(
        createResponse({
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              expires_in: 3600,
            }),
        })
      );

      await devAuthService.ensureAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('env=local'),
        expect.any(Object)
      );
    });
  });
});
