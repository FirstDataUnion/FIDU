import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { UserSettings, SettingsState } from '../../types';
import { getEnvironmentInfo } from '../../utils/environment';
import { getCookieSettingsService } from '../../services/settings/CookieSettingsService';

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
  lastUsedModel: 'auto-router', // Default to Auto Router
  storageMode: getDefaultStorageMode(), // Default based on environment
  storageConfigured: false, // Default to false for new users
  userSelectedStorageMode: false, // Track if user has made a selection from settings
  apiKeys: {
    nlpWorkbench: '',
  },
  privacySettings: {
    shareAnalytics: true, // Default to opted-in for anonymous metrics
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

// Load settings from cookies (primary) with localStorage fallback
const loadSettingsFromStorage = async (): Promise<UserSettings> => {
  try {
    // First try to load from HTTP-only cookies
    const cookieService = getCookieSettingsService();
    const cookieSettings = await cookieService.getSettingsWithRetry(1);
    
    if (cookieSettings) {
      console.log('✅ Loaded settings from HTTP-only cookies');
      
      // Validate and merge with defaults
      const mergedSettings = { ...defaultSettings, ...cookieSettings };
      
      // Always respect environment storage mode if it's set to 'local'
      const envInfo = getEnvironmentInfo();
      if (envInfo.storageMode === 'local') {
        mergedSettings.storageMode = 'local';
      }
      
      return mergedSettings;
    }
    
    // Fallback to localStorage for backward compatibility
    console.log('🔄 No cookie settings found, trying localStorage fallback...');
    const stored = localStorage.getItem('fidu-chat-lab-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      const mergedSettings = { ...defaultSettings, ...parsed };
      
      // Always respect environment storage mode if it's set to 'local'
      const envInfo = getEnvironmentInfo();
      if (envInfo.storageMode === 'local') {
        mergedSettings.storageMode = 'local';
      }
      
      // Migrate to cookies for future use
      const migrationResult = await cookieService.setSettings(mergedSettings);
      if (migrationResult.success) {
        console.log('✅ Migrated localStorage settings to cookies');
      } else if (migrationResult.reason === 'auth_unavailable') {
        console.log('ℹ️ Skipping cookie settings migration until authentication is available');
      } else {
        console.warn('⚠️ Failed to migrate settings to cookies:', migrationResult);
      }
      
      return mergedSettings;
    }
  } catch (error) {
    console.warn('Failed to load settings from storage:', error);
  }
  return defaultSettings;
};

/**
 * Create a plain object copy from Immer draft state
 * This prevents "proxy revoked" errors when serializing settings
 * Must be called synchronously within the reducer to avoid proxy revocation
 */
const createPlainSettingsCopy = (settings: UserSettings): UserSettings => {
  try {
    // Use structuredClone if available (modern browsers) - works with Immer proxies
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(settings);
    }
    // Fallback: manual deep copy for older browsers
    // This reads all properties synchronously before the proxy is revoked
    return {
      ...settings,
      apiKeys: { ...settings.apiKeys },
      privacySettings: { ...settings.privacySettings },
      displaySettings: { ...settings.displaySettings },
      syncSettings: { ...settings.syncSettings },
    };
  } catch (error) {
    // If structuredClone fails, try JSON fallback as last resort
    // This should work if current() provides a readable snapshot
    try {
      return JSON.parse(JSON.stringify(settings));
    } catch (jsonError) {
      console.error('Failed to create plain settings copy:', jsonError);
      // Return a safe fallback
      return { ...defaultSettings };
    }
  }
};

// Save settings to both cookies (primary) and localStorage (fallback)
const saveSettingsToStorage = async (settings: UserSettings): Promise<void> => {
  try {
    // Create a plain copy to avoid proxy issues
    const plainSettings = createPlainSettingsCopy(settings);
    
    // Primary: Save to HTTP-only cookies
    const cookieService = getCookieSettingsService();
    const cookieResult = await cookieService.setSettings(plainSettings);
    
    if (cookieResult.success) {
      console.log('✅ Settings saved to HTTP-only cookies');
    } else if (cookieResult.reason === 'auth_unavailable') {
      console.log('ℹ️ Unable to save settings to cookies yet (authentication not available); using localStorage fallback');
    } else {
      console.warn('⚠️ Failed to save settings to cookies, falling back to localStorage', cookieResult);
    }
    
    // Fallback: Also save to localStorage for backward compatibility
    localStorage.setItem('fidu-chat-lab-settings', JSON.stringify(plainSettings));
  } catch (error) {
    console.warn('Failed to save settings:', error);
    // Fallback to localStorage only
    try {
      const plainSettings = createPlainSettingsCopy(settings);
      localStorage.setItem('fidu-chat-lab-settings', JSON.stringify(plainSettings));
    } catch (localError) {
      console.error('Failed to save settings to localStorage:', localError);
    }
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
  settings: defaultSettings, // Will be loaded asynchronously
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettingsLocally: (state, action) => {
      state.settings = { ...state.settings, ...action.payload };
      // Save asynchronously without blocking the reducer
      // Create plain copy synchronously before reducer completes to avoid proxy revocation
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after update:', error)
      );
    },
    updateTheme: (state, action) => {
      state.settings.theme = action.payload;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after theme update:', error)
      );
    },
    updateLastUsedModel: (state, action) => {
      state.settings.lastUsedModel = action.payload;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after model update:', error)
      );
    },
    updateStorageMode: (state, action) => {
      state.settings.storageMode = action.payload;
      state.settings.userSelectedStorageMode = true; // Mark that user has made a selection
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after storage mode update:', error)
      );
    },
    markStorageConfigured: (state) => {
      state.settings.storageConfigured = true;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after marking configured:', error)
      );
    },
    resetStorageConfiguration: (state) => {
      state.settings.storageConfigured = false;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after reset configuration:', error)
      );
    },
    updateSyncDelay: (state, action) => {
      state.settings.syncSettings.autoSyncDelayMinutes = action.payload;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after sync delay update:', error)
      );
    },
    updateShareAnalytics: (state, action) => {
      state.settings.privacySettings.shareAnalytics = action.payload;
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after analytics update:', error)
      );
    },
    clearError: (state) => {
      state.error = null;
    },
    resetToDefaults: (state) => {
      state.settings = { ...defaultSettings };
      const plainSettings = createPlainSettingsCopy(state.settings);
      saveSettingsToStorage(plainSettings).catch(error => 
        console.warn('Failed to save settings after reset to defaults:', error)
      );
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
  updateShareAnalytics,
  clearError,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer; 