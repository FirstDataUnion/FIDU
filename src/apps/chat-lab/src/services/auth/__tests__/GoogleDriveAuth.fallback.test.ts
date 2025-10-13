/**
 * Unit tests for GoogleDriveAuth fallback mechanism
 * Tests the security-critical behavior of OAuth token exchange fallback
 */

import { GoogleDriveAuthService } from '../GoogleDriveAuth';

describe('GoogleDriveAuthService - Fallback Mechanism', () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: any;

  beforeEach(() => {
    // Save original fetch and environment
    originalFetch = global.fetch;
    originalEnv = { ...import.meta.env };
    
    // Reset environment
    delete (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET;
    (import.meta.env as any).PROD = false;
  });

  afterEach(() => {
    // Restore original fetch and environment
    global.fetch = originalFetch;
    Object.assign(import.meta.env, originalEnv);
  });

  describe('Backend Success Path', () => {
    it('should use backend when available and responding', async () => {
      // Mock successful backend response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'backend_access_token',
          refresh_token: 'backend_refresh_token',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
        })
      });

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      // Access private method for testing
      const tokens = await (service as any).exchangeCodeForTokens('test_code');
      
      expect(tokens.accessToken).toBe('backend_access_token');
      expect(tokens.refreshToken).toBe('backend_refresh_token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/oauth/exchange-code'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('Network Error Fallback', () => {
    it('should fall back to direct OAuth on timeout', async () => {
      // Mock timeout error
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes('/api/oauth')) {
          return Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        }
        // Mock Google OAuth response for fallback
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'direct_access_token',
            refresh_token: 'direct_refresh_token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
          })
        });
      });

      (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET = 'test_secret';

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      const tokens = await (service as any).exchangeCodeForTokens('test_code');
      
      expect(tokens.accessToken).toBe('direct_access_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(Object)
      );
    });

    it('should fall back on network error', async () => {
      // Mock network error
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes('/api/oauth')) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'direct_access_token',
            refresh_token: 'direct_refresh_token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
          })
        });
      });

      (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET = 'test_secret';

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      await expect((service as any).exchangeCodeForTokens('test_code')).resolves.toBeDefined();
    });
  });

  describe('Backend Error Handling', () => {
    it('should NOT fall back on backend 500 error', async () => {
      // Mock backend error response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      // Should throw, not fall back
      await expect((service as any).exchangeCodeForTokens('test_code'))
        .rejects
        .toThrow('Backend OAuth error (500)');
    });

    it('should NOT fall back on backend 400 error', async () => {
      // Mock backend bad request
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request - invalid code'
      });

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      await expect((service as any).exchangeCodeForTokens('test_code'))
        .rejects
        .toThrow('Backend OAuth error (400)');
    });
  });

  describe('Production Security', () => {
    it('should warn when using direct OAuth in production', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate production environment
      (import.meta.env as any).PROD = true;
      (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET = 'secret';
      
      // Mock backend unavailable
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes('/api/oauth')) {
          return Promise.reject(new TypeError('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
          })
        });
      });

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      await (service as any).exchangeCodeForTokens('test_code');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY WARNING')
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should fail fast when strict mode enabled in production', async () => {
      (import.meta.env as any).PROD = true;
      (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET = 'secret';
      (import.meta.env as any).VITE_DISABLE_INSECURE_FALLBACK = 'true';
      
      // Mock backend unavailable
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'));

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      await expect((service as any).exchangeCodeForTokens('test_code'))
        .rejects
        .toThrow('Insecure OAuth fallback is disabled in production');
    });
  });

  describe('Missing Client Secret', () => {
    it('should fail gracefully when client secret missing in fallback', async () => {
      // Mock backend unavailable
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'));
      
      // No client secret set
      delete (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET;

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      await expect((service as any).exchangeCodeForTokens('test_code'))
        .rejects
        .toThrow('Backend unavailable and VITE_GOOGLE_CLIENT_SECRET not set');
    });
  });

  describe('AbortSignal Compatibility', () => {
    it('should work without native AbortSignal.timeout', async () => {
      // Remove native implementation
      const originalTimeout = AbortSignal.timeout;
      delete (AbortSignal as any).timeout;
      
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
        })
      });

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      await expect((service as any).exchangeCodeForTokens('test_code'))
        .resolves
        .toBeDefined();
      
      // Restore
      if (originalTimeout) {
        (AbortSignal as any).timeout = originalTimeout;
      }
    });
  });

  describe('Token Refresh Fallback', () => {
    it('should fall back token refresh on network error', async () => {
      // Mock backend unavailable for refresh
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes('/api/oauth/refresh-token')) {
          return Promise.reject(new TypeError('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'refreshed_token',
            expires_in: 3600
          })
        });
      });

      (import.meta.env as any).VITE_GOOGLE_CLIENT_SECRET = 'test_secret';

      const config = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/oauth-callback',
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      };

      const service = new GoogleDriveAuthService(config);
      
      // Set up tokens to refresh
      (service as any).tokens = {
        accessToken: 'old_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'required scopes'
      };

      const newToken = await (service as any).performTokenRefresh();
      
      expect(newToken).toBe('refreshed_token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(Object)
      );
    });
  });
});

