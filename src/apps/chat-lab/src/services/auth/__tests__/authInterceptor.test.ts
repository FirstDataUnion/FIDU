/**
 * Tests for FiduAuthService auth interceptor
 * 
 * This is a bit janky because it uses both a mocked fetch and a "real" Express server
 * for axios requests, which means you need to know which one is being used.
 * It would be better if fetch forwarded to the Express server but translating between
 * APIs takes a lot of code and might be worth it in the future but not now.
 */

import express from 'express';
import type { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import axios, { AxiosInstance } from 'axios';
import { getFiduAuthService } from '../FiduAuthService';
import { AuthenticationRequiredError } from '../FiduAuthService';


// Test configuration
const testPort = 9876;
const testBaseUrl = `http://localhost:${testPort}`;
const testEnvironment = 'dev';
const testEndpoint = '/api/test-endpoint';

// Test tokens
const initialAccessToken = 'initial-access-token';
const refreshedAccessToken = 'refreshed-access-token';

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

describe('FiduAuthService Auth Interceptor', () => {
  let mockServer: Server;
  let app: Express;
  let axiosClient: AxiosInstance;
  let fiduAuthService: ReturnType<typeof getFiduAuthService>;

  function setupMockServer(done: () => void) {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization');
      next();
    });
    // Debug helper middleware
    // app.use((req, res, next) => {
    //   console.log(req.method, req.path, req.headers.authorization || 'no auth');
    //   next();
    //   console.log(req.method, req.path, res.statusCode);
    // });

    mockServer = createServer(app);
    mockServer.listen(testPort, () => {
      done();
    });
  }

  beforeAll(() => {});

  afterAll(() => {});

  afterEach((done) => {
    jest.clearAllMocks();
    localStorage.clear();
    mockServer.close(() => {
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
        hostname: testBaseUrl,
        port: testPort,
      },
      writable: true,
    });

    // Mock fetch
    let fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;

    // Set up OPTIONS CORS handler (headers added in middleware above)
    app.options('*path', (req: Request, res: Response) => {
      res.sendStatus(200);
    });

    // Initialize FiduAuthService
    fiduAuthService = getFiduAuthService();
    fetchMock.mockResolvedValueOnce({
      ...defaultResponse,
      json: () => Promise.resolve({ success: true }),
    });
    fiduAuthService.setTokens(
      initialAccessToken,
      'refresh_token',
      { id: '1', email: 'test@example.com', profiles: [] }
    );
    
    // Create axios client with interceptor
    const authInterceptor = fiduAuthService.createAuthInterceptor();
    axiosClient = axios.create({
      baseURL: testBaseUrl,
      timeout: 1000,
    });

    // Set up interceptors
    axiosClient.interceptors.request.use(
      authInterceptor.request
    );

    axiosClient.interceptors.response.use(
      authInterceptor.response,
      authInterceptor.error
    );
  });

  describe('Successful request with 200 response', () => {
    it('should add Authorization header and return 200 response with expected data', async () => {
      const expectedData = { message: 'Success', data: { id: 1, name: 'Test' } };
      let requestCount = 0;
      let authHeaders: (string | undefined)[] = [];

      // Set up ALL handlers for this test - must be done before any requests
      app.get(testEndpoint, (req: Request, res: Response) => {
        requestCount++;
        authHeaders.push(req.headers.authorization);
        res.json(expectedData);
      });

      // Make request
      const response = await axiosClient.get(testEndpoint);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.data).toEqual(expectedData);
      expect(authHeaders).toEqual([`Bearer ${initialAccessToken}`]);
      expect(requestCount).toBe(1);
    });
  });

  describe('401 response with successful token refresh and retry', () => {
    it('should refresh token on 401, retry request, and return 200 response', async () => {
      const expectedData = { message: 'Success after retry', data: { id: 2 } };
      let testEndpointCallCount = 0;
      let authHeaders: (string | undefined)[] = [];

      let fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValueOnce({
        ...defaultResponse,
        ok: true,
        json: () => Promise.resolve({ access_token: refreshedAccessToken, expires_in: 3600 }),
      });

      // Test endpoint - first call returns 401, retry returns 200
      app.get(testEndpoint, (req: Request, res: Response) => {
        testEndpointCallCount++;
        authHeaders.push(req.headers.authorization);
        if (testEndpointCallCount === 1) {
          // First call with initial token - return 401
          res.status(401).json({ message: 'Unauthorized' });
        } else {
          // Retry with refreshed token - return 200
          res.json(expectedData);
        }
      });

      // Make request - should trigger refresh and retry
      const response = await axiosClient.get(testEndpoint);

      // Assertions
      expect(response.status).toBe(200);
      expect(response.data).toEqual(expectedData);
      
      // Verify endpoint was called twice (initial + retry)
      expect(testEndpointCallCount).toBe(2);
      
      // Verify retry used refreshed token
      expect(authHeaders).toEqual([`Bearer ${initialAccessToken}`, `Bearer ${refreshedAccessToken}`]);
    });
  });

  describe('401 response with failed token refresh', () => {
    it('should throw error when token refresh also returns 401', async () => {
      let testEndpointCallCount = 0;

      let fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockResolvedValue({
        ...defaultResponse,
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Refresh token expired or invalid' }),
      });

      app.get(testEndpoint, (req: Request, res: Response) => {
        testEndpointCallCount++;
        res.status(401).json({ message: 'Unauthorized' });
      });

      // Make request - should fail after refresh attempt
      await expect(axiosClient.get(testEndpoint)).rejects.toThrow(
        AuthenticationRequiredError
      );

      // Assertions
      expect(testEndpointCallCount).toBe(1); // Called once before refresh attempt
    });

    it('should clear tokens and dispatch logout on refresh failure', async () => {
      const clearAllAuthTokensSpy = jest.spyOn(fiduAuthService, 'clearAllAuthTokens');
      let getTokensCallCount = 0;
      
      app.get('/api/auth/fidu/get-tokens', (req: Request, res: Response) => {
        getTokensCallCount++;
        // First call should return a refresh token so hasRefreshToken() returns true
        if (getTokensCallCount === 1) {
          res.json({
            access_token: initialAccessToken,
            refresh_token: 'expired-refresh-token',
            expires_in: 3600,
          });
        } else {
          res.json({
            access_token: null,
            refresh_token: null,
            expires_in: 0,
          });
        }
      });

      app.post('/api/auth/fidu/refresh-access-token', (req: Request, res: Response) => {
        res.status(401).json({ detail: 'Refresh token expired' });
      });

      app.get(testEndpoint, (req: Request, res: Response) => {
        res.status(401).json({ message: 'Unauthorized' });
      });

      await expect(axiosClient.get(testEndpoint)).rejects.toThrow(
        'Authentication required. Please log in again.'
      );

      // Verify tokens were cleared
      expect(clearAllAuthTokensSpy).toHaveBeenCalled();
    });
  });
});

