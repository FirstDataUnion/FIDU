/**
 * Resource Export Service Tests
 * Tests export functionality, selection filtering, and format generation
 */

import { ResourceExportService } from '../resourceExportService';
import { SystemPromptHandler } from '../handlers/systemPromptHandler';
import { ContextHandler } from '../handlers/contextHandler';
import { BackgroundAgentHandler } from '../handlers/backgroundAgentHandler';
import { ConversationHandler } from '../handlers/conversationHandler';
import { RESOURCE_EXPORT_VERSION } from '../types';

// Mock version utility - Jest will automatically use __mocks__/utils/version.ts
jest.mock('../../utils/version');

// Mock handlers
jest.mock('../handlers/systemPromptHandler');
jest.mock('../handlers/contextHandler');
jest.mock('../handlers/backgroundAgentHandler');
jest.mock('../handlers/conversationHandler');

// Mock UnifiedStorageService
const mockGetSystemPrompts = jest.fn();
const mockGetContexts = jest.fn();
const mockGetBackgroundAgents = jest.fn();
const mockGetConversations = jest.fn();

jest.mock('../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getSystemPrompts: (...args: any[]) => mockGetSystemPrompts(...args),
    getContexts: (...args: any[]) => mockGetContexts(...args),
    getBackgroundAgents: (...args: any[]) => mockGetBackgroundAgents(...args),
    getConversations: (...args: any[]) => mockGetConversations(...args),
  })),
}));

describe('ResourceExportService', () => {
  let service: ResourceExportService;
  const mockProfileId = 'profile-123';
  const mockUserEmail = 'user@example.com';

  beforeEach(() => {
    service = new ResourceExportService();
    jest.clearAllMocks();

    // Setup default mocks
    const mockSystemPromptHandler = new SystemPromptHandler();
    const mockContextHandler = new ContextHandler();
    const mockBackgroundAgentHandler = new BackgroundAgentHandler();
    const mockConversationHandler = new ConversationHandler();

    (SystemPromptHandler as jest.MockedClass<typeof SystemPromptHandler>).mockImplementation(
      () => mockSystemPromptHandler
    );
    (ContextHandler as jest.MockedClass<typeof ContextHandler>).mockImplementation(
      () => mockContextHandler
    );
    (BackgroundAgentHandler as jest.MockedClass<typeof BackgroundAgentHandler>).mockImplementation(
      () => mockBackgroundAgentHandler
    );
    (ConversationHandler as jest.MockedClass<typeof ConversationHandler>).mockImplementation(
      () => mockConversationHandler
    );
  });

  describe('exportResources', () => {
    it('should export selected system prompts', async () => {
      const mockSystemPrompts = [
        {
          id: 'sp-1',
          name: 'Prompt 1',
          description: 'Desc 1',
          content: 'Content 1',
          tokenCount: 100,
          isDefault: false,
          isBuiltIn: false,
          source: 'user' as const,
          categories: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'sp-2',
          name: 'Prompt 2',
          description: 'Desc 2',
          content: 'Content 2',
          tokenCount: 200,
          isDefault: false,
          isBuiltIn: true, // Built-in should be excluded
          source: 'built-in' as const,
          categories: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      // Mock the handler's getAllResources method
      const handler = service['systemPromptHandler'] as jest.Mocked<SystemPromptHandler>;
      handler.getAllResources = jest.fn().mockResolvedValue(mockSystemPrompts);
      handler.exportResource = jest.fn().mockImplementation(async (sp) => ({
        originalId: sp.id,
        resourceType: 'systemPrompt' as const,
        data: {
          id: sp.id,
          name: sp.name,
          description: sp.description,
          content: sp.content,
          tokenCount: sp.tokenCount,
          isDefault: sp.isDefault,
          isBuiltIn: sp.isBuiltIn,
          source: sp.source,
          categories: sp.categories,
        },
      }));

      const selection = {
        systemPromptIds: ['sp-1', 'sp-2'],
      };

      const result = await service.exportResources(selection, mockProfileId, mockUserEmail);

      expect(result.version).toBe(RESOURCE_EXPORT_VERSION);
      expect(result.exportedBy).toBe(mockUserEmail);
      expect(result.exportedAt).toBeDefined();
      expect(result.resources.systemPrompts).toBeDefined();
      expect(result.resources.systemPrompts?.length).toBe(1); // Only non-built-in
      expect(result.resources.systemPrompts?.[0].id).toBe('sp-1');
    });

    it('should exclude built-in resources', async () => {
      const mockSystemPrompts = [
        {
          id: 'sp-1',
          name: 'User Prompt',
          description: '',
          content: 'Content',
          tokenCount: 100,
          isDefault: false,
          isBuiltIn: false,
          source: 'user' as const,
          categories: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'sp-2',
          name: 'Built-in Prompt',
          description: '',
          content: 'Content',
          tokenCount: 100,
          isDefault: false,
          isBuiltIn: true,
          source: 'built-in' as const,
          categories: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      const handler = service['systemPromptHandler'] as jest.Mocked<SystemPromptHandler>;
      handler.getAllResources = jest.fn().mockResolvedValue(mockSystemPrompts);
      handler.exportResource = jest.fn().mockImplementation(async (sp) => ({
        originalId: sp.id,
        resourceType: 'systemPrompt' as const,
        data: {
          id: sp.id,
          name: sp.name,
          description: sp.description,
          content: sp.content,
          tokenCount: sp.tokenCount,
          isDefault: sp.isDefault,
          isBuiltIn: sp.isBuiltIn,
          source: sp.source,
          categories: sp.categories,
        },
      }));

      const selection = {
        systemPromptIds: ['sp-1', 'sp-2'],
      };

      const result = await service.exportResources(selection, mockProfileId);

      expect(result.resources.systemPrompts?.length).toBe(1);
      expect(result.resources.systemPrompts?.[0].name).toBe('User Prompt');
    });

    it('should handle empty selection', async () => {
      const selection = {};

      const result = await service.exportResources(selection, mockProfileId);

      expect(result.resources.systemPrompts).toBeUndefined();
      expect(result.resources.contexts).toBeUndefined();
      expect(result.resources.backgroundAgents).toBeUndefined();
      expect(result.resources.conversations).toBeUndefined();
    });

    it('should include metadata in export', async () => {
      const selection = {};

      const result = await service.exportResources(selection, mockProfileId, mockUserEmail);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.appVersion).toBeDefined();
    });
  });

  describe('downloadExport', () => {
    it('should create download link and trigger download', () => {
      const mockExport = {
        version: RESOURCE_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        resources: {},
      };

      // Mock DOM methods
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');
      const clickSpy = jest.fn();

      const mockLink = document.createElement('a');
      mockLink.click = clickSpy;
      
      createElementSpy.mockReturnValue(mockLink);

      // Mock URL methods
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
      URL.revokeObjectURL = jest.fn();

      service.downloadExport(mockExport);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.download).toContain('fidu-resources-');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('getAvailableResources', () => {
    it('should filter out built-in and system resources', async () => {
      const handlerSP = service['systemPromptHandler'] as jest.Mocked<SystemPromptHandler>;
      handlerSP.getAllResources = jest.fn().mockResolvedValue([
        { id: 'sp-1', isBuiltIn: false } as any,
        { id: 'sp-2', isBuiltIn: true } as any,
      ]);

      const handlerCtx = service['contextHandler'] as jest.Mocked<ContextHandler>;
      handlerCtx.getAllResources = jest.fn().mockResolvedValue([
        { id: 'ctx-1', isBuiltIn: false } as any,
        { id: 'ctx-2', isBuiltIn: true } as any,
      ]);

      const handlerAgent = service['backgroundAgentHandler'] as jest.Mocked<BackgroundAgentHandler>;
      handlerAgent.getAllResources = jest.fn().mockResolvedValue([
        { id: 'agent-1', isSystem: false } as any,
        { id: 'agent-2', isSystem: true } as any,
      ]);

      const handlerConv = service['conversationHandler'] as jest.Mocked<ConversationHandler>;
      handlerConv.getAllResources = jest.fn().mockResolvedValue([
        { id: 'conv-1' } as any,
      ]);

      const result = await service.getAvailableResources(mockProfileId);

      expect(result.systemPrompts.length).toBe(1);
      expect(result.contexts.length).toBe(1);
      expect(result.backgroundAgents.length).toBe(1);
      expect(result.conversations.length).toBe(1);
    });
  });
});

