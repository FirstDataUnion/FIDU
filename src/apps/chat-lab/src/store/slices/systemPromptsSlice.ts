import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { systemPromptsApi } from '../../services/api/systemPrompts';

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  isBuiltIn: boolean; // true for built-in system prompts, false for user-created
  category?: string;
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

// Built-in system prompts (these will always be available)
export const builtInSystemPrompts: SystemPrompt[] = [
  {
    id: 'sys-1',
    name: 'Technical Assistant',
    content: 'You are an expert technical assistant with deep knowledge of software development, architecture, and best practices. Provide clear, accurate, and actionable advice.',
    tokenCount: 42,
    isDefault: true,
    isBuiltIn: true,
    category: 'Technical',
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString()
  },
  {
    id: 'sys-2',
    name: 'Code Reviewer',
    content: 'You are a senior code reviewer. Analyze code for best practices, security vulnerabilities, performance issues, and maintainability. Provide specific, actionable feedback.',
    tokenCount: 38,
    isDefault: false,
    isBuiltIn: true,
    category: 'Development',
    createdAt: new Date('2024-01-12').toISOString(),
    updatedAt: new Date('2024-01-12').toISOString()
  }
];

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
        // Combine built-in system prompts with user-created ones
        state.items = [...builtInSystemPrompts, ...action.payload.systemPrompts];
      })
      .addCase(fetchSystemPrompts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch system prompts';
        // Even if API fails, we still have built-in prompts
        state.items = builtInSystemPrompts;
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

export const { 
  setSelectedSystemPrompt, 
  clearError
} = systemPromptsSlice.actions;

export default systemPromptsSlice.reducer;
