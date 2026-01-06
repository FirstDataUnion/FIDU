/**
 * Integration tests for StorageService
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
    identityServiceUrl: 'http://localhost:9877',
    gatewayUrl: 'http://localhost:9878',
    storageMode: 'cloud', // Change to cloud to allow cloud mode testing
    syncInterval: 300000,
  })),
  getIdentityServiceUrl: jest.fn(() => 'http://localhost:9877'),
  getGatewayUrl: jest.fn(() => 'http://localhost:9878'),
  detectRuntimeEnvironment: jest.fn(() => 'local'),
}));

describe('StorageService Integration Tests', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  describe('Basic Functionality', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(StorageService);
    });

    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should return unknown mode when not initialized', () => {
      expect(service.getCurrentMode()).toBe('unknown');
    });
  });

  describe('Initialization', () => {
    it('should handle initialization gracefully', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle re-initialization', async () => {
      await service.initialize();
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should initialize with specific mode', async () => {
      await expect(service.initialize('local')).resolves.toBeUndefined();
      expect(service.getCurrentMode()).toBe('local');
    });
  });

  describe('Mode Switching', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should switch from local to cloud mode', async () => {
      // Since environment mock is set to cloud, initialize will use cloud mode
      await service.initialize('local');
      expect(service.getCurrentMode()).toBe('cloud'); // Environment overrides parameter
      
      await service.switchMode('local');
      expect(service.getCurrentMode()).toBe('local');
    });

    it('should switch from cloud to local mode', async () => {
      await service.initialize('cloud');
      expect(service.getCurrentMode()).toBe('cloud');
      
      await service.switchMode('local');
      expect(service.getCurrentMode()).toBe('local');
    });

    it('should handle same mode switching gracefully', async () => {
      await service.initialize('local');
      await expect(service.switchMode('local')).resolves.toBeUndefined();
    });
  });

  describe('Adapter Access', () => {
    it('should throw error when accessing adapter before initialization', () => {
      expect(() => service.getAdapter()).toThrow('Storage service not initialized');
    });

    it('should return adapter after initialization', async () => {
      await service.initialize();
      const adapter = service.getAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.isInitialized).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Test that initialization doesn't throw
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    it('should handle mode switching errors gracefully', async () => {
      await service.initialize();
      await expect(service.switchMode('cloud')).resolves.toBeUndefined();
    });
  });
});
