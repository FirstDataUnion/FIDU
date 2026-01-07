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
import { getFiduAuthService, TokenRefreshError } from '../FiduAuthService';
import { AuthenticationRequiredError } from '../FiduAuthService';
import { AddressInfo } from 'net';
import * as environmentUtils from '../../../utils/environment';


// Test configuration
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
  let testPort: number;
  let testBaseUrl: string;
  let mockServer: Server;
  let app: Express;
  let axiosClient: AxiosInstance;
  let fiduAuthService: ReturnType<typeof getFiduAuthService>;

  async function setupMockServer(): Promise<void> {
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
    return new Promise((resolve) => {
      mockServer.listen(0, () => {
        const address = mockServer.address() as AddressInfo;
        testPort = address.port;
        testBaseUrl = `http://localhost:${testPort}`;
        console.log('testBaseUrl', testBaseUrl);
        resolve();
      });
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

  beforeEach(async () => {
    await setupMockServer();

    // Mock environment detection
    jest.spyOn(environmentUtils, 'detectRuntimeEnvironment')
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
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
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
      const authHeaders: (string | undefined)[] = [];

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
      expect(global.fetch).toHaveBeenCalledTimes(1); // In the beforeEach
    });
  });

  describe('401 response with successful token refresh and retry', () => {
    it('should refresh token on 401, retry request, and return 200 response', async () => {
      const expectedData = { message: 'Success after retry', data: { id: 2 } };
      let testEndpointCallCount = 0;
      const authHeaders: (string | undefined)[] = [];

      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockImplementation((input: string | URL | globalThis.Request, _init?: RequestInit) => {
        expect(typeof input).toBe('string');
        const url = input as string;
        expect(url).toContain('auth/fidu/refresh-access-token');
        return Promise.resolve({
          ...defaultResponse,
          ok: true,
          json: () => Promise.resolve({ access_token: refreshedAccessToken, expires_in: 3600 }),
        });
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

  describe('401 response with 401 refresh token response', () => {
    beforeEach(() => {
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockImplementation((input: string | URL | globalThis.Request, _init?: RequestInit) => {
        expect(typeof input).toBe('string');
        const url = input as string;
        expect(url).toContain('auth/fidu/refresh-access-token');
        return Promise.resolve({
          ...defaultResponse,
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Refresh token expired or invalid' }),
        });
      });
    });

    it('should throw error when token refresh also returns 401', async () => {
      let testEndpointCallCount = 0;

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

      app.get(testEndpoint, (req: Request, res: Response) => {
        res.status(401).json({ message: 'Unauthorized' });
      });

      await expect(axiosClient.get(testEndpoint)).rejects.toThrow(AuthenticationRequiredError);

      // Verify tokens were cleared
      expect(clearAllAuthTokensSpy).toHaveBeenCalled();
    });
  });

  describe('401 response with network error during token refresh', () => {
    it('should not clear tokens and dispatch logout on network error', async () => {
      const clearAllAuthTokensSpy = jest.spyOn(fiduAuthService, 'clearAllAuthTokens');

      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockRejectedValue(new Error('Network error'));

      app.get(testEndpoint, (req: Request, res: Response) => {
        res.status(401).json({ message: 'Unauthorized' });
      });

      await expect(axiosClient.get(testEndpoint)).rejects.toThrow(TokenRefreshError);

      // Verify tokens were not cleared
      expect(clearAllAuthTokensSpy).not.toHaveBeenCalled();
    });
  });

  describe('401 response, successful token refresh, 401 again on retry', () => {
    it('should throw an error when the retry also fails', async () => {
      const seenAuthorizationHeaders: (string | undefined)[] = [];
      
      const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchMock.mockImplementation((input: string | URL | globalThis.Request, _init?: RequestInit) => {
        expect(typeof input).toBe('string');
        const url = input as string;
        expect(url).toContain('auth/fidu/refresh-access-token');
        return Promise.resolve({
          ...defaultResponse,
          ok: true,
          json: () => Promise.resolve({ access_token: refreshedAccessToken, expires_in: 3600 }),
        });
      });

      app.get(testEndpoint, (req: Request, res: Response) => {
        seenAuthorizationHeaders.push(req.headers.authorization);
        res.status(401).json({ message: 'Unauthorized' });
      });

      await expect(axiosClient.get(testEndpoint)).rejects.toThrow(AuthenticationRequiredError);

      expect(seenAuthorizationHeaders).toEqual([`Bearer ${initialAccessToken}`, `Bearer ${refreshedAccessToken}`]);
    });
  });
});

