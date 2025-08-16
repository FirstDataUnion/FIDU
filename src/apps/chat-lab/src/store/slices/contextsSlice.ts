import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { contextsApi } from '../../services/api/contexts';

export interface Context {
  id: string;
  title: string;
  body: string;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
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

const initialState: ContextsState = {
  items: [],
  loading: false,
  error: null,
  selectedContext: null,
};



// Async actions
export const fetchContexts = createAsyncThunk(
  'contexts/fetchContexts',
  async (profileId?: string) => {
    const response = await contextsApi.getAll(undefined, 1, 100, profileId);
    return response;
  }
);

export const createContext = createAsyncThunk(
  'contexts/createContext',
  async ({ contextData, profileId }: { contextData: Partial<Context>; profileId: string }) => {
    const newContext = await contextsApi.createContext(contextData, profileId);
    return newContext;
  }
);

export const updateContext = createAsyncThunk(
  'contexts/updateContext',
  async ({ context, profileId }: { context: Partial<Context>; profileId: string }) => {
    const updatedContext = await contextsApi.updateContext(context, profileId);
    return updatedContext;
  }
);

export const deleteContext = createAsyncThunk(
  'contexts/deleteContext',
  async (contextId: string) => {
    await contextsApi.deleteContext(contextId);
    return contextId;
  }
);

export const addConversationToContext = createAsyncThunk(
  'contexts/addConversationToContext',
  async ({ contextId, conversationId, conversationData, profileId }: { 
    contextId: string; 
    conversationId: string; 
    conversationData: { title: string; messages: any[]; platform: string };
    profileId: string;
  }) => {
    // Get the current context to update it
    const contextsResponse = await contextsApi.getAll(profileId);
    const currentContext = contextsResponse.contexts.find(c => c.id === contextId);
    
    if (!currentContext) {
      throw new Error('Context not found');
    }
    
    // Prepare the updated context data
    const updatedContext = {
      ...currentContext,
      body: currentContext.body + `\n\n--- Conversation: ${conversationData.title} ---\n${
        conversationData.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
      }`,
      conversationIds: [...(currentContext.conversationIds || []), conversationId],
      conversationMetadata: {
        totalMessages: (currentContext.conversationMetadata?.totalMessages || 0) + conversationData.messages.length,
        lastAddedAt: new Date().toISOString(),
        platforms: [...(currentContext.conversationMetadata?.platforms || []), conversationData.platform]
      },
      updatedAt: new Date().toISOString()
    };
    
    // Update the context in FIDU Vault
    const updatedContextResponse = await contextsApi.updateContext(updatedContext, profileId);
    
    // Return the updated context data
    return { contextId, conversationId, conversationData, updatedContext: updatedContextResponse };
  }
);

const contextsSlice = createSlice({
  name: 'contexts',
  initialState,
  reducers: {
    setSelectedContext: (state, action: PayloadAction<Context | null>) => {
      state.selectedContext = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },

  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContexts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContexts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.contexts;
      })
      .addCase(fetchContexts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contexts';
      })
      .addCase(createContext.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateContext.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
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
          const index = state.items.findIndex(item => item.id === action.payload.contextId);
          if (index !== -1) {
            state.items[index] = action.payload.updatedContext;
          }
        }
      });
  },
});

export const { 
  setSelectedContext, 
  clearError
} = contextsSlice.actions;

export default contextsSlice.reducer; 