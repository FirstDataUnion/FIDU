/**
 * Tests for WorkspaceInvitationService
 * Focuses on validation logic, flow steps, and error handling
 */

import {
  WorkspaceInvitationService,
  AcceptInvitationOptions,
  AcceptInvitationProgress,
} from '../WorkspaceInvitationService';

// Mock all external dependencies
jest.mock('../../auth/GoogleDriveAuth');
jest.mock('../../drive/DrivePicker');
jest.mock('../../api/apiClientIdentityService');
jest.mock('../WorkspaceRegistry');
jest.mock('../../storage/StorageService');
jest.mock('../../../store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

describe('WorkspaceInvitationService', () => {
  let service: WorkspaceInvitationService;
  let progressUpdates: AcceptInvitationProgress[];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceInvitationService();
    progressUpdates = [];
    service.setProgressCallback(progress => {
      progressUpdates.push({ ...progress });
    });
  });

  describe('Validation', () => {
    it('should reject missing driveFolderId', async () => {
      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: '', // Empty
        googleEmail: 'user@gmail.com',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Workspace folder ID is missing'
      );
    });
  });

  describe('Scope Validation', () => {
    it('should fail if drive.file scope is not available', async () => {
      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(false),
      });

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'drive.file scope required'
      );
    });

    it('should report checking-scope as first progress step', async () => {
      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(false),
      });

      try {
        await service.acceptInvitation(options);
      } catch {
        // Expected to fail
      }

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].step).toBe('checking-scope');
      expect(progressUpdates[0].progress).toBe(10);
    });
  });

  describe('Folder Access Grant Flow', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });
    });

    it('should fail if user cancels folder picker', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: false,
          reason: 'cancelled',
        }),
      }));

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Folder selection cancelled'
      );
    });

    it('should fail if user selects wrong folder', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: false,
          reason: 'mismatch',
        }),
      }));

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'You selected a different folder'
      );
    });

    it('should fail if folder picker succeeds but file picker is cancelled', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: false,
          reason: 'cancelled',
        }),
      }));

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'File selection cancelled'
      );
    });

    it('should fail if user does not select enough files', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1'], // Only 1 file, need 2
        }),
      }));

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Please select ALL workspace files'
      );
    });

    it('should fail if folder access verification fails after picker', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1', 'file-2'],
        }),
        verifyFolderAccess: jest.fn().mockResolvedValue(false),
      }));

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Cannot access the workspace folder'
      );
    });
  });

  describe('API Invitation Acceptance', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1', 'file-2'],
        }),
        verifyFolderAccess: jest.fn().mockResolvedValue(true),
      }));
    });

    it('should handle 404 invitation not found error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ApiError } = require('../../api/apiClients');

      const apiError = new ApiError(404, 'Not Found', {});
      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockRejectedValue(apiError);

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Invitation not found'
      );
    });

    it('should handle 400 invalid invitation error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ApiError } = require('../../api/apiClients');

      const apiError = new ApiError(400, 'Bad Request', {
        error: 'Invitation already accepted',
      });
      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockRejectedValue(apiError);

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'Invitation already accepted'
      );
    });

    it('should handle missing workspace files after acceptance', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');

      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockResolvedValue({});
      identityServiceAPIClient.getWorkspaceFiles = jest.fn().mockResolvedValue({
        files: {}, // Missing required file IDs
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await expect(service.acceptInvitation(options)).rejects.toThrow(
        'No workspace files found'
      );
    });
  });

  describe('Progress Reporting', () => {
    it('should report progress through all steps', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWorkspaceRegistry } = require('../WorkspaceRegistry');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStorageService } = require('../../storage/StorageService');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1', 'file-2'],
        }),
        verifyFolderAccess: jest.fn().mockResolvedValue(true),
      }));

      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockResolvedValue({});
      identityServiceAPIClient.getWorkspaceFiles = jest.fn().mockResolvedValue({
        files: {
          conversations_db_id: 'conv-file-id',
          metadata_json_id: 'meta-file-id',
        },
      });

      getWorkspaceRegistry.mockReturnValue({
        upsertWorkspace: jest.fn(),
      });

      getStorageService.mockReturnValue({
        switchWorkspace: jest.fn().mockResolvedValue(undefined),
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await service.acceptInvitation(options);

      const steps = progressUpdates.map(p => p.step);

      // Should go through all main steps
      expect(steps).toContain('checking-scope');
      expect(steps).toContain('granting-access');
      expect(steps).toContain('verifying-access');
      expect(steps).toContain('accepting-invitation');
      expect(steps).toContain('fetching-files');
      expect(steps).toContain('creating-workspace');
      expect(steps).toContain('switching-workspace');
      expect(steps).toContain('complete');
    });

    it('should report 100% progress on completion', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWorkspaceRegistry } = require('../WorkspaceRegistry');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStorageService } = require('../../storage/StorageService');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1', 'file-2'],
        }),
        verifyFolderAccess: jest.fn().mockResolvedValue(true),
      }));

      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockResolvedValue({});
      identityServiceAPIClient.getWorkspaceFiles = jest.fn().mockResolvedValue({
        files: {
          conversations_db_id: 'conv-file-id',
          metadata_json_id: 'meta-file-id',
        },
      });

      getWorkspaceRegistry.mockReturnValue({
        upsertWorkspace: jest.fn(),
      });

      getStorageService.mockReturnValue({
        switchWorkspace: jest.fn().mockResolvedValue(undefined),
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await service.acceptInvitation(options);

      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.step).toBe('complete');
      expect(lastProgress.progress).toBe(100);
    });
  });

  describe('Local Workspace Creation', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getGoogleDriveAuthService,
      } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        identityServiceAPIClient,
      } = require('../../api/apiClientIdentityService');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        grantAccessToSharedFolder: jest.fn().mockResolvedValue({
          success: true,
          folderId: 'folder-123',
        }),
        grantAccessToWorkspaceFiles: jest.fn().mockResolvedValue({
          success: true,
          fileIds: ['file-1', 'file-2'],
        }),
        verifyFolderAccess: jest.fn().mockResolvedValue(true),
      }));

      identityServiceAPIClient.acceptInvitation = jest
        .fn()
        .mockResolvedValue({});
      identityServiceAPIClient.getWorkspaceFiles = jest.fn().mockResolvedValue({
        files: {
          conversations_db_id: 'conv-file-id',
          metadata_json_id: 'meta-file-id',
        },
      });
    });

    it('should create local workspace entry with correct properties', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWorkspaceRegistry } = require('../WorkspaceRegistry');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStorageService } = require('../../storage/StorageService');

      const upsertWorkspaceMock = jest.fn();
      getWorkspaceRegistry.mockReturnValue({
        upsertWorkspace: upsertWorkspaceMock,
      });

      getStorageService.mockReturnValue({
        switchWorkspace: jest.fn().mockResolvedValue(undefined),
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await service.acceptInvitation(options);

      expect(upsertWorkspaceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'workspace-123',
          name: 'Test Workspace',
          type: 'shared',
          driveFolderId: 'folder-123',
          role: 'member', // Accepting invitation makes you a member, not owner
          files: {
            conversationsDbId: 'conv-file-id',
            metadataJsonId: 'meta-file-id',
          },
        })
      );
    });

    it('should switch to the new workspace after creation', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWorkspaceRegistry } = require('../WorkspaceRegistry');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStorageService } = require('../../storage/StorageService');

      const switchWorkspaceMock = jest.fn().mockResolvedValue(undefined);

      getWorkspaceRegistry.mockReturnValue({
        upsertWorkspace: jest.fn(),
      });

      getStorageService.mockReturnValue({
        switchWorkspace: switchWorkspaceMock,
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      await service.acceptInvitation(options);

      expect(switchWorkspaceMock).toHaveBeenCalledWith('workspace-123');
    });

    it('should return workspace ID on success', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWorkspaceRegistry } = require('../WorkspaceRegistry');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStorageService } = require('../../storage/StorageService');

      getWorkspaceRegistry.mockReturnValue({
        upsertWorkspace: jest.fn(),
      });

      getStorageService.mockReturnValue({
        switchWorkspace: jest.fn().mockResolvedValue(undefined),
      });

      const options: AcceptInvitationOptions = {
        workspaceId: 'workspace-123',
        workspaceName: 'Test Workspace',
        driveFolderId: 'folder-123',
        googleEmail: 'user@gmail.com',
      };

      const result = await service.acceptInvitation(options);

      expect(result).toBe('workspace-123');
    });
  });
});
