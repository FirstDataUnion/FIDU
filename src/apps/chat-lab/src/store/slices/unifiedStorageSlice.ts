import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { getEnvironmentInfo } from '../../utils/environment';
import type { GoogleDriveUser } from '../../types';

// Unified storage state interface
export interface UnifiedStorageState {
  // Core storage configuration
  mode: 'local' | 'cloud' | 'filesystem';
  status: 'unconfigured' | 'configuring' | 'configured' | 'error';
  userSelectedMode: boolean; // Whether user has made a selection from settings page
  
  // Google Drive specific state
  googleDrive: {
    isAuthenticated: boolean;
    user: GoogleDriveUser | null;
    isLoading: boolean;
    error: string | null;
    showAuthModal: boolean;
    expiresAt: number | null;
  };
  
  // File system specific state
  filesystem: {
    isAccessible: boolean;
    directoryName: string | null;
    permissionState: 'granted' | 'denied' | 'prompt' | 'checking';
  };
  
  // General state
  isLoading: boolean;
  error: string | null;
}

// Get default storage mode based on environment
const getDefaultStorageMode = (): 'local' | 'cloud' | 'filesystem' => {
  const envInfo = getEnvironmentInfo();
  // Always use environment storage mode if specified
  return envInfo.storageMode as 'local' | 'cloud' | 'filesystem' || 'local';
};

// Load settings from localStorage for backward compatibility
const loadLegacySettings = (): Partial<UnifiedStorageState> => {
  try {
    const stored = localStorage.getItem('fidu-chat-lab-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Map legacy settings to new unified state
      const result: Partial<UnifiedStorageState> = {};
      
      if (parsed.storageMode) {
        result.mode = parsed.storageMode;
      }
      
      if (parsed.storageConfigured !== undefined) {
        result.status = parsed.storageConfigured ? 'configured' : 'unconfigured';
      }
      
      if (parsed.userSelectedStorageMode !== undefined) {
        result.userSelectedMode = parsed.userSelectedStorageMode;
      } else if (parsed.storageConfigured === true) {
        // If storage was configured in legacy system, user had made a selection
        result.userSelectedMode = true;
      }
      
      return result;
    }
  } catch (error) {
    console.warn('Failed to load legacy settings from localStorage:', error);
  }
  return {};
};

// Save unified state to localStorage (maintaining backward compatibility)
const saveUnifiedStateToStorage = (state: UnifiedStorageState): void => {
  try {
    // Load existing settings to preserve non-storage fields
    const existing = localStorage.getItem('fidu-chat-lab-settings');
    let existingSettings = {};
    
    if (existing) {
      existingSettings = JSON.parse(existing);
    }
    
    // Update only storage-related fields
    const updatedSettings = {
      ...existingSettings,
      storageMode: state.mode,
      storageConfigured: state.status === 'configured',
      userSelectedStorageMode: state.userSelectedMode,
    };
    
    localStorage.setItem('fidu-chat-lab-settings', JSON.stringify(updatedSettings));
  } catch (error) {
    console.warn('Failed to save unified storage state to localStorage:', error);
  }
};

// Initial state
const initialState: UnifiedStorageState = {
  mode: getDefaultStorageMode(),
  status: 'unconfigured',
  userSelectedMode: false,
  googleDrive: {
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null,
    showAuthModal: false,
    expiresAt: null,
  },
  filesystem: {
    isAccessible: false,
    directoryName: null,
    permissionState: 'checking',
  },
  isLoading: false,
  error: null,
  // Apply legacy settings if they exist
  ...loadLegacySettings(),
};

// Async thunks
export const initializeGoogleDriveAuth = createAsyncThunk(
  'unifiedStorage/initializeGoogleDriveAuth',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { unifiedStorage: UnifiedStorageState };
      const storageMode = state.unifiedStorage.mode;
      
      // Only initialize Google Drive auth in cloud storage mode
      if (storageMode !== 'cloud') {
        return {
          isAuthenticated: true, // Local mode doesn't need Google Drive
          user: null,
          expiresAt: null
        };
      }

      const authService = getGoogleDriveAuthService();
      await authService.initialize();
      
      const status = authService.getAuthStatus();
      
      return {
        isAuthenticated: status.isAuthenticated,
        user: status.user,
        expiresAt: status.expiresAt
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to initialize Google Drive auth');
    }
  }
);

export const authenticateGoogleDrive = createAsyncThunk(
  'unifiedStorage/authenticateGoogleDrive',
  async (_, { rejectWithValue }) => {
    try {
      const authService = getGoogleDriveAuthService();
      await authService.authenticate();
      // The page will redirect, so we won't reach here
      return { isAuthenticated: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to authenticate with Google Drive');
    }
  }
);

export const checkGoogleDriveAuthStatus = createAsyncThunk(
  'unifiedStorage/checkGoogleDriveAuthStatus',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { unifiedStorage: UnifiedStorageState };
      const storageMode = state.unifiedStorage.mode;
      
      // In non-cloud storage mode, always return authenticated
      if (storageMode !== 'cloud') {
        return {
          isAuthenticated: true,
          user: null,
          expiresAt: null
        };
      }

      const authService = getGoogleDriveAuthService();
      // Ensure auth service is initialized before checking status
      await authService.initialize();
      const status = authService.getAuthStatus();
      
      return {
        isAuthenticated: status.isAuthenticated,
        user: status.user,
        expiresAt: status.expiresAt
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to check Google Drive auth status');
    }
  }
);

export const revokeGoogleDriveAccess = createAsyncThunk(
  'unifiedStorage/revokeGoogleDriveAccess',
  async (_, { rejectWithValue }) => {
    try {
      const authService = getGoogleDriveAuthService();
      await authService.revokeAccess();
      
      return {
        isAuthenticated: false,
        user: null,
        expiresAt: null
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to revoke Google Drive access');
    }
  }
);

const unifiedStorageSlice = createSlice({
  name: 'unifiedStorage',
  initialState,
  reducers: {
    // Storage mode management
    updateStorageMode: (state, action: PayloadAction<'local' | 'cloud' | 'filesystem'>) => {
      state.mode = action.payload;
      state.userSelectedMode = true; // Mark that user has made a selection
      
      // Reset status when changing modes
      if (state.status === 'configured') {
        state.status = 'unconfigured';
      }
      
      saveUnifiedStateToStorage(state);
    },
    
    markStorageConfigured: (state) => {
      state.status = 'configured';
      saveUnifiedStateToStorage(state);
    },
    
    resetStorageConfiguration: (state) => {
      state.status = 'unconfigured';
      saveUnifiedStateToStorage(state);
    },
    
    // Google Drive auth management
    setShowAuthModal: (state, action: PayloadAction<boolean>) => {
      state.googleDrive.showAuthModal = action.payload;
    },
    
    clearGoogleDriveError: (state) => {
      state.googleDrive.error = null;
    },
    
    setGoogleDriveLoading: (state, action: PayloadAction<boolean>) => {
      state.googleDrive.isLoading = action.payload;
    },
    
    // File system management
    updateFilesystemStatus: (state, action: PayloadAction<{
      isAccessible: boolean;
      directoryName?: string;
      permissionState?: 'granted' | 'denied' | 'prompt' | 'checking';
    }>) => {
      state.filesystem.isAccessible = action.payload.isAccessible;
      if (action.payload.directoryName !== undefined) {
        state.filesystem.directoryName = action.payload.directoryName;
      }
      if (action.payload.permissionState !== undefined) {
        state.filesystem.permissionState = action.payload.permissionState;
      }
    },
    
    // General state management
    clearError: (state) => {
      state.error = null;
    },
    
    resetToDefaults: (state) => {
      const envInfo = getEnvironmentInfo();
      state.mode = envInfo.storageMode as 'local' | 'cloud' | 'filesystem' || 'local';
      state.status = 'unconfigured';
      state.userSelectedMode = false;
      state.googleDrive = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        showAuthModal: false,
        expiresAt: null,
      };
      state.filesystem = {
        isAccessible: false,
        directoryName: null,
        permissionState: 'checking',
      };
      state.error = null;
      
      saveUnifiedStateToStorage(state);
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Google Drive Auth
      .addCase(initializeGoogleDriveAuth.pending, (state) => {
        state.googleDrive.isLoading = true;
        state.googleDrive.error = null;
      })
      .addCase(initializeGoogleDriveAuth.fulfilled, (state, action) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.isAuthenticated = action.payload.isAuthenticated;
        state.googleDrive.user = action.payload.user;
        state.googleDrive.expiresAt = action.payload.expiresAt;
        state.googleDrive.error = null;
        state.googleDrive.showAuthModal = false;
      })
      .addCase(initializeGoogleDriveAuth.rejected, (state, action) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.error = action.payload as string;
        state.googleDrive.isAuthenticated = false;
        state.googleDrive.user = null;
        state.googleDrive.expiresAt = null;
        state.googleDrive.showAuthModal = false;
      })
      
      // Authenticate Google Drive
      .addCase(authenticateGoogleDrive.pending, (state) => {
        state.googleDrive.isLoading = true;
        state.googleDrive.error = null;
      })
      .addCase(authenticateGoogleDrive.fulfilled, (state) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.isAuthenticated = true;
        state.googleDrive.showAuthModal = false;
        state.googleDrive.error = null;
      })
      .addCase(authenticateGoogleDrive.rejected, (state, action) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.error = action.payload as string;
        state.googleDrive.showAuthModal = false;
      })
      
      // Check Google Drive Auth Status
      .addCase(checkGoogleDriveAuthStatus.pending, (state) => {
        // Don't set isLoading for background checks
      })
      .addCase(checkGoogleDriveAuthStatus.fulfilled, (state, action) => {
        state.googleDrive.isAuthenticated = action.payload.isAuthenticated;
        state.googleDrive.user = action.payload.user;
        state.googleDrive.expiresAt = action.payload.expiresAt;
        state.googleDrive.error = null;
        state.googleDrive.showAuthModal = false;
      })
      .addCase(checkGoogleDriveAuthStatus.rejected, (state, action) => {
        state.googleDrive.error = action.payload as string;
        state.googleDrive.isAuthenticated = false;
        state.googleDrive.user = null;
        state.googleDrive.expiresAt = null;
        state.googleDrive.showAuthModal = false;
      })
      
      // Revoke Google Drive Access
      .addCase(revokeGoogleDriveAccess.pending, (state) => {
        state.googleDrive.isLoading = true;
        state.googleDrive.error = null;
      })
      .addCase(revokeGoogleDriveAccess.fulfilled, (state, action) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.isAuthenticated = action.payload.isAuthenticated;
        state.googleDrive.user = action.payload.user;
        state.googleDrive.expiresAt = action.payload.expiresAt;
        state.googleDrive.showAuthModal = false;
        state.googleDrive.error = null;
      })
      .addCase(revokeGoogleDriveAccess.rejected, (state, action) => {
        state.googleDrive.isLoading = false;
        state.googleDrive.error = action.payload as string;
      });
  },
});

export const {
  updateStorageMode,
  markStorageConfigured,
  resetStorageConfiguration,
  setShowAuthModal,
  clearGoogleDriveError,
  setGoogleDriveLoading,
  updateFilesystemStatus,
  clearError,
  resetToDefaults,
} = unifiedStorageSlice.actions;

export default unifiedStorageSlice.reducer;
