import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type {
  Conversation,
  FilterOptions,
  ConversationsState,
  Message,
} from '../../types';
import { conversationsService } from '../../services/conversationsService';

export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async (
    {
      filters,
      page,
      limit,
    }: { filters?: FilterOptions; page?: number; limit?: number },
    { getState }
  ) => {
    const state = getState() as {
      auth: { currentProfile: { id: string } | null };
    };
    const profileId = state.auth.currentProfile?.id;
    if (!profileId) {
      throw new Error(
        'No profile selected. Please select a profile to continue.'
      );
    }
    return await conversationsService.getAll(filters, page, limit, profileId);
  }
);

export const fetchConversation = createAsyncThunk(
  'conversations/fetchConversation',
  async (id: string) => {
    return await conversationsService.getById(id);
  }
);

export const fetchConversationMessages = createAsyncThunk(
  'conversations/fetchConversationMessages',
  async (conversationId: string) => {
    const messages = await conversationsService.getMessages(conversationId);
    return messages;
  }
);

export const saveConversation = createAsyncThunk<Conversation, Conversation>(
  'conversations/saveConversation',
  async (conversation: Conversation) => {
    if (conversation.id) {
      return await conversationsService.updateConversation(
        conversation,
        [],
        conversation.originalPrompt
      );
    } else {
      // For new conversations, we need a profile ID - this should be handled by the caller
      throw new Error('Profile ID required for creating new conversations');
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'conversations/deleteConversation',
  async (id: string) => {
    await conversationsService.delete(id);
    return id;
  }
);

export const updateConversationWithMessages = createAsyncThunk<
  Conversation,
  {
    conversation: Partial<Conversation>;
    messages: Message[];
    originalPrompt?: Conversation['originalPrompt'];
  }
>(
  'conversations/updateConversationWithMessages',
  async ({ conversation, messages, originalPrompt }) => {
    return await conversationsService.updateConversation(
      conversation,
      messages,
      originalPrompt
    );
  }
);

export const archiveConversation = createAsyncThunk<Conversation, string>(
  'conversations/archiveConversation',
  async (id: string) => {
    return await conversationsService.archive(id);
  }
);

export const unarchiveConversation = createAsyncThunk<Conversation, string>(
  'conversations/unarchiveConversation',
  async (id: string) => {
    return await conversationsService.unarchive(id);
  }
);

export const toggleFavoriteConversation = createAsyncThunk<
  Conversation,
  string
>('conversations/toggleFavorite', async (id: string) => {
  return await conversationsService.toggleFavorite(id);
});

export const updateConversationTags = createAsyncThunk<
  Conversation,
  { id: string; tags: string[] }
>('conversations/updateTags', async ({ id, tags }) => {
  return await conversationsService.updateTags(id, tags);
});

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

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setFilters: (state, action: any) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: state => {
      state.filters = initialState.filters;
    },
    setPagination: (state, action: any) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearCurrentConversation: state => {
      state.currentConversation = null;
    },
    clearError: state => {
      state.error = null;
    },
    updateConversationLocally: (state, action: any) => {
      const index = state.items.findIndex(
        (c: Conversation) => c.id === action.payload.id
      );
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      if (state.currentConversation?.id === action.payload.id) {
        state.currentConversation = action.payload;
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action: any) => {
        state.loading = false;
        state.items = action.payload.conversations;
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
        };
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Fetch single conversation
      .addCase(fetchConversation.pending, state => {
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
      .addCase(fetchConversationMessages.pending, state => {
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
      .addCase(saveConversation.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveConversation.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
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
      // Update conversation with messages
      .addCase(updateConversationWithMessages.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateConversationWithMessages.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        } else {
          state.items.push(action.payload);
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      .addCase(updateConversationWithMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update conversation';
      })
      // Delete conversation
      .addCase(deleteConversation.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(
          (c: Conversation) => c.id !== action.payload
        );
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
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Unarchive conversation
      .addCase(unarchiveConversation.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Toggle favorite
      .addCase(toggleFavoriteConversation.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      // Update conversation tags
      .addCase(updateConversationTags.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateConversationTags.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(
          (c: Conversation) => c.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentConversation?.id === action.payload.id) {
          state.currentConversation = action.payload;
        }
      })
      .addCase(updateConversationTags.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message || 'Failed to update conversation tags';
      });
  },
});

export const {
  setFilters,
  clearFilters,
  setPagination,
  clearCurrentConversation,
  clearError,
  updateConversationLocally,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
