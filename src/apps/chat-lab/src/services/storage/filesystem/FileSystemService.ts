/**
 * File System Access API Service
 * Wraps File System Access API calls and manages directory permissions
 */

// Type definitions for File System Access API (since it's not fully typed yet)
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
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

      return {
        handle,
        path: this.sanitizePath('Selected Directory'),
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
   * Set directory handle (for restoring from IndexedDB)
   */
  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this.directoryHandle = handle;
    this.permissionState = 'granted';
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
      path: this.sanitizePath('Selected Directory'),
      permissionState: this.permissionState
    };
  }

  /**
   * Clear directory access
   */
  clearDirectoryAccess(): void {
    this.directoryHandle = null;
    this.permissionState = 'prompt';
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
   * Sanitize path for display (remove sensitive information)
   */
  private sanitizePath(path: string): string {
    // Remove any potential sensitive path information
    // For security, we only show the directory name, not the full path
    const parts = path.split('/');
    return parts[parts.length - 1] || 'Selected Directory';
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
}
