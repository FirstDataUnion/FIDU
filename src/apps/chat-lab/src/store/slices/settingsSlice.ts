import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserSettings, SettingsState } from '../../types';
import { getEnvironmentInfo } from '../../utils/environment';

// Get default storage mode based on environment
const getDefaultStorageMode = (): 'local' | 'cloud' | 'filesystem' => {
  const envInfo = getEnvironmentInfo();
  // Always use environment storage mode if specified
  return envInfo.storageMode as 'local' | 'cloud' | 'filesystem' || 'local';
};

// Simplified settings - only theme is needed
const defaultSettings: UserSettings = {
  id: 'default',
  theme: 'auto',
  language: 'en',
  autoExtractMemories: false, // Disabled since memories are removed
  notificationsEnabled: false, // Disabled since notifications are removed
  defaultPlatform: 'chatgpt',
  exportFormat: 'json',
  lastUsedModel: 'gpt-5.0-nano', // Default to GPT-5.0 Nano
  storageMode: getDefaultStorageMode(), // Default based on environment
  storageConfigured: false, // Default to false for new users
  userSelectedStorageMode: false, // Track if user has made a selection from settings
  apiKeys: {
    nlpWorkbench: '',
  },
  privacySettings: {
    shareAnalytics: false,
    autoBackup: false, // Disabled since local storage is removed
    dataRetentionDays: 365,
  },
  displaySettings: {
    itemsPerPage: 20,
    showTimestamps: true,
    compactView: false,
    groupByDate: true,
  },
  syncSettings: {
    autoSyncDelayMinutes: 5, // Default 5 minutes delay
  },
};

// Load settings from localStorage
const loadSettingsFromStorage = (): UserSettings => {
  try {
    const stored = localStorage.getItem('fidu-chat-lab-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      const mergedSettings = { ...defaultSettings, ...parsed };
      
      // Always respect environment storage mode if it's set to 'local'
      // This prevents Google Drive auth when VITE_STORAGE_MODE=local
      const envInfo = getEnvironmentInfo();
      if (envInfo.storageMode === 'local') {
        mergedSettings.storageMode = 'local';
      }
      
      return mergedSettings;
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }
  return defaultSettings;
};

// Save settings to localStorage
const saveSettingsToStorage = (settings: UserSettings): void => {
  try {
    localStorage.setItem('fidu-chat-lab-settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    return loadSettingsFromStorage();
  }
);

export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: UserSettings) => {
    saveSettingsToStorage(settings);
    return settings;
  }
);

const initialState: SettingsState = {
  settings: loadSettingsFromStorage(),
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettingsLocally: (state, action) => {
      state.settings = { ...state.settings, ...action.payload };
      saveSettingsToStorage(state.settings);
    },
    updateTheme: (state, action) => {
      state.settings.theme = action.payload;
      saveSettingsToStorage(state.settings);
    },
    updateLastUsedModel: (state, action) => {
      state.settings.lastUsedModel = action.payload;
      saveSettingsToStorage(state.settings);
    },
    updateStorageMode: (state, action) => {
      state.settings.storageMode = action.payload;
      state.settings.userSelectedStorageMode = true; // Mark that user has made a selection
      saveSettingsToStorage(state.settings);
    },
    markStorageConfigured: (state) => {
      state.settings.storageConfigured = true;
      saveSettingsToStorage(state.settings);
    },
    resetStorageConfiguration: (state) => {
      state.settings.storageConfigured = false;
      saveSettingsToStorage(state.settings);
    },
    updateSyncDelay: (state, action) => {
      state.settings.syncSettings.autoSyncDelayMinutes = action.payload;
      saveSettingsToStorage(state.settings);
    },
    clearError: (state) => {
      state.error = null;
    },
    resetToDefaults: (state) => {
      state.settings = { ...defaultSettings };
      saveSettingsToStorage(state.settings);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch settings';
      })
      // Save settings
      .addCase(saveSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save settings';
      });
  },
});

export const {
  updateSettingsLocally,
  updateTheme,
  updateLastUsedModel,
  updateStorageMode,
  markStorageConfigured,
  resetStorageConfiguration,
  updateSyncDelay,
  clearError,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer; 