import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Tag, TagsState } from '../../types';
import { dbService } from '../../services/database';

export const fetchTags = createAsyncThunk(
  'tags/fetchTags',
  async () => {
    return await dbService.getTags();
  }
);

export const saveTag = createAsyncThunk(
  'tags/saveTag',
  async (tag: Tag) => {
    await dbService.saveTag(tag);
    return tag;
  }
);

export const deleteTag = createAsyncThunk(
  'tags/deleteTag',
  async (id: string) => {
    await dbService.deleteTag(id);
    return id;
  }
);

const initialState: TagsState = {
  items: [],
  loading: false,
  error: null
};

const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateTagLocally: (state, action) => {
      const index = state.items.findIndex((t: Tag) => t.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    incrementTagUsage: (state, action) => {
      const tag = state.items.find((t: Tag) => t.name === action.payload);
      if (tag) {
        tag.usageCount++;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tags
      .addCase(fetchTags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch tags';
      })
      // Save tag
      .addCase(saveTag.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveTag.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((t: Tag) => t.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        } else {
          state.items.push(action.payload);
        }
      })
      .addCase(saveTag.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save tag';
      })
      // Delete tag
      .addCase(deleteTag.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTag.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((t: Tag) => t.id !== action.payload);
      })
      .addCase(deleteTag.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete tag';
      });
  }
});

export const {
  clearError,
  updateTagLocally,
  incrementTagUsage
} = tagsSlice.actions;

export default tagsSlice.reducer; 