/**
 * Resource Import Service Tests
 * Tests import validation, re-hydration, and error handling
 */

import { ResourceImportService } from '../resourceImportService';
import { SystemPromptHandler } from '../handlers/systemPromptHandler';
import { ContextHandler } from '../handlers/contextHandler';
import { BackgroundAgentHandler } from '../handlers/backgroundAgentHandler';
import { ConversationHandler } from '../handlers/conversationHandler';
import { DocumentHandler } from '../handlers/documentHandler';
import { RESOURCE_EXPORT_VERSION } from '../types';
import type { ResourceExport } from '../types';
import { Context, Conversation, SystemPrompt } from '../../../types';

// Mock handlers
jest.mock('../handlers/systemPromptHandler');
jest.mock('../handlers/contextHandler');
jest.mock('../handlers/backgroundAgentHandler');
jest.mock('../handlers/conversationHandler');
jest.mock('../handlers/documentHandler');

// Mock UnifiedStorageService
const mockCreateSystemPrompt = jest.fn();
const mockCreateContext = jest.fn();
const mockCreateBackgroundAgent = jest.fn();
const mockCreateConversation = jest.fn();
const mockEnsureUserId = jest.fn();
const mockGetSystemPrompts = jest.fn();
const mockGetContexts = jest.fn();
const mockGetBackgroundAgents = jest.fn();
const mockGetDocuments = jest.fn();

jest.mock('../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getSystemPrompts: (...args: any[]) => mockGetSystemPrompts(...args),
    getContexts: (...args: any[]) => mockGetContexts(...args),
    getBackgroundAgents: (...args: any[]) => mockGetBackgroundAgents(...args),
    createSystemPrompt: (...args: any[]) => mockCreateSystemPrompt(...args),
    createContext: (...args: any[]) => mockCreateContext(...args),
    createBackgroundAgent: (...args: any[]) =>
      mockCreateBackgroundAgent(...args),
    createConversation: (...args: any[]) => mockCreateConversation(...args),
    getDocuments: (...args: any[]) => mockGetDocuments(...args),
    getAdapter: jest.fn(() => ({
      ensureUserId: mockEnsureUserId,
    })),
  })),
}));

jest.mock('../../storage/UnsyncedDataManager', () => ({
  unsyncedDataManager: {
    markAsUnsynced: jest.fn(),
  },
}));

describe('ResourceImportService', () => {
  let service: ResourceImportService;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    service = new ResourceImportService();
    jest.clearAllMocks();
    mockEnsureUserId.mockReturnValue(mockUserId);
    mockGetSystemPrompts.mockResolvedValue({ systemPrompts: [] });
    mockGetContexts.mockResolvedValue({ contexts: [] });
    mockGetBackgroundAgents.mockResolvedValue({ backgroundAgents: [] });
    mockGetDocuments.mockResolvedValue({ documents: [] });

    // Setup handler mocks
    const mockSystemPromptHandler = new SystemPromptHandler();
    const mockContextHandler = new ContextHandler();
    const mockBackgroundAgentHandler = new BackgroundAgentHandler();
    const mockConversationHandler = new ConversationHandler();
    const mockDocumentHandler = new DocumentHandler();

    (
      SystemPromptHandler as jest.MockedClass<typeof SystemPromptHandler>
    ).mockImplementation(() => mockSystemPromptHandler);
    (
      ContextHandler as jest.MockedClass<typeof ContextHandler>
    ).mockImplementation(() => mockContextHandler);
    (
      BackgroundAgentHandler as jest.MockedClass<typeof BackgroundAgentHandler>
    ).mockImplementation(() => mockBackgroundAgentHandler);
    (
      ConversationHandler as jest.MockedClass<typeof ConversationHandler>
    ).mockImplementation(() => mockConversationHandler);
    (
      DocumentHandler as jest.MockedClass<typeof DocumentHandler>
    ).mockImplementation(() => mockDocumentHandler);
  });

  describe('validateExportFormat', () => {
    it('should validate correct export format', () => {
      const validExport: ResourceExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {},
      };

      const result = service.validateExportFormat(validExport);
      expect(result.valid).toBe(true);
    });

    it('should reject missing version', () => {
      const invalidExport = {
        exportedAt: new Date().toISOString(),
        resources: {},
      };

      const result = service.validateExportFormat(invalidExport);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('version');
    });

    it('should reject missing resources', () => {
      const invalidExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
      };

      const result = service.validateExportFormat(invalidExport);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('resources');
    });

    it('should reject non-object', () => {
      expect(service.validateExportFormat(null).valid).toBe(false);
      expect(service.validateExportFormat(undefined).valid).toBe(false);
      expect(service.validateExportFormat('string').valid).toBe(false);
    });
  });

  describe('importResources', () => {
    it('should import system prompts successfully', async () => {
      const exportData: ResourceExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {
          systemPrompts: [
            {
              id: 'sp-1',
              name: 'Test Prompt',
              description: 'Description',
              content: 'Content',
              tokenCount: 100,
              isDefault: false,
              isBuiltIn: false,
              source: 'user',
              categories: [],
            },
          ],
        },
      };

      // Mock handler methods
      const handler = service[
        'systemPromptHandler'
      ] as jest.Mocked<SystemPromptHandler>;
      handler.validateImport = jest.fn().mockReturnValue(true);
      handler.importResource = jest.fn().mockResolvedValue({
        id: 'new-sp-1',
        name: 'Test Prompt',
        description: 'Description',
        content: 'Content',
        tokenCount: 100,
        isDefault: false,
        isBuiltIn: false,
        source: 'user',
        categories: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies SystemPrompt);

      mockCreateSystemPrompt.mockResolvedValue({ id: 'new-sp-1' });

      const result = await service.importResources(
        exportData,
        mockProfileId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.imported.systemPrompts).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockCreateSystemPrompt).toHaveBeenCalledTimes(1);
    });

    it('should handle import errors gracefully', async () => {
      const exportData: ResourceExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {
          systemPrompts: [
            {
              id: 'sp-1',
              name: 'Test Prompt',
              description: 'Description',
              content: 'Content',
              tokenCount: 100,
              isDefault: false,
              isBuiltIn: false,
              source: 'user',
              categories: [],
            },
          ],
        },
      };

      const handler = service[
        'systemPromptHandler'
      ] as jest.Mocked<SystemPromptHandler>;
      handler.validateImport = jest.fn().mockReturnValue(true);
      handler.importResource = jest.fn().mockResolvedValue({
        id: 'new-sp-1',
        name: 'Test Prompt',
      } as any);

      mockCreateSystemPrompt.mockRejectedValue(new Error('Storage error'));

      const result = await service.importResources(
        exportData,
        mockProfileId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.imported.systemPrompts).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].resourceType).toBe('systemPrompt');
      expect(result.errors[0].error).toContain('Storage error');
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      const exportData: ResourceExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {
          systemPrompts: [
            {
              id: 'sp-1',
              name: 'Duplicate Prompt',
              description: '',
              content: 'Content',
              tokenCount: 100,
              isDefault: false,
              isBuiltIn: false,
              source: 'user',
              categories: [],
            },
          ],
        },
      };

      // Mock existing prompt with same name
      mockGetSystemPrompts.mockResolvedValue({
        systemPrompts: [
          {
            id: 'existing-sp',
            name: 'Duplicate Prompt',
            isBuiltIn: false,
          },
        ],
      });

      const handler = service[
        'systemPromptHandler'
      ] as jest.Mocked<SystemPromptHandler>;
      handler.validateImport = jest.fn().mockReturnValue(true);

      const result = await service.importResources(
        exportData,
        mockProfileId,
        mockUserId,
        { skipDuplicates: true }
      );

      expect(result.imported.systemPrompts).toBe(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].warning).toContain('duplicate');
      expect(mockCreateSystemPrompt).not.toHaveBeenCalled();
    });

    it('should map IDs correctly for conversation references', async () => {
      const exportData: ResourceExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {
          contexts: [
            {
              id: 'ctx-1',
              title: 'Test Context',
              body: 'Body',
              tokenCount: 100,
              tags: [],
              isBuiltIn: false,
              conversationIds: ['conv-1'],
            },
          ],
          conversations: [
            {
              id: 'conv-1',
              title: 'Test Conversation',
              platform: 'chatgpt',
              lastMessage: 'Hello',
              messageCount: 1,
              tags: [],
              isArchived: false,
              isFavorite: false,
              participants: [],
              status: 'active',
              messages: [],
            },
          ],
        },
      };

      const handlerCtx = service[
        'contextHandler'
      ] as jest.Mocked<ContextHandler>;
      handlerCtx.validateImport = jest.fn().mockReturnValue(true);
      handlerCtx.importResource = jest.fn().mockResolvedValue({
        id: 'new-ctx-1',
        title: 'Test Context',
        body: 'Body',
        tokenCount: 100,
        tags: [],
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Context);

      const handlerConv = service[
        'conversationHandler'
      ] as jest.Mocked<ConversationHandler>;
      handlerConv.validateImport = jest.fn().mockReturnValue(true);
      handlerConv.importResource = jest.fn().mockResolvedValue({
        id: 'new-conv-1',
        title: 'Test Conversation',
        platform: 'chatgpt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: 'Hello',
        messageCount: 1,
        tags: [],
        isArchived: false,
        isFavorite: false,
        participants: [],
        status: 'active',
      } satisfies Conversation);

      mockCreateContext.mockResolvedValue({ id: 'new-ctx-1' });
      mockCreateConversation.mockResolvedValue({ id: 'new-conv-1' });

      const result = await service.importResources(
        exportData,
        mockProfileId,
        mockUserId
      );

      expect(result.imported.contexts).toBe(1);
      expect(result.imported.conversations).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parseImportFile', () => {
    it('should parse valid JSON file', async () => {
      const jsonContent = JSON.stringify({
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {},
      });

      const file = new File([jsonContent], 'export.json', {
        type: 'application/json',
      });

      const result = await service.parseImportFile(file);

      expect(result.version).toBe(RESOURCE_EXPORT_VERSION);
      expect(result.resources).toBeDefined();
    });

    it('should reject invalid JSON', async () => {
      const invalidContent = 'not json';
      const file = new File([invalidContent], 'export.json', {
        type: 'application/json',
      });

      await expect(service.parseImportFile(file)).rejects.toThrow(
        'Failed to parse JSON'
      );
    });
  });
});
