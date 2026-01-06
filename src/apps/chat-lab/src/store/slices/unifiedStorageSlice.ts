import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { getEnvironmentInfo } from '../../utils/environment';
import type { GoogleDriveUser, WorkspaceMetadata } from '../../types';
import { getStorageService } from '../../services/storage/StorageService';
import { getWorkspaceRegistry } from '../../services/workspace/WorkspaceRegistry';

// Unified storage state interface
export interface UnifiedStorageState {
  // Core storage configuration
  mode: 'local' | 'cloud';
  status: 'unconfigured' | 'configuring' | 'configured' | 'error';
  userSelectedMode: boolean; // Whether user has made a selection from settings page
  
  // Workspace state
  activeWorkspace: {
    id: string | null; // null = personal workspace (virtual)
    name: string;
    type: 'personal' | 'shared';
    driveFolderId?: string;
  } | null;
  availableWorkspaces: Array<{
    id: string;
    name: string;
    type: 'personal' | 'shared';
    role?: 'owner' | 'member';
    lastAccessed?: string;
  }>;
  isSwitchingWorkspace: boolean;
  switchError: string | null;
  
  // Google Drive specific state
  googleDrive: {
    isAuthenticated: boolean;
    user: GoogleDriveUser | null;
    isLoading: boolean;
    error: string | null;
    showAuthModal: boolean;
    expiresAt: number | null;
  };
  
  // General state
  isLoading: boolean;
  error: string | null;
}

// Get default storage mode based on environment
const getDefaultStorageMode = (): 'local' | 'cloud' => {
  const envInfo = getEnvironmentInfo();
  // Always use environment storage mode if specified
  return envInfo.storageMode as 'local' | 'cloud' || 'local';
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
  activeWorkspace: null,
  availableWorkspaces: [],
  isSwitchingWorkspace: false,
  switchError: null,
  googleDrive: {
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null,
    showAuthModal: false,
    expiresAt: null,
  },
  isLoading: false,
  error: null,
  // Apply legacy settings if they exist
  ...loadLegacySettings(),
};

// Async thunks
export const initializeGoogleDriveAuth = createAsyncThunk(
  'unifiedStorage/initializeGoogleDriveAuth',
  async (_, { rejectWithValue, getState, dispatch }) => {
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

      // Use AuthManager for coordinated initialization
      const { getAuthManager } = await import('../../services/auth/AuthManager');
      const authManager = getAuthManager(dispatch as any);
      await authManager.initialize();
      
      const status = authManager.getAuthStatus();
      
      const expiresAt = null as number | null; // AuthManager doesn't track expiresAt in its status
      return {
        isAuthenticated: status.isAuthenticated,
        user: status.user,
        expiresAt
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
      const authService = await getGoogleDriveAuthService();
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
  async (_, { rejectWithValue, getState, dispatch }) => {
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

      // Use AuthManager for coordinated status check
      const { getAuthManager } = await import('../../services/auth/AuthManager');
      const authManager = getAuthManager(dispatch as any);
      
      // Use checkAndRestore which is safe to call frequently (has debouncing)
      await authManager.checkAndRestore();
      const status = authManager.getAuthStatus();
      
      const expiresAt = null as number | null; // AuthManager doesn't track expiresAt in its status
      return {
        isAuthenticated: status.isAuthenticated,
        user: status.user,
        expiresAt
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
      const authService = await getGoogleDriveAuthService();
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

// Workspace management thunks
export const loadWorkspaces = createAsyncThunk(
  'unifiedStorage/loadWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      const workspaceRegistry = getWorkspaceRegistry();
      
      // Sync workspaces from API to ensure we have the latest data
      // This is critical for members who were added to workspaces in previous sessions
      try {
        await workspaceRegistry.syncFromAPI();
      } catch {
        // Continue with local registry if sync fails (e.g., offline, API error, not authenticated)
      }
      
      const workspaces = workspaceRegistry.getWorkspaces();
      const activeWorkspaceId = workspaceRegistry.getActiveWorkspaceId();
      
      return {
        workspaces,
        activeWorkspaceId
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load workspaces');
    }
  }
);

export const switchWorkspace = createAsyncThunk(
  'unifiedStorage/switchWorkspace',
  async (workspaceId: string | null, { rejectWithValue }) => {
    try {
      const storageService = getStorageService();
      const workspaceRegistry = getWorkspaceRegistry();
      
      // Handle personal workspace (virtual - no stored entry)
      if (workspaceId === null) {
        // Perform the switch to personal workspace
        await storageService.switchWorkspace(null);
        
        return {
          workspace: {
            id: null,
            name: 'Personal Workspace',
            type: 'personal' as const,
            driveFolderId: undefined
          }
        };
      }
      
      // Handle shared workspace (must exist in registry)
      const workspace = workspaceRegistry.getWorkspace(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      
      // Perform the switch
      await storageService.switchWorkspace(workspaceId);
      
      // Clear UI state (will be handled by components listening to this action)
      // The components should refetch their data after workspace switch
      
      return {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          driveFolderId: workspace.driveFolderId
        }
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to switch workspace');
    }
  }
);

const unifiedStorageSlice = createSlice({
  name: 'unifiedStorage',
  initialState,
  reducers: {
    // Storage mode management
    updateStorageMode: (state, action: PayloadAction<'local' | 'cloud'>) => {
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
    
    setGoogleDriveAuthState: (state, action: PayloadAction<{ isAuthenticated: boolean, user?: any }>) => {
      state.googleDrive.isAuthenticated = action.payload.isAuthenticated;
      state.googleDrive.error = null;
      state.googleDrive.showAuthModal = false;
      
      if (action.payload.user) {
        state.googleDrive.user = action.payload.user;
      }
      
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
    
    // General state management
    clearError: (state) => {
      state.error = null;
    },
    
    resetToDefaults: (state) => {
      const envInfo = getEnvironmentInfo();
      state.mode = envInfo.storageMode as 'local' | 'cloud' || 'local';
      state.status = 'unconfigured';
      state.userSelectedMode = false;
      state.activeWorkspace = null;
      state.availableWorkspaces = [];
      state.isSwitchingWorkspace = false;
      state.switchError = null;
      state.googleDrive = {
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        showAuthModal: false,
        expiresAt: null,
      };
      state.error = null;
      
      saveUnifiedStateToStorage(state);
    },

    // Workspace actions
    setActiveWorkspace: (state, action: PayloadAction<WorkspaceMetadata>) => {
      state.activeWorkspace = {
        id: action.payload.id,
        name: action.payload.name,
        type: action.payload.type,
        driveFolderId: action.payload.driveFolderId
      };
    },

    setAvailableWorkspaces: (state, action: PayloadAction<WorkspaceMetadata[]>) => {
      state.availableWorkspaces = action.payload.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type,
        role: w.role,
        lastAccessed: w.lastAccessed
      }));
    },

    clearSwitchError: (state) => {
      state.switchError = null;
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
      .addCase(checkGoogleDriveAuthStatus.pending, () => {
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
      })
      
      // Load Workspaces
      .addCase(loadWorkspaces.fulfilled, (state, action) => {
        state.availableWorkspaces = action.payload.workspaces.map(w => ({
          id: w.id,
          name: w.name,
          type: w.type,
          role: w.role,
          lastAccessed: w.lastAccessed
        }));
        
        // Set active workspace
        if (action.payload.activeWorkspaceId === null) {
          // Personal workspace (virtual - not stored)
          state.activeWorkspace = {
            id: null,
            name: 'Personal Workspace',
            type: 'personal',
            driveFolderId: undefined
          };
        } else if (action.payload.activeWorkspaceId) {
          // Shared workspace (must exist in registry)
          const activeWorkspace = action.payload.workspaces.find(
            w => w.id === action.payload.activeWorkspaceId
          );
          if (activeWorkspace) {
            state.activeWorkspace = {
              id: activeWorkspace.id,
              name: activeWorkspace.name,
              type: activeWorkspace.type,
              driveFolderId: activeWorkspace.driveFolderId
            };
          } else {
            // Active workspace ID doesn't match any workspace - reset to personal
            state.activeWorkspace = {
              id: null,
              name: 'Personal Workspace',
              type: 'personal',
              driveFolderId: undefined
            };
          }
        } else {
          // No active workspace - default to personal
          state.activeWorkspace = {
            id: null,
            name: 'Personal Workspace',
            type: 'personal',
            driveFolderId: undefined
          };
        }
      })
      
      // Switch Workspace
      .addCase(switchWorkspace.pending, (state) => {
        state.isSwitchingWorkspace = true;
        state.switchError = null;
      })
      .addCase(switchWorkspace.fulfilled, (state, action) => {
        state.isSwitchingWorkspace = false;
        state.activeWorkspace = action.payload.workspace;
        state.switchError = null;
      })
      .addCase(switchWorkspace.rejected, (state, action) => {
        state.isSwitchingWorkspace = false;
        state.switchError = action.payload as string;
      });
  },
});

export const {
  updateStorageMode,
  markStorageConfigured,
  setGoogleDriveAuthState,
  resetStorageConfiguration,
  setShowAuthModal,
  clearGoogleDriveError,
  setGoogleDriveLoading,
  clearError,
  resetToDefaults,
  setActiveWorkspace,
  setAvailableWorkspaces,
  clearSwitchError,
} = unifiedStorageSlice.actions;

export default unifiedStorageSlice.reducer;
