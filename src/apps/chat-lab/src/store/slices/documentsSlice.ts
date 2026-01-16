import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DocumentsState } from '../../types';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

export const fetchDocuments = createAsyncThunk(
  'documents/fetchDocuments',
  async (profileId: string | undefined, { rejectWithValue }) => {
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
