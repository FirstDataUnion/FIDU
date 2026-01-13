/**
 * Tests for SyncService
 * Covers workspace-specific sync behavior for both personal and shared workspaces
 */

import { SyncService, MergeResult } from '../SyncService';
import { BrowserSQLiteManager } from '../../database/BrowserSQLiteManager';
import { GoogleDriveService } from '../../drive/GoogleDriveService';
import { GoogleDriveAuthService } from '../../../auth/GoogleDriveAuth';
import { refreshAllDataFromStorage } from '../../../../store/refreshAllData';

// Mock dependencies
jest.mock('../../database/BrowserSQLiteManager');
jest.mock('../../drive/GoogleDriveService');
jest.mock('../../../auth/GoogleDriveAuth');
jest.mock('../../../../store/refreshAllData');

// Get typed mock
const mockRefreshAllDataFromStorage = jest.mocked(refreshAllDataFromStorage);

describe('SyncService', () => {
  let mockDbManager: jest.Mocked<BrowserSQLiteManager>;
  let mockDriveService: jest.Mocked<GoogleDriveService>;
  let mockAuthService: jest.Mocked<GoogleDriveAuthService>;

  // Helper to create a SyncService with specific workspace config
  function createSyncService(
    isSharedWorkspace: boolean = false,
    workspaceId: string = 'default'
  ): SyncService {
    return new SyncService(
      mockDbManager,
      mockDriveService,
      mockAuthService,
      15 * 60 * 1000, // 15 min interval
      isSharedWorkspace,
      workspaceId
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Setup mock BrowserSQLiteManager
    mockDbManager = {
      importConversationsDB: jest.fn().mockResolvedValue({ inserted: 0, updated: 0, forked: 0 }),
      importAPIKeysDB: jest.fn().mockResolvedValue(undefined),
      exportConversationsDB: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      exportAPIKeysDB: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
      getPendingChangesCount: jest.fn().mockResolvedValue({ dataPackets: 0, apiKeys: 0 }),
      getPendingDataPackets: jest.fn().mockResolvedValue([]),
      getPendingAPIKeys: jest.fn().mockResolvedValue([]),
      markDataPacketsAsSynced: jest.fn().mockResolvedValue(undefined),
      markAPIKeysAsSynced: jest.fn().mockResolvedValue(undefined),
      hasUnsyncedChanges: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<BrowserSQLiteManager>;

    // Setup mock GoogleDriveService
    mockDriveService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      checkFilesExist: jest.fn().mockResolvedValue({ conversations: true, apiKeys: true, metadata: true }),
      downloadConversationsDB: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      downloadAPIKeysDB: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
      downloadFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      uploadConversationsDB: jest.fn().mockResolvedValue(undefined),
      uploadAPIKeysDB: jest.fn().mockResolvedValue(undefined),
      uploadMetadata: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GoogleDriveService>;

    // Setup mock GoogleDriveAuthService
    mockAuthService = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getCachedUser: jest.fn().mockReturnValue({ name: 'Test User', email: 'test@example.com' }),
    } as unknown as jest.Mocked<GoogleDriveAuthService>;

    // Setup mock refreshAllDataFromStorage
    mockRefreshAllDataFromStorage.mockResolvedValue(undefined);
  });

  describe('Constructor', () => {
    it('should create personal workspace service by default', () => {
      const service = new SyncService(mockDbManager, mockDriveService, mockAuthService);
      
      // Access private properties via any
      expect((service as any).isSharedWorkspace).toBe(false);
      expect((service as any).workspaceId).toBe('default');
    });

    it('should create shared workspace service when specified', () => {
      const service = createSyncService(true, 'workspace-123');
      
      expect((service as any).isSharedWorkspace).toBe(true);
      expect((service as any).workspaceId).toBe('workspace-123');
    });
  });

  describe('getLastSyncKey', () => {
    it('should return workspace-specific key', () => {
      const service = createSyncService(false, 'my-workspace');
      const key = (service as any).getLastSyncKey();
      
      expect(key).toBe('fidu_last_sync_my-workspace');
    });

    it('should return different keys for different workspaces', () => {
      const service1 = createSyncService(false, 'workspace-1');
      const service2 = createSyncService(true, 'workspace-2');
      
      const key1 = (service1 as any).getLastSyncKey();
      const key2 = (service2 as any).getLastSyncKey();
      
      expect(key1).not.toBe(key2);
      expect(key1).toBe('fidu_last_sync_workspace-1');
      expect(key2).toBe('fidu_last_sync_workspace-2');
    });
  });

  describe('getCurrentUserName', () => {
    it('should extract username from FIDU user email in localStorage', () => {
      localStorage.setItem('user', JSON.stringify({ email: 'john.doe@example.com' }));
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('john.doe');
    });

    it('should use FIDU user name if available', () => {
      localStorage.setItem('user', JSON.stringify({ name: 'John Doe' }));
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('John Doe');
    });

    it('should prefer email over name for username extraction', () => {
      localStorage.setItem('user', JSON.stringify({ 
        email: 'jane.smith@example.com',
        name: 'Jane Smith' 
      }));
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('jane.smith');
    });

    it('should fall back to Google user name', () => {
      mockAuthService.getCachedUser.mockReturnValue({ name: 'Google User', email: 'google@gmail.com' });
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('Google User');
    });

    it('should fall back to Google email if no name', () => {
      mockAuthService.getCachedUser.mockReturnValue({ email: 'test.user@gmail.com' });
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('test.user');
    });

    it('should return "Unknown user" if no user info available', () => {
      mockAuthService.getCachedUser.mockReturnValue(null);
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('Unknown user');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('user', 'invalid-json');
      mockAuthService.getCachedUser.mockReturnValue({ name: 'Fallback User' });
      
      const service = createSyncService(true);
      const userName = (service as any).getCurrentUserName();
      
      expect(userName).toBe('Fallback User');
    });
  });

  describe('initialize', () => {
    it('should throw if user not authenticated', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
      
      const service = createSyncService();
      
      await expect(service.initialize()).rejects.toThrow('User must be authenticated');
    });

    it('should initialize drive service and load last sync time', async () => {
      const lastSync = '2024-01-15T12:00:00.000Z';
      localStorage.setItem('fidu_last_sync_default', lastSync);
      
      const service = createSyncService(false, 'default');
      await service.initialize();
      
      expect(mockDriveService.initialize).toHaveBeenCalled();
      expect((service as any).lastSyncTime).toEqual(new Date(lastSync));
    });

    it('should load workspace-specific last sync time', async () => {
      const lastSync = '2024-01-15T12:00:00.000Z';
      localStorage.setItem('fidu_last_sync_workspace-123', lastSync);
      
      const service = createSyncService(true, 'workspace-123');
      await service.initialize();
      
      expect((service as any).lastSyncTime).toEqual(new Date(lastSync));
    });
  });

  describe('syncFromDrive - Personal Workspace', () => {
    it('should download both conversations and API keys for personal workspace', async () => {
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(mockDriveService.checkFilesExist).toHaveBeenCalled();
      expect(mockDriveService.downloadConversationsDB).toHaveBeenCalledWith('1');
      expect(mockDriveService.downloadAPIKeysDB).toHaveBeenCalledWith('1');
      expect(mockDbManager.importConversationsDB).toHaveBeenCalled();
      expect(mockDbManager.importAPIKeysDB).toHaveBeenCalled();
    });

    it('should NOT pass username to importConversationsDB for personal workspace', async () => {
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      // For personal workspace, username should be undefined (uses numbered copies)
      expect(mockDbManager.importConversationsDB).toHaveBeenCalledWith(
        expect.anything(), // Uint8Array data
        undefined, // lastSyncTimestamp (not set until first sync)
        undefined, // NO username for personal workspace
        false // isSharedWorkspace
      );
    });

    it('should skip API keys if they do not exist', async () => {
      mockDriveService.checkFilesExist.mockResolvedValue({
        conversations: true,
        apiKeys: false,
        metadata: true,
      });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(mockDriveService.downloadConversationsDB).toHaveBeenCalled();
      expect(mockDriveService.downloadAPIKeysDB).not.toHaveBeenCalled();
    });

    it('should refresh Redux state after successful sync', async () => {
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockResolvedValue(undefined);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });

    it('should complete successfully even if refreshAllDataFromStorage fails', async () => {
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockRejectedValue(new Error('Mock: Failed to refresh Redux state'));
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });
  });

  describe('syncFromDrive - Shared Workspace', () => {
    it('should use file IDs for shared workspace when provided', async () => {
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = {
        conversationsDbId: 'file-abc',
        metadataJsonId: 'file-xyz',
      };
      
      await service.syncFromDrive('1', fileIds);
      
      expect(mockDriveService.downloadFile).toHaveBeenCalledWith('file-abc');
      expect(mockDriveService.checkFilesExist).not.toHaveBeenCalled();
    });

    it('should NOT download API keys for shared workspace', async () => {
      mockDriveService.downloadFile.mockRejectedValue(new Error('404 Not Found'));
      mockDriveService.checkFilesExist.mockResolvedValue({
        conversations: true,
        apiKeys: true,
        metadata: true,
      });
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(mockDriveService.downloadAPIKeysDB).not.toHaveBeenCalled();
      expect(mockDbManager.importAPIKeysDB).not.toHaveBeenCalled();
    });

    it('should fall back to filename search if file ID download fails with 404', async () => {
      mockDriveService.downloadFile.mockRejectedValue(new Error('404 Not Found'));
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'bad-file-id' };
      
      await service.syncFromDrive('1', fileIds);
      
      // Should have tried file ID first, then fallen back to filename search
      expect(mockDriveService.downloadFile).toHaveBeenCalledWith('bad-file-id');
      expect(mockDriveService.checkFilesExist).toHaveBeenCalled();
      expect(mockDriveService.downloadConversationsDB).toHaveBeenCalled();
    });

    it('should throw error if file ID download fails with non-404 error', async () => {
      mockDriveService.downloadFile.mockRejectedValue(new Error('Network error'));
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'file-abc' };
      
      await expect(service.syncFromDrive('1', fileIds)).rejects.toThrow('Network error');
    });

    it('should pass username to importConversationsDB for shared workspace', async () => {
      localStorage.setItem('user', JSON.stringify({ email: 'alice@example.com' }));
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'file-abc' };
      await service.syncFromDrive('1', fileIds);
      
      expect(mockDbManager.importConversationsDB).toHaveBeenCalledWith(
        expect.anything(), // Uint8Array data
        undefined, // lastSyncTimestamp (not set until first sync)
        'alice', // username extracted from email
        true // isSharedWorkspace
      );
    });

    it('should refresh Redux state after successful sync', async () => {
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockResolvedValue(undefined);
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'file-abc' };
      await service.syncFromDrive('1', fileIds);
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });

    it('should complete successfully even if refreshAllDataFromStorage fails', async () => {
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockRejectedValue(new Error('Mock: Failed to refresh Redux state'));
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'file-abc' };
      await service.syncFromDrive('1', fileIds);
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });
  });

  describe('syncToDrive - Personal Workspace', () => {
    it('should upload both conversations and API keys for personal workspace', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 1 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      mockDbManager.getPendingAPIKeys.mockResolvedValue([{ id: 'key-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockDriveService.uploadConversationsDB).toHaveBeenCalled();
      expect(mockDriveService.uploadAPIKeysDB).toHaveBeenCalled();
      expect(mockDbManager.markDataPacketsAsSynced).toHaveBeenCalledWith(['dp-1']);
      expect(mockDbManager.markAPIKeysAsSynced).toHaveBeenCalledWith(['key-1']);
    });

    it('should download and merge before uploading (download-merge-upload pattern)', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      // Set up call order tracking
      const callOrder: string[] = [];
      mockDriveService.downloadConversationsDB.mockImplementation(async () => {
        callOrder.push('download');
        return new Uint8Array([1, 2, 3]);
      });
      mockDbManager.importConversationsDB.mockImplementation(async () => {
        callOrder.push('merge');
        return { inserted: 0, updated: 1, forked: 0 };
      });
      mockDriveService.uploadConversationsDB.mockImplementation(async () => {
        callOrder.push('upload');
      });
      
      await service.syncToDrive();
      
      // Verify download-merge-upload order
      expect(callOrder).toEqual(['download', 'merge', 'upload']);
    });

    it('should skip sync if no pending changes and not forced', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockDriveService.uploadConversationsDB).not.toHaveBeenCalled();
    });

    it('should upload if forceUpload is true even without pending changes', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([]);
      mockDbManager.getPendingAPIKeys.mockResolvedValue([]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive({ forceUpload: true });
      
      expect(mockDriveService.uploadConversationsDB).toHaveBeenCalled();
    });

    it('should NOT pass username to importConversationsDB during merge for personal workspace', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      // For personal workspace, username should be undefined (use numbered copies)
      expect(mockDbManager.importConversationsDB).toHaveBeenCalledWith(
        expect.anything(), // Uint8Array data
        undefined, // lastSyncTimestamp (not set until first sync)
        undefined, // NO username for personal workspace
        false // isSharedWorkspace
      );
    });

    it('should refresh Redux state after successful sync', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockResolvedValue(undefined);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });

    it('should complete successfully even if refreshAllDataFromStorage fails', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockRejectedValue(new Error('Mock: Failed to refresh Redux state'));
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });
  });

  describe('syncToDrive - Shared Workspace', () => {
    it('should NOT upload API keys for shared workspace', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 1 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      mockDbManager.getPendingAPIKeys.mockResolvedValue([{ id: 'key-1' }]);
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockDriveService.uploadConversationsDB).toHaveBeenCalled();
      expect(mockDriveService.uploadAPIKeysDB).not.toHaveBeenCalled();
      expect(mockDbManager.markDataPacketsAsSynced).toHaveBeenCalled();
      expect(mockDbManager.markAPIKeysAsSynced).not.toHaveBeenCalled();
    });

    it('should ignore API key pending count for shared workspace', async () => {
      // Only API keys are pending, but this is a shared workspace
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 5 });
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      // Should skip sync since there are no data packet changes
      await service.syncToDrive();
      
      expect(mockDriveService.uploadConversationsDB).not.toHaveBeenCalled();
    });

    it('should pass username to importConversationsDB during merge for shared workspace', async () => {
      localStorage.setItem('user', JSON.stringify({ email: 'bob@company.com' }));
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      await service.syncToDrive();
      
      // For shared workspace, username should be passed (use "[username's copy]")
      expect(mockDbManager.importConversationsDB).toHaveBeenCalledWith(
        expect.anything(), // Uint8Array data
        undefined, // lastSyncTimestamp (not set until first sync)
        'bob', // username
        true // isSharedWorkspace
      );
    });

    it('should refresh Redux state after successful sync', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockResolvedValue(undefined);
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });

    it('should complete successfully even if refreshAllDataFromStorage fails', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      mockRefreshAllDataFromStorage.mockClear();
      mockRefreshAllDataFromStorage.mockRejectedValue(new Error('Mock: Failed to refresh Redux state'));
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(mockRefreshAllDataFromStorage).toHaveBeenCalled();
    });
  });

  describe('fullSync', () => {
    it('should call syncFromDrive then syncToDrive', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      const callOrder: string[] = [];
      mockDriveService.checkFilesExist.mockImplementation(async () => {
        callOrder.push('checkFiles');
        return { conversations: true, apiKeys: true, metadata: true };
      });
      mockDriveService.downloadConversationsDB.mockImplementation(async () => {
        callOrder.push('downloadConv');
        return new Uint8Array([1, 2, 3]);
      });
      mockDriveService.uploadConversationsDB.mockImplementation(async () => {
        callOrder.push('uploadConv');
      });
      
      await service.fullSync();
      
      // Should check files, download, then upload
      expect(callOrder.filter(c => c === 'checkFiles').length).toBeGreaterThanOrEqual(1);
      expect(callOrder).toContain('downloadConv');
      expect(callOrder).toContain('uploadConv');
    });

    it('should skip download if skipDownload option is true', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.fullSync({ skipDownload: true });
      
      // Should not call syncFromDrive's main download path
      // Note: syncToDrive still downloads for merge, but the initial syncFromDrive is skipped
      expect(mockDbManager.importAPIKeysDB).not.toHaveBeenCalled(); // This only happens in syncFromDrive
    });

    it('should store last sync time after successful sync', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'test-workspace');
      await service.initialize();
      
      await service.fullSync({ forceUpload: true });
      
      const storedTime = localStorage.getItem('fidu_last_sync_test-workspace');
      expect(storedTime).toBeTruthy();
      expect(new Date(storedTime!).getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should prevent concurrent syncs', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      // Track how many times fullSync actually executes
      let fullSyncExecutions = 0;
      
      // Slow down the sync significantly
      let resolveCheckFiles: () => void;
      const checkFilesPromise = new Promise<void>(resolve => { resolveCheckFiles = resolve; });
      
      mockDriveService.checkFilesExist.mockImplementation(async () => {
        fullSyncExecutions++;
        await checkFilesPromise;
        return { conversations: true, apiKeys: true, metadata: true };
      });
      
      // Start first sync
      const sync1 = service.fullSync({ forceUpload: true });
      
      // Wait a tick to ensure first sync has set syncInProgress flag
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Start second sync (should be skipped because first is in progress)
      const sync2 = service.fullSync({ forceUpload: true });
      
      // Release the first sync
      resolveCheckFiles!();
      
      await Promise.all([sync1, sync2]);
      
      // Only first sync should have executed (checkFilesExist is called twice per fullSync: in syncFromDrive and syncToDrive)
      // So we expect 2 calls if only one fullSync ran
      expect(fullSyncExecutions).toBe(2); // syncFromDrive + syncToDrive of first sync
      
      // Verify sync status shows not in progress anymore
      expect(service.getSyncStatus().syncInProgress).toBe(false);
    });

    it('should pass fileIds to syncFromDrive for shared workspaces', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(true, 'shared-123');
      await service.initialize();
      
      const fileIds = { conversationsDbId: 'conv-id', metadataJsonId: 'meta-id' };
      
      await service.fullSync({ forceUpload: true, fileIds });
      
      expect(mockDriveService.downloadFile).toHaveBeenCalledWith('conv-id');
    });
  });

  describe('Merge Result Tracking', () => {
    it('should track merge results from syncFromDrive', async () => {
      const mergeResult: MergeResult = { inserted: 5, updated: 3, forked: 1 };
      mockDbManager.importConversationsDB.mockResolvedValue(mergeResult);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      
      expect(service.getLastMergeResult()).toEqual(mergeResult);
    });

    it('should track merge results from syncToDrive', async () => {
      const mergeResult: MergeResult = { inserted: 2, updated: 4, forked: 2 };
      mockDbManager.importConversationsDB.mockResolvedValue(mergeResult);
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncToDrive();
      
      expect(service.getLastMergeResult()).toEqual(mergeResult);
    });

    it('should clear merge result when requested', async () => {
      const mergeResult: MergeResult = { inserted: 1, updated: 1, forked: 1 };
      mockDbManager.importConversationsDB.mockResolvedValue(mergeResult);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await service.syncFromDrive('1');
      expect(service.getLastMergeResult()).toEqual(mergeResult);
      
      service.clearLastMergeResult();
      expect(service.getLastMergeResult()).toBeNull();
    });
  });

  describe('isSyncNeeded', () => {
    it('should return true if data packets are pending', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 3, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      
      const needed = await service.isSyncNeeded();
      
      expect(needed).toBe(true);
    });

    it('should return true if API keys are pending (personal workspace)', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 2 });
      
      const service = createSyncService(false, 'personal');
      
      const needed = await service.isSyncNeeded();
      
      expect(needed).toBe(true);
    });

    it('should return true if never synced', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      // Don't initialize (no lastSyncTime)
      
      const needed = await service.isSyncNeeded();
      
      expect(needed).toBe(true);
    });

    it('should return true if sync interval exceeded', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      // Set last sync time to 20 minutes ago
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      localStorage.setItem('fidu_last_sync_personal', twentyMinutesAgo);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      const needed = await service.isSyncNeeded();
      
      expect(needed).toBe(true);
    });

    it('should return false if recently synced and no pending changes', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      // Set last sync time to 5 minutes ago (within 15 min interval)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      localStorage.setItem('fidu_last_sync_personal', fiveMinutesAgo);
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      const needed = await service.isSyncNeeded();
      
      expect(needed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should continue upload if download fails during syncToDrive', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 1, apiKeys: 0 });
      mockDbManager.getPendingDataPackets.mockResolvedValue([{ id: 'dp-1' }]);
      mockDriveService.downloadConversationsDB.mockRejectedValue(new Error('Download failed'));
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      // Should not throw - download failure during merge is handled gracefully
      await service.syncToDrive();
      
      // Upload should still happen
      expect(mockDriveService.uploadConversationsDB).toHaveBeenCalled();
    });

    it('should set error state on sync failure', async () => {
      mockDriveService.checkFilesExist.mockRejectedValue(new Error('Network error'));
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      await expect(service.fullSync({ forceUpload: true })).rejects.toThrow('Network error');
      
      const status = service.getSyncStatus();
      expect(status.error).toBe('Network error');
    });

    it('should clear error state on successful sync', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      // Force an error first
      (service as any).error = 'Previous error';
      
      await service.fullSync({ forceUpload: true });
      
      const status = service.getSyncStatus();
      expect(status.error).toBeNull();
    });
  });

  describe('Auto Sync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start periodic sync', async () => {
      mockDbManager.getPendingChangesCount.mockResolvedValue({ dataPackets: 0, apiKeys: 0 });
      
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      service.startAutoSync();
      
      // Fast forward 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);
      
      // Sync should have been triggered
      expect(mockDriveService.checkFilesExist).toHaveBeenCalled();
    });

    it('should stop auto sync', async () => {
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      service.startAutoSync();
      service.stopAutoSync();
      
      // Reset call counts
      mockDriveService.checkFilesExist.mockClear();
      
      // Fast forward 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);
      
      // Sync should NOT have been triggered
      expect(mockDriveService.checkFilesExist).not.toHaveBeenCalled();
    });

    it('should clean up on destroy', async () => {
      const service = createSyncService(false, 'personal');
      await service.initialize();
      
      service.startAutoSync();
      service.destroy();
      
      // Reset call counts
      mockDriveService.checkFilesExist.mockClear();
      
      // Fast forward
      jest.advanceTimersByTime(15 * 60 * 1000);
      
      expect(mockDriveService.checkFilesExist).not.toHaveBeenCalled();
    });
  });

  describe('getAuthService', () => {
    it('should return the auth service instance', () => {
      const service = createSyncService(false, 'test-workspace');
      const authService = service.getAuthService();
      
      expect(authService).toBe(mockAuthService);
    });

    it('should return the same instance on multiple calls', () => {
      const service = createSyncService(false, 'test-workspace');
      const authService1 = service.getAuthService();
      const authService2 = service.getAuthService();
      
      expect(authService1).toBe(authService2);
      expect(authService1).toBe(mockAuthService);
    });
  });
});

