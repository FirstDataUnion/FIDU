/**
 * Storage Service
 * Manages the active storage adapter and provides initialization
 */

import type { StorageAdapter, StorageConfig } from './types';
import { createStorageAdapter } from './StorageFactory';
import { getEnvironmentInfo } from '../../utils/environment';
import { getWorkspaceRegistry } from '../workspace/WorkspaceRegistry';
import { unsyncedDataManager } from './UnsyncedDataManager';
import { encryptionService } from '../encryption/EncryptionService';

export class StorageService {
  private adapter: StorageAdapter | null = null;
  private config: StorageConfig | null = null;
  private initialized = false;

  async initialize(storageMode?: 'local' | 'cloud'): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get storage mode from parameter, settings, or environment
    let mode: 'local' | 'cloud' = 'local'; // default

    if (storageMode) {
      mode = storageMode;
    } else {
      // Check environment variable for deployment type
      const envInfo = getEnvironmentInfo();
      const envMode = envInfo.storageMode as 'local' | 'cloud';

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
          console.warn(
            'Failed to load storage mode from settings, using default'
          );
        }

        // Fallback to environment mode if no user preference
        if (mode === 'local') {
          mode = envMode || 'local';
        }
      }
    }

    this.config = {
      mode,
      baseURL: mode === 'local' ? 'http://127.0.0.1:4000/api/v1' : undefined,
    };

    this.adapter = createStorageAdapter(this.config);
    await this.adapter.initialize();

    this.initialized = true;
  }

  /**
   * Force re-initialization of the storage service and underlying adapter.
   * Useful after authentication state changes (e.g., Google Drive restored).
   */
  async reinitialize(): Promise<void> {
    // If we don't have a config yet, fall back to normal initialize flow
    if (!this.config) {
      this.initialized = false;
      await this.initialize();
      return;
    }

    // Reset initialization state to allow proper re-initialization
    this.initialized = false;

    // Recreate adapter with existing configuration
    this.adapter = createStorageAdapter(this.config);
    await this.adapter.initialize();

    this.initialized = true;
  }

  async switchMode(newMode: 'local' | 'cloud'): Promise<void> {
    if (this.config?.mode === newMode) {
      return;
    }

    // Reset initialization state to allow proper re-initialization
    this.initialized = false;

    const newConfig: StorageConfig = {
      mode: newMode,
      baseURL: newMode === 'local' ? 'http://127.0.0.1:4000/api/v1' : undefined,
    };

    this.adapter = createStorageAdapter(newConfig);
    await this.adapter.initialize();

    this.config = newConfig;
    this.initialized = true;
  }

  getAdapter(): StorageAdapter {
    if (!this.adapter) {
      throw new Error(
        'Storage service not initialized. Call initialize() first.'
      );
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

  /**
   * Switch to a different workspace
   * @param workspaceId - Workspace ID to switch to, or null for personal workspace (virtual)
   * Syncs current workspace, closes connections, and reinitializes with new workspace
   */
  async switchWorkspace(workspaceId: string | null): Promise<void> {
    const workspaceRegistry = getWorkspaceRegistry();

    // Clear workspace encryption key cache before switching
    // This prevents using cached keys from previous workspaces
    const currentWorkspaceId = this.config?.workspaceId;
    if (currentWorkspaceId) {
      encryptionService.clearWorkspaceKeyCache(currentWorkspaceId);
    }

    // Also clear cache for the workspace we're switching to (if it's a shared workspace)
    // This ensures we always get a fresh key when switching to a workspace
    if (workspaceId !== null) {
      encryptionService.clearWorkspaceKeyCache(workspaceId);
    }

    // Handle personal workspace (virtual - no stored entry)
    if (workspaceId === null) {
      // 1. Sync current workspace if there are unsaved changes
      if (this.adapter && unsyncedDataManager.hasUnsynced()) {
        try {
          await this.adapter.sync();
          unsyncedDataManager.markAsSynced();
        } catch (error) {
          console.error('Failed to sync before workspace switch:', error);
          throw new Error(
            'Failed to sync current workspace. Please try again.'
          );
        }
      }

      // 2. Close current adapter and cleanup
      if (this.adapter && typeof (this.adapter as any).close === 'function') {
        await (this.adapter as any).close();
      }

      // 3. Update config for personal workspace (default behavior)
      if (!this.config) {
        throw new Error('Storage service not configured');
      }

      this.config = {
        ...this.config,
        workspaceId: undefined, // Personal workspace has no ID
        workspaceType: 'personal',
        driveFolderId: undefined, // Personal workspace uses AppData
      };

      // 4. Create new adapter with updated config
      this.initialized = false;
      this.adapter = createStorageAdapter(this.config);
      await this.adapter.initialize();
      this.initialized = true;

      // 5. Update workspace registry
      workspaceRegistry.setActiveWorkspace(null);
      return;
    }

    // Handle shared workspace (must exist in registry)
    const workspace = workspaceRegistry.getWorkspace(workspaceId);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // 1. Sync current workspace if there are unsaved changes
    if (this.adapter && unsyncedDataManager.hasUnsynced()) {
      try {
        await this.adapter.sync();
        unsyncedDataManager.markAsSynced();
      } catch (error) {
        console.error('Failed to sync before workspace switch:', error);
        throw new Error('Failed to sync current workspace. Please try again.');
      }
    }

    // 2. Close current adapter and cleanup
    if (this.adapter && typeof (this.adapter as any).close === 'function') {
      await (this.adapter as any).close();
    }

    // Note: Workspace key cache for the new workspace will be cleared above
    // It will be fetched fresh when first needed

    // 3. Update config with new workspace context
    if (!this.config) {
      throw new Error('Storage service not configured');
    }

    this.config = {
      ...this.config,
      workspaceId: workspace.id,
      workspaceType: workspace.type,
      driveFolderId: workspace.driveFolderId,
    };

    // 4. Create new adapter with updated config
    this.initialized = false;
    this.adapter = createStorageAdapter(this.config);
    await this.adapter.initialize();
    this.initialized = true;

    // 5. Update workspace registry
    workspaceRegistry.setActiveWorkspace(workspaceId);
  }

  /**
   * Get current workspace ID from config
   */
  getCurrentWorkspaceId(): string | undefined {
    return this.config?.workspaceId;
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
