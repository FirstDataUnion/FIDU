/**
 * Google Drive API Service
 * Handles file operations with Google Drive
 */

import { GoogleDriveAuthService } from '../../auth/GoogleDriveAuth';
import { MetricsService } from '../../metrics/MetricsService';
import { trackStorageError } from '../../../utils/errorTracking';
import { 
  CONVERSATIONS_DB_PREFIX, 
  API_KEYS_DB_PREFIX, 
  METADATA_JSON_PREFIX,
  getMetadataJsonFilename 
} from '../../../constants/workspaceFiles';

// Custom error for insufficient permissions
export class InsufficientPermissionsError extends Error {
  public readonly originalError: any;
  
  constructor(message: string, originalError: any) {
    super(message);
    this.name = 'InsufficientPermissionsError';
    this.originalError = originalError;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
}

export interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}

export interface UploadFileOptions {
  name: string;
  mimeType?: string;
  parents?: string[];
}

export class GoogleDriveService {
  private authService: GoogleDriveAuthService;
  private readonly APP_DATA_FOLDER = 'appDataFolder';
  private driveFolderId?: string; // Optional folder ID for shared workspaces

  constructor(authService: GoogleDriveAuthService, driveFolderId?: string) {
    this.authService = authService;
    this.driveFolderId = driveFolderId;
  }

  /**
   * Check if an error is a 403 insufficient permissions error
   */
  private isInsufficientPermissionsError(error: any): boolean {
    try {
      // Check if error message contains the 403 permission denied pattern
      const errorString = typeof error === 'string' ? error : error?.message || JSON.stringify(error);
      
      // Look for the specific error patterns from Google Drive API
      const hasInsufficientScopes = errorString.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT');
      const hasInsufficientPermissions = errorString.includes('insufficientPermissions');
      const hasPermissionDenied = errorString.includes('PERMISSION_DENIED');
      const has403Code = errorString.includes('"code": 403') || errorString.includes('"code":403');
      
      return (hasInsufficientScopes || hasInsufficientPermissions) && (hasPermissionDenied || has403Code);
    } catch {
      return false;
    }
  }

  /**
   * Track a Google API request with metrics
   */
  private trackGoogleApiRequest<T>(
    operation: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    return apiCall()
      .then((result) => {
        MetricsService.recordGoogleApiRequest('drive', operation, 'success');
        return result;
      })
      .catch((error) => {
        MetricsService.recordGoogleApiRequest('drive', operation, 'error');
        trackStorageError('google_drive', operation, error.message || 'Unknown error');
        
        // Check if this is an insufficient permissions error
        if (this.isInsufficientPermissionsError(error)) {
          throw new InsufficientPermissionsError(
            'Insufficient permissions to access Google Drive. You may need to re-authorize the app with the correct permissions.',
            error
          );
        }
        
        throw error;
      });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      throw new Error('User must be authenticated to use Google Drive service');
    }
  }

  /**
   * Get the folder ID to use for operations
   * Returns either the custom folder ID or AppData folder
   */
  private getFolderId(): string {
    return this.driveFolderId || this.APP_DATA_FOLDER;
  }

  /**
   * Check if we're using AppData folder
   */
  private isAppDataFolder(): boolean {
    return !this.driveFolderId;
  }

  /**
   * List files in the configured folder (AppData or custom folder)
   */
  async listFiles(): Promise<DriveFile[]> {
    return this.trackGoogleApiRequest('listFiles', async () => {
      const accessToken = await this.authService.getAccessToken();
      
      try {
        const folderId = this.getFolderId();
        const isAppData = this.isAppDataFolder();
        
        // Build query based on folder type
        const apiQuery = isAppData 
          ? `parents in 'appDataFolder'`
          : `'${folderId}' in parents and trashed=false`;
        
        const spaces = isAppData ? 'appDataFolder' : 'drive';
        
        // Include supportsAllDrives and includeItemsFromAllDrives for shared folders/drives
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(apiQuery)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,parents)&spaces=${spaces}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        const response = await fetch(
          url,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list files - Status: ${response.status} ${response.statusText}`);
        }

        const data: DriveFileList = await response.json();
        return data.files;
        
      } catch (error) {
        console.error('Failed to list files:', error);
        return this.fallbackAccessMode();
      }
    });
  }

  /** Fallback listed when appDataFolder access needed re-authentication */
  private async fallbackAccessMode(): Promise<DriveFile[]> {
    return [];
  }

  /**
   * Upload a file to the app data folder, replacing if it exists
   */
  async uploadFile(fileName: string, data: Uint8Array, mimeType: string = 'application/octet-stream'): Promise<string> {
    return this.trackGoogleApiRequest('uploadFile', async () => {
      const accessToken = await this.authService.getAccessToken();
      
      // Check if file already exists in current folder
      // Note: findFileByName only searches within the current folder (getFolderId())
      // so this is already workspace-isolated
      const existingFile = await this.findFileByName(fileName);
      
      if (existingFile) {
        await this.updateFile(existingFile.id, data, mimeType);
        return existingFile.id;
      }

    // Create file metadata for new file
    const folderId = this.getFolderId();
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    // Create multipart request body manually but properly handling binary data
    const boundary = '-------314159265358979323846';
    
    // Convert metadata to string
    const metadataString = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataString);
    
    // Build multipart body without converting binary data to text
    const contentDelimiter = '\r\n--' + boundary + '\r\n';
    const contentDelimiterBytes = new TextEncoder().encode(contentDelimiter);
    const jsonHeaders = new TextEncoder().encode('Content-Type: application/json\r\n\r\n');
    const binaryHeaders = new TextEncoder().encode(`Content-Type: ${mimeType}\r\n\r\n`);
    const closeDelimiterBytes = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);

    // Combine parts properly
    const part1 = [
      ...contentDelimiterBytes,
      ...jsonHeaders,
      ...metadataBytes,
      ...contentDelimiterBytes,
      ...binaryHeaders
    ];
    
    // Combine first part with binary data followed by close delimiter
    const fullBody = new Uint8Array(part1.length + data.length + closeDelimiterBytes.length);
    let offset = 0;
    
    // Copy first part
    fullBody.set(part1, offset);
    offset += part1.length;
    
    // Copy binary data directly without any conversion
    fullBody.set(data, offset);
    offset += data.length;
    
    // Copy close delimiter  
    fullBody.set(closeDelimiterBytes, offset);

      // Include supportsAllDrives=true to support shared folders and shared drives
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: fullBody as any, // TypeScript workaround for file upload 
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload file: ${error}`);
      }

      const result = await response.json();
      return result.id;
    });
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string): Promise<Uint8Array> {
    const accessToken = await this.authService.getAccessToken();
    
    console.log(`🔍 [GoogleDriveService] Downloading file by ID: ${fileId}`);
    
    // Include supportsAllDrives=true to support shared folders and shared drives
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error(`❌ [GoogleDriveService] Failed to download file ${fileId}:`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(`Failed to download file: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ [GoogleDriveService] Successfully downloaded file ${fileId} (${arrayBuffer.byteLength} bytes)`);
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Update an existing file
   */
  async updateFile(fileId: string, data: Uint8Array, mimeType: string = 'application/octet-stream'): Promise<void> {
    const accessToken = await this.authService.getAccessToken();
    
    // Include supportsAllDrives=true to support shared folders and shared drives
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: data as any, // Uint8Array should work but needs type assertion 
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    const accessToken = await this.authService.getAccessToken();
    
    // Include supportsAllDrives=true to support shared folders and shared drives
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    const accessToken = await this.authService.getAccessToken();
    
    // Include supportsAllDrives=true to support shared folders and shared drives
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents&supportsAllDrives=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Find a file by name in the app data folder
   */
  async findFileByName(fileName: string): Promise<DriveFile | null> {
    const files = await this.listFiles();
    return files.find(file => file.name === fileName) || null;
  }

  // Specific methods for our use case

  /**
   * Upload conversations database
   */
  async uploadConversationsDB(data: Uint8Array, version: string = '1'): Promise<string> {
    const fileName = `fidu_conversations_v${version}.db`;
    return await this.uploadFile(fileName, data, 'application/x-sqlite3');
  }

  /**
   * Download conversations database
   */
  async downloadConversationsDB(version: string = '1'): Promise<Uint8Array> {
    const fileName = `fidu_conversations_v${version}.db`;
    const file = await this.findFileByName(fileName);
    
    if (!file) {
      throw new Error(`Conversations database file not found: ${fileName}`);
    }

    return await this.downloadFile(file.id);
  }

  /**
   * Upload API keys database
   */
  async uploadAPIKeysDB(data: Uint8Array, version: string = '1'): Promise<string> {
    const fileName = `fidu_api_keys_v${version}.db`;
    return await this.uploadFile(fileName, data, 'application/x-sqlite3');
  }

  /**
   * Download API keys database
   */
  async downloadAPIKeysDB(version: string = '1'): Promise<Uint8Array> {
    const fileName = `fidu_api_keys_v${version}.db`;
    const file = await this.findFileByName(fileName);
    
    if (!file) {
      throw new Error(`API keys database file not found: ${fileName}`);
    }

    return await this.downloadFile(file.id);
  }

  /**
   * Upload metadata file
   */
  async uploadMetadata(metadata: any, version: string = '1'): Promise<string> {
    const fileName = getMetadataJsonFilename(version);
    const data = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
    return await this.uploadFile(fileName, data, 'application/json');
  }

  /**
   * Download metadata file
   */
  async downloadMetadata(version: string = '1'): Promise<any> {
    const fileName = getMetadataJsonFilename(version);
    const file = await this.findFileByName(fileName);
    
    if (!file) {
      throw new Error(`Metadata file not found: ${fileName}`);
    }

    const data = await this.downloadFile(file.id);
    const text = new TextDecoder().decode(data);
    return JSON.parse(text);
  }

  /**
   * Check if files exist in Drive
   */
  async checkFilesExist(): Promise<{
    conversations: boolean;
    apiKeys: boolean;
    metadata: boolean;
  }> {
    const files = await this.listFiles();
    const fileNames = files.map(f => f.name);

    return {
      conversations: fileNames.some(name => name.startsWith(CONVERSATIONS_DB_PREFIX)),
      apiKeys: fileNames.some(name => name.startsWith(API_KEYS_DB_PREFIX)),
      metadata: fileNames.some(name => name.startsWith(METADATA_JSON_PREFIX))
    };
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    totalFiles: number;
    totalSize: number;
    files: DriveFile[];
  }> {
    const files = await this.listFiles();
    const totalSize = files.reduce((sum, file) => {
      return sum + (file.size ? parseInt(file.size) : 0);
    }, 0);

    return {
      totalFiles: files.length,
      totalSize,
      files
    };
  }

  /**
   * Clear all database files from Google Drive (for testing)
   */
  async clearAllDatabaseFiles(): Promise<void> {
    const files = await this.listFiles();
    const databaseFiles = files.filter(file => 
      file.name.startsWith(CONVERSATIONS_DB_PREFIX) || 
      file.name.startsWith(API_KEYS_DB_PREFIX) || 
      file.name.startsWith(METADATA_JSON_PREFIX)
    );

    if (databaseFiles.length === 0) {
      return;
    }

    const deletePromises = databaseFiles.map(async (file) => {
      await this.deleteFile(file.id);
    });

    await Promise.all(deletePromises);
  }
}
