/**
 * Workspace Helper Functions
 * Utilities for converting between Profile, WorkspaceMetadata, and UnifiedWorkspace types
 */

import type { Profile, WorkspaceMetadata, UnifiedWorkspace } from '../types';

/**
 * Convert a Profile to UnifiedWorkspace (personal workspace)
 */
export function profileToUnifiedWorkspace(profile: Profile): UnifiedWorkspace {
  return {
    id: profile.id,
    name: profile.name,
    type: 'personal',
    profileId: profile.id,
    createdAt: profile.create_timestamp,
    lastAccessed: profile.create_timestamp, // Use create timestamp as default
  };
}

/**
 * Convert WorkspaceMetadata to UnifiedWorkspace
 */
export function workspaceMetadataToUnifiedWorkspace(
  metadata: WorkspaceMetadata
): UnifiedWorkspace {
  return {
    id: metadata.id,
    name: metadata.name,
    type: metadata.type,
    profileId: metadata.profileId,
    driveFolderId: metadata.driveFolderId,
    role: metadata.role,
    members: metadata.members,
    createdAt: metadata.createdAt,
    lastAccessed: metadata.lastAccessed,
  };
}

/**
 * Get the effective profile ID for a workspace
 * - Personal workspaces: returns the actual profile ID
 * - Shared workspaces: returns the virtual profile ID format (workspace-${id}-default)
 */
export function getEffectiveProfileId(workspace: UnifiedWorkspace): string {
  if (workspace.type === 'personal') {
    if (!workspace.profileId) {
      throw new Error(
        `Personal workspace ${workspace.id} is missing profileId`
      );
    }
    return workspace.profileId;
  } else {
    // Shared workspace: use virtual profile ID format
    return `workspace-${workspace.id}-default`;
  }
}

/**
 * Check if a workspace is a personal workspace
 */
export function isPersonalWorkspace(
  workspace: UnifiedWorkspace
): boolean {
  return workspace.type === 'personal';
}

/**
 * Check if a workspace is a shared workspace
 */
export function isSharedWorkspace(workspace: UnifiedWorkspace): boolean {
  return workspace.type === 'shared';
}
