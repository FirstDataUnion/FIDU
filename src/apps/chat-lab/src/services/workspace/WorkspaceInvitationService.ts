/**
 * Workspace Invitation Service
 * Orchestrates the invitation acceptance flow
 */

import { getGoogleDriveAuthService } from '../auth/GoogleDriveAuth';
import { DrivePicker } from '../drive/DrivePicker';
import { identityServiceAPIClient } from '../api/apiClientIdentityService';
import { ApiError } from '../api/apiClients';
import { getWorkspaceRegistry } from './WorkspaceRegistry';
import { getStorageService } from '../storage/StorageService';
import { store } from '../../store';
import { switchWorkspace } from '../../store/slices/unifiedStorageSlice';
import {
  CONVERSATIONS_DB_FILENAME,
  METADATA_JSON_FILENAME,
} from '../../constants/workspaceFiles';
import type { WorkspaceMetadata } from '../../types';

export interface AcceptInvitationOptions {
  workspaceId: string;
  workspaceName: string;
  driveFolderId: string;
  googleEmail: string;
}

export interface AcceptInvitationProgress {
  step:
    | 'checking-scope'
    | 'accepting-invitation'
    | 'granting-access'
    | 'verifying-access'
    | 'fetching-files'
    | 'creating-workspace'
    | 'switching-workspace'
    | 'complete';
  message: string;
  progress: number; // 0-100
}

export interface PickerResult {
  success: boolean;
  folderId?: string;
  reason?: 'cancelled' | 'mismatch';
}

export class WorkspaceInvitationService {
  private onProgress?: (progress: AcceptInvitationProgress) => void;

  /**
   * Set progress callback
   */
  setProgressCallback(
    callback: (progress: AcceptInvitationProgress) => void
  ): void {
    this.onProgress = callback;
  }

  private reportProgress(
    step: AcceptInvitationProgress['step'],
    message: string,
    progress: number
  ): void {
    if (this.onProgress) {
      this.onProgress({ step, message, progress });
    }
  }

  /**
   * Accept a workspace invitation
   * @param options - Workspace ID, name, folder ID, and Google email
   * @returns Promise resolving to workspace ID
   * @throws Error if any step fails
   */
  async acceptInvitation(options: AcceptInvitationOptions): Promise<string> {
    const { workspaceId, workspaceName, driveFolderId, googleEmail } = options;
    const authService = await getGoogleDriveAuthService();

    // Step 1: Check for drive.file scope
    this.reportProgress('checking-scope', 'Checking permissions...', 10);
    const hasDriveFileScope = await authService.hasDriveFileScope();
    if (!hasDriveFileScope) {
      throw new Error(
        'drive.file scope required. Please re-authenticate with additional permissions.'
      );
    }

    // Step 2: Grant app access to shared folder
    // Validate driveFolderId is present
    if (!driveFolderId) {
      throw new Error(
        'Workspace folder ID is missing. Cannot accept invitation without folder ID.'
      );
    }

    this.reportProgress('granting-access', 'Requesting folder access...', 50);
    const drivePicker = new DrivePicker({ authService });

    // Skip direct access check (CORS issues from browser) and go straight to Picker
    // Picker is required to grant app permission for drive.file scope anyway
    this.reportProgress(
      'granting-access',
      'Please select the shared folder to grant app access...',
      50
    );

    // Use Picker to grant app access to the shared folder
    // User selects the folder, which grants app permission AND verifies Drive share acceptance
    const pickerResult = await drivePicker.grantAccessToSharedFolder(
      driveFolderId,
      workspaceName
    );

    if (!pickerResult.success) {
      if (pickerResult.reason === 'cancelled') {
        throw new Error(
          'Folder selection cancelled. Please select the shared folder to grant the app access.'
        );
      } else if (pickerResult.reason === 'mismatch') {
        throw new Error(
          `You selected a different folder. Please select the folder: "${workspaceName}"`
        );
      } else {
        throw new Error('Failed to grant access to shared folder.');
      }
    }

    // Step 3: Grant access to workspace files inside the folder
    // This is critical because drive.file scope only grants access to:
    // 1. Files the app created, OR
    // 2. Files the user explicitly selected via Picker
    // The workspace files were created by the owner's app, so we must pick them explicitly
    this.reportProgress(
      'granting-access',
      'Please select the workspace files to grant app access...',
      55
    );

    const filesPickerResult = await drivePicker.grantAccessToWorkspaceFiles(
      driveFolderId,
      workspaceName
    );

    if (!filesPickerResult.success) {
      if (filesPickerResult.reason === 'cancelled') {
        throw new Error(
          'File selection cancelled. Please select the workspace files to grant the app access.'
        );
      } else {
        throw new Error(
          `Failed to grant access to workspace files: ${filesPickerResult.reason || 'Unknown error'}`
        );
      }
    }

    // Validate that at least 2 files were selected (conversations DB and metadata)
    if (!filesPickerResult.fileIds || filesPickerResult.fileIds.length < 2) {
      throw new Error(
        `Please select ALL workspace files. You selected ${filesPickerResult.fileIds?.length || 0} file(s), but 2 are required. `
          + `Look for files named "${CONVERSATIONS_DB_FILENAME}" and "${METADATA_JSON_FILENAME}".`
      );
    }

    // Step 4: Verify folder access (double-check)
    this.reportProgress('verifying-access', 'Verifying folder access...', 65);
    const hasAccess = await drivePicker.verifyFolderAccess(driveFolderId);
    if (!hasAccess) {
      // This shouldn't happen, but handle gracefully
      throw new Error(
        'Cannot access the workspace folder. Please ensure you have accepted the '
          + 'Google Drive folder share invitation, then try again.'
      );
    }

    // Step 5: Accept invitation in ID service (must happen before fetching files)
    // This marks the invitation as accepted and makes the user a workspace member
    // We need to be a member to fetch workspace files
    this.reportProgress('accepting-invitation', 'Accepting invitation...', 70);
    try {
      await identityServiceAPIClient.acceptInvitation(workspaceId, googleEmail);
    } catch (error: any) {
      // Handle specific error cases
      if (error instanceof ApiError) {
        if (error.status === 404) {
          const err = new Error(
            'Invitation not found. It may have been cancelled or expired.'
          );
          console.error('Original error:', error);
          throw err;
        }
        if (error.status === 400) {
          const err = new Error(
            error.data?.error
              || 'Invalid invitation. Please check with the workspace owner.'
          );
          console.error('Original error:', error);
          throw err;
        }
      }
      throw error;
    }

    // Step 6: Fetch workspace files (now that user is a member)
    this.reportProgress('fetching-files', 'Fetching workspace files...', 80);
    let files;
    try {
      const filesResponse =
        await identityServiceAPIClient.getWorkspaceFiles(workspaceId);
      // Response format: { files: { drive_folder_id, conversations_db_id, metadata_json_id } }
      if (
        !filesResponse.files
        || !filesResponse.files.conversations_db_id
        || !filesResponse.files.metadata_json_id
      ) {
        throw new Error(
          'No workspace files found. The workspace may not be properly initialized.'
        );
      }
      files = filesResponse.files; // Response is already in the correct format
    } catch (error: any) {
      if (error.message?.includes('No workspace files found')) {
        throw error; // Re-throw our specific error
      }
      const err = new Error(
        'Failed to fetch workspace files. Please try again.'
      );
      console.error('Original error:', error);
      throw err;
    }

    // Step 7: Create local workspace entry
    this.reportProgress('creating-workspace', 'Setting up workspace...', 90);
    await this.createLocalWorkspaceEntry(
      workspaceId,
      workspaceName,
      driveFolderId,
      files
    );

    // Step 8: Switch to new workspace
    this.reportProgress('switching-workspace', 'Switching to workspace...', 95);
    await this.switchToWorkspace(workspaceId);

    this.reportProgress('complete', 'Invitation accepted successfully!', 100);
    return workspaceId;
  }

  /**
   * Create local workspace registry entry
   */
  private async createLocalWorkspaceEntry(
    workspaceId: string,
    workspaceName: string,
    driveFolderId: string,
    files: { conversations_db_id?: string; metadata_json_id?: string }
  ): Promise<void> {
    // Validate required file IDs
    if (!files.conversations_db_id || !files.metadata_json_id) {
      throw new Error(
        'Missing required workspace files. The workspace owner may need to re-share it.'
      );
    }

    const workspaceRegistry = getWorkspaceRegistry();

    const localWorkspace: WorkspaceMetadata = {
      id: workspaceId,
      name: workspaceName,
      type: 'shared',
      driveFolderId: driveFolderId,
      role: 'member',
      members: [], // Will be populated when workspace metadata is loaded
      files: {
        conversationsDbId: files.conversations_db_id,
        metadataJsonId: files.metadata_json_id,
      },
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };

    workspaceRegistry.upsertWorkspace(localWorkspace);
  }

  /**
   * Switch to the accepted workspace
   */
  private async switchToWorkspace(workspaceId: string): Promise<void> {
    const storageService = getStorageService();
    await storageService.switchWorkspace(workspaceId);

    // Update Redux state
    store.dispatch(switchWorkspace(workspaceId));
  }
}

// Export singleton instance
let workspaceInvitationServiceInstance: WorkspaceInvitationService | null =
  null;

export function getWorkspaceInvitationService(): WorkspaceInvitationService {
  if (!workspaceInvitationServiceInstance) {
    workspaceInvitationServiceInstance = new WorkspaceInvitationService();
  }
  return workspaceInvitationServiceInstance;
}
