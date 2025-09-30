/**
 * Storage Service
 * Manages the active storage adapter and provides initialization
 */

import type { StorageAdapter, StorageConfig } from './types';
import { createStorageAdapter } from './StorageFactory';
import { getEnvironmentInfo } from '../../utils/environment';

export class StorageService {
  private adapter: StorageAdapter | null = null;
  private config: StorageConfig | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const envInfo = getEnvironmentInfo();
    this.config = {
      mode: envInfo.storageMode as 'local' | 'cloud',
      baseURL: envInfo.storageMode === 'local' ? 'http://127.0.0.1:4000/api/v1' : undefined
    };

    this.adapter = createStorageAdapter(this.config);
    await this.adapter.initialize();
    
    this.initialized = true;
    console.log(`Storage service initialized in ${this.config.mode} mode`);
  }

  async switchMode(newMode: 'local' | 'cloud' | 'filesystem'): Promise<void> {
    if (this.config?.mode === newMode) {
      return;
    }

    const newConfig: StorageConfig = {
      mode: newMode,
      baseURL: newMode === 'local' ? 'http://127.0.0.1:4000/api/v1' : undefined
    };

    this.adapter = createStorageAdapter(newConfig);
    await this.adapter.initialize();
    
    this.config = newConfig;
    console.log(`Storage service switched to ${newMode} mode`);
  }

  getAdapter(): StorageAdapter {
    if (!this.adapter) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  isInitialized(): boolean {
    return this.initialized && this.adapter?.isInitialized() === true;
  }

  getCurrentMode(): string {
    return this.config?.mode || 'unknown';
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}
