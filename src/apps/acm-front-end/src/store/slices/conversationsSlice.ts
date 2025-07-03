import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Conversation, FilterOptions, ConversationsState } from '../../types';
import { conversationsApi } from '../../services/api/conversations';

export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async ({ filters, page, limit }: { filters?: FilterOptions; page?: number; limit?: number }, { getState }) => {
    const state = getState() as { auth: { currentProfile: { id: string } | null } };
    const profileId = state.auth.currentProfile?.id;
    if (!profileId) {
      throw new Error('No profile selected. Please select a profile to continue.');
    }
    return await conversationsApi.getAll(filters, page, limit, profileId);
  }
);

export const fetchConversation = createAsyncThunk(
  'conversations/fetchConversation',
  async (id: string) => {
    return await conversationsApi.getById(id);
  }
);

export const fetchConversationMessages = createAsyncThunk(
  'conversations/fetchConversationMessages',
  async (conversationId: string) => {
    console.log('fetchConversationMessages called with conversationId:', conversationId);
    console.log('Fetching messages from API...');
    const messages = await conversationsApi.getMessages(conversationId);
    console.log('API messages result:', messages);
    return messages;
  }
);

export const saveConversation = createAsyncThunk(
  'conversations/saveConversation',
  async (conversation: Conversation) => {
    if (conversation.id) {
      return await conversationsApi.update(conversation.id, conversation);
    } else {
      return await conversationsApi.create(conversation);
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'conversations/deleteConversation',
  async (id: string) => {
    await conversationsApi.delete(id);
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
  updateConversationLocally
} = conversationsSlice.actions;

export default conversationsSlice.reducer; 