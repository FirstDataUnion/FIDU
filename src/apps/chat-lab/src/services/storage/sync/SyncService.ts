/**
 * Sync Service
 * Coordinates synchronization between browser SQLite and Google Drive
 */

import { BrowserSQLiteManager } from '../database/BrowserSQLiteManager';
import { GoogleDriveService, InsufficientPermissionsError } from '../drive/GoogleDriveService';
import { GoogleDriveAuthService } from '../../auth/GoogleDriveAuth';
import { refreshAllDataFromStorage } from '../../../store/refreshAllData';

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
  fileIds?: { conversationsDbId?: string; metadataJsonId?: string };
}

export interface MergeResult {
  inserted: number;
  updated: number;
  forked: number;
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
  private isSharedWorkspace: boolean;
  private workspaceId: string;
  private lastMergeResult: MergeResult | null = null;

  constructor(
    dbManager: BrowserSQLiteManager,
    driveService: GoogleDriveService,
    authService: GoogleDriveAuthService,
    syncInterval: number = 15 * 60 * 1000, // 15 minutes default
    isSharedWorkspace: boolean = false, // API keys should not be synced for shared workspaces
    workspaceId: string = 'default'
  ) {
    this.dbManager = dbManager;
    this.driveService = driveService;
    this.authService = authService;
    this.syncInterval = syncInterval;
    this.isSharedWorkspace = isSharedWorkspace;
    this.workspaceId = workspaceId;
  }

  /**
   * Get the current user's display name for conflict labeling
   * Prefers FIDU user email (before @), falls back to Google account
   */
  private getCurrentUserName(): string {
    // First try to get FIDU user info from localStorage
    // The user object has the actual email, whereas profile might be "default" in shared workspaces
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user?.email) {
          // Use part before @ as display name (e.g., "john.doe@example.com" -> "john.doe")
          return user.email.split('@')[0];
        }
        if (user?.name) {
          return user.name;
        }
      }
    } catch {
      // Fall through to Google user info
    }
    
    // Fall back to Google account info
    const googleUser = this.authService.getCachedUser();
    if (googleUser?.name) {
      return googleUser.name;
    }
    if (googleUser?.email) {
      // Use part before @ as display name
      return googleUser.email.split('@')[0];
    }
    return 'Unknown user';
  }

  /**
   * Get the localStorage key for this workspace's last sync time
   */
  private getLastSyncKey(): string {
    return `fidu_last_sync_${this.workspaceId}`;
  }

  /**
   * Refresh Redux state from storage after sync operations
   * Called fire-and-forget style so sync operations don't wait for UI updates
   */
  private refreshReduxState(): void {
    refreshAllDataFromStorage().catch(err => {
      console.error('Failed to refresh Redux state after sync:', err);
    });
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to initialize sync service');
    }

    await this.driveService.initialize();
    
    // Load last sync time from localStorage (workspace-specific)
    const storageKey = this.getLastSyncKey();
    const stored = localStorage.getItem(storageKey);
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
        // For shared workspaces, use file IDs from options if provided
        await this.syncFromDrive(options.version || '1', options.fileIds);
      }

      // Upload changes to Drive
      await this.syncToDrive(options);

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
   * @param version - Database version (default: '1')
   * @param fileIds - Optional file IDs for shared workspaces (bypasses filename search)
   * @returns Merge result with counts of inserted, updated, and forked records
   */
  async syncFromDrive(
    version: string = '1', 
    fileIds?: { conversationsDbId?: string; metadataJsonId?: string }
  ): Promise<MergeResult | void> {
    try {
      let conversationsDownloaded = false;
      let mergeResult: MergeResult | undefined = undefined;
      
      // Get the last sync timestamp for conflict detection
      const lastSyncTimestamp = this.lastSyncTime?.toISOString();
      
      // For shared workspaces with file IDs, try using them directly first
      // If that fails (e.g., 404 - file not accessible), fall back to filename search
      if (this.isSharedWorkspace && fileIds?.conversationsDbId) {
        try {
          const conversationsData = await this.driveService.downloadFile(fileIds.conversationsDbId);
          // For shared workspaces, use username in conflict copies
          const currentUserName = this.getCurrentUserName();
          const importResult = await this.dbManager.importConversationsDB(
            conversationsData, 
            lastSyncTimestamp, 
            currentUserName,
            this.isSharedWorkspace
          );
          mergeResult = importResult || undefined;
          if (mergeResult) {
            this.lastMergeResult = mergeResult;
          }
          conversationsDownloaded = true;
        } catch (error: any) {
          // If download by file ID fails (e.g., 404 - file not accessible), fall back to filename search
          const is404 = error?.message?.includes('404') || error?.message?.includes('Not Found') || 
                       error?.message?.includes('Failed to download file');
          if (!is404) {
            console.error('Failed to download conversations DB by file ID:', error);
            throw error;
          }
          // Fall through to filename search below
        }
      }
      
      // If we didn't successfully download by file ID, use filename search
      if (!conversationsDownloaded) {
        const filesExist = await this.driveService.checkFilesExist();
        
        if (filesExist.conversations) {
          const conversationsData = await this.driveService.downloadConversationsDB(version);
          // For shared workspaces, use username in conflict copies; for personal, use numbered copies
          const currentUserName = this.isSharedWorkspace ? this.getCurrentUserName() : undefined;
          const importResult = await this.dbManager.importConversationsDB(
            conversationsData, 
            lastSyncTimestamp, 
            currentUserName,
            this.isSharedWorkspace
          );
          mergeResult = importResult || undefined;
          if (mergeResult) {
            this.lastMergeResult = mergeResult;
          }
        }

        // Skip API keys download for shared workspaces (security: API keys should not be shared)
        if (!this.isSharedWorkspace && filesExist.apiKeys) {
          const apiKeysData = await this.driveService.downloadAPIKeysDB(version);
          await this.dbManager.importAPIKeysDB(apiKeysData);
        }
      }

      this.refreshReduxState();
      return mergeResult;
    } catch (error) {
      console.error('Failed to sync from Drive:', error);
      
      // Re-throw InsufficientPermissionsError so it can be handled by the UI
      if (error instanceof InsufficientPermissionsError) {
        throw error;
      }
      
      // Check if error message suggests insufficient permissions
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || 
          errorMessage.includes('insufficientPermissions')) {
        throw new InsufficientPermissionsError(
          'Insufficient permissions to access Google Drive. Please re-authorize the app.',
          error
        );
      }
      
      throw error;
    }
  }

  /**
   * Sync changes from local SQLite to Google Drive using download-merge-upload pattern
   * 
   * For shared workspaces, this implements a proper merge strategy:
   * 1. Download current remote database
   * 2. Merge remote changes into local (with fork-on-conflict for true conflicts)
   * 3. Upload the merged result
   * 
   * This prevents data loss when multiple users are making changes.
   */
  async syncToDrive(options: SyncOptions = {}): Promise<void> {
    try {
      const version = options.version || '1';

      // Check if we have pending changes
      // For shared workspaces, ignore API keys in the count
      const pendingCounts = await this.dbManager.getPendingChangesCount();
      const hasPendingChanges = pendingCounts.dataPackets > 0 || 
        (!this.isSharedWorkspace && pendingCounts.apiKeys > 0);
      
      if (!hasPendingChanges && !options.forceUpload) {
        console.log('No pending changes to sync');
        return;
      }

      // STEP 1: Download current remote and merge before uploading
      // This prevents data loss when same user uses multiple devices (personal) or multiple users make changes (shared)
      try {
        const filesExist = await this.driveService.checkFilesExist();
        
        if (filesExist.conversations) {
          const remoteData = await this.driveService.downloadConversationsDB(version);
          const lastSyncTimestamp = this.lastSyncTime?.toISOString();
          
          // For shared workspaces, use username in conflict copies; for personal, use numbered copies
          const currentUserName = this.isSharedWorkspace ? this.getCurrentUserName() : undefined;
          const mergeResult = await this.dbManager.importConversationsDB(
            remoteData, 
            lastSyncTimestamp, 
            currentUserName,
            this.isSharedWorkspace
          );
          
          if (mergeResult) {
            this.lastMergeResult = mergeResult;
          }
        }
      } catch (error) {
        // If download fails (e.g., no remote file yet), just proceed with upload
        console.warn('Failed to download/merge remote before upload, proceeding anyway:', error);
      }

      // STEP 2: Export and upload the merged local database
      const conversationsData = await this.dbManager.exportConversationsDB();
      if (conversationsData && conversationsData.length > 0) {
        await this.driveService.uploadConversationsDB(conversationsData, version);
      }

      // Skip API keys sync for shared workspaces (security: API keys should not be shared)
      let apiKeysData: Uint8Array | null = null;
      if (!this.isSharedWorkspace) {
        apiKeysData = await this.dbManager.exportAPIKeysDB();
        if (apiKeysData && apiKeysData.length > 0) {
          await this.driveService.uploadAPIKeysDB(apiKeysData, version);
        }
      }

      this.lastSyncTime = new Date();
      this.storeLastSyncTime();

      // Mark all pending changes as synced
      const pendingDataPackets = await this.dbManager.getPendingDataPackets();
      const pendingAPIKeys = this.isSharedWorkspace ? [] : await this.dbManager.getPendingAPIKeys();
      
      if (pendingDataPackets.length > 0) {
        const packetIds = pendingDataPackets.map(p => p.id);
        await this.dbManager.markDataPacketsAsSynced(packetIds);
      }
      
      // Only mark API keys as synced if this is not a shared workspace
      if (!this.isSharedWorkspace && pendingAPIKeys.length > 0) {
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

      this.refreshReduxState();
    } catch (error) {
      console.error('Failed to sync to Drive:', error);
      
      // Re-throw InsufficientPermissionsError so it can be handled by the UI
      if (error instanceof InsufficientPermissionsError) {
        throw error;
      }
      
      // Check if error message suggests insufficient permissions
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || 
          errorMessage.includes('insufficientPermissions')) {
        throw new InsufficientPermissionsError(
          'Insufficient permissions to sync with Google Drive. Please re-authorize the app.',
          error
        );
      }
      
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

  /**
   * Get the result of the last merge operation
   * Useful for showing users how many conflicts were forked
   */
  getLastMergeResult(): MergeResult | null {
    return this.lastMergeResult;
  }

  /**
   * Clear the last merge result (after user has been notified)
   */
  clearLastMergeResult(): void {
    this.lastMergeResult = null;
  }

  /**
   * Get the auth service for external access (e.g., by SmartAutoSyncService)
   * Used for proactive token refresh before sync attempts
   */
  getAuthService(): GoogleDriveAuthService {
    return this.authService;
  }

  // Private methods

  private storeLastSyncTime(): void {
    if (this.lastSyncTime) {
      const storageKey = this.getLastSyncKey();
      localStorage.setItem(storageKey, this.lastSyncTime.toISOString());
    }
  }
}
