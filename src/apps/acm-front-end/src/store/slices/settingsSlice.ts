import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserSettings, SettingsState } from '../../types';
import { dbService } from '../../services/database';

// Default settings
const defaultSettings: UserSettings = {
  id: 'default',
  theme: 'auto',
  language: 'en',
  autoExtractMemories: true,
  notificationsEnabled: true,
  defaultPlatform: 'chatgpt',
  exportFormat: 'json',
  apiKeys: {
    nlpWorkbench: '',
  },
  privacySettings: {
    shareAnalytics: false,
    autoBackup: true,
    dataRetentionDays: 365,
  },
  displaySettings: {
    itemsPerPage: 20,
    showTimestamps: true,
    compactView: false,
    groupByDate: true,
  },
};

export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    const settings = await dbService.getSettings();
    return settings || defaultSettings;
  }
);

export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: UserSettings) => {
    await dbService.saveSettings(settings);
    return settings;
  }
);

const initialState: SettingsState = {
  settings: defaultSettings,
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettingsLocally: (state, action) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    updateTheme: (state, action) => {
      state.settings.theme = action.payload;
    },
    updateLanguage: (state, action) => {
      state.settings.language = action.payload;
    },
    toggleAutoExtractMemories: (state) => {
      state.settings.autoExtractMemories = !state.settings.autoExtractMemories;
    },
    toggleNotifications: (state) => {
      state.settings.notificationsEnabled = !state.settings.notificationsEnabled;
    },
    updatePrivacySettings: (state, action) => {
      state.settings.privacySettings = { ...state.settings.privacySettings, ...action.payload };
    },
    updateDisplaySettings: (state, action) => {
      state.settings.displaySettings = { ...state.settings.displaySettings, ...action.payload };
    },
    updateApiKeys: (state, action) => {
      state.settings.apiKeys = { ...state.settings.apiKeys, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    resetToDefaults: (state) => {
      state.settings = { ...defaultSettings };
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
  updateLanguage,
  toggleAutoExtractMemories,
  toggleNotifications,
  updatePrivacySettings,
  updateDisplaySettings,
  updateApiKeys,
  clearError,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer; 