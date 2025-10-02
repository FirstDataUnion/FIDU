/**
 * Encryption Service Tests
 * Tests for the EncryptionService class
 */

import { EncryptionService } from '../EncryptionService';
import { IdentityServiceClient } from '../IdentityServiceClient';

// Mock the IdentityServiceClient
jest.mock('../IdentityServiceClient');
const MockedIdentityServiceClient = IdentityServiceClient as jest.MockedClass<typeof IdentityServiceClient>;

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let mockIdentityServiceClient: jest.Mocked<IdentityServiceClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockIdentityServiceClient = {
      getEncryptionKey: jest.fn(),
      createEncryptionKey: jest.fn(),
      deleteEncryptionKey: jest.fn(),
      getIdentityServiceUrl: jest.fn()
    } as any;

    // Mock the constructor
    MockedIdentityServiceClient.mockImplementation(() => mockIdentityServiceClient);

    // Create service instance
    encryptionService = new EncryptionService();
  });

  describe('encryptData', () => {
    it('should encrypt data successfully', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.encrypt
      const mockEncryptedBuffer = new ArrayBuffer(32);
      jest.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(mockEncryptedBuffer);

      // Mock crypto.getRandomValues
      const mockNonce = new Uint8Array(12);
      jest.spyOn(crypto, 'getRandomValues').mockReturnValue(mockNonce);

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const testData = { message: 'Hello, World!' };
      const userId = 'test-user-123';

      const result = await encryptionService.encryptData(testData, userId);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('tag');
      expect(typeof result.encryptedData).toBe('string');
      expect(typeof result.nonce).toBe('string');
      expect(typeof result.tag).toBe('string');
    });

    it('should throw error when encryption fails', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.encrypt to throw error
      jest.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('Encryption failed'));

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const testData = { message: 'Hello, World!' };
      const userId = 'test-user-123';

      await expect(encryptionService.encryptData(testData, userId))
        .rejects.toThrow('Failed to encrypt data. Please try again.');
    });

    it('should throw error when key retrieval fails', async () => {
      // Mock key retrieval to throw error
      mockIdentityServiceClient.getEncryptionKey.mockRejectedValue(new Error('Key not found'));

      const testData = { message: 'Hello, World!' };
      const userId = 'test-user-123';

      await expect(encryptionService.encryptData(testData, userId))
        .rejects.toThrow('Failed to encrypt data. Please try again.');
    });
  });

  describe('decryptData', () => {
    it('should decrypt data successfully', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.decrypt
      const mockDecryptedBuffer = new TextEncoder().encode(JSON.stringify({ message: 'Hello, World!' }));
      jest.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(mockDecryptedBuffer);

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const encryptedData = 'encrypted-data';
      const nonce = 'nonce-data';
      const tag = 'tag-data';
      const userId = 'test-user-123';

      const result = await encryptionService.decryptData(encryptedData, nonce, tag, userId);

      expect(result).toHaveProperty('decryptedData');
      expect(result.decryptedData).toEqual({ message: 'Hello, World!' });
    });

    it('should throw error when decryption fails', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.decrypt to throw error
      jest.spyOn(crypto.subtle, 'decrypt').mockRejectedValue(new Error('Decryption failed'));

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const encryptedData = 'encrypted-data';
      const nonce = 'nonce-data';
      const tag = 'tag-data';
      const userId = 'test-user-123';

      await expect(encryptionService.decryptData(encryptedData, nonce, tag, userId))
        .rejects.toThrow('Failed to decrypt data. The data may be corrupted or the key may be invalid.');
    });
  });

  describe('key caching', () => {
    it('should cache keys and reuse them', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const userId = 'test-user-123';

      // First call should fetch from identity service
      await encryptionService['getEncryptionKey'](userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);

      // Second call should use cached key
      await encryptionService['getEncryptionKey'](userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);
    });

    it('should clear user key cache', () => {
      const userId = 'test-user-123';
      
      // Add a key to cache
      encryptionService['keyCache'].set(userId, {
        key: {} as CryptoKey,
        expires: Date.now() + 600000
      });

      expect(encryptionService['keyCache'].has(userId)).toBe(true);

      // Clear cache
      encryptionService.clearUserKeyCache(userId);

      expect(encryptionService['keyCache'].has(userId)).toBe(false);
    });

    it('should clear all key cache', () => {
      // Add keys to cache
      encryptionService['keyCache'].set('user1', {
        key: {} as CryptoKey,
        expires: Date.now() + 600000
      });
      encryptionService['keyCache'].set('user2', {
        key: {} as CryptoKey,
        expires: Date.now() + 600000
      });

      expect(encryptionService['keyCache'].size).toBe(2);

      // Clear all cache
      encryptionService.clearAllKeyCache();

      expect(encryptionService['keyCache'].size).toBe(0);
    });
  });

  describe('key expiration', () => {
    it('should fetch new key when cached key is expired', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto.subtle.importKey
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      const userId = 'test-user-123';

      // Add expired key to cache
      encryptionService['keyCache'].set(userId, {
        key: {} as CryptoKey,
        expires: Date.now() - 1000 // Expired
      });

      // Call should fetch new key
      await encryptionService['getEncryptionKey'](userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);
    });
  });
});
