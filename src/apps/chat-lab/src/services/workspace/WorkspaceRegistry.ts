/**
 * Workspace Registry Service
 * Manages workspace metadata and active workspace state
 */

import type { WorkspaceMetadata, WorkspaceRegistry } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'fidu-workspaces-registry';

export class WorkspaceRegistryService {
  private registry: WorkspaceRegistry;

  constructor() {
    this.registry = this.loadRegistry();
  }

  /**
   * Load workspace registry from localStorage
   */
  private loadRegistry(): WorkspaceRegistry {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate structure
        if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load workspace registry:', error);
    }

    // Return default registry
    return {
      workspaces: [],
      activeWorkspaceId: null,
    };
  }

  /**
   * Save workspace registry to localStorage
   */
  private saveRegistry(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.registry));
    } catch (error) {
      console.error('Failed to save workspace registry:', error);
      throw new Error('Failed to save workspace registry');
    }
  }

  /**
   * Get all workspaces
   */
  getWorkspaces(): WorkspaceMetadata[] {
    return [...this.registry.workspaces];
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(workspaceId: string): WorkspaceMetadata | null {
    return this.registry.workspaces.find(w => w.id === workspaceId) || null;
  }

  /**
   * Get active workspace ID
   */
  getActiveWorkspaceId(): string | null {
    return this.registry.activeWorkspaceId;
  }

  /**
   * Get active workspace metadata
   */
  getActiveWorkspace(): WorkspaceMetadata | null {
    if (!this.registry.activeWorkspaceId) {
      return null;
    }
    return this.getWorkspace(this.registry.activeWorkspaceId);
  }

  /**
   * Set active workspace
   */
  setActiveWorkspace(workspaceId: string): void {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    this.registry.activeWorkspaceId = workspaceId;
    
    // Update lastAccessed timestamp
    workspace.lastAccessed = new Date().toISOString();
    
    this.saveRegistry();
  }

  /**
   * Add or update workspace
   */
  upsertWorkspace(workspace: WorkspaceMetadata): void {
    const existingIndex = this.registry.workspaces.findIndex(w => w.id === workspace.id);
    
    if (existingIndex >= 0) {
      // Update existing workspace
      this.registry.workspaces[existingIndex] = {
        ...this.registry.workspaces[existingIndex],
        ...workspace,
      };
    } else {
      // Add new workspace
      this.registry.workspaces.push(workspace);
    }
    
    this.saveRegistry();
  }

  /**
   * Remove workspace
   */
  removeWorkspace(workspaceId: string): void {
    this.registry.workspaces = this.registry.workspaces.filter(w => w.id !== workspaceId);
    
    // If we removed the active workspace, clear active workspace ID
    if (this.registry.activeWorkspaceId === workspaceId) {
      this.registry.activeWorkspaceId = null;
    }
    
    this.saveRegistry();
  }

  /**
   * Create a personal workspace for a user/profile
   */
  createPersonalWorkspace(userId: string, profileId: string, profileName: string): WorkspaceMetadata {
    const workspaceId = `personal-${userId}-${profileId}`;
    
    const workspace: WorkspaceMetadata = {
      id: workspaceId,
      name: `${profileName}'s Workspace`,
      type: 'personal',
      driveFolderId: undefined, // Personal workspaces use AppData
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    
    this.upsertWorkspace(workspace);
    
    return workspace;
  }

  /**
   * Create a shared workspace
   */
  createSharedWorkspace(name: string, driveFolderId: string, role: 'owner' | 'member' = 'owner'): WorkspaceMetadata {
    const workspaceId = `shared-${uuidv4()}`;
    
    const workspace: WorkspaceMetadata = {
      id: workspaceId,
      name,
      type: 'shared',
      driveFolderId,
      role,
      members: [],
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    
    this.upsertWorkspace(workspace);
    
    return workspace;
  }

  /**
   * Get or create personal workspace for current user/profile
   */
  getOrCreatePersonalWorkspace(userId: string, profileId: string, profileName: string): WorkspaceMetadata {
    const workspaceId = `personal-${userId}-${profileId}`;
    const existing = this.getWorkspace(workspaceId);
    
    if (existing) {
      return existing;
    }
    
    return this.createPersonalWorkspace(userId, profileId, profileName);
  }

  /**
   * Clear all workspaces (for testing/reset)
   */
  clearAll(): void {
    this.registry = {
      workspaces: [],
      activeWorkspaceId: null,
    };
    this.saveRegistry();
  }
}

// Singleton instance
let workspaceRegistryInstance: WorkspaceRegistryService | null = null;

export function getWorkspaceRegistry(): WorkspaceRegistryService {
  if (!workspaceRegistryInstance) {
    workspaceRegistryInstance = new WorkspaceRegistryService();
  }
  return workspaceRegistryInstance;
}

