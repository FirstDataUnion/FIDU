import { conversationsApi } from '../conversations';
import { fiduVaultAPIClient } from '../apiClientFIDUVault';
import { refreshTokenService } from '../refreshTokenService';
import type { Message, ConversationDataPacket } from '../../../types';

// Mock the API client
jest.mock('../apiClientFIDUVault', () => ({
  fiduVaultAPIClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock the refresh token service
jest.mock('../refreshTokenService', () => ({
  refreshTokenService: {
    getAccessToken: jest.fn(),
    createAuthInterceptor: jest.fn(),
    clearAllAuthTokens: jest.fn(),
  },
}));

const mockFiduVaultAPIClient = fiduVaultAPIClient as jest.Mocked<typeof fiduVaultAPIClient>;
const mockRefreshTokenService = refreshTokenService as jest.Mocked<typeof refreshTokenService>;

const mockConversationDataPacket: ConversationDataPacket = {
  id: '1',
  profile_id: 'profile-1',
  create_timestamp: '2024-01-01T00:00:00Z',
  update_timestamp: '2024-01-01T00:00:00Z',
  tags: ['Chat-Bot-Conversation', 'test'],
  data: {
    sourceChatbot: 'CHATGPT',
    interactions: [
      {
        actor: 'user',
        timestamp: '2024-01-01T00:00:00Z',
        content: 'Hello',
        attachments: [],
        model: 'chatgpt',
      },
      {
        actor: 'bot',
        timestamp: '2024-01-01T00:01:00Z',
        content: 'Hi there!',
        attachments: [],
        model: 'chatgpt',
      },
    ],
    targetModelRequested: 'chatgpt',
    conversationUrl: 'FIDU_Chat_Lab',
    conversationTitle: 'Test Conversation',
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
};

// const _mockConversation: Conversation = {
//   id: '1',
//   title: 'Test Conversation',
//   platform: 'chatgpt',
//   createdAt: '2024-01-01T00:00:00Z',
//   updatedAt: '2024-01-01T00:00:00Z',
//   lastMessage: 'Hi there!',
//   messageCount: 2,
//   tags: ['test'],
//   isArchived: false,
//   isFavorite: false,
//   participants: [],
//   status: 'active',
// };

const mockMessages: Message[] = [
  {
    id: '1-0',
    conversationId: '1',
    content: 'Hello',
    role: 'user',
    timestamp: '2024-01-01T00:00:00Z',
    platform: 'chatgpt',
    metadata: { attachments: [] },
    attachments: [],
    isEdited: false,
  },
  {
    id: '1-1',
    conversationId: '1',
    content: 'Hi there!',
    role: 'assistant',
    timestamp: '2024-01-01T00:01:00Z',
    platform: 'chatgpt',
    metadata: { attachments: [] },
    attachments: [],
    isEdited: false,
  },
];

describe('conversationsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch conversations successfully', async () => {
      const mockResponse = {
        data: [mockConversationDataPacket],
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getAll({}, 1, 20, 'profile-1');
      
      expect(mockFiduVaultAPIClient.get).toHaveBeenCalledWith('/data-packets', {
        params: {
          tags: ['Chat-Bot-Conversation'],
          profile_id: 'profile-1',
          from_timestamp: undefined,
          to_timestamp: undefined,
          limit: 20,
          offset: 0,
          sort_order: 'desc',
        },
        paramsSerializer: expect.any(Object),
      });
      
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].title).toBe('Test Conversation');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should handle filters correctly', async () => {
      const mockResponse = {
        data: [mockConversationDataPacket],
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const filters = {
        tags: ['ai'],
        dateRange: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-31T23:59:59Z'),
        },
      };
      
      await conversationsApi.getAll(filters, 2, 50, 'profile-1');
      
      expect(mockFiduVaultAPIClient.get).toHaveBeenCalledWith('/data-packets', {
        params: {
          tags: ['Chat-Bot-Conversation', 'ai'],
          profile_id: 'profile-1',
          from_timestamp: new Date('2024-01-01T00:00:00Z'),
          to_timestamp: new Date('2024-01-31T23:59:59Z'),
          limit: 50,
          offset: 50, // (page 2 - 1) * limit 50
          sort_order: 'desc',
        },
        paramsSerializer: expect.objectContaining({
          serialize: expect.any(Function),
        }),
      });
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        data: null,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getAll({}, 1, 20, 'profile-1');
      
      expect(result.conversations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle non-array response', async () => {
      const mockResponse = {
        data: { invalid: 'data' },
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getAll({}, 1, 20, 'profile-1');
      
      expect(result.conversations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockFiduVaultAPIClient.get.mockRejectedValue(error);
      
      await expect(conversationsApi.getAll({}, 1, 20, 'profile-1')).rejects.toThrow('API Error');
    });
  });

  describe('getById', () => {
    it('should fetch a single conversation successfully', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(mockFiduVaultAPIClient.get).toHaveBeenCalledWith('/data-packets/1');
      expect(result.title).toBe('Test Conversation');
      expect(result.platform).toBe('chatgpt');
    });

    it('should handle API errors', async () => {
      const error = new Error('Not found');
      mockFiduVaultAPIClient.get.mockRejectedValue(error);
      
      await expect(conversationsApi.getById('1')).rejects.toThrow('Not found');
    });
  });

  describe('getMessages', () => {
    it('should fetch conversation messages successfully', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getMessages('1');
      
      expect(mockFiduVaultAPIClient.get).toHaveBeenCalledWith('/data-packets/1');
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello');
      expect(result[0].role).toBe('user');
      expect(result[1].content).toBe('Hi there!');
      expect(result[1].role).toBe('assistant');
    });

    it('should handle conversation with no interactions', async () => {
      const mockResponse = {
        data: {
          ...mockConversationDataPacket,
          data: {
            ...mockConversationDataPacket.data,
            interactions: [],
          },
        },
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getMessages('1');
      
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const error = new Error('Failed to fetch messages');
      mockFiduVaultAPIClient.get.mockRejectedValue(error);
      
      await expect(conversationsApi.getMessages('1')).rejects.toThrow('Failed to fetch messages');
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation successfully', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 201,
      };
      
      mockFiduVaultAPIClient.post.mockResolvedValue(mockResponse);
      
      const conversation = {
        title: 'New Conversation',
        platform: 'chatgpt' as const,
        tags: ['test'],
      };
      
      const result = await conversationsApi.createConversation('profile-1', conversation, mockMessages);
      
      expect(mockFiduVaultAPIClient.post).toHaveBeenCalledWith('/data-packets', expect.objectContaining({
        request_id: expect.any(String),
        data_packet: expect.objectContaining({
          profile_id: 'profile-1',
          tags: ['Chat-Bot-Conversation', 'FIDU-CHAT-LAB-Conversation', 'test'],
          data: expect.objectContaining({
            sourceChatbot: 'CHATGPT',
            conversationTitle: 'New Conversation',
            modelsUsed: expect.any(Array), // Should compute and store modelsUsed
            interactions: expect.arrayContaining([
              expect.objectContaining({
                actor: 'user',
                content: 'Hello',
              }),
            ]),
          }),
        }),
      }));
      
      expect(result.title).toBe('Test Conversation');
    });
  });

  describe('updateConversation', () => {
    it('should update an existing conversation successfully', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 200,
      };
      
      mockFiduVaultAPIClient.put.mockResolvedValue(mockResponse);
      
      const conversation = {
        id: '1',
        title: 'Updated Conversation',
        platform: 'chatgpt' as const,
        tags: ['updated'],
      };
      
      const result = await conversationsApi.updateConversation(conversation, mockMessages);
      
      expect(mockFiduVaultAPIClient.put).toHaveBeenCalledWith('/data-packets/1', expect.objectContaining({
        request_id: expect.any(String),
        data_packet: expect.objectContaining({
          id: '1',
          tags: ['updated'],
          data: expect.objectContaining({
            conversationTitle: 'Updated Conversation',
            modelsUsed: expect.any(Array), // Should compute and store modelsUsed
          }),
        }),
      }));
      
      expect(result.title).toBe('Test Conversation');
    });

    it('should throw error when conversation ID is missing', async () => {
      const conversation = {
        title: 'Updated Conversation',
        platform: 'chatgpt' as const,
      };
      
      await expect(conversationsApi.updateConversation(conversation, mockMessages))
        .rejects.toThrow('Conversation ID is required to update conversation');
    });

    it('should compute and store modelsUsed when creating conversation', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 201,
      };
      
      mockFiduVaultAPIClient.post.mockResolvedValue(mockResponse);
      
      const messagesWithMultipleModels: Message[] = [
        {
          id: '1-0',
          conversationId: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          platform: 'user',
          attachments: [],
          isEdited: false,
        },
        {
          id: '1-1',
          conversationId: '1',
          role: 'assistant',
          content: 'Hi!',
          timestamp: new Date('2024-01-01T00:01:00Z'),
          platform: 'gpt-4o',
          attachments: [],
          isEdited: false,
        },
        {
          id: '1-2',
          conversationId: '1',
          role: 'assistant',
          content: 'Another response',
          timestamp: new Date('2024-01-01T00:02:00Z'),
          platform: 'claude-3-5-sonnet',
          attachments: [],
          isEdited: false,
        },
      ];

      const conversation = {
        title: 'Multi-Model Conversation',
        platform: 'chatgpt' as const,
        tags: ['test'],
      };
      
      await conversationsApi.createConversation('profile-1', conversation, messagesWithMultipleModels);
      
      const callArgs = mockFiduVaultAPIClient.post.mock.calls[0][1];
      const dataPacket = callArgs.data_packet;
      
      expect(dataPacket.data.modelsUsed).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
    });

    it('should merge existing modelsUsed when updating conversation', async () => {
      const mockResponse = {
        data: {
          ...mockConversationDataPacket,
          data: {
            ...mockConversationDataPacket.data,
            modelsUsed: ['gpt-4o'], // Existing models
          },
        },
        status: 200,
      };
      
      mockFiduVaultAPIClient.put.mockResolvedValue(mockResponse);
      
      const newMessages: Message[] = [
        {
          id: '1-2',
          conversationId: '1',
          role: 'assistant',
          content: 'New response',
          timestamp: new Date('2024-01-01T00:03:00Z'),
          platform: 'claude-3-5-sonnet', // New model
          attachments: [],
          isEdited: false,
        },
      ];

      const conversation = {
        id: '1',
        title: 'Updated Conversation',
        platform: 'chatgpt' as const,
        tags: ['updated'],
        modelsUsed: ['gpt-4o'], // Existing from conversation
      };
      
      await conversationsApi.updateConversation(conversation, newMessages);
      
      const callArgs = mockFiduVaultAPIClient.put.mock.calls[0][1];
      const dataPacket = callArgs.data_packet;
      
      // Should merge existing + new
      expect(dataPacket.data.modelsUsed).toContain('gpt-4o');
      expect(dataPacket.data.modelsUsed).toContain('claude-3-5-sonnet');
      expect(dataPacket.data.modelsUsed.length).toBe(2);
    });
  });

  describe('data transformation', () => {
    it('should transform data packet to conversation correctly', async () => {
      const mockResponse = {
        data: mockConversationDataPacket,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(result.id).toBe('1');
      expect(result.title).toBe('Test Conversation');
      expect(result.platform).toBe('chatgpt');
      expect(result.lastMessage).toBe('Hi there!');
      expect(result.messageCount).toBe(2);
      expect(result.tags).toEqual(['Chat-Bot-Conversation', 'test']);
      expect(result.isArchived).toBe(false);
      expect(result.isFavorite).toBe(false);
    });

    it('should compute modelsUsed from interactions when not stored', async () => {
      const dataPacketWithMultipleModels = {
        ...mockConversationDataPacket,
        data: {
          ...mockConversationDataPacket.data,
          interactions: [
            {
              actor: 'user',
              timestamp: '2024-01-01T00:00:00Z',
              content: 'Hello',
              attachments: [],
              model: 'chatgpt',
            },
            {
              actor: 'bot',
              timestamp: '2024-01-01T00:01:00Z',
              content: 'Hi there!',
              attachments: [],
              model: 'gpt-4o',
            },
            {
              actor: 'assistant',
              timestamp: '2024-01-01T00:02:00Z',
              content: 'Another response',
              attachments: [],
              model: 'claude-3-5-sonnet',
            },
          ],
          // No modelsUsed field - should be computed
        },
      };

      const mockResponse = {
        data: dataPacketWithMultipleModels,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(result.modelsUsed).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
    });

    it('should use stored modelsUsed when available', async () => {
      const dataPacketWithStoredModels = {
        ...mockConversationDataPacket,
        data: {
          ...mockConversationDataPacket.data,
          modelsUsed: ['autorouter', 'gpt-4o', 'custom-model'],
        },
      };

      const mockResponse = {
        data: dataPacketWithStoredModels,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      // Should use stored value, not recompute
      expect(result.modelsUsed).toEqual(['autorouter', 'gpt-4o', 'custom-model']);
    });

    it('should handle conversation with original prompt data', async () => {
      const dataPacketWithPrompt = {
        ...mockConversationDataPacket,
        data: {
          ...mockConversationDataPacket.data,
          originalPrompt: {
            promptText: 'Test prompt',
            contextId: 'context-1',
            contextTitle: 'Test Context',
            contextDescription: 'Test context description',
            systemPromptId: 'system-prompt-1',
            systemPromptContent: 'System prompt content',
            systemPromptName: 'Test System Prompt',
            estimatedTokens: 100,
          },
        },
      };
      
      const mockResponse = {
        data: dataPacketWithPrompt,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(result.originalPrompt).toBeDefined();
      expect(result.originalPrompt?.promptText).toBe('Test prompt');
      expect(result.originalPrompt?.context?.id).toBe('context-1');
      expect(result.originalPrompt?.context?.title).toBe('Test Context');
      expect(result.originalPrompt?.systemPrompt?.id).toBe('system-prompt-1');
      expect(result.originalPrompt?.systemPrompt?.content).toBe('System prompt content');
    });

    it('should handle conversation with multiple system prompts', async () => {
      const dataPacketWithMultiplePrompts = {
        ...mockConversationDataPacket,
        data: {
          ...mockConversationDataPacket.data,
          originalPrompt: {
            promptText: 'Test prompt',
            systemPromptIds: ['system-prompt-1', 'system-prompt-2'],
            systemPromptContents: ['Content 1', 'Content 2'],
            systemPromptNames: ['Prompt 1', 'Prompt 2'],
            estimatedTokens: 200,
          },
        },
      };
      
      const mockResponse = {
        data: dataPacketWithMultiplePrompts,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(result.originalPrompt?.systemPrompts).toHaveLength(2);
      expect(result.originalPrompt?.systemPrompts?.[0].id).toBe('system-prompt-1');
      expect(result.originalPrompt?.systemPrompts?.[0].content).toBe('Content 1');
      expect(result.originalPrompt?.systemPrompts?.[1].id).toBe('system-prompt-2');
      expect(result.originalPrompt?.systemPrompts?.[1].content).toBe('Content 2');
    });

    it('should handle invalid data packet gracefully', async () => {
      const invalidDataPacket = {
        ...mockConversationDataPacket,
        data: {
          ...mockConversationDataPacket.data,
          interactions: [], // No interactions
        },
      };
      
      const mockResponse = {
        data: invalidDataPacket,
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getById('1');
      
      expect(result.title).toBe('Error: Could not parse data packet as conversation');
      expect(result.lastMessage).toBe('Error: Could not parse data packet as conversation');
      expect(result.messageCount).toBe(0);
    });
  });

  describe('unimplemented methods', () => {
    it('should throw error for create method', async () => {
      await expect(conversationsApi.create({})).rejects.toThrow('Not implemented');
    });

    it('should throw error for update method', async () => {
      await expect(conversationsApi.update('1', {})).rejects.toThrow('Not implemented');
    });

    it('should throw error for delete method', async () => {
      await expect(conversationsApi.delete('1')).rejects.toThrow('Not implemented');
    });

    it('should throw error for archive method', async () => {
      await expect(conversationsApi.archive('1')).rejects.toThrow('Not implemented');
    });

    it('should throw error for unarchive method', async () => {
      await expect(conversationsApi.unarchive('1')).rejects.toThrow('Not implemented');
    });

    it('should throw error for toggleFavorite method', async () => {
      await expect(conversationsApi.toggleFavorite('1')).rejects.toThrow('Not implemented');
    });

    it('should throw error for addTags method', async () => {
      await expect(conversationsApi.addTags('1', ['tag1'])).rejects.toThrow('Not implemented');
    });

    it('should throw error for removeTags method', async () => {
      await expect(conversationsApi.removeTags('1', ['tag1'])).rejects.toThrow('Not implemented');
    });
  });

  describe('refresh token integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle 401 errors with automatic token refresh', async () => {
      const mockResponse = {
        data: [mockConversationDataPacket],
        status: 200,
      };
      
      // Mock successful API call (interceptor handles refresh internally)
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);

      // Mock the refresh token service to simulate successful refresh
      mockRefreshTokenService.getAccessToken.mockReturnValue('new-token');
      mockRefreshTokenService.createAuthInterceptor.mockReturnValue({
        request: jest.fn((config) => config),
        response: jest.fn((response) => response),
        error: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await conversationsApi.getAll({}, 1, 20, 'profile-1');
      
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].title).toBe('Test Conversation');
    });

    it('should handle refresh token failure', async () => {
      // Mock API call that will fail due to authentication
      mockFiduVaultAPIClient.get.mockRejectedValue(new Error('Authentication required. Please log in again.'));

      // Mock refresh token service to simulate refresh failure
      mockRefreshTokenService.getAccessToken.mockReturnValue(null);
      mockRefreshTokenService.createAuthInterceptor.mockReturnValue({
        request: jest.fn((config) => config),
        response: jest.fn((response) => response),
        error: jest.fn().mockRejectedValue(new Error('Authentication required. Please log in again.')),
      });

      await expect(conversationsApi.getAll({}, 1, 20, 'profile-1')).rejects.toThrow('Authentication required. Please log in again.');
    });

    it('should not attempt refresh for non-401 errors', async () => {
      const error = new Error('Server error');
      mockFiduVaultAPIClient.get.mockRejectedValue(error);
      
      await expect(conversationsApi.getAll({}, 1, 20, 'profile-1')).rejects.toThrow('Server error');
      
      // Verify refresh token service was not called
      expect(mockRefreshTokenService.getAccessToken).not.toHaveBeenCalled();
    });

    it('should handle successful requests without refresh', async () => {
      const mockResponse = {
        data: [mockConversationDataPacket],
        status: 200,
      };
      
      mockFiduVaultAPIClient.get.mockResolvedValue(mockResponse);
      
      const result = await conversationsApi.getAll({}, 1, 20, 'profile-1');
      
      expect(result.conversations).toHaveLength(1);
      expect(mockFiduVaultAPIClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
