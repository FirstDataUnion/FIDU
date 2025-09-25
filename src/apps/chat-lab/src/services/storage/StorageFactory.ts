/**
 * Storage factory for creating storage adapters based on configuration
 */

import type { StorageAdapter, StorageConfig, StorageFactory } from './types';
import { StorageMode } from './types';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { CloudStorageAdapter } from './adapters/CloudStorageAdapter';

export class ChatLabStorageFactory implements StorageFactory {
  createAdapter(config: StorageConfig): StorageAdapter {
    switch (config.mode) {
      case StorageMode.LOCAL:
        return new LocalStorageAdapter(config);
      case StorageMode.CLOUD:
        return new CloudStorageAdapter(config);
      default:
        throw new Error(`Unsupported storage mode: ${config.mode}`);
    }
  }

  getDefaultConfig(): StorageConfig {
    return {
      mode: StorageMode.LOCAL,
      localConfig: {
        baseURL: 'http://127.0.0.1:4000/api/v1', // Always use local FIDU Vault
        timeout: 10000
      },
      cloudConfig: {
        googleDriveEnabled: false,
        syncInterval: 300000 // 5 minutes
      }
    };
  }
}

// Export singleton instance
export const storageFactory = new ChatLabStorageFactory();
