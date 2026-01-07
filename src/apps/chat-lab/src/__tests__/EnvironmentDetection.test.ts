/**
 * Environment Detection Test
 * Tests that environment detection works correctly for dev/prod switching
 */

// Mock axios
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockAxiosInstance = {
  post: mockPost,
  get: mockGet,
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

// Mock FiduAuthService
const mockFiduAuthService = {
  ensureAccessToken: jest.fn().mockResolvedValue(undefined),
  createAuthInterceptor: jest.fn(() => ({
    request: jest.fn((config) => config),
    response: jest.fn((response) => response),
    error: jest.fn(),
  })),
};

jest.mock('../services/auth/FiduAuthService', () => ({
  getFiduAuthService: jest.fn(() => mockFiduAuthService),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  TokenAcquisitionTimeoutError: class TokenAcquisitionTimeoutError extends Error {},
}));

import { detectRuntimeEnvironment } from '../utils/environment';
import { CookieSettingsService } from '../services/settings/CookieSettingsService';
import { UserSettings } from '../types';

describe('Environment Detection for Dev/Prod Switching', () => {
  beforeEach(() => {
    // Mock window.location with default values
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
      },
      writable: true,
    });

    jest.clearAllMocks();
  });

  describe('CookieSettingsService Environment Detection', () => {
    it('should detect dev environment correctly', () => {
      // Mock dev environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const environment = detectRuntimeEnvironment();
      expect(environment).toBe('dev');
    });

    it('should detect prod environment correctly', () => {
      // Mock prod environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const environment = detectRuntimeEnvironment();
      expect(environment).toBe('prod');
    });

    it('should detect local environment correctly', () => {
      // Mock local environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'localhost',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const environment = detectRuntimeEnvironment();
      expect(environment).toBe('local');
    });

    it('should generate correct environment prefix', () => {
      // Test dev prefix
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      const devPrefix = devService['getEnvironmentPrefix']();
      expect(devPrefix).toBe('_dev');

      // Test prod prefix (should be empty)
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const prodService = new CookieSettingsService();
      const prodPrefix = prodService['getEnvironmentPrefix']();
      expect(prodPrefix).toBe('');
    });
  });

  describe('Environment-Specific Cookie Names', () => {
    it('should use dev cookie names for dev environment', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      
      // Mock axios post to return success
      mockPost.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const mockSettings = { theme: 'dark', storageMode: 'cloud' } as UserSettings;
      await devService.setSettings(mockSettings);

      // Verify the request includes environment information
      expect(mockPost).toHaveBeenCalledWith(
        'api/settings/set',
        expect.objectContaining({
          settings: expect.objectContaining({
            environment: 'dev',
            environmentPrefix: '_dev',
          }),
          environment: 'dev',
        })
      );
    });

    it('should use prod cookie names for prod environment', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const prodService = new CookieSettingsService();
      
      // Mock axios post to return success
      mockPost.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const mockSettings = { theme: 'dark', storageMode: 'cloud' } as UserSettings;
      await prodService.setSettings(mockSettings);

      // Verify the request includes environment information
      expect(mockPost).toHaveBeenCalledWith(
        'api/settings/set',
        expect.objectContaining({
          settings: expect.objectContaining({
            environment: 'prod',
            environmentPrefix: '',
          }),
          environment: 'prod',
        })
      );
    });

    it('should validate environment when retrieving settings', async () => {
      // Mock dev environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      
      // Mock axios get to return settings for wrong environment
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: { 
          settings: { 
            theme: 'dark', 
            environment: 'prod' // Wrong environment!
          } 
        },
      });

      const result = await devService.getSettings();
      // Should return null because environment doesn't match
      expect(result).toBeNull();
      expect(mockGet).toHaveBeenCalledWith('api/settings/get?env=dev');
    });
  });

  describe('URL Pattern Matching', () => {
    it('should handle various dev subdomain patterns', () => {
      const testCases = [
        { hostname: 'dev.chatlab.firstdataunion.org', expected: 'dev' },
        { hostname: 'dev.firstdataunion.org', expected: 'dev' },
        { hostname: 'staging.dev.firstdataunion.org', expected: 'dev' },
        { hostname: 'test-dev.firstdataunion.org', expected: 'dev' },
      ];

      testCases.forEach(({ hostname, expected }) => {
        Object.defineProperty(window, 'location', {
          value: {
            hostname,
            pathname: '/fidu-chat-lab',
          },
          writable: true,
        });

        const environment = detectRuntimeEnvironment();
        expect(environment).toBe(expected);
      });
    });
  });
});
