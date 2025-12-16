/**
 * Tests for WorkspaceCreationService
 * Focuses on validation logic and error handling
 */

import { WorkspaceCreationService, CreateWorkspaceOptions, WorkspaceCreationProgress } from '../WorkspaceCreationService';

// Mock all external dependencies
jest.mock('../../auth/GoogleDriveAuth');
jest.mock('../../drive/DrivePicker');
jest.mock('../../storage/drive/GoogleDriveService');
jest.mock('../../storage/database/BrowserSQLiteManager');
jest.mock('../../api/apiClientIdentityService');
jest.mock('../WorkspaceRegistry');
jest.mock('../../storage/StorageService');
jest.mock('../../../store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

describe('WorkspaceCreationService', () => {
  let service: WorkspaceCreationService;
  let progressUpdates: WorkspaceCreationProgress[];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceCreationService();
    progressUpdates = [];
    service.setProgressCallback((progress) => {
      progressUpdates.push({ ...progress });
    });
  });

  describe('Validation', () => {
    describe('workspace name validation', () => {
      it('should reject empty workspace name', async () => {
        const options: CreateWorkspaceOptions = {
          name: '',
          memberEmails: [],
          folderCreationMethod: 'create',
          folderName: 'Test Folder',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Workspace name is required');
      });

      it('should reject whitespace-only workspace name', async () => {
        const options: CreateWorkspaceOptions = {
          name: '   ',
          memberEmails: [],
          folderCreationMethod: 'create',
          folderName: 'Test Folder',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Workspace name is required');
      });

      it('should reject workspace name exceeding 255 characters', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'a'.repeat(256),
          memberEmails: [],
          folderCreationMethod: 'create',
          folderName: 'Test Folder',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Workspace name must be 255 characters or less');
      });

      it('should accept workspace name at exactly 255 characters', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'a'.repeat(255),
          memberEmails: [],
          folderCreationMethod: 'create',
          folderName: 'Test Folder',
        };

        // This will fail at the scope check step (not validation), meaning validation passed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });
    });

    describe('folder configuration validation', () => {
      it('should reject select method without selectedFolderId', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: [],
          folderCreationMethod: 'select',
          // selectedFolderId is missing
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('No folder selected');
      });

      it('should accept select method with selectedFolderId', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: [],
          folderCreationMethod: 'select',
          selectedFolderId: 'folder-123',
        };

        // Should proceed to scope check
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });

      it('should accept create method without folderName (uses workspace name)', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'My Workspace',
          memberEmails: [],
          folderCreationMethod: 'create',
          // folderName is not provided - should use workspace name
        };

        // Should proceed to scope check
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });
    });

    describe('email validation', () => {
      it('should reject invalid email format', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: ['invalid-email'],
          folderCreationMethod: 'create',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Invalid email addresses: invalid-email');
      });

      it('should reject multiple invalid emails', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: ['bad', 'also-bad', 'valid@example.com'],
          folderCreationMethod: 'create',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Invalid email addresses: bad, also-bad');
      });

      it('should accept valid email addresses', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: ['user@example.com', 'another.user@company.org'],
          folderCreationMethod: 'create',
        };

        // Should proceed to scope check
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });

      it('should reject duplicate emails (case-insensitive)', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: ['User@Example.com', 'user@example.com'],
          folderCreationMethod: 'create',
        };

        await expect(service.createWorkspace(options)).rejects.toThrow('Duplicate email addresses');
      });

      it('should allow empty member list', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: [],
          folderCreationMethod: 'create',
        };

        // Should proceed to scope check (validation passed)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });

      it('should ignore empty strings in member emails', async () => {
        const options: CreateWorkspaceOptions = {
          name: 'Test Workspace',
          memberEmails: ['', '  ', 'valid@example.com'],
          folderCreationMethod: 'create',
        };

        // Should proceed to scope check (empty strings are filtered)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
        getGoogleDriveAuthService.mockResolvedValue({
          hasDriveFileScope: jest.fn().mockResolvedValue(false),
        });

        await expect(service.createWorkspace(options)).rejects.toThrow('drive.file scope required');
      });
    });
  });

  describe('Progress Reporting', () => {
    it('should report checking-scope as first progress step', async () => {
      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'create',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(false),
      });

      try {
        await service.createWorkspace(options);
      } catch {
        // Expected to fail
      }

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].step).toBe('checking-scope');
      expect(progressUpdates[0].progress).toBe(10);
    });

    it('should report creating-folder after scope check passes', async () => {
      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'create',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        createFolder: jest.fn().mockRejectedValue(new Error('Mock folder creation failed')),
      }));

      try {
        await service.createWorkspace(options);
      } catch {
        // Expected to fail
      }

      const steps = progressUpdates.map(p => p.step);
      expect(steps).toContain('checking-scope');
      expect(steps).toContain('creating-folder');
    });
  });

  describe('Scope Validation', () => {
    it('should fail if drive.file scope is not available', async () => {
      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'create',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(false),
      });

      await expect(service.createWorkspace(options)).rejects.toThrow(
        'drive.file scope required. Please re-authenticate with additional permissions.'
      );
    });

    it('should proceed if drive.file scope is available', async () => {
      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'create',
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      // Fail at folder creation to verify we got past scope check
      DrivePicker.mockImplementation(() => ({
        createFolder: jest.fn().mockRejectedValue(new Error('Folder creation error')),
      }));

      await expect(service.createWorkspace(options)).rejects.toThrow('Folder creation error');
    });
  });

  describe('Folder Selection', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });
    });

    it('should create folder when folderCreationMethod is "create"', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      const createFolderMock = jest.fn().mockResolvedValue('new-folder-id');

      DrivePicker.mockImplementation(() => ({
        createFolder: createFolderMock,
      }));

      // Fail at next step to isolate folder creation test
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { identityServiceAPIClient } = require('../../api/apiClientIdentityService');
      identityServiceAPIClient.createWorkspace = jest.fn().mockRejectedValue(new Error('Mock API error'));

      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'create',
        folderName: 'Custom Folder Name',
      };

      try {
        await service.createWorkspace(options);
      } catch {
        // Expected to fail
      }

      expect(createFolderMock).toHaveBeenCalledWith('Custom Folder Name');
    });

    it('should use workspace name as folder name if folderName not provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      const createFolderMock = jest.fn().mockResolvedValue('new-folder-id');

      DrivePicker.mockImplementation(() => ({
        createFolder: createFolderMock,
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { identityServiceAPIClient } = require('../../api/apiClientIdentityService');
      identityServiceAPIClient.createWorkspace = jest.fn().mockRejectedValue(new Error('Mock API error'));

      const options: CreateWorkspaceOptions = {
        name: 'My Workspace Name',
        memberEmails: [],
        folderCreationMethod: 'create',
        // folderName not provided
      };

      try {
        await service.createWorkspace(options);
      } catch {
        // Expected to fail
      }

      expect(createFolderMock).toHaveBeenCalledWith('My Workspace Name');
    });

    it('should verify folder access when folderCreationMethod is "select"', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');
      const verifyFolderAccessMock = jest.fn().mockResolvedValue(false);

      DrivePicker.mockImplementation(() => ({
        verifyFolderAccess: verifyFolderAccessMock,
      }));

      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'select',
        selectedFolderId: 'existing-folder-id',
      };

      await expect(service.createWorkspace(options)).rejects.toThrow(
        'App does not have access to the selected folder'
      );

      expect(verifyFolderAccessMock).toHaveBeenCalledWith('existing-folder-id');
    });

    it('should proceed with selected folder when access is verified', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');

      DrivePicker.mockImplementation(() => ({
        verifyFolderAccess: jest.fn().mockResolvedValue(true),
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { identityServiceAPIClient } = require('../../api/apiClientIdentityService');
      identityServiceAPIClient.createWorkspace = jest.fn().mockRejectedValue(new Error('Mock API error'));

      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: [],
        folderCreationMethod: 'select',
        selectedFolderId: 'existing-folder-id',
      };

      // Should fail at API step, not folder verification
      await expect(service.createWorkspace(options)).rejects.toThrow('Mock API error');
    });
  });

  describe('Error Handling for Member Validation', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGoogleDriveAuthService } = require('../../auth/GoogleDriveAuth');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DrivePicker } = require('../../drive/DrivePicker');

      getGoogleDriveAuthService.mockResolvedValue({
        hasDriveFileScope: jest.fn().mockResolvedValue(true),
      });

      DrivePicker.mockImplementation(() => ({
        createFolder: jest.fn().mockResolvedValue('folder-123'),
      }));
    });

    it('should handle error when members have not connected Google Drive', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { identityServiceAPIClient } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ApiError } = require('../../api/apiClients');

      const apiError = new ApiError(
        400,
        'Bad Request',
        { error: 'The following users must connect their Google Drive account: user@example.com' }
      );
      identityServiceAPIClient.createWorkspace = jest.fn().mockRejectedValue(apiError);

      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: ['user@example.com'],
        folderCreationMethod: 'create',
      };

      await expect(service.createWorkspace(options)).rejects.toThrow(
        /must connect their Google Drive account/
      );
    });

    it('should handle member not found error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { identityServiceAPIClient } = require('../../api/apiClientIdentityService');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ApiError } = require('../../api/apiClients');

      const apiError = new ApiError(
        400,
        'Bad Request',
        { error: 'User not found: unknown@example.com' }
      );
      identityServiceAPIClient.createWorkspace = jest.fn().mockRejectedValue(apiError);

      const options: CreateWorkspaceOptions = {
        name: 'Test Workspace',
        memberEmails: ['unknown@example.com'],
        folderCreationMethod: 'create',
      };

      await expect(service.createWorkspace(options)).rejects.toThrow(/not found/);
    });
  });
});

