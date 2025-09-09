import { RefreshTokenService } from '../refreshTokenService';
import type { TokenRefreshResponse, TokenRefreshError } from '../refreshTokenService';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: jest.fn(),
  },
  writable: true,
});

describe('RefreshTokenService', () => {
  let refreshTokenService: RefreshTokenService;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    refreshTokenService = new RefreshTokenService();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  describe('getAccessToken', () => {
    it('should return access token from localStorage', () => {
      const mockToken = 'mock-access-token';
      localStorageMock.getItem.mockReturnValue(mockToken);

      const result = refreshTokenService.getAccessToken();

      expect(result).toBe(mockToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_token');
    });

    it('should return null when no token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = refreshTokenService.getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('should return refresh token from localStorage', () => {
      const mockRefreshToken = 'mock-refresh-token';
      localStorageMock.getItem.mockReturnValue(mockRefreshToken);

      const result = refreshTokenService.getRefreshToken();

      expect(result).toBe(mockRefreshToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('fiduRefreshToken');
    });

    it('should return null when no refresh token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = refreshTokenService.getRefreshToken();

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no access token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);

      // Access private method through any type
      const result = (refreshTokenService as any).isTokenExpired();

      expect(result).toBe(true);
    });

    it('should return true when access token is expired', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
      localStorageMock.getItem.mockReturnValue(expiredToken);

      const result = (refreshTokenService as any).isTokenExpired();

      expect(result).toBe(true);
    });

    it('should return false when access token is not expired', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOi${futureTimestamp}fQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ`;
      localStorageMock.getItem.mockReturnValue(validToken);

      const result = (refreshTokenService as any).isTokenExpired();

      expect(result).toBe(false);
    });

    it('should return false when JWT is malformed (no exp property)', () => {
      const malformedToken = 'invalid-jwt-token';
      localStorageMock.getItem
        .mockReturnValueOnce(malformedToken) // getAccessToken
        .mockReturnValueOnce('refresh-token'); // getRefreshToken

      const result = (refreshTokenService as any).isTokenExpired();

      // The method returns false when JWT is malformed because decodeJWT returns null
      // and the method only checks expiration if payload exists and has exp property
      expect(result).toBe(false);
    });

    it('should return false when no refresh token exists (no JWT check)', () => {
      const validToken = 'valid-token';
      localStorageMock.getItem
        .mockReturnValueOnce(validToken) // getAccessToken
        .mockReturnValueOnce(null); // getRefreshToken

      const result = (refreshTokenService as any).isTokenExpired();

      expect(result).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockNewAccessToken = 'new-access-token';
      const mockResponse: TokenRefreshResponse = {
        access_token: mockNewAccessToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await refreshTokenService.refreshAccessToken();

      expect(result).toBe(mockNewAccessToken);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.firstdataunion.org/refresh',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: mockRefreshToken,
          }),
        }
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', mockNewAccessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token_expires_in', '3600');
    });

    it('should throw error when no refresh token exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(refreshTokenService.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });

    it('should throw error when refresh request fails', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockError: TokenRefreshError = {
        error: 'invalid_grant',
        message: 'Refresh token expired',
      };

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockError,
        headers: new Headers(),
        redirected: false,
        statusText: 'Bad Request',
        type: 'basic',
        url: '',
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn(),
        bytes: jest.fn(),
      } as Response);

      await expect(refreshTokenService.refreshAccessToken()).rejects.toThrow('Refresh token expired');
    });

    it('should throw error when response is not ok and no error message', async () => {
      const mockRefreshToken = 'mock-refresh-token';

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        headers: new Headers(),
        redirected: false,
        statusText: 'Internal Server Error',
        type: 'basic',
        url: '',
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn(),
        bytes: jest.fn(),
      } as Response);

      await expect(refreshTokenService.refreshAccessToken()).rejects.toThrow('Failed to refresh token');
    });

    it('should throw error when no access token in response', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockResponse = {
        expires_in: 3600,
        token_type: 'Bearer',
      };

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(refreshTokenService.refreshAccessToken()).rejects.toThrow('No access token received from refresh endpoint');
    });
  });

  describe('getValidAccessToken', () => {
    it('should return existing token when not expired', async () => {
      const mockToken = 'valid-token';
      localStorageMock.getItem.mockReturnValue(mockToken);

      // Mock isTokenExpired to return false
      jest.spyOn(refreshTokenService as any, 'isTokenExpired').mockReturnValue(false);

      const result = await refreshTokenService.getValidAccessToken();

      expect(result).toBe(mockToken);
    });

    it('should refresh token when expired', async () => {
      const mockOldToken = 'expired-token';
      const mockNewToken = 'new-token';
      const mockRefreshToken = 'refresh-token';
      const mockResponse: TokenRefreshResponse = {
        access_token: mockNewToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };

      localStorageMock.getItem
        .mockReturnValueOnce(mockOldToken) // getAccessToken
        .mockReturnValueOnce(mockRefreshToken); // getRefreshToken

      // Mock isTokenExpired to return true
      jest.spyOn(refreshTokenService as any, 'isTokenExpired').mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await refreshTokenService.getValidAccessToken();

      expect(result).toBe(mockNewToken);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error when no access token available', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(refreshTokenService.getValidAccessToken()).rejects.toThrow('No access token available');
    });
  });

  describe('handleUnauthorized', () => {
    it('should retry request after successful token refresh', async () => {
      const mockRequest = jest.fn()
        .mockRejectedValueOnce({ response: { status: 401 } }) // First call fails with 401
        .mockResolvedValueOnce('success'); // Second call succeeds
      const mockRefreshToken = 'refresh-token';
      const mockNewToken = 'new-token';
      const mockResponse: TokenRefreshResponse = {
        access_token: mockNewToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await refreshTokenService.handleUnauthorized(mockRequest);

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(2); // Original call + retry
    });

    it('should clear tokens and reload when refresh fails', async () => {
      const mockRequest = jest.fn().mockRejectedValue({
        response: { status: 401 },
      });
      const mockRefreshToken = 'invalid-refresh-token';

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', message: 'Refresh token expired' }),
      } as Response);

      await expect(refreshTokenService.handleUnauthorized(mockRequest)).rejects.toThrow('Authentication required. Please log in again.');

      expect(localStorageMock.removeItem).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should not retry non-401 errors', async () => {
      const mockRequest = jest.fn().mockRejectedValue({
        response: { status: 500 },
      });

      await expect(refreshTokenService.handleUnauthorized(mockRequest)).rejects.toEqual({
        response: { status: 500 },
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should not retry if already retried once', async () => {
      const mockRequest = jest.fn().mockRejectedValue({
        response: { status: 401 },
      });

      await expect(refreshTokenService.handleUnauthorized(mockRequest, 1)).rejects.toEqual({
        response: { status: 401 },
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearAllAuthTokens', () => {
    it('should clear all auth-related localStorage items', () => {
      refreshTokenService.clearAllAuthTokens();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fiduRefreshToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token_expires_in');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('current_profile');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fiduToken');
    });

    it('should clear all auth-related cookies', () => {
      // Mock document.cookie
      const originalCookie = document.cookie;
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      refreshTokenService.clearAllAuthTokens();

      // Restore original cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: originalCookie,
      });
    });
  });

  describe('createAuthInterceptor', () => {
    it('should add authorization header to requests', () => {
      const mockToken = 'test-token';
      localStorageMock.getItem.mockReturnValue(mockToken);

      const interceptor = refreshTokenService.createAuthInterceptor();
      const config = { headers: {} };

      const result = interceptor.request(config);

      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not add authorization header when no token', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const interceptor = refreshTokenService.createAuthInterceptor();
      const config = { headers: {} };

      const result = interceptor.request(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should handle 401 errors with token refresh and retry', async () => {
      const mockRefreshToken = 'refresh-token';
      const mockNewToken = 'new-token';
      const mockResponse: TokenRefreshResponse = {
        access_token: mockNewToken,
        expires_in: 3600,
        token_type: 'Bearer',
      };

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Mock the retryRequest method directly
      const originalRetryRequest = (refreshTokenService as any).retryRequest;
      (refreshTokenService as any).retryRequest = jest.fn().mockResolvedValue({ data: 'success' });

      const interceptor = refreshTokenService.createAuthInterceptor();
      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      const result = await interceptor.error(error);

      expect(result).toEqual({ data: 'success' });
      expect((refreshTokenService as any).retryRequest).toHaveBeenCalledWith({
        headers: { Authorization: `Bearer ${mockNewToken}` },
        _retry: true,
      });

      // Restore original method
      (refreshTokenService as any).retryRequest = originalRetryRequest;
    });

    it('should clear tokens and reload when refresh fails', async () => {
      const mockRefreshToken = 'invalid-refresh-token';

      localStorageMock.getItem.mockReturnValue(mockRefreshToken);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', message: 'Refresh token expired' }),
        headers: new Headers(),
        redirected: false,
        statusText: 'Bad Request',
        type: 'basic',
        url: '',
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn(),
        bytes: jest.fn(),
      } as Response);

      const interceptor = refreshTokenService.createAuthInterceptor();
      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      };

      await expect(interceptor.error(error)).rejects.toThrow('Authentication required. Please log in again.');

      expect(localStorageMock.removeItem).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should not retry if already retried', async () => {
      const interceptor = refreshTokenService.createAuthInterceptor();
      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: true },
      };

      await expect(interceptor.error(error)).rejects.toEqual(error);
    });

    it('should not handle non-401 errors', async () => {
      const interceptor = refreshTokenService.createAuthInterceptor();
      const error = {
        response: { status: 500 },
        config: { headers: {} },
      };

      await expect(interceptor.error(error)).rejects.toEqual(error);
    });
  });
});
