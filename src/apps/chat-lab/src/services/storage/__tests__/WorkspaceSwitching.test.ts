/**
 * Tests for Workspace Switching in StorageService
 */

import { StorageService } from '../StorageService';
import { getWorkspaceRegistry } from '../../workspace/WorkspaceRegistry';
import { unsyncedDataManager } from '../UnsyncedDataManager';
import type { StorageAdapter } from '../types';

// Mock dependencies
jest.mock('../StorageFactory');
jest.mock('../../workspace/WorkspaceRegistry');
jest.mock('../UnsyncedDataManager');

describe('StorageService - Workspace Switching', () => {
  let storageService: StorageService;
  let mockAdapter: jest.Mocked<StorageAdapter & { close: () => Promise<void> }>;
  let mockWorkspaceRegistry: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorage.clear();

    // Create mock adapter
    mockAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      setUserId: jest.fn(),
      sync: jest.fn().mockResolvedValue(undefined),
      isOnline: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
      // Add other required methods as mocks
      createConversation: jest.fn(),
      updateConversation: jest.fn(),
      getConversations: jest.fn(),
      getConversationById: jest.fn(),
      getMessages: jest.fn(),
      getAPIKey: jest.fn(),
      isAPIKeyAvailable: jest.fn(),
      getAllAPIKeys: jest.fn(),
      saveAPIKey: jest.fn(),
      deleteAPIKey: jest.fn(),
      getContexts: jest.fn(),
      getContextById: jest.fn(),
      createContext: jest.fn(),
      updateContext: jest.fn(),
      deleteContext: jest.fn(),
      getSystemPrompts: jest.fn(),
      getSystemPromptById: jest.fn(),
      createSystemPrompt: jest.fn(),
      updateSystemPrompt: jest.fn(),
      deleteSystemPrompt: jest.fn(),
    };

    // Mock workspace registry
    mockWorkspaceRegistry = {
      getWorkspace: jest.fn(),
      setActiveWorkspace: jest.fn(),
      getWorkspaces: jest.fn().mockReturnValue([]),
      getActiveWorkspaceId: jest.fn().mockReturnValue(null),
    };

    (getWorkspaceRegistry as jest.Mock).mockReturnValue(mockWorkspaceRegistry);

    // Mock unsyncedDataManager
    (unsyncedDataManager.hasUnsynced as jest.Mock) = jest
      .fn()
      .mockReturnValue(false);
    (unsyncedDataManager.markAsSynced as jest.Mock) = jest.fn();

    // Mock createStorageAdapter
    const { createStorageAdapter } = jest.requireMock('../StorageFactory');
    (createStorageAdapter as jest.Mock).mockReturnValue(mockAdapter);

    storageService = new StorageService();
  });

  describe('switchWorkspace', () => {
    beforeEach(async () => {
      // Initialize storage service first
      await storageService.initialize('cloud');
    });

    it('should successfully switch to a different workspace', async () => {
      const targetWorkspace = {
        id: 'workspace-2',
        name: 'Team Workspace',
        type: 'shared' as const,
        driveFolderId: 'folder-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      mockWorkspaceRegistry.getWorkspace.mockReturnValue(targetWorkspace);

      await storageService.switchWorkspace('workspace-2');

      // Verify workspace registry was queried
      expect(mockWorkspaceRegistry.getWorkspace).toHaveBeenCalledWith(
        'workspace-2'
      );

      // Verify adapter was closed
      expect(mockAdapter.close).toHaveBeenCalled();

      // Verify new adapter was initialized
      expect(mockAdapter.initialize).toHaveBeenCalledTimes(2); // Once for initial, once for switch

      // Verify active workspace was set
      expect(mockWorkspaceRegistry.setActiveWorkspace).toHaveBeenCalledWith(
        'workspace-2'
      );
    });

    it('should sync before switching if there are unsynced changes', async () => {
      const targetWorkspace = {
        id: 'workspace-2',
        name: 'Team Workspace',
        type: 'shared' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      mockWorkspaceRegistry.getWorkspace.mockReturnValue(targetWorkspace);
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);

      await storageService.switchWorkspace('workspace-2');

      // Verify sync was called
      expect(mockAdapter.sync).toHaveBeenCalled();
      expect(unsyncedDataManager.markAsSynced).toHaveBeenCalled();
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceRegistry.getWorkspace.mockReturnValue(null);

      await expect(
        storageService.switchWorkspace('non-existent')
      ).rejects.toThrow('Workspace not found: non-existent');
    });

    it('should throw error if sync fails before switching', async () => {
      const targetWorkspace = {
        id: 'workspace-2',
        name: 'Team Workspace',
        type: 'shared' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      mockWorkspaceRegistry.getWorkspace.mockReturnValue(targetWorkspace);
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);
      mockAdapter.sync.mockRejectedValue(new Error('Sync failed'));

      await expect(
        storageService.switchWorkspace('workspace-2')
      ).rejects.toThrow('Failed to sync current workspace');
    });

    it('should update config with workspace context', async () => {
      const targetWorkspace = {
        id: 'workspace-2',
        name: 'Team Workspace',
        type: 'shared' as const,
        driveFolderId: 'folder-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      mockWorkspaceRegistry.getWorkspace.mockReturnValue(targetWorkspace);

      await storageService.switchWorkspace('workspace-2');

      // Verify createStorageAdapter was called with updated config
      const { createStorageAdapter } = jest.requireMock('../StorageFactory');
      const lastCall = (createStorageAdapter as jest.Mock).mock.calls[
        (createStorageAdapter as jest.Mock).mock.calls.length - 1
      ];
      const config = lastCall[0];

      expect(config.workspaceId).toBe('workspace-2');
      expect(config.workspaceType).toBe('shared');
      expect(config.driveFolderId).toBe('folder-123');
    });

    it('should handle personal workspace (virtual - null)', async () => {
      // Personal workspace is virtual - pass null
      await storageService.switchWorkspace(null);

      const { createStorageAdapter } = jest.requireMock('../StorageFactory');
      const lastCall = (createStorageAdapter as jest.Mock).mock.calls[
        (createStorageAdapter as jest.Mock).mock.calls.length - 1
      ];
      const config = lastCall[0];

      expect(config.workspaceId).toBeUndefined();
      expect(config.workspaceType).toBe('personal');
      expect(config.driveFolderId).toBeUndefined();

      // Verify registry was updated to null
      expect(mockWorkspaceRegistry.setActiveWorkspace).toHaveBeenCalledWith(
        null
      );
    });
  });

  describe('getCurrentWorkspaceId', () => {
    it('should return undefined when not initialized', () => {
      expect(storageService.getCurrentWorkspaceId()).toBeUndefined();
    });

    it('should return workspace ID after switching', async () => {
      await storageService.initialize('cloud');

      const targetWorkspace = {
        id: 'workspace-2',
        name: 'Team Workspace',
        type: 'shared' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      mockWorkspaceRegistry.getWorkspace.mockReturnValue(targetWorkspace);

      await storageService.switchWorkspace('workspace-2');

      expect(storageService.getCurrentWorkspaceId()).toBe('workspace-2');
    });
  });
});
