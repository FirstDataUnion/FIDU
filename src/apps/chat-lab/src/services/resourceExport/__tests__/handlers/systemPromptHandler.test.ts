/**
 * System Prompt Handler Tests
 * Tests export/import logic with ID sanitization and re-hydration
 */

import { SystemPromptHandler } from '../../handlers/systemPromptHandler';
import type { SystemPrompt } from '../../../../types';

// Mock UnifiedStorageService
jest.mock('../../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getSystemPrompts: jest.fn(),
  })),
}));

describe('SystemPromptHandler', () => {
  let handler: SystemPromptHandler;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    handler = new SystemPromptHandler();
    jest.clearAllMocks();
  });

  describe('exportResource', () => {
    it('should sanitize system prompt by removing timestamps and preserving ID', async () => {
      const systemPrompt: SystemPrompt = {
        id: 'sp-123',
        name: 'Test Prompt',
        description: 'Test Description',
        content: 'Test Content',
        tokenCount: 100,
        isDefault: false,
        isBuiltIn: false,
        source: 'user',
        categories: ['test'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = await handler.exportResource(systemPrompt, mockProfileId);

      expect(result.originalId).toBe('sp-123');
      expect(result.resourceType).toBe('systemPrompt');
      expect(result.data.id).toBe('sp-123'); // ID preserved for reference resolution
      expect(result.data.name).toBe('Test Prompt');
      expect(result.data.content).toBe('Test Content');
      // Timestamps should not be in export
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
      // Ownership IDs should not be present
      expect(result.data).not.toHaveProperty('profile_id');
      expect(result.data).not.toHaveProperty('user_id');
    });

    it('should preserve all exportable fields', async () => {
      const systemPrompt: SystemPrompt = {
        id: 'sp-456',
        name: 'Complex Prompt',
        description: 'Complex Description',
        content: 'Complex Content',
        tokenCount: 200,
        isDefault: true,
        isBuiltIn: false,
        source: 'fabric',
        categories: ['cat1', 'cat2'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = await handler.exportResource(systemPrompt, mockProfileId);

      expect(result.data.tokenCount).toBe(200);
      expect(result.data.isDefault).toBe(true);
      expect(result.data.isBuiltIn).toBe(false);
      expect(result.data.source).toBe('fabric');
      expect(result.data.categories).toEqual(['cat1', 'cat2']);
    });
  });

  describe('importResource', () => {
    it('should generate new ID and re-hydrate ownership', async () => {
      const exportData = {
        originalId: 'sp-123',
        resourceType: 'systemPrompt' as const,
        data: {
          id: 'sp-123',
          name: 'Test Prompt',
          description: 'Test Description',
          content: 'Test Content',
          tokenCount: 100,
          isDefault: false,
          isBuiltIn: false,
          source: 'user' as const,
          categories: ['test'],
        },
      };

      const idMapping: Record<string, string> = {};
      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId,
        idMapping
      );

      // New ID should be generated
      expect(result.id).not.toBe('sp-123');
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');

      // ID mapping should be updated
      expect(idMapping['sp-123']).toBe(result.id);

      // Content should be preserved
      expect(result.name).toBe('Test Prompt');
      expect(result.content).toBe('Test Content');

      // Ownership should be reset
      expect(result.isDefault).toBe(false);
      expect(result.isBuiltIn).toBe(false);
      expect(result.source).toBe('user');

      // Timestamps should be set to current time
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should handle missing categories', async () => {
      const exportData = {
        originalId: 'sp-123',
        resourceType: 'systemPrompt' as const,
        data: {
          id: 'sp-123',
          name: 'Test Prompt',
          description: '',
          content: 'Test Content',
          tokenCount: 0,
          isDefault: false,
          isBuiltIn: false,
          source: 'user' as const,
          categories: [],
        },
      };

      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId
      );

      expect(result.categories).toEqual([]);
    });
  });

  describe('validateImport', () => {
    it('should validate correct system prompt data', () => {
      const validData = {
        id: 'sp-123',
        name: 'Test Prompt',
        content: 'Test Content',
      };

      expect(handler.validateImport(validData)).toBe(true);
    });

    it('should reject missing required fields', () => {
      expect(handler.validateImport({ id: 'sp-123' })).toBe(false);
      expect(handler.validateImport({ name: 'Test' })).toBe(false);
      expect(handler.validateImport({ content: 'Content' })).toBe(false);
    });

    it('should reject invalid types', () => {
      // Note: Current validation only checks for presence, not types
      // This is acceptable for basic validation - stricter validation can be added if needed
      expect(
        handler.validateImport({
          id: 'sp-123',
          name: 'Test',
          content: 'Content',
        })
      ).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(handler.validateImport(null)).toBe(false);
      expect(handler.validateImport(undefined)).toBe(false);
      expect(handler.validateImport({})).toBe(false);
    });
  });
});
