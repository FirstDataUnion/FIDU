/**
 * Tests for GoogleDriveAuth integration with FiduAuthService interceptor
 * 
 * This is a bit janky because it uses both a mocked fetch and a "real" Express server
 * for axios requests, which means you need to know which one is being used.
 * It would be better if fetch forwarded to the Express server but translating between
 * APIs takes a lot of code and might be worth it in the future but not now.
 * 
 * It's even worse here because the mocking of fetch ties it to a very specific sequence
 * of calls - we need to carefully mock each fetch call in the exact order it will be
 * made, which makes the tests brittle but necessary to ensure no real network calls are made.
 */

import express from 'express';
import type { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { GoogleDriveAuthConfig, GoogleDriveAuthService, ServiceUnavailableError, getGoogleDriveAuthService } from '../GoogleDriveAuth';
import { getFiduAuthService, AuthenticationRequiredError, TokenRefreshError, FiduAuthService } from '../FiduAuthService';
import { AddressInfo } from 'net';
import * as environmentUtils from '../../../utils/environment';

jest.mock('../../api/apiClientIdentityService', () => ({
  identityServiceAPIClient: {
    updateGoogleEmail: jest.fn().mockResolvedValue({
      message: 'Google email updated successfully',
      user: {
        id: '1',
        email: 'test@example.com',
        google_email: 'google@example.com',
        google_email_updated_at: new Date().toISOString(),
      },
    }),
  },
}));

// Test configuration
const testEnvironment = 'dev';

// Test tokens
const fiduAccessToken = 'fidu-access-token';
const fiduRefreshedAccessToken = 'fidu-refreshed-access-token';
const fiduRefreshToken = 'fidu-refresh-token';
const googleAccessToken = 'google-access-token';
const googleExpiredAccessToken = 'google-expired-access-token';
const googleRefreshToken = 'google-refresh-token';
const testGoogleClientId = 'test-google-client-id';

const scope_string = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// Default response for fetch
const defaultHeaders = new Headers({
  'Content-Type': 'application/json',
});
const defaultResponse = {
  headers: defaultHeaders,
  ok: true,
  redirected: false,
  status: 200,
  statusText: 'OK',
  type: 'default' as const,
  url: '',
  body: null,
  bodyUsed: false,
  clone: () => defaultResponse,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob()),
  bytes: () => Promise.resolve(new Uint8Array()),
  formData: () => Promise.resolve(new FormData()),
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
};

describe('GoogleDriveAuth FiduAuthService Integration', () => {
  let testPort: number;
  let testBaseUrl: string;
  let fiduApp: Express;
  let fiduServer: Server;
  let baseGoogleDriveAuthConfig: GoogleDriveAuthConfig;
  let googleDriveAuth: GoogleDriveAuthService;
  let fiduAuthService: FiduAuthService;
  let fetchCallHistory: Array<{ url: string; method?: string }> = [];
  let fiduAppCallHistory: Array<{ url: string; method: string, authorization?: string }> = [];

  async function setupMockServer(): Promise<void> {
    fiduApp = express();
    fiduApp.use(express.json());
    fiduApp.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });
    fiduApp.use((req, res, next) => {
      if (req.method !== 'OPTIONS') {
        fiduAppCallHistory.push({ url: req.url, method: req.method, authorization: req.headers.authorization });
      }
      next();
    });
    fiduApp.options('*path', (req: Request, res: Response) => {
      res.sendStatus(200);
    });

    // Debug helper middleware
    // fiduApp.use((req, res, next) => {
    //   console.log(req.method, req.path, req.headers.authorization || 'no auth');
    //   next();
    //   console.log(req.method, req.path, res.statusCode);
    // });

    fiduServer = createServer(fiduApp);
    return new Promise<void>((resolve) => {
      fiduServer.listen(0, () => {
        const address = fiduServer.address() as AddressInfo;
        testPort = address.port;
        testBaseUrl = `http://localhost:${testPort}`;
        resolve();
      });
    });
  }

  function setUpValidFiduAppEndpoints() {
    fiduApp.get('/api/oauth/get-tokens', (req: Request, res: Response) => {
      res.json({
        has_tokens: true,
        refresh_token: googleRefreshToken,
      });
    });
    fiduApp.post('/api/oauth/refresh-token', (req: Request, res: Response) => {
      res.json({
        access_token: googleAccessToken,
        expires_in: 3600,
        scope: scope_string,
      });
    });
    fiduApp.post('/api/oauth/exchange-code', (req: Request, res: Response) => {
      res.json({
        access_token: googleAccessToken,
        expires_in: 3600,
        scope: scope_string,
      });
    });
  }

  function setUpWindowLocationForOAuthCallback() {
    const code = 'test-oauth-code';
    const urlParams = new URLSearchParams();
    urlParams.set('code', code);
    urlParams.set('state', 'test-state');
    sessionStorage.setItem('google_oauth_state', 'test-state');
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        hostname: 'localhost',
        port: String(testPort),
        origin: testBaseUrl,
        href: `${testBaseUrl}/?${urlParams.toString()}`,
        search: `?${urlParams.toString()}`,
      },
      writable: true,
    });
  }
  
  function setUpExpiredGoogleOAuthToken(googleDriveAuth: GoogleDriveAuthService) {
    (googleDriveAuth as any).tokens = {
      accessToken: googleExpiredAccessToken,
      refreshToken: fiduRefreshToken,
      expiresAt: Date.now() - 1000, // Expired
      scope: scope_string,
    };
  }

  function setUpValidFetchMock() {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    
    fetchMock.mockImplementation((input: string | URL | globalThis.Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      
      // Track all fetch calls
      fetchCallHistory.push({ url, method });

      if (url.includes('googleapis.com')) {
        // Mock Google API endpoints
        if (url.includes('https://www.googleapis.com/oauth2/v2/userinfo')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              id: 'google-user-id',
              email: 'google@example.com',
              name: 'Google User',
              picture: 'https://example.com/picture.jpg',
            }),
          });
        }
        
        if (url.includes('https://www.googleapis.com/oauth2/v1/tokeninfo')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              scope: scope_string,
            }),
          });
        }
        
        if (url.includes('https://oauth2.googleapis.com/revoke')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          });
        }
      } else {
        // Mock FIDU auth endpoints
        if (url.includes('/api/auth/fidu/set-tokens')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }
        
        if (url.includes('/api/auth/fidu/get-tokens')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              access_token: fiduAccessToken,
              refresh_token: fiduRefreshToken,
              user: { id: '1', email: 'test@example.com', profiles: [] },
            }),
          });
        }
        
        if (url.includes('/api/auth/fidu/refresh-access-token')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              access_token: fiduRefreshedAccessToken,
              expires_in: 3600,
            }),
          });
        }
        
        if (url.includes('/api/auth/fidu/clear-tokens')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }
        
        // Mock FIDU's Google OAuth endpoints
        if (url.includes('/api/config')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({ googleClientId: testGoogleClientId }),
          });
        }
        
        if (url.includes('/api/oauth/logout')) {
          return Promise.resolve({
            ...defaultResponse,
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }
      }
      
      // Default: reject to catch any unmocked calls
      console.error('Unmocked fetch call:', url, method);
      return Promise.reject(new Error(`Unmocked fetch call: ${url} ${method}`));
    });
    
    return fetchMock;
  }

  beforeAll(async () => {
    baseGoogleDriveAuthConfig = (await getGoogleDriveAuthService() as any).config;
  });

  afterAll(() => {});

  afterEach((done) => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    fetchCallHistory = [];
    fiduAppCallHistory = [];
    // Clear any state from services
    if (googleDriveAuth) {
      (googleDriveAuth as any).tokens = null;
      (googleDriveAuth as any).user = null;
    }
    
    if (fiduServer.listening) {
      fiduServer.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(async () => {
    await setupMockServer();

    // Mock environment detection
    jest.spyOn(environmentUtils, 'detectRuntimeEnvironment')
      .mockReturnValue(testEnvironment);

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        hostname: 'localhost',
        port: String(testPort),
        origin: testBaseUrl,
        href: `${testBaseUrl}/`,
        search: '',
      },
      writable: true,
    });

    // Mock fetch
    global.fetch = setUpValidFetchMock();

    // Initialize FiduAuthService
    fiduAuthService = getFiduAuthService();
  });

  describe('a valid FIDU access token is cached in memory', () => {
    beforeEach(async () => {
      fiduAuthService.setTokens(
        fiduAccessToken,
        fiduRefreshToken,
        { id: '1', email: 'test@example.com', profiles: [] }
      );
      googleDriveAuth = new GoogleDriveAuthService({...baseGoogleDriveAuthConfig, testHostName: testBaseUrl});
      setUpValidFiduAppEndpoints();
    });

    it('processOAuthCallback should store new Google OAuth tokens in memory', async () => {
      setUpWindowLocationForOAuthCallback();

      await googleDriveAuth.processOAuthCallback();

      expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
        accessToken: googleAccessToken,
      }));
      expect(fiduAppCallHistory).toEqual([expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` })]);
    });

    it('getAccessToken should refresh its expired Google OAuth token', async () => {
      setUpExpiredGoogleOAuthToken(googleDriveAuth);

      await googleDriveAuth.getAccessToken();

      expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
        accessToken: googleAccessToken,
      }));
      expect(fiduAppCallHistory).toEqual([expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` })]);
    });

    it('restoreFromCookies should set the tokens in memory', async () => {
      const restored = await googleDriveAuth.restoreFromCookies();

      expect(restored).toBe(true);
      expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
        accessToken: googleAccessToken,
        refreshToken: googleRefreshToken,
      }));
      expect(fiduAppCallHistory).toEqual([
        expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` }),
        expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` }),
      ]);
    });
  });

  describe('a seemingly valid but revoked FIDU access token is cached in memory', () => {
    beforeEach(async () => {
      fiduAuthService.setTokens(
        fiduAccessToken,
        fiduRefreshToken,
        { id: '1', email: 'test@example.com', profiles: [] }
      );
      googleDriveAuth = new GoogleDriveAuthService({...baseGoogleDriveAuthConfig, testHostName: testBaseUrl});

      fiduApp.use((req, res, next) => {
        if (req.headers.authorization === `Bearer ${fiduAccessToken}`) {
          res.status(401).json({ message: 'Unauthorized' });
        } else {
          next();
        }
      });
    });

    describe('and refreshing it succeeds', () => {
      it('processOAuthCallback should retry a 401 and then store new Google OAuth tokens in memory', async () => {
        setUpValidFiduAppEndpoints();
        setUpWindowLocationForOAuthCallback();

        await googleDriveAuth.processOAuthCallback();

        expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
          accessToken: googleAccessToken,
        }));
        expect(fiduAppCallHistory).toEqual([
          expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` }),
          expect.objectContaining({ authorization: `Bearer ${fiduRefreshedAccessToken}` }),
        ]);
      });

      it('getAccessToken should retry a 401 and then refresh its expired Google OAuth token', async () => {
        setUpValidFiduAppEndpoints();
        setUpExpiredGoogleOAuthToken(googleDriveAuth);

        await googleDriveAuth.getAccessToken();

        expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
          accessToken: googleAccessToken,
        }));
        expect(fiduAppCallHistory).toEqual([
          expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` }),
          expect.objectContaining({ authorization: `Bearer ${fiduRefreshedAccessToken}` }),
        ]);
      });

      it('restoreFromCookies should retry a 401 and then set the tokens in memory', async () => {
        setUpValidFiduAppEndpoints();
        const restored = await googleDriveAuth.restoreFromCookies();

        expect(restored).toBe(true);
        expect((googleDriveAuth as any).tokens).toEqual(expect.objectContaining({
          accessToken: googleAccessToken,
          refreshToken: googleRefreshToken,
        }));
        expect(fiduAppCallHistory).toEqual([
          expect.objectContaining({ authorization: `Bearer ${fiduAccessToken}` }),
          expect.objectContaining({ authorization: `Bearer ${fiduRefreshedAccessToken}` }),
          expect.objectContaining({ authorization: `Bearer ${fiduRefreshedAccessToken}` }),
        ]);
      });

      describe('but the following call fails for unrelated reasons', () => {
        beforeEach(async () => {
          fiduApp.use((req, res, next) => {
            if (req.url.includes('/api/oauth/')) {
              res.status(500).json({ message: 'Internal Server Error' });
            } else {
              next();
            }
          });
          setUpValidFiduAppEndpoints();
        });

        it('processOAuthCallback should throw an error', async () => {
          setUpWindowLocationForOAuthCallback();

          await expect(googleDriveAuth.processOAuthCallback()).rejects.toThrow("Backend OAuth error (500): Internal Server Error");
        });

        it('getAccessToken should throw an error', async () => {
          setUpExpiredGoogleOAuthToken(googleDriveAuth);

          await expect(googleDriveAuth.getAccessToken()).rejects.toThrow("Backend token refresh error (500): Internal Server Error");
        });

        it('restoreFromCookies should return false', async () => {
          const restored = await googleDriveAuth.restoreFromCookies();

          expect(restored).toBe(false);
        });
      });
    });

    describe('and refresh token is also invalid or expired', () => {
      beforeEach(async () => {
        const defaultFetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
        global.fetch = jest.fn().mockImplementation((input: string | URL | globalThis.Request, init?: RequestInit) => {
          expect(typeof input).toBe('string');
          const url = input as string;
          if (url.includes('/api/auth/fidu/refresh-access-token')) {
            return Promise.resolve({
              ...defaultResponse,
              ok: false,
              status: 401,
              json: () => Promise.resolve({ message: 'Unauthorized' }),
            });
          }
          return defaultFetchMock(input, init);
        });
      });

      it('processOAuthCallback should throw an error', async () => {
        setUpWindowLocationForOAuthCallback();

        await expect(googleDriveAuth.processOAuthCallback()).rejects.toThrow(AuthenticationRequiredError);
      });

      it('getAccessToken should throw an error', async () => {
        setUpExpiredGoogleOAuthToken(googleDriveAuth);

        await expect(googleDriveAuth.getAccessToken()).rejects.toThrow(AuthenticationRequiredError);
      });

      it('restoreFromCookies should return false', async () => {
        const restored = await googleDriveAuth.restoreFromCookies();

        expect(restored).toBe(false);
      });
    });

    describe('and there is an error refreshing the FIDU access token', () => {
      beforeEach(async () => {
        const defaultFetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
        global.fetch = jest.fn().mockImplementation((input: string | URL | globalThis.Request, init?: RequestInit) => {
          expect(typeof input).toBe('string');
          const url = input as string;
          if (url.includes('/api/auth/fidu/refresh-access-token')) {
            return Promise.resolve({
              ...defaultResponse,
              ok: false,
              status: 500,
              json: () => Promise.resolve({ message: 'Internal Server Error' }),
            });
          }
          return defaultFetchMock(input, init);
        });
      });

      it('processOAuthCallback should throw a TokenRefreshError', async () => {
        setUpWindowLocationForOAuthCallback();

        await expect(googleDriveAuth.processOAuthCallback()).rejects.toThrow(TokenRefreshError);
      });

      it('getAccessToken should throw a TokenRefreshError', async () => {
        setUpExpiredGoogleOAuthToken(googleDriveAuth);

        await expect(googleDriveAuth.getAccessToken()).rejects.toThrow(TokenRefreshError);
      });

      it('restoreFromCookies should return false', async () => {
        const restored = await googleDriveAuth.restoreFromCookies();

        expect(restored).toBe(false);
      });
    });
  });

  describe('all FIDU services have server-side errors', () => {
    beforeEach(async () => {
      fiduAuthService.setTokens(
        fiduAccessToken,
        fiduRefreshToken,
        { id: '1', email: 'test@example.com', profiles: [] }
      );
      googleDriveAuth = new GoogleDriveAuthService({...baseGoogleDriveAuthConfig, testHostName: testBaseUrl});

      const defaultFetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      global.fetch = jest.fn().mockImplementation((input: string | URL | globalThis.Request, init?: RequestInit) => {
        expect(typeof input).toBe('string');
        const url = input as string;
        if (url.includes('googleapis.com')) {
          return defaultFetchMock(input, init);
        }
        return {
          ...defaultResponse,
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal Server Error' }),
        }
      });

      fiduApp.use((_req, res, _next) => {
        res.status(500).json({ message: 'Internal Server Error' });
      });
      setUpValidFiduAppEndpoints();
    });

    it('processOAuthCallback should throw a ServiceUnavailableError', async () => {
      setUpWindowLocationForOAuthCallback();

      await expect(googleDriveAuth.processOAuthCallback()).rejects.toThrow("Backend OAuth error (500): Internal Server Error");

      expect(fiduAppCallHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api/auth/fidu/refresh-access-token'})]));
    });
    
    it('getAccessToken should throw a ServiceUnavailableError', async () => {
      setUpExpiredGoogleOAuthToken(googleDriveAuth);

      await expect(googleDriveAuth.getAccessToken()).rejects.toThrow("Backend token refresh error (500): Internal Server Error");

      expect(fiduAppCallHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api/auth/fidu/refresh-access-token'})]));
    });

    it('restoreFromCookies should return false', async () => {
      const restored = await googleDriveAuth.restoreFromCookies();
      expect(restored).toBe(false);
      expect(fiduAppCallHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api/auth/fidu/refresh-access-token'})]));
    });
  });

  describe('FIDU backend cannot exchange code for tokens', () => {
    beforeEach(async () => {
      fiduAuthService.setTokens(
        fiduAccessToken,
        fiduRefreshToken,
        { id: '1', email: 'test@example.com', profiles: [] }
      );
      googleDriveAuth = new GoogleDriveAuthService({...baseGoogleDriveAuthConfig, testHostName: testBaseUrl});

      fiduApp.use((req, res, next) => {
        if (req.url.includes('/api/oauth/exchange-code') || req.url.includes('/api/oauth/refresh-token')) {
          res.status(503).json({ message: 'Gateway error' });
        } else {
          next();
        }
      });
      setUpValidFiduAppEndpoints();
    });

    it('processOAuthCallback should throw an error', async () => {
      setUpWindowLocationForOAuthCallback();

      await expect(googleDriveAuth.processOAuthCallback()).rejects.toThrow("Backend OAuth error (503): Gateway error");

      expect(fiduAppCallHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api/auth/fidu/refresh-access-token'})]));
    });

    it('getAccessToken should throw an error', async () => {
      setUpExpiredGoogleOAuthToken(googleDriveAuth);

      await expect(googleDriveAuth.getAccessToken()).rejects.toThrow(ServiceUnavailableError);

      expect(fiduAppCallHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ url: '/api/auth/fidu/refresh-access-token'})]));
    });
  });
});
