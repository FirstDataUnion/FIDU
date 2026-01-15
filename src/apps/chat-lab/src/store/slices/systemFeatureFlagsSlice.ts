import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { FeatureFlagsMap } from '../../types/featureFlags';
import { getFeatureFlags } from '../../services/featureFlags/FeatureFlagsService';

export interface SystemFeatureFlagsState {
  flags: FeatureFlagsMap | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

const initialState: SystemFeatureFlagsState = {
  flags: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
};

export const fetchSystemFeatureFlags = createAsyncThunk<
  FeatureFlagsMap,
  void,
  { rejectValue: string }
>(
  'systemFeatureFlags/fetchSystemFeatureFlags',
  async (_, { rejectWithValue }) => {
    try {
      return await getFeatureFlags();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch feature flags';
      return rejectWithValue(message);
    }
  }
);

const systemFeatureFlagsSlice = createSlice({
  name: 'systemFeatureFlags',
  initialState,
  reducers: {
    clearSystemFeatureFlagError: state => {
      state.error = null;
    },
    hydrateSystemFeatureFlags: (
      state,
      action: PayloadAction<FeatureFlagsMap>
    ) => {
      state.flags = action.payload;
      state.lastFetchedAt = Date.now();
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchSystemFeatureFlags.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemFeatureFlags.fulfilled, (state, action) => {
        state.loading = false;
        state.flags = action.payload;
        state.error = null;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchSystemFeatureFlags.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload
          || action.error.message
          || 'Failed to fetch feature flags';
      });
  },
});

export const { clearSystemFeatureFlagError, hydrateSystemFeatureFlags } =
  systemFeatureFlagsSlice.actions;

export default systemFeatureFlagsSlice.reducer;
