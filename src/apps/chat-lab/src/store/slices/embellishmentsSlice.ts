import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { embellishmentsApi } from '../../services/api/embellishments';
import { availableEmbellishments } from '../../utils/embellishments';
import type { Embellishment } from '../../types';

export interface EmbellishmentsState {
  items: Embellishment[];
  loading: boolean;
  error: string | null;
  selectedEmbellishments: Embellishment[];
}

const initialState: EmbellishmentsState = {
  items: availableEmbellishments, // Start with built-in embellishments
  loading: false,
  error: null,
  selectedEmbellishments: [],
};

// Async actions
export const fetchEmbellishments = createAsyncThunk(
  'embellishments/fetchEmbellishments',
  async (profileId?: string) => {
    const response = await embellishmentsApi.getAll(undefined, 1, 100, profileId);
    return response;
  }
);

export const createEmbellishment = createAsyncThunk(
  'embellishments/createEmbellishment',
  async ({ embellishmentData, profileId }: { embellishmentData: Omit<Embellishment, 'id' | 'createdAt' | 'updatedAt'>; profileId: string }) => {
    const newEmbellishment = await embellishmentsApi.create(embellishmentData, profileId);
    return newEmbellishment;
  }
);

export const updateEmbellishment = createAsyncThunk(
  'embellishments/updateEmbellishment',
  async ({ id, updates, profileId }: { id: string; updates: Partial<Embellishment>; profileId: string }) => {
    const updatedEmbellishment = await embellishmentsApi.update(id, updates, profileId);
    return updatedEmbellishment;
  }
);

export const deleteEmbellishment = createAsyncThunk(
  'embellishments/deleteEmbellishment',
  async (id: string) => {
    await embellishmentsApi.delete(id);
    return id;
  }
);

const embellishmentsSlice = createSlice({
  name: 'embellishments',
  initialState,
  reducers: {
    setSelectedEmbellishments: (state, action: PayloadAction<Embellishment[]>) => {
      state.selectedEmbellishments = action.payload;
    },
    addSelectedEmbellishment: (state, action: PayloadAction<Embellishment>) => {
      if (!state.selectedEmbellishments.find(emb => emb.id === action.payload.id)) {
        state.selectedEmbellishments.push(action.payload);
      }
    },
    removeSelectedEmbellishment: (state, action: PayloadAction<string>) => {
      state.selectedEmbellishments = state.selectedEmbellishments.filter(emb => emb.id !== action.payload);
    },
    clearSelectedEmbellishments: (state) => {
      state.selectedEmbellishments = [];
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch embellishments
      .addCase(fetchEmbellishments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmbellishments.fulfilled, (state, action) => {
        state.loading = false;
        // Combine built-in and custom embellishments
        const customEmbellishments = action.payload.embellishments;
        state.items = [...availableEmbellishments, ...customEmbellishments];
      })
      .addCase(fetchEmbellishments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch embellishments';
      })
      
      // Create embellishment
      .addCase(createEmbellishment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEmbellishment.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createEmbellishment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create embellishment';
      })
      
      // Update embellishment
      .addCase(updateEmbellishment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateEmbellishment.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(emb => emb.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateEmbellishment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update embellishment';
      })
      
      // Delete embellishment
      .addCase(deleteEmbellishment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteEmbellishment.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(emb => emb.id !== action.payload);
        // Also remove from selected if it was selected
        state.selectedEmbellishments = state.selectedEmbellishments.filter(emb => emb.id !== action.payload);
      })
      .addCase(deleteEmbellishment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete embellishment';
      });
  },
});

export const {
  setSelectedEmbellishments,
  addSelectedEmbellishment,
  removeSelectedEmbellishment,
  clearSelectedEmbellishments,
  setError,
  clearError
} = embellishmentsSlice.actions;

export default embellishmentsSlice.reducer;
