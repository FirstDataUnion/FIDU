/**
 * Conversation Handler Tests
 * Tests export/import logic with messages and reference mapping
 */

import { ConversationHandler } from '../../handlers/conversationHandler';
import type { Conversation, Message } from '../../../../types';
import { ConversationExport, ExportableResource } from '../../types';

const mockGetMessages = jest.fn();

jest.mock('../../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getConversations: jest.fn(),
    getMessages: (...args: any[]) => mockGetMessages(...args),
  })),
}));

describe('ConversationHandler', () => {
  let handler: ConversationHandler;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    handler = new ConversationHandler();
    jest.clearAllMocks();
    mockGetMessages.mockResolvedValue([]);
  });

  describe('exportResource', () => {
    it('should export conversation with messages', async () => {
      const conversation: Conversation = {
        id: 'conv-123',
        title: 'Test Conversation',
        platform: 'chatgpt',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        lastMessage: 'Hello',
        messageCount: 2,
        tags: ['test'],
        isArchived: false,
        isFavorite: false,
        participants: ['user'],
        status: 'active',
        modelsUsed: ['gpt-4'],
      };

      const messages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          content: 'Hello',
          role: 'user',
          timestamp: '2024-01-01T00:00:00Z',
          platform: 'chatgpt',
          isEdited: false,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-123',
          content: 'Hi there!',
          role: 'assistant',
          timestamp: '2024-01-01T00:01:00Z',
          platform: 'chatgpt',
          isEdited: false,
        },
      ];

      mockGetMessages.mockResolvedValueOnce(messages);

      const result = await handler.exportResource(conversation, mockProfileId);

      expect(result.originalId).toBe('conv-123');
      expect(result.resourceType).toBe('conversation');
      expect(result.data.id).toBe('conv-123');
      expect(result.data.title).toBe('Test Conversation');
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.messages[0].content).toBe('Hello');
      expect(result.data.messages[1].content).toBe('Hi there!');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    });

    it('should preserve original prompt references', async () => {
      const conversation: Conversation = {
        id: 'conv-123',
        title: 'Test Conversation',
        platform: 'chatgpt',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        lastMessage: 'Hello',
        messageCount: 1,
        tags: [],
        isArchived: false,
        isFavorite: false,
        participants: [],
        status: 'active',
        originalPrompt: {
          promptText: 'Test prompt',
          context: { id: 'ctx-123', title: 'Test Context', body: '', tokenCount: 0, createdAt: '', updatedAt: '', tags: [], isBuiltIn: false },
          systemPrompts: [
            { id: 'sp-1', name: 'Prompt 1', content: 'Content 1', description: '', tokenCount: 0, isDefault: false, isBuiltIn: false, source: 'user', categories: [], createdAt: '', updatedAt: '' },
            { id: 'sp-2', name: 'Prompt 2', content: 'Content 2', description: '', tokenCount: 0, isDefault: false, isBuiltIn: false, source: 'user', categories: [], createdAt: '', updatedAt: '' },
          ],
          metadata: {
            estimatedTokens: 100,
          },
        },
      };

      mockGetMessages.mockResolvedValueOnce([]);

      const result = await handler.exportResource(conversation, mockProfileId);

      expect(result.data.originalPrompt?.contextId).toBe('ctx-123');
      expect(result.data.originalPrompt?.systemPromptIds).toEqual(['sp-1', 'sp-2']);
    });
  });

  describe('importResource', () => {
    it('should generate new IDs and map references', async () => {
      const exportData: ExportableResource = {
        originalId: 'conv-123',
        resourceType: 'conversation',
        data: {
          id: 'conv-123',
          title: 'Test Conversation',
          platform: 'chatgpt' as const,
          lastMessage: 'Hello',
          messageCount: 2,
          tags: ['test'],
          isArchived: false,
          isFavorite: false,
          participants: ['user'],
          status: 'active' as const,
          modelsUsed: ['gpt-4'],
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-123',
              content: 'Hello',
              role: 'user' as const,
              timestamp: '2024-01-01T00:00:00Z',
              platform: 'chatgpt',
              isEdited: false,
            },
          ],
          originalPrompt: {
            promptText: 'Test prompt',
            contextId: 'ctx-123',
            systemPromptIds: ['sp-1'],
            systemPromptContents: ['Content 1'],
            systemPromptNames: ['Prompt 1'],
            estimatedTokens: 100,
          },
        } satisfies ConversationExport,
      };

      const idMapping: Record<string, string> = {
        'ctx-123': 'new-ctx-123',
        'sp-1': 'new-sp-1',
      };

      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId,
        idMapping
      );

      expect(result.id).not.toBe('conv-123');
      expect(idMapping['conv-123']).toBe(result.id);
      expect(result.title).toBe('Test Conversation');
      expect(result.originalPrompt?.context?.id).toBe('new-ctx-123');
      expect(result.originalPrompt?.systemPrompt?.id).toBe('new-sp-1');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle missing platform in messages', async () => {
      const exportData: ExportableResource = {
        originalId: 'conv-123',
        resourceType: 'conversation',
        data: {
          id: 'conv-123',
          title: 'Test Conversation',
          platform: 'chatgpt' as const,
          lastMessage: 'Hello',
          messageCount: 1,
          tags: [],
          isArchived: false,
          isFavorite: false,
          participants: [],
          status: 'active' as const,
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-123',
              content: 'Hello',
              role: 'user' as const,
              timestamp: '2024-01-01T00:00:00Z',
              isEdited: false,
            },
          ],
        } satisfies ConversationExport,
      };

      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId
      );

      // Messages are handled in import service, but handler should work
      expect(result.platform).toBe('chatgpt');
    });
  });

  describe('validateImport', () => {
    it('should validate correct conversation data', () => {
      const validData = {
        id: 'conv-123',
        title: 'Test Conversation',
        platform: 'chatgpt',
      };

      expect(handler.validateImport(validData)).toBe(true);
    });

    it('should reject missing required fields', () => {
      expect(handler.validateImport({ id: 'conv-123' })).toBe(false);
      expect(handler.validateImport({ title: 'Test' })).toBe(false);
      expect(handler.validateImport({ platform: 'chatgpt' })).toBe(false);
    });

    it('should validate messages array if present', () => {
      expect(
        handler.validateImport({
          id: 'conv-123',
          title: 'Test',
          platform: 'chatgpt',
          messages: 'invalid',
        })
      ).toBe(false);

      expect(
        handler.validateImport({
          id: 'conv-123',
          title: 'Test',
          platform: 'chatgpt',
          messages: [],
        })
      ).toBe(true);
    });
  });
});

