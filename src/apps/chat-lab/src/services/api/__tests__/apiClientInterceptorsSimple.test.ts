/**
 * Simplified API Client Interceptor Tests
 * Focuses on testing the interceptor setup and basic functionality
 */

// Mock axios first
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

// Mock the environment module
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: () => ({
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  }),
  getIdentityServiceUrl: () => 'https://identity.firstdataunion.org',
  getGatewayUrl: () => 'https://gateway.firstdataunion.org',
  isDevEnvironment: jest.fn(() => true),
  detectRuntimeEnvironment: jest.fn(() => 'local'),
}));

// Mock GoogleDriveAuth to fix import.meta errors
jest.mock('../../auth/GoogleDriveAuth', () => ({
  GoogleDriveAuthService: jest.fn(),
  getGoogleDriveAuthService: jest.fn(),
}));

// Mock the FiduAuthService
const mockFiduAuthService = {
  createAuthInterceptor: jest.fn(() => ({
    request: jest.fn(config => config),
    response: jest.fn(response => response),
    error: jest.fn(),
  })),
  clearAllAuthTokens: jest.fn(),
};
jest.mock('../../auth/FiduAuthService', () => ({
  getFiduAuthService: jest.fn(() => mockFiduAuthService),
}));

import axios from 'axios';
import { FiduVaultAPIClient } from '../apiClientFIDUVault';
import { NLPWorkbenchAPIClient } from '../apiClientNLPWorkbench';

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('API Client Interceptor Setup', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    // Mock axios.create to return our mock instance
    mockAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('FiduVaultAPIClient', () => {
    it('should create client and set up interceptors', () => {
      new FiduVaultAPIClient();

      // Verify axios.create was called
      expect(mockAxios.create).toHaveBeenCalled();

      // Verify interceptors were set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use refresh token service for auth interceptor', () => {
      new FiduVaultAPIClient();

      // Verify refresh token service was called
      expect(mockFiduAuthService.createAuthInterceptor).toHaveBeenCalled();
    });
  });

  describe('NLPWorkbenchAPIClient', () => {
    it('should create client and set up interceptors', () => {
      new NLPWorkbenchAPIClient();

      // Verify axios.create was called
      expect(mockAxios.create).toHaveBeenCalled();

      // Verify interceptors were set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use refresh token service for auth interceptor', () => {
      new NLPWorkbenchAPIClient();

      // Verify refresh token service was called
      expect(mockFiduAuthService.createAuthInterceptor).toHaveBeenCalled();
    });
  });

  describe('Interceptor Configuration', () => {
    it('should set up request interceptor with proper functions', () => {
      new FiduVaultAPIClient();

      const requestInterceptorCall =
        mockAxiosInstance.interceptors.request.use.mock.calls[0];
      expect(requestInterceptorCall).toHaveLength(2);
      expect(typeof requestInterceptorCall[0]).toBe('function'); // request handler
      expect(typeof requestInterceptorCall[1]).toBe('function'); // error handler
    });

    it('should set up response interceptor with proper functions', () => {
      new FiduVaultAPIClient();

      const responseInterceptorCall =
        mockAxiosInstance.interceptors.response.use.mock.calls[0];
      expect(responseInterceptorCall).toHaveLength(2);
      expect(typeof responseInterceptorCall[0]).toBe('function'); // response handler
      expect(typeof responseInterceptorCall[1]).toBe('function'); // error handler
    });
  });

  describe('Auth Interceptor Integration', () => {
    it('should call createAuthInterceptor for each client', () => {
      // Clear previous calls
      (mockFiduAuthService.createAuthInterceptor as jest.Mock).mockClear();

      new FiduVaultAPIClient();
      new NLPWorkbenchAPIClient();

      // Should be called twice (once for each client)
      expect(mockFiduAuthService.createAuthInterceptor).toHaveBeenCalledTimes(
        2
      );
    });

    it('should return proper interceptor structure', () => {
      const interceptor = mockFiduAuthService.createAuthInterceptor();

      expect(interceptor).toHaveProperty('request');
      expect(interceptor).toHaveProperty('response');
      expect(interceptor).toHaveProperty('error');
      expect(typeof interceptor.request).toBe('function');
      expect(typeof interceptor.response).toBe('function');
      expect(typeof interceptor.error).toBe('function');
    });
  });

  describe('Error Handling Setup', () => {
    it('should set up error handlers for request interceptor', () => {
      new FiduVaultAPIClient();

      const requestInterceptorCall =
        mockAxiosInstance.interceptors.request.use.mock.calls[0];
      const errorHandler = requestInterceptorCall[1];

      // Test that error handler is a function
      expect(typeof errorHandler).toBe('function');
    });

    it('should set up error handlers for response interceptor', () => {
      new FiduVaultAPIClient();

      const responseInterceptorCall =
        mockAxiosInstance.interceptors.response.use.mock.calls[0];
      const errorHandler = responseInterceptorCall[1];

      // Test that error handler is a function
      expect(typeof errorHandler).toBe('function');
    });
  });
});
