/**
 * Tests for CookieSettingsService
 * High-impact tests for cookie-based settings storage
 */

import { CookieSettingsService } from '../CookieSettingsService';
import { getFiduAuthService } from '../../auth/FiduAuthService';
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

const createResponse = (body: any, overrides: Partial<Response> = {}) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
  ...overrides,
}) as unknown as Response;

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
    localStorage.clear();
    const fiduService = getFiduAuthService() as any;
    fiduService.cachedAccessToken = null;
    fiduService.cachedRefreshTokenAvailable = null;
    fiduService.refreshPromise = null;
    
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
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockResolvedValueOnce(createResponse({ success: true }));

      const result = await service.setSettings(mockSettings);

      expect(result.success).toBe(true);
      const calls = (fetch as jest.Mock).mock.calls;
      expect(calls.some(([url]) => url === '/fidu-chat-lab/api/auth/fidu/get-tokens?env=prod')).toBe(true);
      const settingsCall = calls.find(([url]) => url === '/fidu-chat-lab/api/settings/set');
      expect(settingsCall).toBeDefined();
      expect(settingsCall?.[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-auth-token',
          }),
          credentials: 'include',
          body: expect.stringContaining('"environment":"prod"'),
        })
      );
    });

    it('should handle server errors gracefully', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
          })
        )
        .mockResolvedValueOnce(createResponse({}, { ok: false, status: 500 }));

      const result = await service.setSettings(mockSettings);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('request_failed');
      expect(result.status).toBe(500);
    });

    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
          })
        )
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await service.setSettings(mockSettings);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unexpected_error');
    });
  });

  describe('getSettings', () => {
    it('should successfully retrieve settings from HTTP-only cookie', async () => {
      // Mock the auth token fetch first
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockResolvedValueOnce(createResponse({ settings: mockSettings }));

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      const calls = (fetch as jest.Mock).mock.calls;
      expect(calls.some(([url]) => url === '/fidu-chat-lab/api/auth/fidu/get-tokens?env=prod')).toBe(true);
      const getCall = calls.find(([url]) => url === '/fidu-chat-lab/api/settings/get?env=prod');
      expect(getCall).toBeDefined();
      expect(getCall?.[1]).toEqual(
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer test-auth-token' }),
          credentials: 'include',
        })
      );
    });

    it('should return null when no settings found', async () => {
      // Mock the auth token fetch first
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockResolvedValueOnce(createResponse({}));

      const result = await service.getSettings();

      expect(result).toBeNull();
    });

    it('should handle server errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(createResponse({}, { ok: false, status: 404 }));

      const result = await service.getSettings();

      expect(result).toBeNull();
    });
  });

  describe('getSettingsWithRetry', () => {
    it('should retry on failure and eventually succeed', async () => {
      // Mock auth token fetch
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createResponse({ settings: mockSettings }));

      const result = await service.getSettingsWithRetry(2);

      expect(result).toEqual(mockSettings);
      expect((fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should return null after all retries fail', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getSettingsWithRetry(2);

      expect(result).toBeNull();
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
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockResolvedValueOnce(createResponse({ success: true }));

      await prodService.setSettings(mockSettings);
      
      // Verify the correct path was used for settings
      expect((fetch as jest.Mock).mock.calls.some(([url]) => url === '/fidu-chat-lab/api/settings/set')).toBe(true);
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
        .mockResolvedValueOnce(
          createResponse({
            access_token: 'test-auth-token',
            refresh_token: 'test-refresh-token',
            user: { id: 'test-user', email: 'test@example.com' },
        })
        )
        .mockResolvedValueOnce(createResponse({ success: true }));

      await devService.setSettings(mockSettings);
      
      // Verify the correct path was used for settings
      expect((fetch as jest.Mock).mock.calls.some(([url]) => url === '/api/settings/set')).toBe(true);
    });
  });
});
