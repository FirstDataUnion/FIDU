/**
 * Encryption Integration Tests
 * End-to-end tests for encryption functionality
 */

import { encryptionService } from '../EncryptionService';
import { IdentityServiceClient } from '../IdentityServiceClient';

// Mock the IdentityServiceClient
jest.mock('../IdentityServiceClient');
const MockedIdentityServiceClient = IdentityServiceClient as jest.MockedClass<typeof IdentityServiceClient>;

describe('Encryption Integration Tests', () => {
  let mockIdentityServiceClient: jest.Mocked<IdentityServiceClient>;

  beforeEach(() => {
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
  });

  describe('End-to-End Encryption Flow', () => {
    it('should encrypt and decrypt data successfully', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto operations
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      // Mock random nonce
      const mockNonce = new Uint8Array(12);
      jest.spyOn(crypto, 'getRandomValues').mockReturnValue(mockNonce);

      // Mock encryption
      const mockEncryptedBuffer = new ArrayBuffer(32);
      jest.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(mockEncryptedBuffer);

      // Mock decryption
      const mockDecryptedBuffer = new TextEncoder().encode(JSON.stringify({ message: 'Hello, World!' }));
      jest.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(mockDecryptedBuffer);

      const testData = { message: 'Hello, World!' };
      const userId = 'test-user-123';

      // Encrypt data
      const encryptedResult = await encryptionService.encryptData(testData, userId);

      expect(encryptedResult).toHaveProperty('encryptedData');
      expect(encryptedResult).toHaveProperty('nonce');
      expect(encryptedResult).toHaveProperty('tag');

      // Decrypt data
      const decryptedResult = await encryptionService.decryptData(
        encryptedResult.encryptedData,
        encryptedResult.nonce,
        encryptedResult.tag,
        userId
      );

      expect(decryptedResult.decryptedData).toEqual(testData);
    });

    it('should handle different data types', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto operations
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      // Mock random nonce
      const mockNonce = new Uint8Array(12);
      jest.spyOn(crypto, 'getRandomValues').mockReturnValue(mockNonce);

      // Mock encryption
      const mockEncryptedBuffer = new ArrayBuffer(32);
      jest.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(mockEncryptedBuffer);

      // Mock decryption
      const mockDecryptedBuffer = new TextEncoder().encode(JSON.stringify({ 
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' }
      }));
      jest.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(mockDecryptedBuffer);

      const testData = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };
      const userId = 'test-user-123';

      // Encrypt data
      const encryptedResult = await encryptionService.encryptData(testData, userId);

      // Decrypt data
      const decryptedResult = await encryptionService.decryptData(
        encryptedResult.encryptedData,
        encryptedResult.nonce,
        encryptedResult.tag,
        userId
      );

      expect(decryptedResult.decryptedData).toEqual(testData);
    });

    it('should handle empty data', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto operations
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      // Mock random nonce
      const mockNonce = new Uint8Array(12);
      jest.spyOn(crypto, 'getRandomValues').mockReturnValue(mockNonce);

      // Mock encryption
      const mockEncryptedBuffer = new ArrayBuffer(32);
      jest.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(mockEncryptedBuffer);

      // Mock decryption
      const mockDecryptedBuffer = new TextEncoder().encode(JSON.stringify({}));
      jest.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(mockDecryptedBuffer);

      const testData = {};
      const userId = 'test-user-123';

      // Encrypt data
      const encryptedResult = await encryptionService.encryptData(testData, userId);

      // Decrypt data
      const decryptedResult = await encryptionService.decryptData(
        encryptedResult.encryptedData,
        encryptedResult.nonce,
        encryptedResult.tag,
        userId
      );

      expect(decryptedResult.decryptedData).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should handle key retrieval failure', async () => {
      // Mock key retrieval to fail
      mockIdentityServiceClient.getEncryptionKey.mockRejectedValue(new Error('Key not found'));

      const testData = { message: 'Hello, World!' };
      const userId = 'test-user-123';

      await expect(encryptionService.encryptData(testData, userId))
        .rejects.toThrow('Failed to encrypt data. Please try again.');
    });

    it('should handle decryption failure', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto operations
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      // Mock decryption to fail
      jest.spyOn(crypto.subtle, 'decrypt').mockRejectedValue(new Error('Decryption failed'));

      const encryptedData = 'invalid-encrypted-data';
      const nonce = 'invalid-nonce';
      const tag = 'invalid-tag';
      const userId = 'test-user-123';

      await expect(encryptionService.decryptData(encryptedData, nonce, tag, userId))
        .rejects.toThrow('Failed to decrypt data. The data may be corrupted or the key may be invalid.');
    });
  });

  describe('Key Caching', () => {
    it('should cache keys across multiple operations', async () => {
      // Mock key retrieval
      const mockKey = 'mock-base64-key';
      mockIdentityServiceClient.getEncryptionKey.mockResolvedValue(mockKey);

      // Mock crypto operations
      const mockCryptoKey = {} as CryptoKey;
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey);

      // Mock random nonce
      const mockNonce = new Uint8Array(12);
      jest.spyOn(crypto, 'getRandomValues').mockReturnValue(mockNonce);

      // Mock encryption
      const mockEncryptedBuffer = new ArrayBuffer(32);
      jest.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(mockEncryptedBuffer);

      // Mock decryption
      const mockDecryptedBuffer = new TextEncoder().encode(JSON.stringify({ message: 'Hello, World!' }));
      jest.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(mockDecryptedBuffer);

      const userId = 'test-user-123';

      // First operation
      await encryptionService.encryptData({ message: 'First' }, userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);

      // Second operation should use cached key
      await encryptionService.encryptData({ message: 'Second' }, userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);

      // Third operation should use cached key
      await encryptionService.decryptData('encrypted', 'nonce', 'tag', userId);
      expect(mockIdentityServiceClient.getEncryptionKey).toHaveBeenCalledTimes(1);
    });
  });
});
