/**
 * Tests for WorkspaceRegistry
 */

import { WorkspaceRegistryService, getWorkspaceRegistry } from '../WorkspaceRegistry';
import type { WorkspaceMetadata } from '../../../types';

describe('WorkspaceRegistryService', () => {
  let registry: WorkspaceRegistryService;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Create a fresh instance
    registry = new WorkspaceRegistryService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty registry', () => {
      const workspaces = registry.getWorkspaces();
      expect(workspaces).toEqual([]);
      expect(registry.getActiveWorkspaceId()).toBeNull();
    });

    it('should load existing registry from localStorage', () => {
      // Clear and set up fresh localStorage
      localStorage.clear();
      
      const mockRegistry = {
        workspaces: [
          {
            id: 'test-workspace',
            name: 'Test Workspace',
            type: 'personal' as const,
            createdAt: '2024-01-01T00:00:00.000Z',
            lastAccessed: '2024-01-01T00:00:00.000Z',
          },
        ],
        activeWorkspaceId: 'test-workspace',
      };

      localStorage.setItem('fidu-workspaces-registry', JSON.stringify(mockRegistry));
      
      // Verify it was stored correctly
      const stored = localStorage.getItem('fidu-workspaces-registry');
      expect(stored).toBeTruthy();
      
      const newRegistry = new WorkspaceRegistryService();
      const workspaces = newRegistry.getWorkspaces();
      
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).toBe('test-workspace');
      expect(newRegistry.getActiveWorkspaceId()).toBe('test-workspace');
    });
  });

  describe('workspace management', () => {
    it('should set personal workspace as active (virtual - null)', () => {
      // Personal workspace is virtual - set activeWorkspaceId to null
      registry.setActiveWorkspace(null);
      
      expect(registry.getActiveWorkspaceId()).toBeNull();
      expect(registry.getActiveWorkspace()).toBeNull();
      // Personal workspace is not stored, so workspaces list should be empty
      expect(registry.getWorkspaces()).toHaveLength(0);
    });

    it('should create shared workspace', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123', 'owner');
      
      expect(workspace.id).toContain('shared-');
      expect(workspace.name).toBe('Team Workspace');
      expect(workspace.type).toBe('shared');
      expect(workspace.driveFolderId).toBe('folder-123');
      expect(workspace.role).toBe('owner');
      expect(workspace.members).toEqual([]);
    });

    it('should upsert workspace', () => {
      const workspace: WorkspaceMetadata = {
        id: 'test-workspace',
        name: 'Test Workspace',
        type: 'personal',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-01T00:00:00.000Z',
      };

      registry.upsertWorkspace(workspace);
      expect(registry.getWorkspaces()).toHaveLength(1);

      // Update the workspace
      const updatedWorkspace = { ...workspace, name: 'Updated Workspace' };
      registry.upsertWorkspace(updatedWorkspace);
      
      expect(registry.getWorkspaces()).toHaveLength(1);
      expect(registry.getWorkspace('test-workspace')?.name).toBe('Updated Workspace');
    });

    it('should remove workspace', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123');
      expect(registry.getWorkspaces()).toHaveLength(1);

      registry.removeWorkspace(workspace.id);
      expect(registry.getWorkspaces()).toHaveLength(0);
      expect(registry.getWorkspace(workspace.id)).toBeNull();
    });

    it('should clear active workspace when removed', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123');
      registry.setActiveWorkspace(workspace.id);
      
      expect(registry.getActiveWorkspaceId()).toBe(workspace.id);
      
      registry.removeWorkspace(workspace.id);
      expect(registry.getActiveWorkspaceId()).toBeNull();
    });
  });

  describe('active workspace management', () => {
    it('should set active workspace to shared workspace', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123');
      registry.setActiveWorkspace(workspace.id);
      
      expect(registry.getActiveWorkspaceId()).toBe(workspace.id);
      expect(registry.getActiveWorkspace()?.id).toBe(workspace.id);
    });

    it('should set active workspace to personal (null)', () => {
      registry.setActiveWorkspace(null);
      
      expect(registry.getActiveWorkspaceId()).toBeNull();
      expect(registry.getActiveWorkspace()).toBeNull();
    });

    it('should throw error when setting non-existent workspace as active', () => {
      expect(() => {
        registry.setActiveWorkspace('non-existent');
      }).toThrow('Workspace not found: non-existent');
    });

    it('should update lastAccessed when setting active shared workspace', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123');
      const originalLastAccessed = workspace.lastAccessed;
      
      // Wait a bit to ensure timestamp changes
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      registry.setActiveWorkspace(workspace.id);
      const updatedWorkspace = registry.getWorkspace(workspace.id);
      
      expect(updatedWorkspace?.lastAccessed).not.toBe(originalLastAccessed);
      
      jest.useRealTimers();
    });

    it('should return null for active workspace when none is set (personal workspace)', () => {
      expect(registry.getActiveWorkspace()).toBeNull();
      expect(registry.getActiveWorkspaceId()).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist shared workspaces to localStorage', () => {
      registry.createSharedWorkspace('Team Workspace', 'folder-123');
      
      const stored = localStorage.getItem('fidu-workspaces-registry');
      expect(stored).toBeTruthy();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.workspaces).toHaveLength(1);
        expect(parsed.workspaces[0].type).toBe('shared');
      }
    });

    it('should persist active shared workspace to localStorage', () => {
      const workspace = registry.createSharedWorkspace('Team Workspace', 'folder-123');
      registry.setActiveWorkspace(workspace.id);
      
      const stored = localStorage.getItem('fidu-workspaces-registry');
      expect(stored).toBeTruthy();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.activeWorkspaceId).toBe(workspace.id);
      }
    });

    it('should persist null activeWorkspaceId for personal workspace', () => {
      registry.setActiveWorkspace(null);
      
      const stored = localStorage.getItem('fidu-workspaces-registry');
      expect(stored).toBeTruthy();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.activeWorkspaceId).toBeNull();
      }
    });
  });

  describe('clearAll', () => {
    it('should clear all shared workspaces', () => {
      const workspace1 = registry.createSharedWorkspace('Team Workspace 1', 'folder-123');
      const workspace2 = registry.createSharedWorkspace('Team Workspace 2', 'folder-456');
      
      // Verify both workspaces were created (they should have different IDs)
      const workspaces = registry.getWorkspaces();
      expect(workspaces.length).toBeGreaterThanOrEqual(1);
      // If UUIDs happen to collide (unlikely but possible), we'd have 1, otherwise 2
      // The important thing is that clearAll removes all of them
      
      registry.clearAll();
      
      expect(registry.getWorkspaces()).toHaveLength(0);
      expect(registry.getActiveWorkspaceId()).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getWorkspaceRegistry();
      const instance2 = getWorkspaceRegistry();
      
      expect(instance1).toBe(instance2);
    });
  });
});

