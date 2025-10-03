// Mock the environment module to fix import.meta errors
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: () => ({
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  }),
  getIdentityServiceUrl: () => 'https://identity.firstdataunion.org',
  getGatewayUrl: () => 'https://gateway.firstdataunion.org',
}));

/**
 * Identity Service Client Tests
 * Tests for the IdentityServiceClient class
 */

import { IdentityServiceClient } from '../IdentityServiceClient';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('IdentityServiceClient', () => {
  let client: IdentityServiceClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new IdentityServiceClient();
  });

  describe('getEncryptionKey', () => {
    it('should fetch encryption key successfully', async () => {
      const mockResponse = {
        encryption_key: {
          id: 'test-id',
          key: 'base64-encoded-key',
          algorithm: 'AES-256-GCM',
          created_at: '2024-01-01T00:00:00Z',
          version: 1
        }
      };

      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const result = await client.getEncryptionKey('user-123');

      expect(result).toBe('base64-encoded-key');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.firstdataunion.org/encryption/key',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should create key when 404 is returned', async () => {
      const mockResponse = {
        encryption_key: {
          id: 'test-id',
          key: 'new-base64-encoded-key',
          algorithm: 'AES-256-GCM',
          created_at: '2024-01-01T00:00:00Z',
          version: 1
        }
      };

      mockLocalStorage.getItem.mockReturnValue('mock-token');
      
      // First call returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      // Second call (create) returns success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response);

      const result = await client.getEncryptionKey('user-123');

      expect(result).toBe('new-base64-encoded-key');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no auth token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(client.getEncryptionKey('user-123'))
        .rejects.toThrow('Authentication token not found. Please log in again.');
    });

    it('should throw error when authentication fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      } as Response);

      await expect(client.getEncryptionKey('user-123'))
        .rejects.toThrow('Authentication failed. Please log in again.');
    });

    it('should throw error when request fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(client.getEncryptionKey('user-123'))
        .rejects.toThrow('Failed to fetch encryption key: 500 Internal Server Error');
    });
  });

  describe('createEncryptionKey', () => {
    it('should create encryption key successfully', async () => {
      const mockResponse = {
        encryption_key: {
          id: 'test-id',
          key: 'new-base64-encoded-key',
          algorithm: 'AES-256-GCM',
          created_at: '2024-01-01T00:00:00Z',
          version: 1
        }
      };

      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response);

      const result = await client.createEncryptionKey('user-123');

      expect(result).toBe('new-base64-encoded-key');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.firstdataunion.org/encryption/key',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should throw error when no auth token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(client.createEncryptionKey('user-123'))
        .rejects.toThrow('Authentication token not found. Please log in again.');
    });

    it('should throw error when authentication fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      } as Response);

      await expect(client.createEncryptionKey('user-123'))
        .rejects.toThrow('Authentication failed. Please log in again.');
    });

    it('should throw error when request fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server Error')
      } as any);

      await expect(client.createEncryptionKey('user-123'))
        .rejects.toThrow('Failed to create encryption key: 500 Internal Server Error');
    });
  });

  describe('deleteEncryptionKey', () => {
    it('should delete encryption key successfully', async () => {
      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204
      } as Response);

      await client.deleteEncryptionKey('user-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.firstdataunion.org/encryption/key',
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should handle 404 gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      } as Response);

      // Should not throw error for 404
      await expect(client.deleteEncryptionKey('user-123')).resolves.toBeUndefined();
    });

    it('should throw error when no auth token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(client.deleteEncryptionKey('user-123'))
        .rejects.toThrow('Authentication token not found. Please log in again.');
    });

    it('should throw error when authentication fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      } as Response);

      await expect(client.deleteEncryptionKey('user-123'))
        .rejects.toThrow('Authentication failed. Please log in again.');
    });

    it('should throw error when request fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('mock-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(client.deleteEncryptionKey('user-123'))
        .rejects.toThrow('Failed to delete encryption key: 500 Internal Server Error');
    });
  });

  describe('getIdentityServiceUrl', () => {
    it('should return the correct URL', () => {
      const url = client.getIdentityServiceUrl();
      expect(url).toBe('https://identity.firstdataunion.org');
    });
  });
});
