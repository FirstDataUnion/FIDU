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
    request: jest.fn(config => config),
    response: jest.fn(response => response),
    error: jest.fn(),
  })),
};

jest.mock('../services/auth/FiduAuthService', () => ({
  getFiduAuthService: jest.fn(() => mockFiduAuthService),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  TokenAcquisitionTimeoutError: class TokenAcquisitionTimeoutError extends Error {},
}));

// Unmock the environment module so we can test the real detectRuntimeEnvironment function
// Jest automatically uses __mocks__/utils/environment.ts, but we need the real implementation
jest.unmock('../utils/environment');

import { detectRuntimeEnvironment } from '../utils/environment';
import { CookieSettingsService } from '../services/settings/CookieSettingsService';
import { UserSettings } from '../types';

describe('Environment Detection for Dev/Prod Switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CookieSettingsService Environment Detection', () => {
    it('should detect dev environment correctly', () => {
      // Mock dev environment by passing a mock location object
      const mockLocation = {
        hostname: 'dev.chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://dev.chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      // Verify the mock location has the expected hostname
      expect((mockLocation as any).hostname).toBe(
        'dev.chatlab.firstdataunion.org'
      );

      const environment = detectRuntimeEnvironment(mockLocation);
      expect(environment).toBe('dev');
    });

    it('should detect prod environment correctly', () => {
      // Mock prod environment by passing a mock location object
      const mockLocation = {
        hostname: 'chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const environment = detectRuntimeEnvironment(mockLocation);
      expect(environment).toBe('prod');
    });

    it('should detect local environment correctly', () => {
      // Mock local environment by passing a mock location object
      const mockLocation = {
        hostname: 'localhost',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://localhost:3000/fidu-chat-lab',
        protocol: 'http:',
        port: '3000',
      } as Location;

      const environment = detectRuntimeEnvironment(mockLocation);
      expect(environment).toBe('local');
    });

    it('should generate correct environment prefix', () => {
      // Test dev prefix
      const devLocation = {
        hostname: 'dev.chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://dev.chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const devService = new CookieSettingsService(undefined, devLocation);
      const devPrefix = devService['getEnvironmentPrefix']();
      expect(devPrefix).toBe('_dev');

      // Test prod prefix (should be empty)
      const prodLocation = {
        hostname: 'chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const prodService = new CookieSettingsService(undefined, prodLocation);
      const prodPrefix = prodService['getEnvironmentPrefix']();
      expect(prodPrefix).toBe('');
    });
  });

  describe('Environment-Specific Cookie Names', () => {
    it('should use dev cookie names for dev environment', async () => {
      const devLocation = {
        hostname: 'dev.chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://dev.chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const devService = new CookieSettingsService(undefined, devLocation);

      // Mock axios post to return success
      mockPost.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const mockSettings = {
        theme: 'dark',
        storageMode: 'cloud',
      } as UserSettings;
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
      const prodLocation = {
        hostname: 'chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const prodService = new CookieSettingsService(undefined, prodLocation);

      // Mock axios post to return success
      mockPost.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const mockSettings = {
        theme: 'dark',
        storageMode: 'cloud',
      } as UserSettings;
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
      const devLocation = {
        hostname: 'dev.chatlab.firstdataunion.org',
        pathname: '/fidu-chat-lab',
        search: '',
        hash: '',
        href: 'http://dev.chatlab.firstdataunion.org/fidu-chat-lab',
        protocol: 'http:',
        port: '',
      } as Location;

      const devService = new CookieSettingsService(undefined, devLocation);

      // Mock axios get to return settings for wrong environment
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          settings: {
            theme: 'dark',
            environment: 'prod', // Wrong environment!
          },
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
        const mockLocation = {
          hostname,
          pathname: '/fidu-chat-lab',
          search: '',
          hash: '',
          href: `http://${hostname}/fidu-chat-lab`,
          protocol: 'http:',
          port: '',
        } as Location;

        const environment = detectRuntimeEnvironment(mockLocation);
        expect(environment).toBe(expected);
      });
    });
  });
});
