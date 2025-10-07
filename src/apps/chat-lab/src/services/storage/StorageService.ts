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

  async initialize(storageMode?: 'local' | 'cloud' | 'filesystem'): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get storage mode from parameter, settings, or environment
    let mode: 'local' | 'cloud' | 'filesystem' = 'local'; // default
    
    if (storageMode) {
      mode = storageMode;
    } else {
      // Check environment variable for deployment type
      const envInfo = getEnvironmentInfo();
      const envMode = envInfo.storageMode as 'local' | 'cloud' | 'filesystem';
      
      // For local deployment, always use local mode (FIDU Vault API)
      if (envMode === 'local') {
        mode = 'local';
      } else {
        // For cloud deployment, respect user's storage mode choice from localStorage
        try {
          const stored = localStorage.getItem('fidu-chat-lab-settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.storageMode) {
              mode = parsed.storageMode;
            }
          }
        } catch {
          console.warn('Failed to load storage mode from settings, using default');
        }
        
        // Fallback to environment mode if no user preference
        if (mode === 'local') {
          mode = envMode || 'local';
        }
      }
    }

    this.config = {
      mode,
      baseURL: mode === 'local' ? 'http://127.0.0.1:4000/api/v1' : undefined
    };

    this.adapter = createStorageAdapter(this.config);
    await this.adapter.initialize();
    
    this.initialized = true;
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

  setUserId(userId: string): void {
    if (this.config) {
      this.config.userId = userId;
    }
    if (this.adapter) {
      this.adapter.setUserId(userId);
    }
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
