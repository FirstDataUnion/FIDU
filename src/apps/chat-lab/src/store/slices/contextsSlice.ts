import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { store } from '../index';
import { selectIsFeatureFlagEnabled } from '../selectors/featureFlagsSelectors';

export interface Context {
  id: string;
  title: string;
  body: string;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isBuiltIn: boolean;
  // Conversation references for building context over time
  conversationIds?: string[];
  // Metadata about conversations in this context
  conversationMetadata?: {
    totalMessages: number;
    lastAddedAt: string;
    platforms: string[];
  };
}

export interface ContextsState {
  items: Context[];
  loading: boolean;
  error: string | null;
  selectedContext: Context | null;
}

// Built-in contexts (these will always be available)
export const builtInContexts: Context[] = [];

const initialState: ContextsState = {
  items: builtInContexts,
  loading: false,
  error: null,
  selectedContext: null,
};

// Async actions
export const fetchContexts = createAsyncThunk(
  'contexts/fetchContexts',
  async (profileId: string | undefined, { rejectWithValue }) => {
    // Check if contexts feature flag is enabled
    const state = store.getState();
    const isContextsEnabled = selectIsFeatureFlagEnabled(state, 'context');
    if (!isContextsEnabled) {
      console.log(
        '📋 [Contexts] Fetch skipped - contexts feature flag is disabled'
      );
      return rejectWithValue('Contexts feature is disabled');
    }

    try {
      const storageService = getUnifiedStorageService();
      const response = await storageService.getContexts(
        undefined,
        1,
        100,
        profileId
      );
      return response;
    } catch (error: any) {
      // Check if this is a storage init error and handle gracefully
      if (
        error.message?.includes('Cloud storage adapter not initialized')
        || error.message?.includes('Cloud storage not fully initialized')
      ) {
        console.warn(
          'Storage adapter not ready yet, will retry later:',
          error.message
        );
        return rejectWithValue('Storage not ready, retrying...');
      }
      console.error('Failed to fetch contexts using unified storage:', error);
      throw error;
    }
  }
);

export const createContext = createAsyncThunk(
  'contexts/createContext',
  async (
    {
      contextData,
      profileId,
    }: {
      contextData: Partial<Context>;
      profileId: string;
    },
    { rejectWithValue }
  ) => {
    // Check if contexts feature flag is enabled
    const state = store.getState();
    const isContextsEnabled = selectIsFeatureFlagEnabled(state, 'context');
    if (!isContextsEnabled) {
      console.log(
        '📋 [Contexts] Create skipped - contexts feature flag is disabled'
      );
      return rejectWithValue('Contexts feature is disabled');
    }

    try {
      const storageService = getUnifiedStorageService();
      const newContext = await storageService.createContext(
        contextData,
        profileId
      );
      return newContext;
    } catch (error: any) {
      console.error('Failed to create context using unified storage:', error);
      throw error;
    }
  }
);

export const updateContext = createAsyncThunk(
  'contexts/updateContext',
  async (
    {
      context,
      profileId,
    }: {
      context: Partial<Context>;
      profileId: string;
    },
    { rejectWithValue }
  ) => {
    // Check if contexts feature flag is enabled
    const state = store.getState();
    const isContextsEnabled = selectIsFeatureFlagEnabled(state, 'context');
    if (!isContextsEnabled) {
      console.log(
        '📋 [Contexts] Update skipped - contexts feature flag is disabled'
      );
      return rejectWithValue('Contexts feature is disabled');
    }

    try {
      const storageService = getUnifiedStorageService();
      const updatedContext = await storageService.updateContext(
        context,
        profileId
      );
      return updatedContext;
    } catch (error: any) {
      console.error('Failed to update context using unified storage:', error);
      throw error;
    }
  }
);

export const deleteContext = createAsyncThunk(
  'contexts/deleteContext',
  async (contextId: string, { rejectWithValue }) => {
    // Check if contexts feature flag is enabled
    const state = store.getState();
    const isContextsEnabled = selectIsFeatureFlagEnabled(state, 'context');
    if (!isContextsEnabled) {
      console.log(
        '📋 [Contexts] Delete skipped - contexts feature flag is disabled'
      );
      return rejectWithValue('Contexts feature is disabled');
    }

    try {
      const storageService = getUnifiedStorageService();
      await storageService.deleteContext(contextId);
      return contextId;
    } catch (error: any) {
      console.error('Failed to delete context using unified storage:', error);
      throw error;
    }
  }
);

export const addConversationToContext = createAsyncThunk(
  'contexts/addConversationToContext',
  async (
    {
      contextId,
      conversationId,
      conversationData,
      profileId,
    }: {
      contextId: string;
      conversationId: string;
      conversationData: { title: string; messages: any[]; platform: string };
      profileId: string;
    },
    { rejectWithValue }
  ) => {
    // Check if contexts feature flag is enabled
    const state = store.getState();
    const isContextsEnabled = selectIsFeatureFlagEnabled(state, 'context');
    if (!isContextsEnabled) {
      console.log(
        '📋 [Contexts] Add conversation skipped - contexts feature flag is disabled'
      );
      return rejectWithValue('Contexts feature is disabled');
    }

    // Get the current context to update it
    const storageService = getUnifiedStorageService();
    const contextsResponse = await storageService.getContexts(
      undefined,
      1,
      100,
      profileId
    );
    const currentContext = contextsResponse.contexts.find(
      (c: any) => c.id === contextId
    );

    if (!currentContext) {
      throw new Error('Context not found');
    }

    // Prepare the updated context data
    const updatedContext = {
      ...currentContext,
      body:
        currentContext.body
        + `\n\n--- Conversation: ${conversationData.title} ---\n${conversationData.messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n\n')}`,
      conversationIds: [
        ...(currentContext.conversationIds || []),
        conversationId,
      ],
      conversationMetadata: {
        totalMessages:
          (currentContext.conversationMetadata?.totalMessages || 0)
          + conversationData.messages.length,
        lastAddedAt: new Date().toISOString(),
        platforms: [
          ...(currentContext.conversationMetadata?.platforms || []),
          conversationData.platform,
        ],
      },
      updatedAt: new Date().toISOString(),
    };

    // Update the context using unified storage
    const updatedContextResponse = await storageService.updateContext(
      updatedContext,
      profileId
    );

    // Return the updated context data
    return {
      contextId,
      conversationId,
      conversationData,
      updatedContext: updatedContextResponse,
    };
  }
);

const contextsSlice = createSlice({
  name: 'contexts',
  initialState,
  reducers: {
    setSelectedContext: (state, action: PayloadAction<Context | null>) => {
      state.selectedContext = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchContexts.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContexts.fulfilled, (state, action) => {
        state.loading = false;
        // Combine built-in contexts with user-created ones
        state.items = [...builtInContexts, ...action.payload.contexts];
      })
      .addCase(fetchContexts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contexts';
        // Even if API fails, we still have built-in contexts
        state.items = builtInContexts;
      })
      .addCase(createContext.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateContext.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          item => item.id === action.payload.id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteContext.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      })
      .addCase(addConversationToContext.fulfilled, (state, action) => {
        // Update the context in the store with the updated context from FIDU Vault
        if (action.payload.updatedContext) {
          const index = state.items.findIndex(
            item => item.id === action.payload.contextId
          );
          if (index !== -1) {
            state.items[index] = action.payload.updatedContext;
          }
        }
      });
  },
});

export const { setSelectedContext, clearError } = contextsSlice.actions;

export default contextsSlice.reducer;
