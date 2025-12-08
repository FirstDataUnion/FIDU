/**
 * Workspace Creation Service
 * Orchestrates the creation of shared workspaces
 */

import { getGoogleDriveAuthService, GoogleDriveAuthService } from '../auth/GoogleDriveAuth';
import { DrivePicker } from '../drive/DrivePicker';
import { GoogleDriveService } from '../storage/drive/GoogleDriveService';
import { BrowserSQLiteManager } from '../storage/database/BrowserSQLiteManager';
import { identityServiceAPIClient } from '../api/apiClientIdentityService';
import { ApiError } from '../api/apiClients';
import { getWorkspaceRegistry } from './WorkspaceRegistry';
import { getStorageService } from '../storage/StorageService';
import { store } from '../../store';
import { switchWorkspace } from '../../store/slices/unifiedStorageSlice';
import { CONVERSATIONS_DB_FILENAME, METADATA_JSON_FILENAME } from '../../constants/workspaceFiles';
import type { WorkspaceMetadata } from '../../types';

export interface CreateWorkspaceOptions {
  name: string;
  memberEmails: string[];
  folderCreationMethod: 'create' | 'select';
  folderName?: string; // For 'create' method
  selectedFolderId?: string; // For 'select' method
}

export interface WorkspaceCreationProgress {
  step: 'checking-scope' | 'creating-folder' | 'registering-workspace' | 'creating-files' | 'registering-files' | 'sharing-folder' | 'switching-workspace' | 'complete';
  message: string;
  progress: number; // 0-100
}

export class WorkspaceCreationService {
  private onProgress?: (progress: WorkspaceCreationProgress) => void;

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: WorkspaceCreationProgress) => void): void {
    this.onProgress = callback;
  }

  private reportProgress(step: WorkspaceCreationProgress['step'], message: string, progress: number): void {
    if (this.onProgress) {
      this.onProgress({ step, message, progress });
    }
  }

  /**
   * Validate workspace creation options
   * @throws Error if validation fails
   */
  private validateOptions(options: CreateWorkspaceOptions): void {
    // Validate workspace name
    if (!options.name || !options.name.trim()) {
      throw new Error('Workspace name is required');
    }
    
    if (options.name.trim().length > 255) {
      throw new Error('Workspace name must be 255 characters or less');
    }

    // Validate folder creation method
    if (options.folderCreationMethod === 'create') {
      // If folderName is not provided, we'll use workspace name as fallback
      // No validation needed here - fallback handled in getOrCreateFolder
    } else if (options.folderCreationMethod === 'select') {
      if (!options.selectedFolderId) {
        throw new Error('No folder selected');
      }
    }

    // Validate member emails (basic format check - detailed validation happens in dialog)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = options.memberEmails.filter(email => {
      const trimmed = email.trim();
      return trimmed.length > 0 && !emailRegex.test(trimmed);
    });
    
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }

    // Check for duplicate emails (case-insensitive)
    const emailMap = new Map<string, number>();
    const duplicates: string[] = [];
    options.memberEmails.forEach((email, index) => {
      const trimmed = email.trim().toLowerCase();
      if (trimmed) {
        if (emailMap.has(trimmed)) {
          duplicates.push(email.trim());
        } else {
          emailMap.set(trimmed, index);
        }
      }
    });
    
    if (duplicates.length > 0) {
      throw new Error(`Duplicate email addresses: ${duplicates.join(', ')}`);
    }
  }

  /**
   * Create a new shared workspace
   * 
   * @param options - Workspace creation options including name, members, and folder configuration
   * @returns Promise resolving to workspace ID and folder ID
   * @throws Error if validation fails, permissions are insufficient, or workspace creation fails
   */
  async createWorkspace(options: CreateWorkspaceOptions): Promise<{ workspaceId: string; folderId: string }> {
    // Validate inputs
    this.validateOptions(options);
    
    const authService = await getGoogleDriveAuthService();
    
    // Step 1: Check for drive.file scope
    this.reportProgress('checking-scope', 'Checking permissions...', 10);
    
    const hasDriveFileScope = await authService.hasDriveFileScope();
    if (!hasDriveFileScope) {
      throw new Error('drive.file scope required. Please re-authenticate with additional permissions.');
    }

    // Step 2: Create or select folder
    this.reportProgress('creating-folder', 'Setting up Google Drive folder...', 20);
    const folderId = await this.getOrCreateFolder(authService, options);
    
    // Step 3: Register with ID service early (before creating files)
    // This validates that all members have connected Google Drive and returns their Google emails
    this.reportProgress('registering-workspace', 'Registering workspace and validating members...', 30);
    const { workspaceId, members } = await this.registerWorkspace(
      options.name, 
      folderId, 
      options.memberEmails
    );
    
    // Extract Google emails from members (excluding owner, who already has access)
    const memberGoogleEmails = members
      .filter(m => m.role === 'member' && m.google_email)
      .map(m => m.google_email!);
    
    // Step 4: Create database files in folder
    this.reportProgress('creating-files', 'Creating workspace files...', 50);
    const { conversationsFileId, metadataFileId } = await this.createWorkspaceFiles(
      authService, 
      folderId, 
      options.name
    );
    
    // Step 5: Register file IDs with ID service
    this.reportProgress('registering-files', 'Registering workspace files...', 60);
    try {
      await identityServiceAPIClient.registerWorkspaceFiles(
        workspaceId,
        folderId,
        conversationsFileId,
        metadataFileId
      );
    } catch (error: any) {
      console.error('Failed to register workspace files with ID service:', error);
      // Don't fail the whole process - files are created and stored locally
      // But log the error so we know about it
      console.warn('Workspace files created but not registered with ID service. Members may need to manually configure files.');
    }
    
    // Step 6: Share folder with members using Google emails from ID service
    this.reportProgress('sharing-folder', 'Sharing folder with team members...', 70);
    await this.shareFolderWithMembers(authService, folderId, memberGoogleEmails);
    
    // Step 7: Create local registry entry and switch
    this.reportProgress('switching-workspace', 'Switching to new workspace...', 90);
    await this.setupLocalWorkspace(workspaceId, options.name, folderId, conversationsFileId, metadataFileId);
    
    this.reportProgress('complete', 'Workspace created successfully!', 100);
    
    return { workspaceId, folderId };
  }

  /**
   * Get or create folder based on options
   * 
   * @param authService - Google Drive authentication service
   * @param options - Workspace creation options
   * @returns Promise resolving to the folder ID
   * @throws Error if folder creation/selection fails or access is denied
   */
  private async getOrCreateFolder(
    authService: GoogleDriveAuthService,
    options: CreateWorkspaceOptions
  ): Promise<string> {
    const drivePicker = new DrivePicker({ authService });

    switch (options.folderCreationMethod) {
      case 'create':
        // Use folderName if provided, otherwise fall back to workspace name
        const folderNameToUse = options.folderName?.trim() || options.name.trim();
        return await drivePicker.createFolder(folderNameToUse);
      
      case 'select':
        // Validation already done in validateOptions, but double-check for safety
        if (!options.selectedFolderId) {
          throw new Error('No folder selected');
        }
        // Verify access (folder was already verified in the dialog, but verify again for safety)
        const hasAccess = await drivePicker.verifyFolderAccess(options.selectedFolderId);
        if (!hasAccess) {
          throw new Error('App does not have access to the selected folder. Please select a folder created by this app or grant access via Google Picker.');
        }
        return options.selectedFolderId;
      
      default:
        throw new Error(`Unknown folder creation method: ${options.folderCreationMethod}`);
    }
  }

  /**
   * Create workspace files (conversations.db and metadata.json)
   * Note: api_keys.db is NOT created for shared workspaces
   * 
   * @param authService - Google Drive authentication service
   * @param folderId - Google Drive folder ID where files will be created
   * @param workspaceName - Name of the workspace (used in metadata)
   * @returns Promise resolving to file IDs for conversations DB and metadata JSON
   * @throws Error if file creation or upload fails
   */
  private async createWorkspaceFiles(
    authService: GoogleDriveAuthService,
    folderId: string,
    workspaceName: string
  ): Promise<{ conversationsFileId: string; metadataFileId: string }> {
    // Create empty databases
    const dbManager = new BrowserSQLiteManager({
      conversationsDbName: 'fidu_conversations',
      apiKeysDbName: 'fidu_api_keys',
      enableEncryption: false, // Will be enabled after workspace setup
    });
    
    try {
      await dbManager.initialize();
      
      // Export conversations database (empty)
      const conversationsData = await dbManager.exportConversationsDB();
      
      // Create Drive service for the folder
      const driveService = new GoogleDriveService(authService, folderId);
      await driveService.initialize();
      
      // Upload conversations database
      const conversationsFileId = await driveService.uploadFile(
        CONVERSATIONS_DB_FILENAME,
        conversationsData,
        'application/x-sqlite3'
      );
      
      // Create metadata.json with actual workspace name
      const metadata = {
        workspace_name: workspaceName,
        conversations_db_id: conversationsFileId,
        created_at: new Date().toISOString(),
        version: '1',
      };
      
      const metadataData = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
      const metadataFileId = await driveService.uploadFile(
        METADATA_JSON_FILENAME,
        metadataData,
        'application/json'
      );
      
      return { conversationsFileId, metadataFileId };
    } finally {
      // Ensure cleanup even if an error occurs
      dbManager.close();
    }
  }

  /**
   * Share folder with team members using their Google email addresses
   * 
   * @param authService - Google Drive authentication service
   * @param folderId - Google Drive folder ID to share
   * @param googleEmails - Array of Google email addresses to share with
   * @throws Error if all sharing attempts fail
   */
  private async shareFolderWithMembers(
    authService: GoogleDriveAuthService,
    folderId: string,
    googleEmails: string[]
  ): Promise<void> {
    if (googleEmails.length === 0) {
      return; // No members to share with
    }

    const accessToken = await authService.getAccessToken();

    // Share with each member
    // Include supportsAllDrives=true to support shared folders and shared drives
    const shareResults = await Promise.allSettled(
      googleEmails.map(async (email) => {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?supportsAllDrives=true`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'writer',
              type: 'user',
              emailAddress: email,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to share folder with ${email}: ${response.status} ${response.statusText} - ${errorText}`);
        }
      })
    );

    // Check for failures
    const failures = shareResults.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const failureMessages = failures
        .map(r => r.status === 'rejected' ? r.reason?.message || String(r.reason) : '')
        .filter(Boolean);
      console.warn('Some members could not be shared with:', failureMessages);
      
      // If all shares failed, throw an error
      if (failures.length === googleEmails.length) {
        throw new Error(`Failed to share folder with any members: ${failureMessages.join('; ')}`);
      }
    }
  }

  /**
   * Register workspace with ID service
   * This validates that all members have connected Google Drive accounts
   * and returns their Google email addresses for Drive sharing
   * 
   * @throws Error if any member hasn't connected Google Drive or other validation fails
   */
  private async registerWorkspace(
    name: string,
    folderId: string,
    memberEmails: string[]
  ): Promise<{ workspaceId: string; members: Array<{ fidu_email: string; google_email: string | null; role: 'owner' | 'member' }> }> {
    try {
      // Create workspace with members in one call
      // The API validates that all members have connected Google Drive
      const result = await identityServiceAPIClient.createWorkspace(
        name, 
        folderId, 
        memberEmails.length > 0 ? memberEmails : undefined
      );
      
      // Check if any members are missing Google emails (shouldn't happen due to validation, but be safe)
      const membersWithoutGoogle = result.members.filter(m => !m.google_email);
      if (membersWithoutGoogle.length > 0) {
        const emails = membersWithoutGoogle.map(m => m.fidu_email).join(', ');
        throw new Error(
          `The following members have not connected their Google Drive accounts: ${emails}. ` +
          `Please ask them to connect their Google Drive account in Chat Lab before inviting them to a workspace.`
        );
      }
      
      return {
        workspaceId: result.workspace.id,
        members: result.members,
      };
    } catch (error) {
      // Extract error message, handling both ApiError and regular Error
      let errorMessage = '';
      if (error instanceof ApiError) {
        // ApiError may have message in data.error or data.details
        errorMessage = error.data?.error || error.data?.details || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
      
      // Handle specific error cases from the API
      if (errorMessage.includes('must connect their Google Drive account') ||
          errorMessage.includes('connect their Google Drive')) {
        // Re-throw with a user-friendly message
        throw new Error(
          errorMessage || 
          'One or more members have not connected their Google Drive account. ' +
          'All members must connect their Google Drive account in Chat Lab before being invited to a shared workspace.'
        );
      }
      
      // Check for user not found errors
      if (errorMessage.includes('not found')) {
        throw new Error(
          errorMessage || 
          'One or more members were not found. Please verify the email addresses are correct.'
        );
      }
      
      // For 400 Bad Request errors, use the API error message
      if (error instanceof ApiError && error.status === 400) {
        throw new Error(errorMessage || 'Invalid request. Please check the member email addresses and try again.');
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  /**
   * Setup local workspace registry entry and switch to it
   * Creates the workspace metadata directly with the server ID (avoids creating temporary ID)
   * 
   * @param workspaceId - Server-assigned workspace ID
   * @param name - Workspace name
   * @param folderId - Google Drive folder ID
   * @param conversationsFileId - Google Drive file ID for conversations database
   * @param metadataFileId - Google Drive file ID for metadata JSON
   */
  private async setupLocalWorkspace(
    workspaceId: string,
    name: string,
    folderId: string,
    conversationsFileId: string,
    metadataFileId: string
  ): Promise<void> {
    const workspaceRegistry = getWorkspaceRegistry();
    
    // Create workspace metadata directly with server ID (no temporary ID needed)
    const localWorkspace: WorkspaceMetadata = {
      id: workspaceId,
      name,
      type: 'shared',
      driveFolderId: folderId,
      role: 'owner',
      members: [],
      files: {
        conversationsDbId: conversationsFileId,
        metadataJsonId: metadataFileId,
        // Note: apiKeysDbId is intentionally omitted for shared workspaces
      },
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    
    workspaceRegistry.upsertWorkspace(localWorkspace);
    
    // Switch to new workspace
    const storageService = getStorageService();
    await storageService.switchWorkspace(workspaceId);
    
    // Update Redux state
    store.dispatch(switchWorkspace(workspaceId));
  }
}

// Export singleton instance
let workspaceCreationServiceInstance: WorkspaceCreationService | null = null;

export function getWorkspaceCreationService(): WorkspaceCreationService {
  if (!workspaceCreationServiceInstance) {
    workspaceCreationServiceInstance = new WorkspaceCreationService();
  }
  return workspaceCreationServiceInstance;
}

