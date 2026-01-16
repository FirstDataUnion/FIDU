import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

import conversationsSlice from './slices/conversationsSlice';
import uiSlice from './slices/uiSlice';
import settingsSlice from './slices/settingsSlice';
import contextsSlice from './slices/contextsSlice';
import documentsSlice from './slices/documentsSlice';
import systemPromptsSlice from './slices/systemPromptsSlice';
import promptLabSlice from './slices/promptLabSlice';
import searchSlice from './slices/searchSlice';
import authSlice from './slices/authSlice';
import unifiedStorageSlice from './slices/unifiedStorageSlice';
import googleDriveAuthSlice from './slices/googleDriveAuthSlice';
import userFeatureFlagsSlice from './slices/userFeatureFlagsSlice';
import systemFeatureFlagsSlice from './slices/systemFeatureFlagsSlice';

export const store = configureStore({
  reducer: {
    conversations: conversationsSlice,
    ui: uiSlice,
    settings: settingsSlice,
    contexts: contextsSlice,
    documents: documentsSlice,
    systemPrompts: systemPromptsSlice,
    promptLab: promptLabSlice,
    search: searchSlice,
    auth: authSlice,
    unifiedStorage: unifiedStorageSlice,
    googleDriveAuth: googleDriveAuthSlice,
    systemFeatureFlags: systemFeatureFlagsSlice,
    userFeatureFlags: userFeatureFlagsSlice,
  },
  middleware: getDefaultMiddleware =>
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
