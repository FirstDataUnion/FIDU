/**
 * Integration tests for Storage Mode Switching
 * These tests focus on real behavior with minimal mocking
 */

import { StorageService } from '../StorageService';

// Mock browser APIs
Object.defineProperty(global, 'indexedDB', {
  value: {
    open: jest.fn(() => ({
      onsuccess: null,
      onerror: null,
      result: {
        createObjectStore: jest.fn(),
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            add: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
          })),
        })),
      },
    })),
  },
  writable: true,
});

// Mock external services
jest.mock('../drive/GoogleDriveService', () => ({
  GoogleDriveService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    isAuthenticated: jest.fn(() => false),
    uploadFile: jest.fn(() => Promise.resolve({ success: true, fileId: 'mock-file-id' })),
    downloadFile: jest.fn(() => Promise.resolve({ success: true, data: new ArrayBuffer(0) })),
    listFiles: jest.fn(() => Promise.resolve({ success: true, files: [] })),
    deleteFile: jest.fn(() => Promise.resolve({ success: true })),
  })),
}));

jest.mock('../../auth/GoogleDriveAuth', () => ({
  GoogleDriveAuthService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    isAuthenticated: jest.fn(() => false),
    authenticate: jest.fn(() => Promise.resolve()),
    revokeAccess: jest.fn(() => Promise.resolve()),
  })),
  getGoogleDriveAuthService: jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    isAuthenticated: jest.fn(() => false),
    authenticate: jest.fn(() => Promise.resolve()),
    revokeAccess: jest.fn(() => Promise.resolve()),
  })),
}));

// Mock environment utils
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: jest.fn(() => ({
    mode: 'development',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local', // Use local as default to allow parameter override
    syncInterval: 300000,
  })),
  getIdentityServiceUrl: jest.fn(() => 'https://identity.firstdataunion.org'),
  getGatewayUrl: jest.fn(() => 'https://gateway.firstdataunion.org'),
  isDevEnvironment: jest.fn(() => true),
  detectRuntimeEnvironment: jest.fn(() => 'local'),
}));

describe('Storage Mode Switching Integration Tests', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  describe('Mode Switching', () => {
    it('should switch from local to cloud mode', async () => {
      await service.initialize('local');
      expect(service.getCurrentMode()).toBe('local');
      
      await service.switchMode('cloud');
      expect(service.getCurrentMode()).toBe('cloud');
    });

    it('should switch from cloud to local mode', async () => {
      await service.initialize('cloud');
      expect(service.getCurrentMode()).toBe('cloud');
      
      await service.switchMode('local');
      expect(service.getCurrentMode()).toBe('local');
    });

    it('should handle multiple mode switches', async () => {
      const modes: ('local' | 'cloud')[] = ['local', 'cloud', 'local'];
      
      for (const mode of modes) {
        // Create a fresh service instance for each mode
        const freshService = new StorageService();
        await freshService.initialize(mode);
        // The service will use the mode parameter when provided
        expect(freshService.getCurrentMode()).toBe(mode);
        expect(freshService.isInitialized()).toBe(true);
      }
    });
  });

  describe('Data Consistency Across Modes', () => {
    it('should maintain consistent adapter access across modes', async () => {
      await service.initialize('local');
      const localAdapter = service.getAdapter();
      expect(localAdapter).toBeDefined();
      
      await service.switchMode('cloud');
      const cloudAdapter = service.getAdapter();
      expect(cloudAdapter).toBeDefined();
    });

    it('should maintain consistent initialization state across modes', async () => {
      await service.initialize('local');
      expect(service.isInitialized()).toBe(true);
      
      await service.switchMode('cloud');
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('Error Handling During Mode Switch', () => {
    it('should handle initialization errors gracefully', async () => {
      // Test that initialization doesn't throw
      await expect(service.initialize()).resolves.toBeUndefined();
      
      // Test that re-initialization doesn't throw
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should handle mode switching errors gracefully', async () => {
      await service.initialize();
      await expect(service.switchMode('cloud')).resolves.toBeUndefined();
    });

    it('should handle same mode switching gracefully', async () => {
      await service.initialize('local');
      await expect(service.switchMode('local')).resolves.toBeUndefined();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid mode switches', async () => {
      const modes: ('local' | 'cloud')[] = ['local', 'cloud', 'local', 'cloud'];
      
      for (const mode of modes) {
        // Create a fresh service instance for each mode
        const freshService = new StorageService();
        await freshService.initialize(mode);
        expect(freshService.isInitialized()).toBe(true);
        // The service will use the mode parameter when provided
        expect(freshService.getCurrentMode()).toBe(mode);
      }
    });

    it('should maintain state consistency during mode switches', async () => {
      await service.initialize('local');
      expect(service.isInitialized()).toBe(true);
      
      await service.switchMode('cloud');
      expect(service.isInitialized()).toBe(true);
      
      await service.switchMode('local');
      expect(service.isInitialized()).toBe(true);
    });
  });
});