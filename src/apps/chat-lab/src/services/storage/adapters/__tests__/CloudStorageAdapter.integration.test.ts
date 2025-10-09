/**
 * Integration tests for CloudStorageAdapter
 * These tests focus on real behavior with minimal mocking
 */

import { CloudStorageAdapter } from '../CloudStorageAdapter';
import type { StorageConfig } from '../../types';

// Mock environment utils
jest.mock('../../../../utils/environment', () => ({
  getEnvironmentInfo: jest.fn(() => ({
    mode: 'development',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  })),
  getIdentityServiceUrl: jest.fn(() => 'https://identity.firstdataunion.org'),
  getGatewayUrl: jest.fn(() => 'https://gateway.firstdataunion.org'),
}));

// Only mock browser APIs and external services
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

// Mock Google Drive Auth (external service)
jest.mock('../../../auth/GoogleDriveAuth', () => ({
  GoogleDriveAuthService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    isAuthenticated: jest.fn(() => false), // Start unauthenticated
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

// Mock Google Drive Service (external service)
jest.mock('../../drive/GoogleDriveService', () => ({
  GoogleDriveService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    isAuthenticated: jest.fn(() => false),
    uploadFile: jest.fn(() => Promise.resolve({ success: true, fileId: 'mock-file-id' })),
    downloadFile: jest.fn(() => Promise.resolve({ success: true, data: new ArrayBuffer(0) })),
    listFiles: jest.fn(() => Promise.resolve({ success: true, files: [] })),
    deleteFile: jest.fn(() => Promise.resolve({ success: true })),
  })),
}));

describe('CloudStorageAdapter Integration Tests', () => {
  let adapter: CloudStorageAdapter;
  let config: StorageConfig;

  beforeEach(() => {
    config = {
      mode: 'cloud',
      baseURL: 'http://localhost:4000',
    };
    adapter = new CloudStorageAdapter(config);
  });

  describe('Basic Functionality', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(CloudStorageAdapter);
    });

    it('should return online status', () => {
      expect(adapter.isOnline()).toBe(true);
    });

    it('should handle authentication status checks', () => {
      expect(() => adapter.isAuthenticated()).not.toThrow();
    });
  });

  describe('Initialization', () => {
    it('should handle initialization gracefully', async () => {
      // Test that initialization doesn't throw errors
      await expect(adapter.initialize()).resolves.toBeUndefined();
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should handle re-initialization', async () => {
      await adapter.initialize();
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  describe('API Key Operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle API key operations gracefully', async () => {
      await expect(adapter.getAPIKey('openai')).resolves.toBeDefined();
      await expect(adapter.isAPIKeyAvailable('openai')).resolves.toBeDefined();
    });

    it('should return consistent results for API key availability', async () => {
      const isAvailable = await adapter.isAPIKeyAvailable('openai');
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Context Operations', () => {
    const mockContext = { 
      id: 'test-context', 
      name: 'Test Context',
      title: 'Test Context',
      body: 'Test body',
      isBuiltIn: false,
      tags: [],
      conversationIds: [],
      conversationMetadata: {
        totalMessages: 0,
        platforms: [],
        lastAddedAt: new Date().toISOString(),
      },
      tokenCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should require authentication for context operations', async () => {
      // CloudStorageAdapter requires authentication
      await expect(adapter.getContexts()).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.createContext(mockContext, 'test-profile')).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.updateContext(mockContext, 'test-profile')).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.deleteContext('test-context')).rejects.toThrow('authenticate with Google Drive');
    });

    it('should return consistent error messages', async () => {
      try {
        await adapter.getContexts();
      } catch (error) {
        expect((error as Error).message).toContain('authenticate with Google Drive');
      }
    });
  });

  describe('System Prompt Operations', () => {
    const mockSystemPrompt = {
      id: 'test-prompt',
      name: 'Test Prompt',
      content: 'Test content',
      description: 'Test description',
      categories: [],
      isBuiltIn: false,
      isDefault: false,
      source: 'user' as const,
      tokenCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should require authentication for system prompt operations', async () => {
      // CloudStorageAdapter requires authentication
      await expect(adapter.getSystemPrompts()).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.createSystemPrompt(mockSystemPrompt, 'test-profile')).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.updateSystemPrompt(mockSystemPrompt, 'test-profile')).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.deleteSystemPrompt('test-prompt')).rejects.toThrow('authenticate with Google Drive');
    });

    it('should return consistent error messages for system prompts', async () => {
      try {
        await adapter.getSystemPrompts();
      } catch (error) {
        expect((error as Error).message).toContain('authenticate with Google Drive');
      }
    });
  });

  describe('Sync Operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should require authentication for sync operations', async () => {
      // CloudStorageAdapter requires authentication for sync
      await expect(adapter.sync()).rejects.toThrow('authenticate with Google Drive');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle invalid inputs gracefully', async () => {
      // Test with invalid inputs - these should still require authentication
      await expect(adapter.getAPIKey('')).resolves.toBeDefined();
      await expect(adapter.getContexts(undefined, -1, -1)).rejects.toThrow('authenticate with Google Drive');
      await expect(adapter.getSystemPrompts(undefined, -1, -1)).rejects.toThrow('authenticate with Google Drive');
    });

    it('should handle missing data gracefully', async () => {
      await expect(adapter.getConversationById('non-existent')).rejects.toThrow();
      await expect(adapter.getMessages('non-existent')).rejects.toThrow();
    });
  });

  describe('Authentication States', () => {
    it('should handle unauthenticated state', () => {
      expect(adapter.isAuthenticated()).toBe(false);
    });

    it('should maintain consistent behavior across authentication states', async () => {
      // Should consistently require authentication
      await expect(adapter.getContexts()).rejects.toThrow('Cloud storage adapter not initialized');
    });
  });

  describe('API Key Management', () => {
    it('should handle getAllAPIKeys when not initialized', async () => {
      await expect(adapter.getAllAPIKeys()).rejects.toThrow('Cloud storage adapter not initialized');
    });

    it('should require initialization for saveAPIKey', async () => {
      await expect(adapter.saveAPIKey('openai', 'sk-test123')).rejects.toThrow('Cloud storage adapter not initialized');
    });

    it('should require initialization for deleteAPIKey', async () => {
      await expect(adapter.deleteAPIKey('test-id')).rejects.toThrow('Cloud storage adapter not initialized');
    });

    it('should handle getAPIKey when not initialized', async () => {
      await expect(adapter.getAPIKey('openai')).rejects.toThrow('Cloud storage adapter not initialized');
    });

    it('should handle isAPIKeyAvailable when not initialized', async () => {
      await expect(adapter.isAPIKeyAvailable('openai')).rejects.toThrow('Cloud storage adapter not initialized');
    });
  });
});
