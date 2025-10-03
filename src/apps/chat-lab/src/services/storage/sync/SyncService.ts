/**
 * Sync Service
 * Coordinates synchronization between browser SQLite and Google Drive
 */

import { BrowserSQLiteManager } from '../database/BrowserSQLiteManager';
import { GoogleDriveService } from '../drive/GoogleDriveService';
import { GoogleDriveAuthService } from '../../auth/GoogleDriveAuth';

export interface SyncStatus {
  lastSyncTime: Date | null;
  syncInProgress: boolean;
  error: string | null;
  filesStatus: {
    conversations: boolean;
    apiKeys: boolean;
    metadata: boolean;
  };
}

export interface SyncOptions {
  forceUpload?: boolean;
  skipDownload?: boolean;
  version?: string;
}

export class SyncService {
  private dbManager: BrowserSQLiteManager;
  private driveService: GoogleDriveService;
  private authService: GoogleDriveAuthService;
  private syncInterval: number;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncTime: Date | null = null;
  private syncInProgress: boolean = false;
  private error: string | null = null;

  constructor(
    dbManager: BrowserSQLiteManager,
    driveService: GoogleDriveService,
    authService: GoogleDriveAuthService,
    syncInterval: number = 15 * 60 * 1000 // 15 minutes default
  ) {
    this.dbManager = dbManager;
    this.driveService = driveService;
    this.authService = authService;
    this.syncInterval = syncInterval;

  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to initialize sync service');
    }

    await this.driveService.initialize();
    
    // Load last sync time from localStorage
    const stored = localStorage.getItem('fidu_last_sync');
    if (stored) {
      this.lastSyncTime = new Date(stored);
    }
  }

  /**
   * Perform full synchronization (download from Drive, then upload changes)
   */
  async fullSync(options: SyncOptions = {}): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    this.error = null;

    try {
      console.log('Starting full sync...');

      // Download files from Drive (unless skipped)
      if (!options.skipDownload) {
        await this.syncFromDrive(options.version);
      }

      // Upload changes to Drive
      await this.syncToDrive(options);

      this.lastSyncTime = new Date();
      this.storeLastSyncTime();

      console.log('Full sync completed successfully');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync changes from Google Drive to local SQLite
   */
  async syncFromDrive(version: string = '1'): Promise<void> {
    try {
      const filesExist = await this.driveService.checkFilesExist();
      
      if (filesExist.conversations) {
        const conversationsData = await this.driveService.downloadConversationsDB(version);
        await this.dbManager.importConversationsDB(conversationsData);
      }

      if (filesExist.apiKeys) {
        const apiKeysData = await this.driveService.downloadAPIKeysDB(version);
        await this.dbManager.importAPIKeysDB(apiKeysData);
      }
    } catch (error) {
      console.error('Failed to sync from Drive:', error);
      throw error;
    }
  }

  /**
   * Sync changes from local SQLite to Google Drive using granular change tracking
   */
  async syncToDrive(options: SyncOptions = {}): Promise<void> {
    try {
      const version = options.version || '1';

      // Check if we have pending changes
      const pendingCounts = await this.dbManager.getPendingChangesCount();
      
      if (pendingCounts.dataPackets === 0 && pendingCounts.apiKeys === 0 && !options.forceUpload) {
        console.log('No pending changes to sync');
        return;
      }

      console.log(`Syncing ${pendingCounts.dataPackets} data packets and ${pendingCounts.apiKeys} API keys`);

      // Full database export for simplicity
      // In the future, we could implement incremental sync here
      const conversationsData = await this.dbManager.exportConversationsDB();
      if (conversationsData && conversationsData.length > 0) {
        await this.driveService.uploadConversationsDB(conversationsData, version);
      } else {
        console.log('No conversations data to sync (empty database)');
      }

      const apiKeysData = await this.dbManager.exportAPIKeysDB();
      if (apiKeysData && apiKeysData.length > 0) {
        await this.driveService.uploadAPIKeysDB(apiKeysData, version);
      } else {
        console.log('No API keys data to sync (empty database)');
      }

      // Mark all pending changes as synced
      const pendingDataPackets = await this.dbManager.getPendingDataPackets();
      const pendingAPIKeys = await this.dbManager.getPendingAPIKeys();
      
      if (pendingDataPackets.length > 0) {
        const packetIds = pendingDataPackets.map(p => p.id);
        await this.dbManager.markDataPacketsAsSynced(packetIds);
      }
      
      if (pendingAPIKeys.length > 0) {
        const keyIds = pendingAPIKeys.map(k => k.id);
        await this.dbManager.markAPIKeysAsSynced(keyIds);
      }

      const metadata = {
        lastSync: new Date().toISOString(),
        version: version,
        conversationsSize: conversationsData ? conversationsData.length : 0,
        apiKeysSize: apiKeysData ? apiKeysData.length : 0,
        syncedDataPackets: pendingDataPackets.length,
        syncedAPIKeys: pendingAPIKeys.length
      };
      await this.driveService.uploadMetadata(metadata, version);
      
      console.log(`Successfully synced ${pendingDataPackets.length} data packets and ${pendingAPIKeys.length} API keys`);
    } catch (error) {
      console.error('Failed to sync to Drive:', error);
      throw error;
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      console.log('Auto sync already running');
      return;
    }

    console.log(`Starting auto sync every ${this.syncInterval / 1000 / 60} minutes`);
    
    this.syncTimer = setInterval(async () => {
      try {
        await this.fullSync();
      } catch (error) {
        console.error('Auto sync failed:', error);
        // Let it retry on next interval
      }
    }, this.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('Auto sync stopped');
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      error: this.error,
      filesStatus: {
        conversations: false, // TODO: Check if files exist locally
        apiKeys: false,
        metadata: false
      }
    };
  }

  /**
   * Check if sync is needed based on pending changes or time interval
   */
  async isSyncNeeded(): Promise<boolean> {
    // Check if we have pending changes
    const pendingCounts = await this.dbManager.getPendingChangesCount();
    if (pendingCounts.dataPackets > 0 || pendingCounts.apiKeys > 0) {
      console.log(`Sync needed: ${pendingCounts.dataPackets} data packets and ${pendingCounts.apiKeys} API keys pending`);
      return true;
    }

    // Check time-based sync
    if (!this.lastSyncTime) {
      return true;
    }

    const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime();
    const needsTimeSync = timeSinceLastSync > this.syncInterval;
    
    if (needsTimeSync) {
      console.log(`Sync needed: ${Math.round(timeSinceLastSync / 1000 / 60)} minutes since last sync`);
    }
    
    return needsTimeSync;
  }

  /**
   * Force a sync (useful for manual sync button)
   */
  async forceSync(): Promise<void> {
    await this.fullSync({ forceUpload: true });
  }

  /**
   * Set sync interval
   */
  setSyncInterval(intervalMs: number): void {
    this.syncInterval = intervalMs;
    
    // Restart auto sync with new interval
    if (this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  /**
   * Get sync interval in minutes
   */
  getSyncIntervalMinutes(): number {
    return this.syncInterval / 1000 / 60;
  }

  /**
   * Check if there are unsynced changes that could be lost
   */
  async hasUnsyncedChanges(): Promise<boolean> {
    return await this.dbManager.hasUnsyncedChanges();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSync();
  }

  // Private methods

  private storeLastSyncTime(): void {
    if (this.lastSyncTime) {
      localStorage.setItem('fidu_last_sync', this.lastSyncTime.toISOString());
    }
  }
}
