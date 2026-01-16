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
   * Returns null if activeWorkspaceId is null (personal workspace - virtual)
   */
  getActiveWorkspace(): WorkspaceMetadata | null {
    if (!this.registry.activeWorkspaceId) {
      return null; // Personal workspace (virtual - not stored)
    }
    return this.getWorkspace(this.registry.activeWorkspaceId);
  }

  /**
   * Set active workspace
   * @param workspaceId - Workspace ID to set as active, or null for personal workspace (virtual)
   */
  setActiveWorkspace(workspaceId: string | null): void {
    if (workspaceId === null) {
      // Setting to personal workspace (virtual - no stored entry)
      this.registry.activeWorkspaceId = null;
      this.saveRegistry();
      return;
    }

    // Setting to a shared workspace - must exist in registry
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
    const existingIndex = this.registry.workspaces.findIndex(
      w => w.id === workspace.id
    );

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
    this.registry.workspaces = this.registry.workspaces.filter(
      w => w.id !== workspaceId
    );

    // If we removed the active workspace, clear active workspace ID
    if (this.registry.activeWorkspaceId === workspaceId) {
      this.registry.activeWorkspaceId = null;
    }

    this.saveRegistry();
  }

  /**
   * Create a shared workspace
   * Note: Personal workspaces are virtual (no stored entry) - use setActiveWorkspace(null) to switch to personal
   */
  createSharedWorkspace(
    name: string,
    driveFolderId: string,
    role: 'owner' | 'member' = 'owner'
  ): WorkspaceMetadata {
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
   * Sync workspaces from identity service API
   * Fetches all workspaces the user is a member of and updates the local registry
   */
  async syncFromAPI(): Promise<void> {
    try {
      const { identityServiceAPIClient } =
        await import('../api/apiClientIdentityService');

      // Fetch all workspaces - the API returns the user's role directly in each workspace
      const allWorkspacesResponse =
        await identityServiceAPIClient.listWorkspaces();

      // Build workspace map using the role from the API response
      const allWorkspaces = new Map<string, any>();

      allWorkspacesResponse.workspaces.forEach((ws: any) => {
        // Use the role directly from the API response - it tells us the current user's role
        allWorkspaces.set(ws.id, ws);
      });

      // Get file IDs for each workspace (needed for sync)
      const workspaceMetadataPromises = Array.from(allWorkspaces.values()).map(
        async ws => {
          try {
            const files = await identityServiceAPIClient.getWorkspaceFiles(
              ws.id
            );
            // Map snake_case API response to camelCase WorkspaceMetadata format
            return {
              id: ws.id,
              name: ws.name,
              type: 'shared' as const,
              driveFolderId: ws.drive_folder_id,
              role: ws.role,
              files: {
                conversationsDbId: files.files.conversations_db_id,
                metadataJsonId: files.files.metadata_json_id,
                // API doesn't return apiKeysDbId for shared workspaces (API keys aren't synced)
              },
              createdAt: ws.created_at,
              lastAccessed:
                this.getWorkspace(ws.id)?.lastAccessed
                || new Date().toISOString(), // Preserve lastAccessed if exists
            };
          } catch (error) {
            console.warn(
              `Failed to fetch files for workspace ${ws.id}:`,
              error
            );
            // Return workspace without files - will be added to registry anyway
            return {
              id: ws.id,
              name: ws.name,
              type: 'shared' as const,
              driveFolderId: ws.drive_folder_id,
              role: ws.role,
              createdAt: ws.created_at,
              lastAccessed:
                this.getWorkspace(ws.id)?.lastAccessed
                || new Date().toISOString(),
            };
          }
        }
      );

      const workspaceMetadata = await Promise.all(workspaceMetadataPromises);

      // Update registry with synced workspaces
      workspaceMetadata.forEach(workspace => {
        this.upsertWorkspace(workspace as any);
      });

      // Remove workspaces from registry that are no longer in API response
      // (user was removed from workspace)
      const apiWorkspaceIds = new Set(workspaceMetadata.map(w => w.id));
      const localWorkspaceIds = this.registry.workspaces
        .filter(w => w.type === 'shared')
        .map(w => w.id);

      localWorkspaceIds.forEach(id => {
        if (!apiWorkspaceIds.has(id)) {
          this.removeWorkspace(id);
        }
      });
    } catch (error) {
      console.error('Failed to sync workspaces from API:', error);
      throw error;
    }
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
