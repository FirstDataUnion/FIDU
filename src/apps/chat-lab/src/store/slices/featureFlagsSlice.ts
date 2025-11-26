import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { FeatureFlagsMap } from '../../types/featureFlags';
import { getFeatureFlags } from '../../services/featureFlags/FeatureFlagsService';

export interface FeatureFlagsState {
  flags: FeatureFlagsMap | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

const initialState: FeatureFlagsState = {
  flags: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
};

export const fetchFeatureFlags = createAsyncThunk<
  FeatureFlagsMap,
  void,
  { rejectValue: string }
>('featureFlags/fetchFeatureFlags', async (_, { rejectWithValue }) => {
  try {
    return await getFeatureFlags();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch feature flags';
    return rejectWithValue(message);
  }
});

const featureFlagsSlice = createSlice({
  name: 'featureFlags',
  initialState,
  reducers: {
    clearFeatureFlagError: (state) => {
      state.error = null;
    },
    hydrateFeatureFlags: (state, action: PayloadAction<FeatureFlagsMap>) => {
      state.flags = action.payload;
      state.lastFetchedAt = Date.now();
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeatureFlags.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFeatureFlags.fulfilled, (state, action) => {
        state.loading = false;
        state.flags = action.payload;
        state.error = null;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchFeatureFlags.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error.message ||
          'Failed to fetch feature flags';
      });
  },
});

export const { clearFeatureFlagError, hydrateFeatureFlags } =
  featureFlagsSlice.actions;

export default featureFlagsSlice.reducer;

