// Mock the environment module to fix import.meta errors
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: () => ({
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  }),
  getIdentityServiceUrl: () => 'https://identity.firstdataunion.org',
  getGatewayUrl: () => 'https://gateway.firstdataunion.org',
  detectRuntimeEnvironment: () => 'local',
  isDevEnvironment: () => true,
}));

// Mock GoogleDriveAuth to fix import.meta errors
jest.mock('../../../services/auth/GoogleDriveAuth', () => ({
  GoogleDriveAuthService: jest.fn(),
  getGoogleDriveAuthService: jest.fn(),
}));

import conversationsSlice, {
  fetchConversations,
  fetchConversation,
  fetchConversationMessages,
  saveConversation,
  deleteConversation,
  archiveConversation,
  unarchiveConversation,
  toggleFavoriteConversation,
  setFilters,
  clearFilters,
  setPagination,
  clearCurrentConversation,
  clearError,
  updateConversationLocally,
} from '../conversationsSlice';
import type { Conversation, ConversationsState } from '../../../types';
import { conversationsService } from '../../../services/conversationsService';

// Mock the API
jest.mock('../../../services/conversationsService', () => ({
  conversationsService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    getMessages: jest.fn(),
    createConversation: jest.fn(),
    updateConversation: jest.fn(),
    deleteConversation: jest.fn(),
    archiveConversation: jest.fn(),
    unarchiveConversation: jest.fn(),
    toggleFavoriteConversation: jest.fn(),
  },
}));

const mockConversationsService = conversationsService as jest.Mocked<
  typeof conversationsService
>;

const mockConversation: Conversation = {
  id: '1',
  title: 'Test Conversation',
  platform: 'chatgpt',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastMessage: 'Hello world',
  messageCount: 5,
  tags: ['test'],
  isArchived: false,
  isFavorite: false,
  participants: [],
  status: 'active',
};

const mockMessages = [
  {
    id: '1',
    conversationId: '1',
    content: 'Hello',
    role: 'user' as const,
    timestamp: '2024-01-01T00:00:00Z',
    platform: 'chatgpt',
    metadata: { attachments: [] },
    attachments: [],
    isEdited: false,
  },
  {
    id: '2',
    conversationId: '1',
    content: 'Hi there!',
    role: 'assistant' as const,
    timestamp: '2024-01-01T00:01:00Z',
    platform: 'chatgpt',
    metadata: { attachments: [] },
    attachments: [],
    isEdited: false,
  },
];

describe('conversationsSlice', () => {
  const initialState: ConversationsState = {
    items: [],
    currentConversation: null,
    currentMessages: [],
    messagesLoading: false,
    loading: false,
    error: null,
    filters: {
      searchQuery: '',
      platforms: [],
      tags: [],
      isArchived: undefined,
      isFavorite: undefined,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reducers', () => {
    it('should handle setFilters', () => {
      const action = setFilters({
        searchQuery: 'test',
        platforms: ['chatgpt'],
      } as any);
      const state = conversationsSlice(initialState, action);

      expect(state.filters.searchQuery).toBe('test');
      expect(state.filters.platforms).toEqual(['chatgpt']);
    });

    it('should handle clearFilters', () => {
      const stateWithFilters = {
        ...initialState,
        filters: {
          searchQuery: 'test',
          platforms: ['chatgpt'],
          tags: ['ai'],
          isArchived: true,
          isFavorite: false,
          sortBy: 'title' as const,
          sortOrder: 'asc' as const,
        },
      };

      const state = conversationsSlice(stateWithFilters, clearFilters());

      expect(state.filters).toEqual(initialState.filters);
    });

    it('should handle setPagination', () => {
      const action = setPagination({ page: 2, limit: 50 } as any);
      const state = conversationsSlice(initialState, action);

      expect(state.pagination.page).toBe(2);
      expect(state.pagination.limit).toBe(50);
    });

    it('should handle clearCurrentConversation', () => {
      const stateWithCurrent = {
        ...initialState,
        currentConversation: mockConversation,
        currentMessages: mockMessages,
      };

      const state = conversationsSlice(
        stateWithCurrent,
        clearCurrentConversation()
      );

      expect(state.currentConversation).toBeNull();
    });

    it('should handle clearError', () => {
      const stateWithError = {
        ...initialState,
        error: 'Test error',
      };

      const state = conversationsSlice(stateWithError, clearError());

      expect(state.error).toBeNull();
    });

    it('should handle updateConversationLocally', () => {
      const stateWithItems = {
        ...initialState,
        items: [mockConversation],
        currentConversation: mockConversation,
      };

      const updatedConversation = {
        ...mockConversation,
        title: 'Updated Title',
      };

      const action = updateConversationLocally(updatedConversation as any);
      const state = conversationsSlice(stateWithItems, action);

      expect(state.items[0].title).toBe('Updated Title');
      expect(state.currentConversation?.title).toBe('Updated Title');
    });
  });

  describe('async thunks', () => {
    describe('fetchConversations', () => {
      it('should handle fetchConversations.pending', () => {
        const action = fetchConversations.pending('', {});
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle fetchConversations.fulfilled', async () => {
        const mockResponse = {
          conversations: [mockConversation],
          total: 1,
          page: 1,
          limit: 20,
        };

        mockConversationsService.getAll.mockResolvedValue(mockResponse);

        const thunk = fetchConversations({
          filters: undefined,
          page: 1,
          limit: 20,
        });
        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          auth: { currentProfile: { id: 'profile-1' } },
        }));

        await thunk(dispatch, getState, undefined);

        expect(mockConversationsService.getAll).toHaveBeenCalledWith(
          undefined,
          1,
          20,
          'profile-1'
        );
      });

      it('should handle fetchConversations.rejected', () => {
        const action = fetchConversations.rejected(
          new Error('Failed to fetch'),
          '',
          {}
        );
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to fetch');
      });

      it('should throw error when no workspace is selected', async () => {
        const thunk = fetchConversations({});
        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          auth: { currentProfile: null, currentWorkspace: null },
        }));

        const result = await thunk(dispatch, getState, undefined);
        expect(result.type).toBe('conversations/fetchConversations/rejected');
        expect((result as any).error.message).toBe(
          'No workspace selected. Please select a workspace to continue.'
        );
      });
    });

    describe('fetchConversation', () => {
      it('should handle fetchConversation.pending', () => {
        const action = fetchConversation.pending('', '1');
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle fetchConversation.fulfilled', () => {
        const action = fetchConversation.fulfilled(mockConversation, '', '1');
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.currentConversation).toEqual(mockConversation);
      });

      it('should handle fetchConversation.rejected', () => {
        const action = fetchConversation.rejected(
          new Error('Failed to fetch'),
          '',
          '1'
        );
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to fetch');
      });
    });

    describe('fetchConversationMessages', () => {
      it('should handle fetchConversationMessages.pending', () => {
        const action = fetchConversationMessages.pending('', '1');
        const state = conversationsSlice(initialState, action);

        expect(state.messagesLoading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle fetchConversationMessages.fulfilled', () => {
        const action = fetchConversationMessages.fulfilled(
          mockMessages,
          '',
          '1'
        );
        const state = conversationsSlice(initialState, action);

        expect(state.messagesLoading).toBe(false);
        expect(state.currentMessages).toEqual(mockMessages);
      });

      it('should handle fetchConversationMessages.rejected', () => {
        const action = fetchConversationMessages.rejected(
          new Error('Failed to fetch'),
          '',
          '1'
        );
        const state = conversationsSlice(initialState, action);

        expect(state.messagesLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch');
      });
    });

    describe('saveConversation', () => {
      it('should handle saveConversation.pending', () => {
        const action = saveConversation.pending('', mockConversation);
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle saveConversation.fulfilled for new conversation', () => {
        const action = saveConversation.fulfilled(
          mockConversation,
          '',
          mockConversation
        );
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.items).toContain(mockConversation);
      });

      it('should handle saveConversation.fulfilled for existing conversation', () => {
        const stateWithItems = {
          ...initialState,
          items: [mockConversation],
        };

        const updatedConversation = {
          ...mockConversation,
          title: 'Updated Title',
        };

        const action = saveConversation.fulfilled(
          updatedConversation,
          '',
          updatedConversation
        );
        const state = conversationsSlice(stateWithItems, action);

        expect(state.loading).toBe(false);
        expect(state.items[0].title).toBe('Updated Title');
      });

      it('should handle saveConversation.rejected', () => {
        const action = saveConversation.rejected(
          new Error('Failed to save'),
          '',
          mockConversation
        );
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to save');
      });
    });

    describe('deleteConversation', () => {
      it('should handle deleteConversation.pending', () => {
        const action = deleteConversation.pending('', '1');
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle deleteConversation.fulfilled', () => {
        const stateWithItems = {
          ...initialState,
          items: [mockConversation],
          currentConversation: mockConversation,
          currentMessages: mockMessages,
        };

        const action = deleteConversation.fulfilled('1', '', '1');
        const state = conversationsSlice(stateWithItems, action);

        expect(state.loading).toBe(false);
        expect(state.items).toHaveLength(0);
        expect(state.currentConversation).toBeNull();
        expect(state.currentMessages).toHaveLength(0);
      });

      it('should handle deleteConversation.rejected', () => {
        const action = deleteConversation.rejected(
          new Error('Failed to delete'),
          '',
          '1'
        );
        const state = conversationsSlice(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to delete');
      });
    });

    describe('archiveConversation', () => {
      it('should handle archiveConversation.fulfilled', () => {
        const stateWithItems = {
          ...initialState,
          items: [mockConversation],
          currentConversation: mockConversation,
        };

        const archivedConversation = {
          ...mockConversation,
          isArchived: true,
        };

        const action = archiveConversation.fulfilled(
          archivedConversation,
          '',
          '1'
        );
        const state = conversationsSlice(stateWithItems, action);

        expect(state.items[0].isArchived).toBe(true);
        expect(state.currentConversation?.isArchived).toBe(true);
      });
    });

    describe('unarchiveConversation', () => {
      it('should handle unarchiveConversation.fulfilled', () => {
        const archivedConversation = {
          ...mockConversation,
          isArchived: true,
        };

        const stateWithItems = {
          ...initialState,
          items: [archivedConversation],
          currentConversation: archivedConversation,
        };

        const unarchivedConversation = {
          ...mockConversation,
          isArchived: false,
        };

        const action = unarchiveConversation.fulfilled(
          unarchivedConversation,
          '',
          '1'
        );
        const state = conversationsSlice(stateWithItems, action);

        expect(state.items[0].isArchived).toBe(false);
        expect(state.currentConversation?.isArchived).toBe(false);
      });
    });

    describe('toggleFavoriteConversation', () => {
      it('should handle toggleFavoriteConversation.fulfilled', () => {
        const stateWithItems = {
          ...initialState,
          items: [mockConversation],
          currentConversation: mockConversation,
        };

        const favoritedConversation = {
          ...mockConversation,
          isFavorite: true,
        };

        const action = toggleFavoriteConversation.fulfilled(
          favoritedConversation,
          '',
          '1'
        );
        const state = conversationsSlice(stateWithItems, action);

        expect(state.items[0].isFavorite).toBe(true);
        expect(state.currentConversation?.isFavorite).toBe(true);
      });
    });
  });
});
