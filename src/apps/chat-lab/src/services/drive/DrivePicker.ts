/**
 * Google Drive Picker Service
 * Handles folder selection and creation via Google Drive API
 */

import { GoogleDriveAuthService } from '../auth/GoogleDriveAuth';
import { MetricsService } from '../metrics/MetricsService';
import {
  CONVERSATIONS_DB_FILENAME,
  METADATA_JSON_FILENAME,
} from '../../constants/workspaceFiles';

export interface DrivePickerConfig {
  authService: GoogleDriveAuthService;
}

export interface PickerResult {
  success: boolean;
  folderId?: string;
  reason?: 'cancelled' | 'mismatch';
}

export interface PickerInstructions {
  folderName: string;
  folderId: string;
  instructions?: string;
}

export class DrivePicker {
  private authService: GoogleDriveAuthService;
  private pickerApiLoaded: boolean = false;

  constructor(config: DrivePickerConfig) {
    this.authService = config.authService;
  }

  /**
   * Load Google Picker API
   */
  private async loadPickerApi(): Promise<void> {
    if (this.pickerApiLoaded) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google?.picker) {
        this.pickerApiLoaded = true;
        resolve();
        return;
      }

      // Load the API script
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        // Load the picker API
        window.gapi?.load('picker', {
          callback: () => {
            this.pickerApiLoaded = true;
            resolve();
          },
          onerror: (error: any) => {
            reject(new Error(`Failed to load Google Picker API: ${error}`));
          },
        });
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google API script'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Create a new folder in Google Drive
   * Note: drive.file scope allows creating folders (folders are files with special mimeType)
   *
   * @param name - Folder name
   * @param parentFolderId - Optional parent folder ID (if not provided, creates in root)
   * @returns Folder ID if successful, null if failed
   */
  async createFolder(name: string, parentFolderId?: string): Promise<string> {
    try {
      const accessToken = await this.authService.getAccessToken();

      const metadata: any = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      }

      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create folder: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const folder = await response.json();
      MetricsService.recordGoogleApiRequest(
        'drive',
        'create_folder',
        'success'
      );
      return folder.id;
    } catch (error) {
      MetricsService.recordGoogleApiRequest('drive', 'create_folder', 'error');
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  /**
   * Verify that the app has access to a folder
   * Attempts to list files in the folder to verify access
   */
  async verifyFolderAccess(folderId: string): Promise<boolean> {
    try {
      const accessToken = await this.authService.getAccessToken();

      const query = `'${folderId}' in parents and trashed=false`;
      // Include supportsAllDrives and includeItemsFromAllDrives for shared folders/drives
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          return false; // Access denied
        }
        throw new Error(
          `Failed to verify folder access: ${response.status} ${response.statusText}`
        );
      }

      MetricsService.recordGoogleApiRequest(
        'drive',
        'verify_folder_access',
        'success'
      );
      return true;
    } catch (error) {
      MetricsService.recordGoogleApiRequest(
        'drive',
        'verify_folder_access',
        'error'
      );
      console.error('Failed to verify folder access:', error);
      return false;
    }
  }

  /**
   * Try direct access to folder via API
   * This might work if user has accepted Drive share and folder is accessible
   * Returns true if access is granted, false if permission needed
   */
  async tryDirectFolderAccess(folderId: string): Promise<boolean> {
    try {
      const accessToken = await this.authService.getAccessToken();

      // Try to get folder metadata - if this works, app has access
      // Include supportsAllDrives=true to support shared folders and shared drives
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // If successful (200 OK), app has access!
      if (response.ok) {
        console.log('✅ Direct folder access successful');
        MetricsService.recordGoogleApiRequest(
          'drive',
          'direct_folder_access',
          'success'
        );
        return true;
      }

      // If 403 Forbidden, need explicit permission (Picker)
      if (response.status === 403) {
        console.log('⚠️ Direct access failed (403) - Picker required');
        // Don't record as error - this is expected when permission needed
        return false;
      }

      // Other errors - assume we need Picker
      console.log(
        `⚠️ Direct access failed (${response.status}) - Picker required`
      );
      MetricsService.recordGoogleApiRequest(
        'drive',
        'direct_folder_access',
        'error'
      );
      return false;
    } catch (error) {
      console.log('⚠️ Direct access error - Picker required:', error);
      MetricsService.recordGoogleApiRequest(
        'drive',
        'direct_folder_access',
        'error'
      );
      return false;
    }
  }

  /**
   * Show pre-picker instructions dialog
   * Displays helpful information before opening the Google Picker
   */
  private showPickerInstructions(
    instructions: PickerInstructions
  ): Promise<boolean> {
    return new Promise(resolve => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create modal content
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;

      const title = document.createElement('h2');
      title.textContent = 'Select Workspace Folder';
      title.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 20px;
        font-weight: 600;
        color: #1f2937;
      `;

      const instructionText = document.createElement('p');
      instructionText.innerHTML =
        instructions.instructions
        || 'The app needs permission to access the shared workspace folder. In the next step, please select the folder from Google Drive.';
      instructionText.style.cssText = `
        margin: 0 0 16px 0;
        color: #4b5563;
        line-height: 1.5;
      `;

      const folderInfo = document.createElement('div');
      folderInfo.style.cssText = `
        background: #f3f4f6;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
      `;

      const folderNameLabel = document.createElement('div');
      folderNameLabel.innerHTML = `<strong>Folder name:</strong> ${instructions.folderName}`;
      folderNameLabel.style.cssText = `
        margin-bottom: 8px;
        color: #1f2937;
      `;

      const folderIdLabel = document.createElement('div');
      folderIdLabel.style.cssText = `
        color: #6b7280;
        font-size: 12px;
      `;

      const idText = document.createElement('span');
      idText.innerHTML = `<strong>Folder ID:</strong> `;

      const idValue = document.createElement('code');
      idValue.textContent = instructions.folderId;
      idValue.style.cssText = `
        background: #e5e7eb;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
      `;

      folderIdLabel.appendChild(idText);
      folderIdLabel.appendChild(idValue);

      const hint = document.createElement('p');
      hint.textContent =
        'Tip: The picker will automatically search for this folder. Look in the "Shared with me" tab first.';
      hint.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 14px;
        color: #6b7280;
        font-style: italic;
      `;

      folderInfo.appendChild(folderNameLabel);
      folderInfo.appendChild(folderIdLabel);

      // Create buttons
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      `;

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancel';
      cancelButton.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
        font-weight: 500;
      `;
      cancelButton.onmouseover = () => {
        cancelButton.style.background = '#f9fafb';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.background = 'white';
      };

      const continueButton = document.createElement('button');
      continueButton.textContent = 'Open Folder Picker';
      continueButton.style.cssText = `
        padding: 8px 16px;
        border: none;
        background: #3b82f6;
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      `;
      continueButton.onmouseover = () => {
        continueButton.style.background = '#2563eb';
      };
      continueButton.onmouseout = () => {
        continueButton.style.background = '#3b82f6';
      };

      // Event handlers
      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      cancelButton.onclick = () => {
        cleanup();
        resolve(false);
      };

      continueButton.onclick = () => {
        cleanup();
        resolve(true);
      };

      // Escape key handler
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', escapeHandler);
          resolve(false);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      // Assemble modal
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(continueButton);

      modal.appendChild(title);
      modal.appendChild(instructionText);
      modal.appendChild(folderInfo);
      modal.appendChild(hint);
      modal.appendChild(buttonContainer);

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Focus the continue button
      continueButton.focus();
    });
  }

  /**
   * Grant app access to a specific shared folder via Picker
   * User selects the folder, which grants app permission
   * This is required for drive.file scope - even if user has accepted Drive share,
   * the app still needs explicit permission via Picker
   *
   * @param expectedFolderId - The folder ID we expect (for verification)
   * @param folderName - Optional folder name to help user identify it
   * @returns PickerResult with success status and reason for failure if applicable
   */
  async grantAccessToSharedFolder(
    expectedFolderId: string,
    folderName?: string
  ): Promise<PickerResult> {
    try {
      // Show instructions dialog first
      const shouldContinue = await this.showPickerInstructions({
        folderName: folderName || 'Workspace Folder',
        folderId: expectedFolderId,
        instructions:
          'The app needs permission to access the shared workspace folder. '
          + "This is a one-time step required by Google Drive's security policy. "
          + 'In the next window, please locate and select the folder shown below.',
      });

      if (!shouldContinue) {
        return { success: false, reason: 'cancelled' };
      }

      await this.loadPickerApi();
      const accessToken = await this.authService.getAccessToken();

      if (!window.google?.picker) {
        throw new Error('Google Picker API not loaded');
      }

      const googlePicker = window.google.picker;

      return new Promise(resolve => {
        // Get client ID for setAppId - CRITICAL for drive.file scope!
        const clientId = this.authService.getClientId();

        const builder = new googlePicker.PickerBuilder()
          .setOAuthToken(accessToken)
          .setAppId(clientId); // Critical: links Picker selection to our app for drive.file access

        // Set a helpful title with the folder name if provided
        if (folderName) {
          builder.setTitle(`Select the shared folder: "${folderName}"`);
        } else {
          builder.setTitle('Select the shared workspace folder');
        }

        // Create a view for "Shared with me" folders - most likely location
        const sharedView = new googlePicker.DocsView(
          googlePicker.ViewId.FOLDERS
        )
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder');

        // If we have a folder name, pre-filter the search to make it easier to find
        if (folderName) {
          sharedView.setQuery(folderName);
        }

        // Add the "Shared with me" view first (most likely location for invited folders)
        builder.addView(sharedView);

        // Also add "My Drive" view as fallback (in case folder was moved)
        const myDriveView = new googlePicker.DocsView(
          googlePicker.ViewId.FOLDERS
        )
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder');

        if (folderName) {
          myDriveView.setQuery(folderName);
        }

        builder.addView(myDriveView);

        // Set callback
        // Note: The callback can fire multiple times:
        // 1. "loaded" - when picker UI loads (ignore this)
        // 2. "picked" - when user selects a folder (process this)
        // 3. "cancel" - when user cancels (process this)
        let callbackFired = false;
        builder.setCallback((data: any) => {
          const action = data[googlePicker.Response.ACTION];
          console.log(
            '🔍 [DrivePicker] Picker callback received, action:',
            action
          );

          // Ignore "loaded" action - this fires when picker opens, not when user selects
          if (action === 'loaded') {
            console.log(
              'ℹ️ [DrivePicker] Picker loaded, waiting for user selection...'
            );
            return; // Don't resolve, wait for actual pick or cancel
          }

          // Prevent multiple callbacks from resolving
          if (callbackFired) {
            console.warn(
              '⚠️ [DrivePicker] Callback already fired, ignoring duplicate'
            );
            return;
          }
          callbackFired = true;

          console.log('🔍 [DrivePicker] Expected folder ID:', expectedFolderId);

          if (action === googlePicker.Action.PICKED) {
            const folder = data[googlePicker.Response.DOCUMENTS][0];
            const selectedFolderId = folder.id;

            console.log('✅ [DrivePicker] Folder picked:', selectedFolderId);

            // Verify selected folder matches expected
            if (selectedFolderId !== expectedFolderId) {
              console.warn(
                `⚠️ [DrivePicker] Folder mismatch: expected ${expectedFolderId}, got ${selectedFolderId}`
              );
              // Don't record as error - this is handled by caller
              resolve({
                success: false,
                folderId: selectedFolderId,
                reason: 'mismatch',
              });
              return;
            }

            console.log('✅ [DrivePicker] Folder ID matches expected');
            MetricsService.recordGoogleApiRequest(
              'drive',
              'picker_shared_folder',
              'success'
            );
            resolve({
              success: true,
              folderId: selectedFolderId,
            });
          } else {
            // User cancelled or other action
            console.log(
              '❌ [DrivePicker] Picker action was not PICKED:',
              action
            );
            resolve({
              success: false,
              reason: 'cancelled',
            });
          }
        });

        const picker = builder.build();
        picker.setVisible(true);
      });
    } catch (error) {
      MetricsService.recordGoogleApiRequest(
        'drive',
        'picker_shared_folder',
        'error'
      );
      console.error('Failed to grant access to shared folder:', error);
      throw error;
    }
  }

  /**
   * Grant app access to workspace files inside a shared folder.
   *
   * This is required because `drive.file` scope only grants access to files that:
   * 1. The app created, OR
   * 2. The user explicitly selected via Picker
   *
   * When joining a shared workspace, the files were created by the owner's app instance,
   * so the invited user must explicitly select them via Picker to grant access.
   *
   * @param folderId - The folder ID containing the workspace files
   * @param folderName - Optional folder name for display
   * @returns Object with success status and selected file IDs
   */
  async grantAccessToWorkspaceFiles(
    folderId: string,
    folderName?: string
  ): Promise<{ success: boolean; fileIds?: string[]; reason?: string }> {
    try {
      // Show instructions dialog for file selection
      const shouldContinue = await this.showPickerInstructions({
        folderName: folderName || 'Workspace Folder',
        folderId: folderId,
        instructions:
          'One more step: Please select the workspace files to grant the app access.<br><br>'
          + '<strong>📁 Select BOTH of these files:</strong><br>'
          + `&nbsp;&nbsp;&nbsp;• ${CONVERSATIONS_DB_FILENAME}<br>`
          + `&nbsp;&nbsp;&nbsp;• ${METADATA_JSON_FILENAME}<br><br>`
          + '<strong>💡 Tip:</strong> Use <kbd style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">Ctrl+A</kbd> '
          + '(or <kbd style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">Cmd+A</kbd> on Mac) '
          + 'to select all files at once, then click "Select".',
      });

      if (!shouldContinue) {
        return { success: false, reason: 'cancelled' };
      }

      await this.loadPickerApi();
      const accessToken = await this.authService.getAccessToken();

      if (!window.google?.picker) {
        throw new Error('Google Picker API not loaded');
      }

      const googlePicker = window.google.picker;

      return new Promise(resolve => {
        // Get client ID for setAppId - CRITICAL for drive.file scope!
        // Without setAppId, the Picker selection doesn't grant app access to files
        const clientId = this.authService.getClientId();

        const builder = new googlePicker.PickerBuilder()
          .setOAuthToken(accessToken)
          .setAppId(clientId); // Critical: links Picker selection to our app for drive.file access

        // Enable multi-select so user can select all workspace files at once
        builder.enableFeature(googlePicker.Feature.MULTISELECT_ENABLED);

        // Set title - make it clear users need to select ALL files
        builder.setTitle(
          'Select ALL workspace files (Ctrl+A to select all, then click Select)'
        );

        // Create a view showing files in the specific folder
        // Using DOCS view to show all document types, filtered to the parent folder
        const filesView = new googlePicker.DocsView(googlePicker.ViewId.DOCS)
          .setIncludeFolders(false) // Only show files, not sub-folders
          .setSelectFolderEnabled(false)
          .setParent(folderId); // Show files in the shared folder

        builder.addView(filesView);

        let callbackFired = false;
        builder.setCallback((data: any) => {
          const action = data[googlePicker.Response.ACTION];
          console.log(
            '🔍 [DrivePicker] File picker callback received, action:',
            action
          );

          if (action === 'loaded') {
            console.log(
              'ℹ️ [DrivePicker] File picker loaded, waiting for user selection...'
            );
            return;
          }

          if (callbackFired) {
            console.warn(
              '⚠️ [DrivePicker] Callback already fired, ignoring duplicate'
            );
            return;
          }
          callbackFired = true;

          if (action === googlePicker.Action.PICKED) {
            const documents = data[googlePicker.Response.DOCUMENTS];
            const fileIds = documents.map((doc: any) => doc.id);

            console.log(
              `✅ [DrivePicker] ${fileIds.length} file(s) picked:`,
              fileIds
            );

            if (fileIds.length === 0) {
              console.warn('⚠️ [DrivePicker] No files selected');
              resolve({ success: false, reason: 'No files selected' });
              return;
            }

            MetricsService.recordGoogleApiRequest(
              'drive',
              'picker_workspace_files',
              'success'
            );
            resolve({
              success: true,
              fileIds: fileIds,
            });
          } else {
            console.log(
              '❌ [DrivePicker] File picker action was not PICKED:',
              action
            );
            resolve({
              success: false,
              reason: 'cancelled',
            });
          }
        });

        const picker = builder.build();
        picker.setVisible(true);
      });
    } catch (error) {
      MetricsService.recordGoogleApiRequest(
        'drive',
        'picker_workspace_files',
        'error'
      );
      console.error('Failed to grant access to workspace files:', error);
      throw error;
    }
  }
}

// Type declarations for Google Picker API
declare global {
  interface Window {
    google?: {
      picker: {
        PickerBuilder: new () => PickerBuilderInstance;
        DocsView: new (viewId?: any) => DocsViewInstance;
        ViewId: {
          FOLDERS: any;
          DOCS: any;
        };
        Response: {
          ACTION: string;
          DOCUMENTS: string;
        };
        Action: {
          PICKED: string;
        };
        Feature: {
          MULTISELECT_ENABLED: any;
        };
      };
    };
    gapi?: {
      load: (
        api: string,
        options: { callback: () => void; onerror: (error: any) => void }
      ) => void;
    };
  }
}

interface PickerBuilderInstance {
  setOAuthToken(token: string): PickerBuilderInstance;
  setAppId(appId: string): PickerBuilderInstance;
  enableFeature(feature: any): PickerBuilderInstance;
  addView(view: any): PickerBuilderInstance;
  setTitle(title: string): PickerBuilderInstance;
  setCallback(callback: (data: any) => void): PickerBuilderInstance;
  build(): {
    setVisible(visible: boolean): void;
  };
}

interface DocsViewInstance {
  setIncludeFolders(include: boolean): DocsViewInstance;
  setSelectFolderEnabled(enabled: boolean): DocsViewInstance;
  setMimeTypes(mimeTypes: string): DocsViewInstance;
  setQuery(query: string): DocsViewInstance;
  setParent(parentId: string): DocsViewInstance;
}
