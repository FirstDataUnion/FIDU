/**
 * Browser Compatibility Utilities
 * Provides information about browser capabilities and feature support
 */

export interface BrowserCompatibilityInfo {
  fileSystemAccess: {
    supported: boolean;
    browser: string;
    message: string;
  };
}

export class BrowserCompatibility {
  /**
   * Get comprehensive browser compatibility information
   */
  static getCompatibilityInfo(): BrowserCompatibilityInfo {
    return {
      fileSystemAccess: this.getFileSystemAccessSupport()
    };
  }

  /**
   * Check File System Access API support
   */
  static getFileSystemAccessSupport(): {
    supported: boolean;
    browser: string;
    message: string;
  } {
    if (typeof window === 'undefined') {
      return {
        supported: false,
        browser: 'Unknown',
        message: 'Not running in a browser environment'
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    let browser = 'Unknown';
    
    if (userAgent.includes('firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('chrome') || userAgent.includes('edge')) {
      browser = 'Chrome/Edge';
    } else if (userAgent.includes('opera')) {
      browser = 'Opera';
    }

    // Check for File System Access API support
    const isSupported = 'showDirectoryPicker' in window && 
                       typeof window.showDirectoryPicker === 'function';

    if (!isSupported) {
      let message = `File System Access API is not supported in ${browser}.`;
      
      if (browser === 'Firefox') {
        message += ' This feature requires Chrome, Edge, or other Chromium-based browsers. Firefox support is not yet available.';
      } else if (browser === 'Safari') {
        message += ' This feature requires Chrome, Edge, or other Chromium-based browsers. Safari support is not yet available.';
      } else {
        message += ' This feature requires a modern Chromium-based browser with File System Access API support.';
      }

      return {
        supported: false,
        browser,
        message
      };
    }

    return {
      supported: true,
      browser,
      message: `File System Access API is supported in ${browser}.`
    };
  }

  /**
   * Check if File System Access API is supported
   */
  static isFileSystemAccessSupported(): boolean {
    return this.getFileSystemAccessSupport().supported;
  }

  /**
   * Get user-friendly browser name
   */
  static getBrowserName(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
    if (userAgent.includes('chrome')) return 'Chrome';
    if (userAgent.includes('edge')) return 'Edge';
    if (userAgent.includes('opera')) return 'Opera';
    
    return 'Unknown Browser';
  }

  /**
   * Get recommended browsers for File System Access API
   */
  static getRecommendedBrowsers(): Array<{
    name: string;
    downloadUrl: string;
    description: string;
  }> {
    return [
      {
        name: 'Google Chrome',
        downloadUrl: 'https://www.google.com/chrome/',
        description: 'Full support for File System Access API'
      },
      {
        name: 'Microsoft Edge',
        downloadUrl: 'https://www.microsoft.com/edge/',
        description: 'Full support for File System Access API'
      }
    ];
  }

  /**
   * Check if current browser is recommended for File System Access API
   */
  static isRecommendedBrowser(): boolean {
    const browser = this.getBrowserName();
    return browser === 'Chrome' || browser === 'Edge';
  }
}
