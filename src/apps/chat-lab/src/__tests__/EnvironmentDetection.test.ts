/**
 * Environment Detection Test
 * Tests that environment detection works correctly for dev/prod switching
 */

import { detectRuntimeEnvironment } from '../utils/environment';
import { CookieSettingsService } from '../services/settings/CookieSettingsService';

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
    it('should use different cookie names for different environments', async () => {
      // Test dev environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      
      // Mock fetch to capture the request
      global.fetch = jest.fn()
        // Mock auth token fetch first
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Then mock settings call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const mockSettings = { theme: 'dark', storageMode: 'cloud' };
      await devService.setSettings(mockSettings);

      // Verify the request includes environment information
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/fidu-chat-lab/api/settings/set',
        expect.objectContaining({
          body: expect.stringContaining('"environment":"dev"'),
        })
      );
    });

    it('should validate environment when retrieving settings', () => {
      // Mock dev environment
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'dev.chatlab.firstdataunion.org',
          pathname: '/fidu-chat-lab',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      
      // Mock fetch to return settings for wrong environment
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          settings: { 
            theme: 'dark', 
            environment: 'prod' // Wrong environment!
          } 
        }),
      });

      return devService.getSettings().then(result => {
        // Should return null because environment doesn't match
        expect(result).toBeNull();
      });
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
