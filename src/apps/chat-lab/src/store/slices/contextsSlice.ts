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
export const builtInContexts: Context[] = [
  {
    id: 'ctx-builtin-1',
    title: 'React Development Patterns',
    body: 'Best practices and patterns for React development including hooks, state management, and performance optimization. Covers modern React patterns, custom hooks, context API, and performance best practices.',
    tokenCount: 45,
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString(),
    isBuiltIn: true,
    tags: ['react', 'development', 'patterns'],
    conversationIds: [],
    conversationMetadata: {
      totalMessages: 0,
      lastAddedAt: new Date('2024-01-10').toISOString(),
      platforms: []
    }
  },
  {
    id: 'ctx-builtin-2',
    title: 'API Design Guidelines',
    body: 'RESTful API design principles, GraphQL patterns, authentication strategies, and best practices for building scalable and maintainable APIs.',
    tokenCount: 32,
    createdAt: new Date('2024-01-12').toISOString(),
    updatedAt: new Date('2024-01-12').toISOString(),
    isBuiltIn: true,
    tags: ['api', 'design', 'rest', 'graphql'],
    conversationIds: [],
    conversationMetadata: {
      totalMessages: 0,
      lastAddedAt: new Date('2024-01-12').toISOString(),
      platforms: []
    }
  },
  {
    id: 'ctx-builtin-3',
    title: 'Software Architecture Principles',
    body: 'Core principles of software architecture including SOLID principles, design patterns, microservices, and architectural decision making.',
    tokenCount: 38,
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString(),
    isBuiltIn: true,
    tags: ['architecture', 'design-patterns', 'principles'],
    conversationIds: [],
    conversationMetadata: {
      totalMessages: 0,
      lastAddedAt: new Date('2024-01-15').toISOString(),
      platforms: []
    }
  }
];

const initialState: ContextsState = {
  items: builtInContexts,
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