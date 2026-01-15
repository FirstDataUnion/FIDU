/**
 * Tests for CookieSettingsService
 * High-impact tests for cookie-based settings storage
 */
import express from 'express';
import type { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';

import { CookieSettingsService } from '../CookieSettingsService';
import { getFiduAuthService } from '../../auth/FiduAuthService';
import type { UserSettings } from '../../../types';
import { AddressInfo } from 'net';

// Test tokens
const fiduAccessToken = 'test-auth-token';
const fiduRefreshToken = 'test-refresh-token';

describe('CookieSettingsService', () => {
  let testPort: number;
  let testBaseUrl: string;
  let fiduApp: Express;
  let fiduServer: Server;
  let fiduAppCallHistory: Array<{
    url: string;
    method: string;
    authorization?: string;
  }> = [];

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

  async function setUpMockServer(): Promise<void> {
    fiduApp = express();
    fiduApp.use(express.json());
    fiduApp.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type'
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });
    // Debug helper middleware
    // fiduApp.use((req, res, next) => {
    //   console.log(req.method, req.path, req.headers.authorization || 'no auth');
    //   next();
    //   console.log(req.method, req.path, res.statusCode);
    // });
    fiduApp.use((req, res, next) => {
      if (req.method !== 'OPTIONS') {
        fiduAppCallHistory.push({
          url: req.url,
          method: req.method,
          authorization: req.headers.authorization,
        });
      }
      next();
    });
    fiduApp.options('*path', (req: Request, res: Response) => {
      res.sendStatus(200);
    });

    fiduServer = createServer(fiduApp);
    return new Promise(resolve => {
      fiduServer.listen(0, () => {
        const address = fiduServer.address() as AddressInfo;
        testPort = address.port;
        testBaseUrl = `http://localhost:${testPort}`;
        resolve();
      });
    });
  }

  afterEach(done => {
    fiduAppCallHistory = [];
    if (fiduServer.listening) {
      fiduServer.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(async () => {
    await setUpMockServer();

    // Mock window.location for production path and environment
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/fidu-chat-lab/some-page',
        hostname: 'dev.chatlab.firstdataunion.org',
      },
      writable: true,
    });

    service = new CookieSettingsService(testBaseUrl);
    const fiduService = getFiduAuthService() as any;
    fiduService.cachedAccessToken = null;
    fiduService.cachedRefreshTokenAvailable = null;
    fiduService.refreshPromise = null;

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          return { success: true };
        },
      })
      .mockImplementation(() => {
        expect('SUT should not use fetch').toBe(false);
      });
    getFiduAuthService().setTokens(fiduAccessToken, fiduRefreshToken, {
      id: 'test-user',
      email: 'test@example.com',
      profiles: [],
    });
  });

  describe('setSettings', () => {
    it('should successfully store settings in HTTP-only cookie', async () => {
      fiduApp.post('/api/settings/set', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const result = await service.setSettings(mockSettings);

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(fiduAppCallHistory).toContainEqual({
        method: 'POST',
        authorization: `Bearer ${fiduAccessToken}`,
        url: '/api/settings/set',
      });
    });

    it('should handle server errors gracefully', async () => {
      fiduApp.post('/api/settings/set', (req: Request, res: Response) => {
        res.sendStatus(500);
      });

      const result = await service.setSettings(mockSettings);

      expect(result.success).toBe(false);
      expect((result as any).reason).toBe('request_failed');
      expect((result as any).status).toBe(500);
    });

    it('should handle network errors gracefully', async () => {
      // Stop the mock server to simulate network error
      await new Promise(resolve => fiduServer.close(resolve));

      const result = await service.setSettings(mockSettings);

      expect(result.success).toBe(false);
      expect((result as any).reason).toBe('unexpected_error');
    });
  });

  describe('getSettings', () => {
    it('should successfully retrieve settings from HTTP-only cookie', async () => {
      fiduApp.get('/api/settings/get', (req: Request, res: Response) => {
        res.json({ settings: mockSettings });
      });

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      expect(fiduAppCallHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'GET',
            authorization: `Bearer ${fiduAccessToken}`,
            url: expect.stringContaining('/api/settings/get'),
          }),
        ])
      );
    });

    it('should return null when no settings found', async () => {
      fiduApp.get('/api/settings/get', (req: Request, res: Response) => {
        res.json({});
      });

      const result = await service.getSettings();

      expect(result).toBeNull();
    });
  });

  describe('getSettingsWithRetry', () => {
    it('should retry on failure and eventually succeed', async () => {
      let getSettingsCallCount = 0;
      fiduApp.get('/api/settings/get', (req: Request, res: Response) => {
        getSettingsCallCount++;
        if (getSettingsCallCount === 1) {
          res.sendStatus(500);
        } else {
          res.json({ settings: mockSettings });
        }
      });

      const result = await service.getSettingsWithRetry(2);

      expect(result).toEqual(mockSettings);
      expect(getSettingsCallCount).toBe(2);
    });

    it('should return null after all retries fail', async () => {
      await new Promise(resolve => fiduServer.close(resolve));

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
      expect(fiduAppCallHistory).toEqual([]);
    });
  });
});
