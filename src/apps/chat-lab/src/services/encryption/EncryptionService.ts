/**
 * Encryption Service
 * Handles encryption/decryption of sensitive data using AES-256-GCM
 * Integrates with identity service for key management
 */

import { identityServiceAPIClient } from '../api/apiClientIdentityService';

export interface EncryptionResult {
  encryptedData: string;
  nonce: string;
  tag: string;
}

export interface DecryptionResult {
  decryptedData: any;
}

export class EncryptionService {
  private keyCache = new Map<string, { key: CryptoKey; expires: number }>();
  private workspaceKeyCache = new Map<
    string,
    { key: CryptoKey; expires: number }
  >();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  // Track in-flight promises to deduplicate concurrent API calls
  private inFlightKeyPromises = new Map<string, Promise<CryptoKey>>();
  private inFlightWorkspaceKeyPromises = new Map<string, Promise<CryptoKey>>();

  /**
   * Encrypt data for a specific user or workspace
   * @param data - The data to encrypt (will be JSON stringified)
   * @param userId - The user ID to encrypt for
   * @param workspaceId - Optional workspace ID. If provided, uses workspace encryption key instead of personal key
   * @returns Promise<EncryptionResult> - Encrypted data with nonce and tag
   */
  async encryptData(
    data: any,
    userId: string,
    workspaceId?: string
  ): Promise<EncryptionResult> {
    try {
      // Get encryption key - use workspace key if workspaceId is provided, otherwise use personal key
      const key = workspaceId
        ? await this.getWorkspaceEncryptionKey(workspaceId, userId)
        : await this.getEncryptionKey(userId);

      // Convert data to JSON string
      const jsonData = JSON.stringify(data);

      // Generate random nonce (12 bytes for GCM)
      const nonce = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128, // 16 bytes
        },
        key,
        new TextEncoder().encode(jsonData)
      );

      // Extract ciphertext and tag
      const tagLength = 16; // 16 bytes for GCM tag
      const ciphertext = encryptedBuffer.slice(0, -tagLength);
      const tag = encryptedBuffer.slice(-tagLength);

      // Convert to base64 for storage
      const encryptedData = this.arrayBufferToBase64(ciphertext);
      const nonceBase64 = this.arrayBufferToBase64(nonce.buffer);
      const tagBase64 = this.arrayBufferToBase64(tag);

      return {
        encryptedData,
        nonce: nonceBase64,
        tag: tagBase64,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data. Please try again.');
    }
  }

  /**
   * Decrypt data for a specific user or workspace
   * @param encryptedData - The encrypted data
   * @param nonce - The nonce used for encryption
   * @param tag - The authentication tag
   * @param userId - The user ID to decrypt for
   * @param workspaceId - Optional workspace ID. If provided, uses workspace encryption key instead of personal key
   * @returns Promise<DecryptionResult> - Decrypted data
   */
  async decryptData(
    encryptedData: string,
    nonce: string,
    tag: string,
    userId: string,
    workspaceId?: string
  ): Promise<DecryptionResult> {
    try {
      // Get encryption key - use workspace key if workspaceId is provided, otherwise use personal key
      const key = workspaceId
        ? await this.getWorkspaceEncryptionKey(workspaceId, userId)
        : await this.getEncryptionKey(userId);

      // Convert from base64
      const ciphertext = this.base64ToArrayBuffer(encryptedData);
      const nonceBuffer = this.base64ToArrayBuffer(nonce);
      const tagBuffer = this.base64ToArrayBuffer(tag);

      // Combine ciphertext and tag
      const combinedBuffer = new Uint8Array(
        ciphertext.byteLength + tagBuffer.byteLength
      );
      combinedBuffer.set(new Uint8Array(ciphertext), 0);
      combinedBuffer.set(new Uint8Array(tagBuffer), ciphertext.byteLength);

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonceBuffer,
          tagLength: 128, // 16 bytes
        },
        key,
        combinedBuffer
      );

      // Convert back to JSON
      const jsonData = new TextDecoder().decode(decryptedBuffer);
      const decryptedData = JSON.parse(jsonData);

      return { decryptedData };
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(
        'Failed to decrypt data. The data may be corrupted or the key may be invalid.'
      );
    }
  }

  /**
   * Get encryption key for a user with caching and promise deduplication.
   * Concurrent calls share the same promise to prevent duplicate API requests.
   */
  private async getEncryptionKey(userId: string): Promise<CryptoKey> {
    const cached = this.keyCache.get(userId);
    if (cached && !this.isKeyExpired(cached.expires)) {
      return cached.key;
    }

    const inFlightPromise = this.inFlightKeyPromises.get(userId);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    // Create controlled promise and set it before starting async operation
    // This ensures concurrent calls will see it and wait for the same request
    let resolvePromise!: (value: CryptoKey) => void;
    let rejectPromise!: (reason?: any) => void;
    const sharedPromise = new Promise<CryptoKey>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.inFlightKeyPromises.set(userId, sharedPromise);

    (async () => {
      try {
        const keyString = await identityServiceAPIClient.getEncryptionKey();
        const keyBuffer = this.base64ToArrayBuffer(keyString);
        const key = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );

        this.keyCache.set(userId, {
          key,
          expires: Date.now() + this.CACHE_TTL,
        });

        resolvePromise(key);
      } catch (error) {
        rejectPromise(error);
      } finally {
        this.inFlightKeyPromises.delete(userId);
      }
    })();

    return sharedPromise;
  }

  /**
   * Get workspace encryption key with caching and promise deduplication.
   * Fetches wrapped key from identity service and unwraps it using the user's personal key.
   */
  async getWorkspaceEncryptionKey(
    workspaceId: string,
    userId: string
  ): Promise<CryptoKey> {
    const cached = this.workspaceKeyCache.get(workspaceId);
    if (cached && !this.isKeyExpired(cached.expires)) {
      return cached.key;
    }

    const cacheKey = `${workspaceId}:${userId}`;
    const inFlightPromise = this.inFlightWorkspaceKeyPromises.get(cacheKey);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    // Create controlled promise and set it before starting async operation
    let resolvePromise!: (value: CryptoKey) => void;
    let rejectPromise!: (reason?: any) => void;
    const sharedPromise = new Promise<CryptoKey>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.inFlightWorkspaceKeyPromises.set(cacheKey, sharedPromise);

    (async () => {
      try {
        const wrappedKeyBase64 =
          await identityServiceAPIClient.getWrappedWorkspaceEncryptionKey(
            workspaceId
          );
        const personalKey = await this.getEncryptionKey(userId);
        const workspaceKey = await this.unwrapKey(
          wrappedKeyBase64,
          personalKey
        );

        this.workspaceKeyCache.set(workspaceId, {
          key: workspaceKey,
          expires: Date.now() + this.CACHE_TTL,
        });

        resolvePromise(workspaceKey);
      } catch (error) {
        console.error(
          `Failed to get workspace encryption key for workspace ${workspaceId}:`,
          error
        );
        rejectPromise(
          new Error(
            `Failed to get workspace encryption key. ${error instanceof Error ? error.message : 'Please try again.'}`
          )
        );
      } finally {
        this.inFlightWorkspaceKeyPromises.delete(cacheKey);
      }
    })();

    return sharedPromise;
  }

  /**
   * Check if a cached key is expired
   * @param expires - Expiration timestamp
   * @returns boolean - True if expired
   */
  private isKeyExpired(expires: number): boolean {
    return Date.now() >= expires;
  }

  /**
   * Clear key cache for a user (useful for logout)
   * @param userId - The user ID
   */
  clearUserKeyCache(userId: string): void {
    this.keyCache.delete(userId);
    this.inFlightKeyPromises.delete(userId);
  }

  /**
   * Clear all cached keys (useful for logout)
   */
  clearAllKeyCache(): void {
    this.keyCache.clear();
    this.workspaceKeyCache.clear();
    this.inFlightKeyPromises.clear();
    this.inFlightWorkspaceKeyPromises.clear();
  }

  /**
   * Clear workspace key cache for a specific workspace (useful when switching workspaces)
   * @param workspaceId - The workspace ID
   */
  clearWorkspaceKeyCache(workspaceId: string): void {
    this.workspaceKeyCache.delete(workspaceId);
    // Clear all in-flight promises for this workspace (they may have different userIds)
    for (const [key, _] of this.inFlightWorkspaceKeyPromises.entries()) {
      if (key.startsWith(`${workspaceId}:`)) {
        this.inFlightWorkspaceKeyPromises.delete(key);
      }
    }
  }

  /**
   * Clear all workspace key caches (useful for logout)
   */
  clearAllWorkspaceKeyCache(): void {
    this.workspaceKeyCache.clear();
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param buffer - The ArrayBuffer to convert
   * @returns string - Base64 encoded string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   * @param base64 - The base64 string to convert
   * @returns ArrayBuffer - The decoded ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Unwrap a workspace encryption key using the user's personal encryption key
   * The wrapped key is encrypted with AES-GCM using the personal key
   * Format: base64-encoded string containing nonce (12 bytes) + ciphertext (includes 16-byte tag)
   *
   * @param wrappedKeyBase64 - The wrapped workspace key (base64-encoded)
   * @param personalKey - The user's personal encryption key (CryptoKey)
   * @returns Promise<CryptoKey> - The unwrapped workspace encryption key
   */
  private async unwrapKey(
    wrappedKeyBase64: string,
    personalKey: CryptoKey
  ): Promise<CryptoKey> {
    try {
      // 1. Decode wrapped key from base64
      const wrappedKeyBuffer = this.base64ToArrayBuffer(wrappedKeyBase64);
      const wrappedKeyArray = new Uint8Array(wrappedKeyBuffer);

      // 2. Extract nonce (first 12 bytes) and ciphertext (rest, which includes 16-byte tag)
      const nonceLength = 12; // 12 bytes for GCM nonce
      const nonce = wrappedKeyArray.slice(0, nonceLength);
      const ciphertext = wrappedKeyArray.slice(nonceLength);

      // 3. Decrypt using personal key
      const decryptedKeyBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128, // 16 bytes for GCM tag
        },
        personalKey,
        ciphertext
      );

      // 4. Import the decrypted key as a CryptoKey for AES-GCM
      const workspaceKey = await crypto.subtle.importKey(
        'raw',
        decryptedKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      return workspaceKey;
    } catch (error) {
      console.error('Failed to unwrap workspace key:', error);
      throw new Error(
        'Failed to unwrap workspace encryption key. The key may be invalid or corrupted.'
      );
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
