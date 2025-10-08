/**
 * Integration tests for FileSystemStorageAdapter
 * These tests focus on real behavior with minimal mocking
 */

import { FileSystemStorageAdapter } from '../FileSystemStorageAdapter';
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

// Only mock browser APIs that don't exist in Node.js
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

// Mock only the File System Access API (browser-specific)
Object.defineProperty(global, 'showDirectoryPicker', {
  value: jest.fn(() => Promise.resolve({
    name: 'test-directory',
    getFileHandle: jest.fn(),
    getDirectoryHandle: jest.fn(),
  })),
  writable: true,
});

describe('FileSystemStorageAdapter Integration Tests', () => {
  let adapter: FileSystemStorageAdapter;
  let config: StorageConfig;

  beforeEach(() => {
    config = {
      mode: 'filesystem',
      baseURL: 'http://localhost:4000',
    };
    adapter = new FileSystemStorageAdapter(config);
  });

  describe('Basic Functionality', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(FileSystemStorageAdapter);
    });

    it('should return online status', () => {
      expect(adapter.isOnline()).toBe(true);
    });

    it('should handle directory access checks', () => {
      // These methods should not throw errors
      expect(() => adapter.isDirectoryAccessible()).not.toThrow();
      expect(() => adapter.hasDirectoryMetadata()).not.toThrow();
      expect(() => adapter.getDirectoryName()).not.toThrow();
    });
  });

  describe('API Key Operations', () => {
    it('should handle API key operations gracefully', async () => {
      // Test that these methods don't throw errors
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

    it('should require directory access for context operations', async () => {
      // FileSystemStorageAdapter requires directory access
      await expect(adapter.getContexts()).rejects.toThrow('No directory access');
      await expect(adapter.createContext(mockContext, 'test-profile')).rejects.toThrow('No directory access');
      await expect(adapter.updateContext(mockContext, 'test-profile')).rejects.toThrow('No directory access');
      await expect(adapter.deleteContext('test-context')).rejects.toThrow('No directory access');
    });

    it('should return consistent error messages', async () => {
      try {
        await adapter.getContexts();
      } catch (error) {
        expect((error as Error).message).toContain('directory access');
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

    it('should require directory access for system prompt operations', async () => {
      // FileSystemStorageAdapter requires directory access
      await expect(adapter.getSystemPrompts()).rejects.toThrow('No directory access');
      await expect(adapter.createSystemPrompt(mockSystemPrompt, 'test-profile')).rejects.toThrow('No directory access');
      await expect(adapter.updateSystemPrompt(mockSystemPrompt, 'test-profile')).rejects.toThrow('No directory access');
      await expect(adapter.deleteSystemPrompt('test-prompt')).rejects.toThrow('No directory access');
    });

    it('should return consistent error messages for system prompts', async () => {
      try {
        await adapter.getSystemPrompts();
      } catch (error) {
        expect((error as Error).message).toContain('directory access');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', async () => {
      // Test with invalid inputs - these should still require directory access
      await expect(adapter.getAPIKey('')).resolves.toBeDefined();
      await expect(adapter.getContexts(undefined, -1, -1)).rejects.toThrow('No directory access');
      await expect(adapter.getSystemPrompts(undefined, -1, -1)).rejects.toThrow('No directory access');
    });

    it('should handle missing data gracefully', async () => {
      // Test with non-existent IDs
      await expect(adapter.getConversationById('non-existent')).rejects.toThrow();
      await expect(adapter.getMessages('non-existent')).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent error behavior across operations', async () => {
      // All operations should consistently require directory access
      await expect(adapter.getContexts()).rejects.toThrow('No directory access');
      await expect(adapter.getSystemPrompts()).rejects.toThrow('No directory access');
    });
  });

  describe('API Key Management', () => {
    it('should handle getAllAPIKeys without directory access', async () => {
      await expect(adapter.getAllAPIKeys()).resolves.toEqual([]);
    });

    it('should require directory access for saveAPIKey', async () => {
      await expect(adapter.saveAPIKey('openai', 'sk-test123')).rejects.toThrow('No directory access');
    });

    it('should require directory access for deleteAPIKey', async () => {
      await expect(adapter.deleteAPIKey('test-id')).rejects.toThrow('No directory access');
    });

    it('should handle getAPIKey without directory access', async () => {
      await expect(adapter.getAPIKey('openai')).resolves.toBeNull();
    });

    it('should handle isAPIKeyAvailable without directory access', async () => {
      await expect(adapter.isAPIKeyAvailable('openai')).resolves.toBe(false);
    });
  });
});
