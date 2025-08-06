import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

import conversationsSlice from './slices/conversationsSlice';
import memoriesSlice from './slices/memoriesSlice';
import uiSlice from './slices/uiSlice';
import settingsSlice from './slices/settingsSlice';
import tagsSlice from './slices/tagsSlice';
import contextsSlice from './slices/contextsSlice';
import promptLabSlice from './slices/promptLabSlice';
import personasSlice from './slices/personasSlice';
import searchSlice from './slices/searchSlice';
import authSlice from './slices/authSlice';

export const store = configureStore({
  reducer: {
    conversations: conversationsSlice,
    memories: memoriesSlice,
    ui: uiSlice,
    settings: settingsSlice,
    tags: tagsSlice,
    contexts: contextsSlice,
    promptLab: promptLabSlice,
    personas: personasSlice,
    search: searchSlice,
    auth: authSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector; 