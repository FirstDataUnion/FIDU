import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type {
  FeatureFlagKey,
  UserFeatureFlagOverrides,
} from '../../types/featureFlags';

export interface UserFeatureFlagsState {
  userOverrides: UserFeatureFlagOverrides;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'fidu-chat-lab-feature-flag-overrides';

// Load user overrides from localStorage
const loadUserOverridesFromStorage = (): UserFeatureFlagOverrides => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate that parsed object has valid structure
      if (
        typeof parsed === 'object'
        && parsed !== null
        && !Array.isArray(parsed)
      ) {
        return parsed as UserFeatureFlagOverrides;
      }
    }
  } catch (error) {
    console.warn(
      'Failed to load user feature flag overrides from storage:',
      error
    );
  }
  return {};
};

// Save user overrides to localStorage
const saveUserOverridesToStorage = (
  overrides: UserFeatureFlagOverrides
): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn(
      'Failed to save user feature flag overrides to storage:',
      error
    );
  }
};

const getInitialState = (): UserFeatureFlagsState => ({
  userOverrides: loadUserOverridesFromStorage(),
  loading: false,
  error: null,
});

const userFeatureFlagsSlice = createSlice({
  name: 'userFeatureFlags',
  initialState: getInitialState,
  reducers: {
    setUserOverride: (
      state,
      action: PayloadAction<{ key: FeatureFlagKey; value: boolean | null }>
    ) => {
      const { key, value } = action.payload;
      if (value === null) {
        // Remove override
        const { [key]: _, ...rest } = state.userOverrides;
        state.userOverrides = rest;
      } else {
        // Set override
        state.userOverrides = { ...state.userOverrides, [key]: value };
      }
      // Persist to localStorage
      saveUserOverridesToStorage(state.userOverrides);
    },
    clearAllUserOverrides: state => {
      state.userOverrides = {};
      saveUserOverridesToStorage({});
    },
    loadUserOverrides: (
      state,
      action: PayloadAction<UserFeatureFlagOverrides>
    ) => {
      state.userOverrides = action.payload;
      saveUserOverridesToStorage(action.payload);
    },
    clearUserFeatureFlagError: state => {
      state.error = null;
    },
  },
});

export const {
  setUserOverride,
  clearAllUserOverrides,
  loadUserOverrides,
  clearUserFeatureFlagError,
} = userFeatureFlagsSlice.actions;

export default userFeatureFlagsSlice.reducer;
