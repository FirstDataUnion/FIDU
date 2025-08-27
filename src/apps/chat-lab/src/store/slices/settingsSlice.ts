import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserSettings, SettingsState } from '../../types';

// Simplified settings - only theme is needed
const defaultSettings: UserSettings = {
  id: 'default',
  theme: 'auto',
  language: 'en',
  autoExtractMemories: false, // Disabled since memories are removed
  notificationsEnabled: false, // Disabled since notifications are removed
  defaultPlatform: 'chatgpt',
  exportFormat: 'json',
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
};

// Load settings from localStorage
const loadSettingsFromStorage = (): UserSettings => {
  try {
    const stored = localStorage.getItem('fidu-chat-lab-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
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
  clearError,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer; 