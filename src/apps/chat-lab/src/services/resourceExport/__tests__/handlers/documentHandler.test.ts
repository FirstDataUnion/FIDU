/**
 * Document Handler Tests
 * Tests export/import logic for documents
 */

import { DocumentHandler } from '../../handlers/documentHandler';
import type { MarkdownDocument } from '../../../../types';
import { DocumentExport, ExportableResource } from '../../types';

describe('DocumentHandler', () => {
  let handler: DocumentHandler;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    handler = new DocumentHandler();
    jest.clearAllMocks();
  });

  describe('exportResource', () => {
    it('should export document without timestamps', async () => {
      const document: MarkdownDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Test Content',
        tags: ['test'],
        createdAt: '2024-01-01T12:34:56Z',
        updatedAt: '2024-01-02T05:07:09Z',
      };

      const result = await handler.exportResource(document, mockProfileId);

      expect(result.originalId).toBe('doc-123');
      expect(result.resourceType).toBe('document');
      expect(result.data.id).toBe('doc-123');
      expect(result.data.title).toBe('Test Document');
      expect(result.data.content).toBe('Test Content');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    });
  });

  describe('importResource', () => {
    it('should import document with new ID', async () => {
      const exportData: DocumentExport = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Test Content',
        tags: ['test'],
      };
      const exportable: ExportableResource = {
        originalId: 'doc-123',
        resourceType: 'document',
        data: exportData,
      };

      const result = await handler.importResource(
        exportable,
        mockProfileId,
        mockUserId
      );

      expect(result.id).not.toBe('doc-123');
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.title).toBe('Test Document');
      expect(result.content).toBe('Test Content');
      expect(result.tags).toEqual(['test']);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.createdAt).getTime()).toBeGreaterThan(0);
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(0);
    });
  });
});
