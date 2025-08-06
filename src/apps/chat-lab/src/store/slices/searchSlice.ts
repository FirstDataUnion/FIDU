import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SearchState, SearchResult } from '../../types';

const initialState: SearchState = {
  query: '',
  results: [],
  loading: false,
  filters: {
    types: ['conversation', 'message', 'memory'],
  },
  suggestions: [],
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    setResults: (state, action: PayloadAction<SearchResult[]>) => {
      state.results = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<SearchState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSuggestions: (state, action: PayloadAction<string[]>) => {
      state.suggestions = action.payload;
    },
    clearSearch: (state) => {
      state.query = '';
      state.results = [];
      state.loading = false;
    },
  },
});

export const {
  setQuery,
  setResults,
  setLoading,
  setFilters,
  setSuggestions,
  clearSearch,
} = searchSlice.actions;

export default searchSlice.reducer; 