/**
 * Context Handler Tests
 * Tests export/import logic with ID sanitization and reference mapping
 */

import { ContextHandler } from '../../handlers/contextHandler';
import type { Context } from '../../../../types';

jest.mock('../../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getContexts: jest.fn(),
  })),
}));

describe('ContextHandler', () => {
  let handler: ContextHandler;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    handler = new ContextHandler();
    jest.clearAllMocks();
  });

  describe('exportResource', () => {
    it('should sanitize context by removing timestamps', async () => {
      const context: Context = {
        id: 'ctx-123',
        title: 'Test Context',
        body: 'Test Body',
        tokenCount: 100,
        tags: ['tag1'],
        isBuiltIn: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = await handler.exportResource(context, mockProfileId);

      expect(result.originalId).toBe('ctx-123');
      expect(result.resourceType).toBe('context');
      expect(result.data.id).toBe('ctx-123');
      expect(result.data.title).toBe('Test Context');
      expect(result.data.body).toBe('Test Body');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    });

    it('should preserve conversation references', async () => {
      const context: Context = {
        id: 'ctx-123',
        title: 'Test Context',
        body: 'Test Body',
        tokenCount: 100,
        tags: [],
        isBuiltIn: false,
        conversationIds: ['conv-1', 'conv-2'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = await handler.exportResource(context, mockProfileId);

      expect(result.data.conversationIds).toEqual(['conv-1', 'conv-2']);
    });
  });

  describe('importResource', () => {
    it('should generate new ID and map conversation references', async () => {
      const exportData = {
        originalId: 'ctx-123',
        resourceType: 'context' as const,
        data: {
          id: 'ctx-123',
          title: 'Test Context',
          body: 'Test Body',
          tokenCount: 100,
          tags: ['tag1'],
          isBuiltIn: false,
          conversationIds: ['conv-1', 'conv-2'],
        },
      };

      const idMapping: Record<string, string> = {
        'conv-1': 'new-conv-1',
        'conv-2': 'new-conv-2',
      };

      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId,
        idMapping
      );

      expect(result.id).not.toBe('ctx-123');
      expect(idMapping['ctx-123']).toBe(result.id);
      expect(result.title).toBe('Test Context');
      expect(result.body).toBe('Test Body');
      expect(result.conversationIds).toEqual(['new-conv-1', 'new-conv-2']);
      expect(result.isBuiltIn).toBe(false);
    });

    it('should handle unmapped conversation IDs', async () => {
      const exportData = {
        originalId: 'ctx-123',
        resourceType: 'context' as const,
        data: {
          id: 'ctx-123',
          title: 'Test Context',
          body: 'Test Body',
          tokenCount: 100,
          tags: [],
          isBuiltIn: false,
          conversationIds: ['conv-1', 'conv-unmapped'],
        },
      };

      const idMapping: Record<string, string> = {
        'conv-1': 'new-conv-1',
      };

      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId,
        idMapping
      );

      // Only mapped IDs should be included
      expect(result.conversationIds).toEqual(['new-conv-1']);
    });
  });

  describe('validateImport', () => {
    it('should validate correct context data', () => {
      const validData = {
        id: 'ctx-123',
        title: 'Test Context',
        body: 'Test Body',
      };

      expect(handler.validateImport(validData)).toBe(true);
    });

    it('should reject missing required fields', () => {
      expect(handler.validateImport({ id: 'ctx-123' })).toBe(false);
      expect(handler.validateImport({ title: 'Test' })).toBe(false);
      expect(handler.validateImport({ body: 'Body' })).toBe(false);
    });

    it('should reject invalid types', () => {
      expect(
        handler.validateImport({ id: 'ctx-123', title: 123, body: 'Body' })
      ).toBe(false);
      expect(
        handler.validateImport({ id: 'ctx-123', title: 'Test', body: 123 })
      ).toBe(false);
    });
  });
});
