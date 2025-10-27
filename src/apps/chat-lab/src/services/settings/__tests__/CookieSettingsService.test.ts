/**
 * Tests for CookieSettingsService
 * High-impact tests for cookie-based settings storage
 */

import { CookieSettingsService } from '../CookieSettingsService';
import type { UserSettings } from '../../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('CookieSettingsService', () => {
  let service: CookieSettingsService;
  const mockSettings: UserSettings = {
    id: 'test-user',
    theme: 'dark',
    language: 'en',
    autoExtractMemories: false,
    notificationsEnabled: false,
    defaultPlatform: 'chatgpt',
    exportFormat: 'json',
    lastUsedModel: 'gpt-4',
    storageMode: 'cloud',
    storageConfigured: true,
    userSelectedStorageMode: true,
    apiKeys: {},
    privacySettings: {
      shareAnalytics: true,
      autoBackup: false,
      dataRetentionDays: 365,
    },
    displaySettings: {
      itemsPerPage: 20,
      showTimestamps: true,
      compactView: false,
      groupByDate: true,
    },
    syncSettings: {
      autoSyncDelayMinutes: 5,
    },
  };

  beforeEach(() => {
    // Mock window.location for production path and environment
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/fidu-chat-lab/some-page',
        hostname: 'chatlab.firstdataunion.org', // Default to prod environment
      },
      writable: true,
    });
    
    service = new CookieSettingsService();
    jest.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('setSettings', () => {
    it('should successfully store settings in HTTP-only cookie', async () => {
      // Mock the auth token fetch first
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Then mock the settings storage
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const result = await service.setSettings(mockSettings);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // First call should be to get auth tokens
      expect(fetch).toHaveBeenNthCalledWith(1,
        '/fidu-chat-lab/api/auth/fidu/get-tokens?env=prod',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
      
      // Second call should be to store settings
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/fidu-chat-lab/api/settings/set',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-auth-token',
          },
          credentials: 'include',
          body: expect.stringContaining('"environment":"prod"'),
        })
      );
    });

    it('should handle server errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.setSettings(mockSettings);

      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.setSettings(mockSettings);

      expect(result).toBe(false);
    });
  });

  describe('getSettings', () => {
    it('should successfully retrieve settings from HTTP-only cookie', async () => {
      // Mock the auth token fetch first
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Then mock the settings retrieval
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // First call should be to get auth tokens
      expect(fetch).toHaveBeenNthCalledWith(1,
        '/fidu-chat-lab/api/auth/fidu/get-tokens?env=prod',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
      
      // Second call should be to get settings
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/fidu-chat-lab/api/settings/get?env=prod',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-auth-token',
          },
          credentials: 'include',
        })
      );
    });

    it('should return null when no settings found', async () => {
      // Mock the auth token fetch first
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Then mock empty settings response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      const result = await service.getSettings();

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle server errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.getSettings();

      expect(result).toBeNull();
    });
  });

  describe('getSettingsWithRetry', () => {
    it('should retry on failure and eventually succeed', async () => {
      // Mock auth token fetch
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // First call fails
        .mockRejectedValueOnce(new Error('Network error'))
        // Auth token for retry
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ settings: mockSettings }),
        });

      const result = await service.getSettingsWithRetry(2);

      expect(result).toEqual(mockSettings);
      expect(fetch).toHaveBeenCalledTimes(4); // 1 auth + 1 auth retry + 2 settings calls
    });

    it('should return null after all retries fail', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getSettingsWithRetry(2);

      expect(result).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should skip retry when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const result = await service.getSettingsWithRetry(3);

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('path handling', () => {
    it('should use correct base path for production', async () => {
      // Mock window.location for production
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/fidu-chat-lab/some-page',
          hostname: 'chatlab.firstdataunion.org',
        },
        writable: true,
      });

      const prodService = new CookieSettingsService();
      
      // Mock auth token fetch
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Mock settings call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      await prodService.setSettings(mockSettings);
      
      // Verify the correct path was used for settings
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/fidu-chat-lab/api/settings/set',
        expect.any(Object)
      );
    });

    it('should use empty base path for development', async () => {
      // Mock window.location for development
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/some-page',
          hostname: 'localhost',
        },
        writable: true,
      });

      const devService = new CookieSettingsService();
      
      // Mock auth token fetch
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' }
          }),
        })
        // Mock settings call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      await devService.setSettings(mockSettings);
      
      // Verify the correct path was used for settings
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/api/settings/set',
        expect.any(Object)
      );
    });
  });
});
