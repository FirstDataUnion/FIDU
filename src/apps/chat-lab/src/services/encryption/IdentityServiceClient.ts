/**
 * Identity Service Client
 * Handles communication with the identity service for encryption key management
 */

import { getIdentityServiceUrl } from '../../utils/environment';

export interface EncryptionKeyData {
  id: string;
  key: string;
  algorithm: string;
  created_at: string;
  version: number;
}

export interface EncryptionKeyResponse {
  encryption_key: EncryptionKeyData;
}

export interface WrappedWorkspaceKeyResponse {
  wrapped_key: string;
  algorithm: string;
}

export class IdentityServiceClient {
  private readonly identityServiceUrl: string;

  constructor() {
    this.identityServiceUrl = getIdentityServiceUrl();
  }

  /**
   * Get encryption key for a user (user is determined from auth token)
   * @param userId - The user ID (not used in API call, kept for compatibility)
   * @returns Promise<string> - Base64 encoded encryption key
   */
  async getEncryptionKey(userId: string): Promise<string> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    try {
      const response = await fetch(`${this.identityServiceUrl}/encryption/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      if (response.status === 404) {
        // Key doesn't exist, create one
        return await this.createEncryptionKey(userId);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch encryption key: ${response.status} ${response.statusText}`);
      }

      const data: EncryptionKeyResponse = await response.json();
      
      // Validate the response structure
      if (!data.encryption_key || !data.encryption_key.key || typeof data.encryption_key.key !== 'string') {
        console.error('❌ [IdentityServiceClient] Invalid key format:', data);
        throw new Error('Invalid encryption key format received from server');
      }
      
      return data.encryption_key.key;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to communicate with identity service. Please try again later.');
    }
  }

  /**
   * Create a new encryption key for a user (user is determined from auth token)
   * @param userId - The user ID (not used in API call, kept for compatibility)
   * @returns Promise<string> - Base64 encoded encryption key
   */
  async createEncryptionKey(_userId: string): Promise<string> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    try {
      const response = await fetch(`${this.identityServiceUrl}/encryption/key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [IdentityServiceClient] Failed to create key:', response.status, errorText);
        throw new Error(`Failed to create encryption key: ${response.status} ${response.statusText}`);
      }

      const data: EncryptionKeyResponse = await response.json();
      console.log('🔑 [IdentityServiceClient] Created encryption key response:', data);
      
      // Validate the response structure
      if (!data.encryption_key || !data.encryption_key.key || typeof data.encryption_key.key !== 'string') {
        console.error('❌ [IdentityServiceClient] Invalid key format:', data);
        throw new Error('Invalid encryption key format received from server');
      }
      
      return data.encryption_key.key;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create encryption key. Please try again later.');
    }
  }

  /**
   * Delete encryption key for a user (user is determined from auth token)
   * @param userId - The user ID (not used in API call, kept for compatibility)
   * @returns Promise<void>
   */
  async deleteEncryptionKey(_userId: string): Promise<void> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    try {
      const response = await fetch(`${this.identityServiceUrl}/encryption/key`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      if (response.status === 404) {
        // Key doesn't exist, that's fine
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to delete encryption key: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete encryption key. Please try again later.');
    }
  }

  /**
   * Get authentication token from localStorage
   * @returns string | null - The auth token or null if not found
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Get wrapped workspace encryption key for the authenticated user
   * @param workspaceId - The workspace ID
   * @returns Promise<string> - Base64 encoded wrapped encryption key
   */
  async getWrappedWorkspaceKey(workspaceId: string): Promise<string> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    try {
      const response = await fetch(`${this.identityServiceUrl}/workspaces/${workspaceId}/encryption-key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      if (response.status === 404) {
        throw new Error('Encryption key not found for workspace');
      }

      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({ error: 'User is not a workspace member' }));
        throw new Error(errorData.error || 'User is not a workspace member');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch workspace encryption key: ${response.status} ${response.statusText}`);
      }

      const data: WrappedWorkspaceKeyResponse = await response.json();
      
      // Validate the response structure
      if (!data.wrapped_key || typeof data.wrapped_key !== 'string') {
        console.error('❌ [IdentityServiceClient] Invalid wrapped key format:', data);
        throw new Error('Invalid wrapped encryption key format received from server');
      }

      if (data.algorithm !== 'AES-256-GCM') {
        console.warn(`⚠️ [IdentityServiceClient] Unexpected algorithm: ${data.algorithm}, expected AES-256-GCM`);
      }
      
      return data.wrapped_key;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to communicate with identity service. Please try again later.');
    }
  }

  /**
   * Get the identity service URL
   * @returns string - The identity service URL
   */
  getIdentityServiceUrl(): string {
    return this.identityServiceUrl;
  }
}
