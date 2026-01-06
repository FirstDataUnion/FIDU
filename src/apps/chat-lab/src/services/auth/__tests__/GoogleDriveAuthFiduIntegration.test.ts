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
import { GoogleDriveAuthService, getGoogleDriveAuthService } from '../GoogleDriveAuth';
import { getFiduAuthService, AuthenticationRequiredError } from '../FiduAuthService';

// Test configuration
const testPort = 9876;
const testBaseUrl = `http://localhost:${testPort}`;
const testEnvironment = 'dev';
const identityServicePort = 9877;

// Test tokens
const fiduAccessToken = 'fidu-access-token';
const fiduRefreshedAccessToken = 'fidu-refreshed-access-token';
const googleAccessToken = 'google-access-token';
const googleRefreshedAccessToken = 'google-refreshed-access-token';
const googleRefreshToken = 'google-refresh-token';
const testGoogleClientId = 'test-google-client-id';

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
  let fiduApp: Express;
  let fiduServer: Server;
  let identityServiceApp: Express;
  let identityServiceServer: Server;
  let googleDriveAuth: GoogleDriveAuthService;
  let fiduAuthService: ReturnType<typeof getFiduAuthService>;
  let fetchCallHistory: Array<{ url: string; method?: string }> = [];
  let identityServiceCallHistory: Array<{ url: string; method: string, authorization?: string }> = [];

  function setupMockServer(done: () => void) {
    fiduApp = express();
    fiduApp.use(express.json());
    fiduApp.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });
    fiduApp.options('*path', (req: Request, res: Response) => {
      res.sendStatus(200);
    });

    // Debug helper middleware
    fiduApp.use((req, res, next) => {
      console.log(req.method, req.path, req.headers.authorization || 'no auth');
      next();
      console.log(req.method, req.path, res.statusCode);
    });

    fiduServer = createServer(fiduApp);
    const mockServerListening = new Promise((resolve) => {
      fiduServer.listen(testPort, () => {
          resolve(true);
        });
      }
    );


    identityServiceApp = express();
    identityServiceApp.use(express.json());
    identityServiceApp.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });
    identityServiceApp.use((req, res, next) => {
      identityServiceCallHistory.push({ url: req.url, method: req.method, authorization: req.headers.authorization });
      next();
    });
    identityServiceApp.options('*path', (req: Request, res: Response) => {
      res.sendStatus(200);
    });
    identityServiceApp.put('/user/google-email', (req: Request, res: Response) => {
      res.json({ success: true });
    });

    identityServiceServer = createServer(identityServiceApp);
    const identityServiceServerListening = new Promise((resolve) => {
      identityServiceServer.listen(identityServicePort, () => {
        resolve(true);
      });
    });

    Promise.all([mockServerListening, identityServiceServerListening]).then(() => {
      done();
    });
  }

  function createFetchMock() {
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
              scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
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
              refresh_token: 'fidu-refresh-token',
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

  beforeAll(() => {});

  afterAll(() => {});

  afterEach((done) => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    fetchCallHistory = [];
    identityServiceCallHistory = [];

    // Clear any state from services
    if (googleDriveAuth) {
      (googleDriveAuth as any).tokens = null;
      (googleDriveAuth as any).user = null;
    }
    
    const fiduServerClosed = new Promise((resolve) => {
      fiduServer.close(() => {
        resolve(true);
      });
    });
    const identityServiceServerClosed = new Promise((resolve) => {
      identityServiceServer.close(() => {
        resolve(true);
      });
    });
    Promise.all([fiduServerClosed, identityServiceServerClosed]).then(() => {
      done();
    });
  });

  beforeEach((done) => {
    setupMockServer(done);

    // Mock environment detection
    jest.spyOn(require('../../../utils/environment'), 'detectRuntimeEnvironment')
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
    global.fetch = createFetchMock();

    // Initialize FiduAuthService and set tokens
    fiduAuthService = getFiduAuthService();
  });

  describe('OAuth code exchange with FIDU auth interceptor', () => {
    it('should exchange OAuth code for tokens using FIDU auth interceptor', async () => {
      const oauthCode = 'test-oauth-code';
      const seenAuthorizationHeaders: (string | undefined)[] = [];
      const seenCodes: (string | undefined)[] = [];

      fiduAuthService.setTokens(
        fiduAccessToken,
        'fidu-refresh-token',
        { id: '1', email: 'test@example.com', profiles: [] }
      );
      
      // Set up Express endpoint for token exchange
      fiduApp.post('/api/oauth/exchange-code', (req: Request, res: Response) => {
        // Verify FIDU auth header was added by interceptor
        seenAuthorizationHeaders.push(req.headers.authorization);
        seenCodes.push(req.body?.code);
        res.json({
          access_token: googleAccessToken,
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        });
      });


      // Simulate OAuth callback
      const urlParams = new URLSearchParams();
      urlParams.set('code', oauthCode);
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

      googleDriveAuth = await getGoogleDriveAuthService(testBaseUrl);

      // Initialize should handle the callback
      await googleDriveAuth.initialize();

      expect(seenAuthorizationHeaders).toEqual([`Bearer ${fiduAccessToken}`]);
      expect(seenCodes).toEqual([oauthCode]);

      // Verify fetch calls were made in correct order
      const fetchCalls = fetchCallHistory.map(c => c.url);
      expect(fetchCalls).toEqual(expect.arrayContaining([
        expect.stringContaining('/api/auth/fidu/set-tokens'),
        expect.stringContaining('/api/config'),
        expect.stringContaining("googleapis.com/oauth2/v2/userinfo"),
      ]));

      // Verify identity service calls were made in correct order
      expect(identityServiceCallHistory).toEqual(expect.arrayContaining([
        { url: '/user/google-email', method: 'PUT', authorization: `Bearer ${fiduAccessToken}` },
      ]));
    });
  });

  describe('Token refresh with FIDU auth interceptor', () => {
    let seenRefreshTokenAuthorizationHeaders: (string | undefined)[] = [];
    let seenGetTokensAuthorizationHeaders: (string | undefined)[] = [];

    beforeEach(async () => {
      seenRefreshTokenAuthorizationHeaders = [];
      seenGetTokensAuthorizationHeaders = [];

      // Set up endpoints
      fiduApp.post('/api/oauth/refresh-token', (req: Request, res: Response) => {
        // Store FIDU auth header for verification outside endpoint
        seenRefreshTokenAuthorizationHeaders.push(req.headers.authorization);
        res.json({
          access_token: googleRefreshedAccessToken,
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        });
      });

      fiduApp.get('/api/oauth/get-tokens', (req: Request, res: Response) => {
        // Store FIDU auth header for verification outside endpoint
        seenGetTokensAuthorizationHeaders.push(req.headers.authorization);
        res.json({
          has_tokens: true,
          refresh_token: googleRefreshToken,
        });
      });

      // Initialize GoogleDriveAuth
      googleDriveAuth = await getGoogleDriveAuthService(testBaseUrl);
      
      // Set up tokens in memory
      (googleDriveAuth as any).tokens = {
        accessToken: googleAccessToken,
        refreshToken: googleRefreshToken,
        expiresAt: Date.now() - 1000, // Expired
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      };
    });

    it('should refresh Google token using FIDU auth interceptor', async () => {
      const newToken = await googleDriveAuth.getAccessToken();
      
      expect(newToken).toBe(googleRefreshedAccessToken);
      
      // Verify FIDU auth header was added by interceptor
      expect(seenRefreshTokenAuthorizationHeaders).toEqual([`Bearer ${fiduAccessToken}`]);
    });
  });

  describe('401 response handling with token refresh retry', () => {
    let seenRefreshTokenAuthorizationHeaders: (string | undefined)[] = [];

    beforeEach(async () => {
      seenRefreshTokenAuthorizationHeaders = [];

      // Set up endpoints
      let callCount = 0;
      
      fiduApp.post('/api/oauth/refresh-token', (req: Request, res: Response) => {
        callCount++;
        // Store FIDU auth header for verification outside endpoint
        seenRefreshTokenAuthorizationHeaders.push(req.headers.authorization);
        if (callCount === 1) {
          // First call returns 401 - should trigger FIDU token refresh
          res.status(401).json({ message: 'Unauthorized' });
        } else {
          // Retry with refreshed FIDU token succeeds
          res.json({
            access_token: googleRefreshedAccessToken,
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
          });
        }
      });

      // Initialize GoogleDriveAuth
      googleDriveAuth = await getGoogleDriveAuthService(testBaseUrl);
      
      // Set up tokens in memory
      (googleDriveAuth as any).tokens = {
        accessToken: googleAccessToken,
        refreshToken: googleRefreshToken,
        expiresAt: Date.now() - 1000, // Expired
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      };
    });

    it('should refresh FIDU token on 401 and retry Google token refresh', async () => {
      const newToken = await googleDriveAuth.getAccessToken();
      
      expect(newToken).toBe(googleRefreshedAccessToken);
      
      // Verify FIDU auth headers - first call should use original token, retry should use refreshed token
      expect(seenRefreshTokenAuthorizationHeaders).toEqual([`Bearer ${fiduAccessToken}`, `Bearer ${fiduRefreshedAccessToken}`]);
      // Verify FIDU token refresh was called
      expect(fetchCallHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ url: expect.stringContaining('/api/auth/fidu/refresh-access-token'), method: 'POST' }),
      ]));
    });
  });

  describe('Restore from cookies with FIDU auth interceptor', () => {
    let seenGetTokensAuthorizationHeaders: (string | undefined)[] = [];
    let seenRefreshTokenAuthorizationHeaders: (string | undefined)[] = [];

    beforeEach(async () => {
      seenGetTokensAuthorizationHeaders = [];
      seenRefreshTokenAuthorizationHeaders = [];

      // Set up endpoint for getting tokens from cookies
      fiduApp.get('/api/oauth/get-tokens', (req: Request, res: Response) => {
        // Store FIDU auth header for verification outside endpoint
        seenGetTokensAuthorizationHeaders.push(req.headers.authorization);
        res.json({
          has_tokens: true,
          refresh_token: googleRefreshToken,
        });
      });

      fiduApp.post('/api/oauth/refresh-token', (req: Request, res: Response) => {
        // Store FIDU auth header for verification outside endpoint
        seenRefreshTokenAuthorizationHeaders.push(req.headers.authorization);
        res.json({
          access_token: googleAccessToken,
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        });
      });

      fiduAuthService.setTokens(
        fiduAccessToken,
        'fidu-refresh-token',
        { id: '1', email: 'test@example.com', profiles: [] }
      );

      // Initialize GoogleDriveAuth
      googleDriveAuth = await getGoogleDriveAuthService(testBaseUrl);
    });

    it('should restore tokens from cookies using FIDU auth interceptor', async () => {
      const restored = await googleDriveAuth.restoreFromCookies();
      
      expect(restored).toBe(true);
      
      // Verify FIDU auth header was added by interceptor
      expect(seenGetTokensAuthorizationHeaders).toEqual([`Bearer ${fiduAccessToken}`]);
      expect(fetchCallHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ url: expect.stringContaining('googleapis.com/oauth2/v2/userinfo'), method: 'GET' }),
      ]));
    });
  });
});
