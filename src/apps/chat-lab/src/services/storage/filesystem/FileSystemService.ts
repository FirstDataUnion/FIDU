/**
 * File System Access API Service
 * Wraps File System Access API calls and manages directory permissions
 */

// Type definitions for File System Access API (since it's not fully typed yet)
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  requestPermission(options?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemPermissionStatus {
  state: 'granted' | 'denied' | 'prompt';
}

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>;
  }
}

export interface DirectoryInfo {
  handle: FileSystemDirectoryHandle;
  path: string; // Sanitized path for display
  permissionState: 'granted' | 'denied' | 'prompt';
}

export interface FileOperationResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

export class FileSystemService {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private permissionState: 'granted' | 'denied' | 'prompt' = 'prompt';
  private directoryName: string | null = null; // Store directory name for display

  /**
   * Check if File System Access API is supported in the current browser
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'showDirectoryPicker' in window &&
           typeof window.showDirectoryPicker === 'function';
  }

  /**
   * Get browser compatibility information
   */
  static getBrowserCompatibility(): {
    supported: boolean;
    browser: string;
    message: string;
  } {
    if (!this.isSupported()) {
      const userAgent = navigator.userAgent.toLowerCase();
      let browser = 'Unknown';
      
      if (userAgent.includes('firefox')) {
        browser = 'Firefox';
      } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        browser = 'Safari';
      } else if (userAgent.includes('chrome') || userAgent.includes('edge')) {
        browser = 'Chrome/Edge';
      }

      return {
        supported: false,
        browser,
        message: `File System Access API is not supported in ${browser}. This feature requires Chrome, Edge, or other Chromium-based browsers.`
      };
    }

    return {
      supported: true,
      browser: 'Chrome/Edge',
      message: 'File System Access API is supported in this browser.'
    };
  }

  /**
   * Request directory access from user
   */
  async requestDirectoryAccess(): Promise<DirectoryInfo> {
    if (!FileSystemService.isSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Check permission state
      const permission = await this.checkPermission(handle);
      
      this.directoryHandle = handle;
      this.permissionState = permission.state;
      
      // Store directory name for display (we can't get the full path for security)
      this.directoryName = 'FIDU-Data'; // We'll use a consistent name

      return {
        handle,
        path: this.directoryName,
        permissionState: permission.state
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('User cancelled directory selection');
      }
      throw new Error(`Failed to access directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Request directory access with smart hints based on previous selection
   */
  async requestDirectoryAccessWithHints(): Promise<DirectoryInfo> {
    if (!FileSystemService.isSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      // Determine the best starting location based on previous selection
      let startIn: 'documents' | 'downloads' | 'desktop' = 'documents';
      
      // If we have a previous directory name, we can make educated guesses
      if (this.directoryName) {
        // For re-selection scenarios, start in documents as it's most common
        startIn = 'documents';
      }

      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: startIn
      });

      // Check permission state
      const permission = await this.checkPermission(handle);
      
      this.directoryHandle = handle;
      this.permissionState = permission.state;
      
      // Store directory name for display (we can't get the full path for security)
      this.directoryName = 'FIDU-Data'; // We'll use a consistent name

      return {
        handle,
        path: this.directoryName,
        permissionState: permission.state
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Directory selection was cancelled by the user');
      }
      throw error;
    }
  }

  /**
   * Check permission status for a directory handle
   */
  private async checkPermission(handle: FileSystemDirectoryHandle): Promise<FileSystemPermissionStatus> {
    try {
      // Try to access the directory to check permission
      await handle.keys().next();
      return { state: 'granted' };
    } catch (error) {
      return { state: 'denied' };
    }
  }

  /**
   * Check if current directory permission is still valid
   */
  async verifyPermission(): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }

    try {
      // Try to access the directory
      await this.directoryHandle.keys().next();
      this.permissionState = 'granted';
      return true;
    } catch (error) {
      this.permissionState = 'denied';
      return false;
    }
  }

  /**
   * Request permission renewal for current directory
   */
  async renewPermission(): Promise<{ success: boolean; error?: string }> {
    if (!this.directoryHandle) {
      return { success: false, error: 'No directory selected' };
    }

    try {
      // Try to access the directory to renew permission
      await this.directoryHandle.keys().next();
      this.permissionState = 'granted';
      return { success: true };
    } catch (error) {
      this.permissionState = 'denied';
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Permission renewal failed' 
      };
    }
  }


  /**
   * Get current directory info
   */
  getDirectoryInfo(): DirectoryInfo | null {
    if (!this.directoryHandle) {
      return null;
    }

    return {
      handle: this.directoryHandle,
      path: this.directoryName || 'Selected Directory',
      permissionState: this.permissionState
    };
  }

  /**
   * Set directory handle (for restoring from IndexedDB)
   */
  setDirectoryHandle(handle: FileSystemDirectoryHandle, name: string): void {
    this.directoryHandle = handle;
    this.permissionState = 'granted';
    this.directoryName = name;
  }

  /**
   * Request permission for a restored directory handle
   */
  async requestPermissionForHandle(handle: FileSystemDirectoryHandle): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      this.permissionState = permission;
      return permission;
    } catch (error) {
      console.error('Error requesting permission for handle:', error);
      this.permissionState = 'denied';
      return 'denied';
    }
  }

  /**
   * Clear directory access
   */
  clearDirectoryAccess(): void {
    this.directoryHandle = null;
    this.permissionState = 'prompt';
    this.directoryName = null;
  }

  /**
   * Read a file from the selected directory
   */
  async readFile(filename: string): Promise<FileOperationResult> {
    if (!this.directoryHandle) {
      return {
        success: false,
        error: 'No directory selected'
      };
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: false });
      const file = await fileHandle.getFile();
      const data = await file.arrayBuffer();
      
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      };
    }
  }

  /**
   * Write a file to the selected directory
   */
  async writeFile(filename: string, data: ArrayBuffer): Promise<FileOperationResult> {
    if (!this.directoryHandle) {
      return {
        success: false,
        error: 'No directory selected'
      };
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file'
      };
    }
  }

  /**
   * Check if a file exists in the selected directory
   */
  async fileExists(filename: string): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }

    try {
      await this.directoryHandle.getFileHandle(filename, { create: false });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List files in the selected directory
   */
  async listFiles(): Promise<string[]> {
    if (!this.directoryHandle) {
      return [];
    }

    try {
      const files: string[] = [];
      for await (const [name, handle] of this.directoryHandle.entries()) {
        if ((handle as any).kind === 'file') {
          files.push(name);
        }
      }
      return files;
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Delete a file from the selected directory
   */
  async deleteFile(filename: string): Promise<FileOperationResult> {
    if (!this.directoryHandle) {
      return {
        success: false,
        error: 'No directory selected'
      };
    }

    try {
      await this.directoryHandle.removeEntry(filename);
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }


  /**
   * Get directory handle for persistence (serializable)
   */
  getDirectoryHandleForPersistence(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * Check if directory access is available
   */
  isDirectoryAccessible(): boolean {
    return this.directoryHandle !== null && this.permissionState === 'granted';
  }

  /**
   * Get directory name for display
   */
  getDirectoryName(): string | null {
    return this.directoryName;
  }

  /**
   * Set directory name (for restoration purposes)
   */
  setDirectoryName(name: string): void {
    this.directoryName = name;
  }
}
