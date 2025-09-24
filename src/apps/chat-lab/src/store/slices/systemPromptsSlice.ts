import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { systemPromptsApi } from '../../services/api/systemPrompts';
import { fabricSystemPrompts } from '../../data/prompts/fabricSystemPrompts';
import { builtInSystemPrompts } from '../../data/prompts/builtInSystemPrompts';

export interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  isBuiltIn: boolean; // true for built-in system prompts, false for user-created
  source?: 'fabric' | 'built-in' | 'user'; // source of the system prompt
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemPromptsState {
  items: SystemPrompt[];
  loading: boolean;
  error: string | null;
  selectedSystemPrompt: SystemPrompt | null;
}

const initialState: SystemPromptsState = {
  items: [],
  loading: false,
  error: null,
  selectedSystemPrompt: null,
};

// Built-in system prompts are now imported from builtInSystemPrompts.ts

// Async actions
export const fetchSystemPrompts = createAsyncThunk(
  'systemPrompts/fetchSystemPrompts',
  async (profileId?: string) => {
    if (profileId) {
      const response = await systemPromptsApi.getAll(undefined, 1, 100, profileId);
      return response;
    }
    return { systemPrompts: [], total: 0, page: 1, limit: 100 };
  }
);

export const createSystemPrompt = createAsyncThunk(
  'systemPrompts/createSystemPrompt',
  async ({ systemPromptData, profileId }: { systemPromptData: Partial<SystemPrompt>; profileId: string }) => {
    const newSystemPrompt = await systemPromptsApi.createSystemPrompt(systemPromptData, profileId);
    return newSystemPrompt;
  }
);

export const updateSystemPrompt = createAsyncThunk(
  'systemPrompts/updateSystemPrompt',
  async ({ systemPrompt, profileId }: { systemPrompt: Partial<SystemPrompt>; profileId: string }) => {
    const updatedSystemPrompt = await systemPromptsApi.updateSystemPrompt(systemPrompt, profileId);
    return updatedSystemPrompt;
  }
);

export const deleteSystemPrompt = createAsyncThunk(
  'systemPrompts/deleteSystemPrompt',
  async (systemPromptId: string) => {
    await systemPromptsApi.deleteSystemPrompt(systemPromptId);
    return systemPromptId;
  }
);

const systemPromptsSlice = createSlice({
  name: 'systemPrompts',
  initialState,
  reducers: {
    setSelectedSystemPrompt: (state, action: PayloadAction<SystemPrompt | null>) => {
      state.selectedSystemPrompt = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemPrompts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemPrompts.fulfilled, (state, action) => {
        state.loading = false;
        // Combine built-in system prompts, Fabric patterns, and user-created ones
        state.items = [...builtInSystemPrompts, ...fabricSystemPrompts, ...action.payload.systemPrompts] as SystemPrompt[];
      })
      .addCase(fetchSystemPrompts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch system prompts';
        // Even if API fails, we still have built-in prompts and Fabric patterns
        state.items = [...builtInSystemPrompts, ...fabricSystemPrompts] as SystemPrompt[];
      })
      .addCase(createSystemPrompt.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateSystemPrompt.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteSystemPrompt.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      });
  },
});

// Helper functions for filtering system prompts
export const getFabricSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'fabric');

export const getBuiltInSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'built-in');

export const getUserSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'user' || !prompt.source);

export const getSystemPromptsByCategory = (state: SystemPromptsState, category: string) => 
  state.items.filter(prompt => prompt.categories.includes(category));

export const getAllCategories = (state: SystemPromptsState) => 
  [...new Set(state.items.flatMap(prompt => prompt.categories))].sort();

export const { 
  setSelectedSystemPrompt, 
  clearError
} = systemPromptsSlice.actions;

export default systemPromptsSlice.reducer;
