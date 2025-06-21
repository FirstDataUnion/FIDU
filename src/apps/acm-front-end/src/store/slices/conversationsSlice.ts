import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Conversation, FilterOptions, ConversationsState } from '../../types';
import { conversationsApi } from '../../services/api/conversations';
import { dbService } from '../../services/database';

export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async ({ filters, page, limit }: { filters?: FilterOptions; page?: number; limit?: number }, { getState }) => {
    const state = getState() as { conversations: ConversationsState };
    const useApi = state.conversations.useApi;

    if (useApi) {
      return await conversationsApi.getAll(filters, page, limit);
    } else {
      const conversations = await dbService.getConversations(filters);
      return {
        conversations,
        total: conversations.length,
        page: page || 1,
        limit: limit || 20
      };
    }
  }
);

export const fetchConversation = createAsyncThunk(
  'conversations/fetchConversation',
  async (id: string, { getState }) => {
    const state = getState() as { conversations: ConversationsState };
    const useApi = state.conversations.useApi;

    if (useApi) {
      return await conversationsApi.getById(id);
    } else {
      return await dbService.getConversation(id);
    }
  }
);

export const fetchConversationMessages = createAsyncThunk(
  'conversations/fetchConversationMessages',
  async (conversationId: string, { getState }) => {
    console.log('fetchConversationMessages called with conversationId:', conversationId);
    const state = getState() as { conversations: ConversationsState };
    const useApi = state.conversations.useApi;
    console.log('Using API:', useApi, 'State useApi value:', state.conversations.useApi);

    if (useApi) {
      console.log('Fetching messages from API...');
      const messages = await conversationsApi.getMessages(conversationId);
      console.log('API messages result:', messages);
      return messages;
    } else {
      console.log('Fetching messages from local database...');
      const messages = await dbService.getMessages(conversationId);
      console.log('Database messages result:', messages);
      return messages;
    }
  }
);

export const saveConversation = createAsyncThunk(
  'conversations/saveConversation',
  async (conversation: Conversation, { getState }) => {
    const state = getState() as { conversations: ConversationsState };
    const useApi = state.conversations.useApi;

    if (useApi) {
      if (conversation.id) {
        return await conversationsApi.update(conversation.id, conversation);
      } else {
        return await conversationsApi.create(conversation);
      }
    } else {
      await dbService.saveConversation(conversation);
      return conversation;
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'conversations/deleteConversation',
  async (id: string, { getState }) => {
    const state = getState() as { conversations: ConversationsState };
    const useApi = state.conversations.useApi;

    if (useApi) {
      await conversationsApi.delete(id);
    } else {
      await dbService.deleteConversation(id);      
    }
    return id;
  }
);

export const archiveConversation = createAsyncThunk(
  'conversations/archiveConversation',
  async (id: string) => {
    return await conversationsApi.archive(id);
  }
);

export const unarchiveConversation = createAsyncThunk(
  'conversations/unarchiveConversation',
  async (id: string) => {
    return await conversationsApi.unarchive(id);
  }
);

export const toggleFavoriteConversation = createAsyncThunk(
  'conversations/toggleFavorite',
  async (id: string) => {
    return await conversationsApi.toggleFavorite(id);
  }
);

const initialState: ConversationsState = {
  items: [],
  currentConversation: null,
  currentMessages: [],
  messagesLoading: false,
  loading: false,
  error: null,
  useApi: false,
  filters: {
    searchQuery: '',
    platforms: [],
    tags: [],
    isArchived: undefined,
    isFavorite: undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  }
};

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearCurrentConversation: (state) => {
      state.currentConversation = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateConversationLocally: (state, action) => {
      const index = state.items.findIndex((c: Conversation) => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      if (state.currentConversation?.id === action.payload.id) {
        state.currentConversation = action.payload;
      }
    },
    toggleDataSource: (state) => {
      state.useApi = !state.useApi;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.conversations;
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total
        };
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Fetch single conversation
      .addCase(fetchConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.currentConversation = action.payload;
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch conversation';
      })
      // Fetch conversation messages
      .addCase(fetchConversationMessages.pending, (state) => {
        state.messagesLoading = true;
        state.error = null;
      })
      .addCase(fetchConversationMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.currentMessages = action.payload;
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.messagesLoading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      // Save conversation
      .addCase(saveConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveConversation.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((c: Conversation) => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        } else {
          state.items.push(action.payload);
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      .addCase(saveConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save conversation';
      })
      // Delete conversation
      .addCase(deleteConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((c: Conversation) => c.id !== action.payload);
        if (state.currentConversation?.id === action.payload) {
          state.currentConversation = null;
          state.currentMessages = [];
        }
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete conversation';
      })
      // Archive conversation
      .addCase(archiveConversation.fulfilled, (state, action) => {
        const index = state.items.findIndex((c: Conversation) => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Unarchive conversation
      .addCase(unarchiveConversation.fulfilled, (state, action) => {
        const index = state.items.findIndex((c: Conversation) => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Toggle favorite
      .addCase(toggleFavoriteConversation.fulfilled, (state, action) => {
        const index = state.items.findIndex((c: Conversation) => c.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      });
  }
});

export const {
  setFilters,
  clearFilters,
  setPagination,
  clearCurrentConversation,
  clearError,
  updateConversationLocally,
  toggleDataSource
} = conversationsSlice.actions;

export default conversationsSlice.reducer; 