import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DocumentsState } from '../../types';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { store } from '../index';
import { selectIsFeatureFlagEnabled } from '../selectors/featureFlagsSelectors';

export const fetchDocuments = createAsyncThunk(
  'documents/fetchDocuments',
  async (profileId: string | undefined, { rejectWithValue }) => {
    // Check if documents feature flag is enabled
    const state = store.getState();
    const isDocumentsEnabled = selectIsFeatureFlagEnabled(state, 'documents');
    if (!isDocumentsEnabled) {
      console.log(
        '📄 [Documents] Fetch skipped - documents feature flag is disabled'
      );
      return rejectWithValue('Documents feature is disabled');
    }

    try {
      const storageService = getUnifiedStorageService();
      const response = await storageService.getDocuments(
        undefined,
        1,
        100,
        profileId
      );
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState: DocumentsState = {
  items: [],
  loading: false,
  error: null,
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchDocuments.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.documents;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      });
  },
});

export default documentsSlice.reducer;
