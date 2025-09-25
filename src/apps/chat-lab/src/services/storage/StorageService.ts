/**
 * Storage service that manages the storage adapter based on environment configuration
 */

import type { StorageAdapter, StorageConfig } from './types';
import { StorageMode } from './types';
import { storageFactory } from './StorageFactory';

class StorageService {
  private adapter: StorageAdapter | null = null;
  private config: StorageConfig | null = null;

  /**
   * Initialize the storage service with the appropriate adapter
   */
  async initialize(): Promise<void> {
    this.config = this.getStorageConfig();
    this.adapter = storageFactory.createAdapter(this.config);
    await this.adapter.initialize();
  }

  /**
   * Get the current storage adapter
   */
  getAdapter(): StorageAdapter {
    if (!this.adapter) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  /**
   * Get the current storage configuration
   */
  getConfig(): StorageConfig {
    if (!this.config) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Check if the storage service is initialized
   */
  isInitialized(): boolean {
    return this.adapter !== null && this.adapter.isInitialized();
  }

  /**
   * Get the current storage mode
   */
  getStorageMode(): StorageMode {
    return this.getConfig().mode;
  }

  /**
   * Check if running in cloud mode
   */
  isCloudMode(): boolean {
    return this.getStorageMode() === StorageMode.CLOUD;
  }

  /**
   * Check if running in local mode
   */
  isLocalMode(): boolean {
    return this.getStorageMode() === StorageMode.LOCAL;
  }

  /**
   * Get storage configuration from environment variables
   */
  private getStorageConfig(): StorageConfig {
    // Check for environment variable to determine storage mode
    const storageMode = import.meta.env.VITE_STORAGE_MODE as string;
    
    let mode: StorageMode;
    if (storageMode === 'cloud') {
      mode = StorageMode.CLOUD;
    } else {
      mode = StorageMode.LOCAL; // Default to local mode
    }

    return {
      mode,
      localConfig: {
        baseURL: 'http://127.0.0.1:4000/api/v1', // Always use local FIDU Vault
        timeout: 10000
      },
      cloudConfig: {
        googleDriveEnabled: true,
        syncInterval: parseInt(import.meta.env.VITE_SYNC_INTERVAL || '300000') // 5 minutes default
      }
    };
  }

  /**
   * Switch storage mode (for testing purposes)
   */
  async switchMode(newMode: StorageMode): Promise<void> {
    if (this.config) {
      this.config.mode = newMode;
      this.adapter = storageFactory.createAdapter(this.config);
      if (this.adapter) {
        await this.adapter.initialize();
      }
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
