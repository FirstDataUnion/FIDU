import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Memory, MemoriesState } from '../../types';
import { dbService } from '../../services/database';

export const fetchMemories = createAsyncThunk(
  'memories/fetchMemories',
  async (filters?: { types?: string[]; importance?: string[]; tags?: string[]; searchQuery?: string }) => {
    return await dbService.getMemories(filters);
  }
);

export const saveMemory = createAsyncThunk(
  'memories/saveMemory',
  async (memory: Memory) => {
    await dbService.saveMemory(memory);
    return memory;
  }
);

export const deleteMemory = createAsyncThunk(
  'memories/deleteMemory',
  async (id: string) => {
    await dbService.deleteMemory(id);
    return id;
  }
);

const initialState: MemoriesState = {
  items: [],
  loading: false,
  error: null,
  filters: {
    types: [],
    importance: [],
    tags: [],
    searchQuery: ''
  }
};

const memoriesSlice = createSlice({
  name: 'memories',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateMemoryLocally: (state, action) => {
      const index = state.items.findIndex((m: Memory) => m.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch memories
      .addCase(fetchMemories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemories.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchMemories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch memories';
      })
      // Save memory
      .addCase(saveMemory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveMemory.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((m: Memory) => m.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        } else {
          state.items.push(action.payload);
        }
      })
      .addCase(saveMemory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save memory';
      })
      // Delete memory
      .addCase(deleteMemory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteMemory.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((m: Memory) => m.id !== action.payload);
      })
      .addCase(deleteMemory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete memory';
      });
  }
});

export const {
  setFilters,
  clearFilters,
  clearError,
  updateMemoryLocally
} = memoriesSlice.actions;

export default memoriesSlice.reducer; 