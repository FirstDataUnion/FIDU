import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/auth';
import { getFiduAuthService } from '../../services/auth/FiduAuthService';
import {
  beginLogout,
  completeLogout,
  currentLogoutSource,
  markAuthenticated,
} from '../../services/auth/logoutCoordinator';
import { getWorkspaceRegistry } from '../../services/workspace/WorkspaceRegistry';
import type { AuthState, Profile, UnifiedWorkspace } from '../../types';
import {
  profileToUnifiedWorkspace,
  workspaceMetadataToUnifiedWorkspace,
} from '../../utils/workspaceHelpers';

// Async thunks
export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getCurrentUser();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to get current user');
    }
  }
);

export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async (display_name: string, { rejectWithValue }) => {
    try {
      const response = await authApi.createProfile(display_name);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create profile');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (
    { profile_id, display_name }: { profile_id: string; display_name: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authApi.updateProfile(profile_id, display_name);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update profile');
    }
  }
);

export const deleteProfile = createAsyncThunk(
  'auth/deleteProfile',
  async (profile_id: string, { rejectWithValue }) => {
    try {
      const response = await authApi.deleteProfile(profile_id);
      return { profile_id, success: response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete profile');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const started = beginLogout('manual');
      const source = currentLogoutSource();

      if (!started) {
        if (source === 'manual') {
          console.log(
            '🔁 Logout already in progress, skipping manual logout request'
          );
          return true;
        }

        console.log('🧹 Continuing existing auto logout cleanup...');
      } else {
        console.log('🧹 Starting logout process (manual)...');
      }

      // Clear HTTP-only cookies via backend (FIDU auth)
      const fiduAuthService = getFiduAuthService();
      await fiduAuthService.clearTokens();
      console.log('✅ FIDU auth cookies cleared');

      // Clear Google Drive auth if available
      try {
        const { getGoogleDriveAuthService } =
          await import('../../services/auth/GoogleDriveAuth');
        const googleDriveAuthService = await getGoogleDriveAuthService();
        await googleDriveAuthService.logout();
        console.log('✅ Google Drive auth cleared');
      } catch (error) {
        // If Google Drive auth service is not available, that's okay - just log it
        console.warn(
          'Could not clear Google Drive auth (may not be initialized):',
          error
        );
      }

      // Clear localStorage and client-side cookies
      getFiduAuthService().clearAllAuthTokens();
      console.log('✅ LocalStorage and client-side cookies cleared');

      // Also clear Google Drive tokens from localStorage if they exist
      localStorage.removeItem('google_drive_tokens');
      localStorage.removeItem('google_drive_user');

      // Clear cached FIDU SDK instance to force reinitialization on next login
      // This ensures the login widget appears properly after logout
      if ((window as any).__fiduAuthInstance) {
        delete (window as any).__fiduAuthInstance;
        console.log('✅ FIDU SDK instance cleared');
      }

      // Mark logout as complete to clear timeout and prevent loops
      completeLogout();

      return true;
    } catch (error: any) {
      console.error('❌ Logout failed:', error);
      // Even if some steps fail, we should still clear what we can
      getFiduAuthService().clearAllAuthTokens();
      localStorage.removeItem('google_drive_tokens');
      localStorage.removeItem('google_drive_user');

      // Clear cached FIDU SDK instance even on error
      if ((window as any).__fiduAuthInstance) {
        delete (window as any).__fiduAuthInstance;
      }

      // Still mark logout as complete even on failure to prevent infinite loops
      completeLogout();

      return rejectWithValue(error.message || 'Failed to logout completely');
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { dispatch, rejectWithValue, getState }) => {
    try {
      const fiduAuthService = getFiduAuthService();

      if (await fiduAuthService.isAuthenticated()) {
        console.log('✅ Using FIDU auth tokens from HTTP-only cookies');
      } else if (await fiduAuthService.migrateFromLocalStorage()) {
        // Fallback to localStorage for backward compatibility
        console.log('🔄 Using FIDU auth tokens from localStorage (fallback)');
      } else {
        console.log('❌ No FIDU auth tokens found');
        return null;
      }

      markAuthenticated();

      // Get current user info
      const currentUser = await dispatch(getCurrentUser()).unwrap();

      // Fetch profiles (personal workspaces)
      const profiles = currentUser.profiles;

      // Load shared workspaces from registry (only if feature is enabled)
      const workspaceRegistry = getWorkspaceRegistry();

      // Check if shared workspaces feature is enabled
      const state = getState() as any;
      const { selectIsFeatureFlagEnabled } =
        await import('../selectors/featureFlagsSelectors');
      const isSharedWorkspacesEnabled = selectIsFeatureFlagEnabled(
        state,
        'shared_workspaces'
      );

      if (isSharedWorkspacesEnabled) {
        try {
          await workspaceRegistry.syncFromAPI();
        } catch {
          // Continue with local registry if sync fails (e.g., offline, API error)
        }
      }

      const allWorkspaces = workspaceRegistry.getWorkspaces();
      // Filter out shared workspaces if feature is disabled
      const sharedWorkspaces = isSharedWorkspacesEnabled
        ? allWorkspaces
        : allWorkspaces.filter(w => w.type !== 'shared');

      // Check for existing saved workspace first (new format)
      let currentWorkspace: UnifiedWorkspace | null = null;
      const savedWorkspace = localStorage.getItem('current_workspace');

      if (savedWorkspace) {
        try {
          const parsedWorkspace = JSON.parse(
            savedWorkspace
          ) as UnifiedWorkspace;
          // Verify the saved workspace still exists
          if (parsedWorkspace.type === 'personal') {
            const profileExists = profiles.find(
              p => p.id === parsedWorkspace.profileId
            );
            if (profileExists) {
              currentWorkspace = profileToUnifiedWorkspace(profileExists);
            }
          } else {
            // Shared workspace
            const workspaceExists = sharedWorkspaces.find(
              w => w.id === parsedWorkspace.id
            );
            if (workspaceExists) {
              currentWorkspace =
                workspaceMetadataToUnifiedWorkspace(workspaceExists);
            }
          }
        } catch (error) {
          console.warn('Failed to parse saved workspace:', error);
        }
      }

      // Fallback: Check for legacy saved profile
      if (!currentWorkspace) {
        const savedProfile = localStorage.getItem('current_profile');
        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            const profileExists = profiles.find(p => p.id === parsedProfile.id);
            if (profileExists) {
              currentWorkspace = profileToUnifiedWorkspace(profileExists);
            }
          } catch (error) {
            console.warn('Failed to parse saved profile:', error);
          }
        }
      }

      // If no saved workspace/profile, default to first profile (default profile)
      if (!currentWorkspace && profiles.length > 0) {
        currentWorkspace = profileToUnifiedWorkspace(profiles[0]);
        localStorage.setItem(
          'current_workspace',
          JSON.stringify(currentWorkspace)
        );
      }

      // Set legacy currentProfile for backward compatibility
      const currentProfile =
        currentWorkspace?.type === 'personal' && currentWorkspace.profileId
          ? profiles.find(p => p.id === currentWorkspace.profileId) || null
          : null;

      if (currentProfile) {
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
      }

      return {
        user: currentUser,
        profiles,
        currentProfile,
        personalWorkspaces: profiles,
        currentWorkspace,
      };
    } catch (error: any) {
      console.error('❌ Failed to initialize auth:', error);
      // Clear invalid auth data
      const fiduAuthService = getFiduAuthService();
      await fiduAuthService.clearTokens();
      fiduAuthService.clearAllAuthTokens();
      return rejectWithValue(error.message || 'Failed to initialize auth');
    }
  }
);

const initialState: AuthState = {
  user: null,
  // Legacy: Keep for backward compatibility during migration
  currentProfile: null,
  profiles: [],
  // New: Unified workspace state
  currentWorkspace: null,
  personalWorkspaces: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCurrentProfile: (state, action: PayloadAction<Profile>) => {
      state.currentProfile = action.payload;
      localStorage.setItem('current_profile', JSON.stringify(action.payload));
      // Also update unified workspace state
      state.currentWorkspace = profileToUnifiedWorkspace(action.payload);
      localStorage.setItem(
        'current_workspace',
        JSON.stringify(state.currentWorkspace)
      );
    },

    setCurrentWorkspace: (state, action: PayloadAction<UnifiedWorkspace>) => {
      state.currentWorkspace = action.payload;
      localStorage.setItem('current_workspace', JSON.stringify(action.payload));
      // Also update legacy profile state if it's a personal workspace
      if (action.payload.type === 'personal' && action.payload.profileId) {
        const profile = state.personalWorkspaces.find(
          p => p.id === action.payload.profileId
        );
        if (profile) {
          state.currentProfile = profile;
          localStorage.setItem('current_profile', JSON.stringify(profile));
        }
      }
    },

    clearError: state => {
      state.error = null;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      // Get Current User
      .addCase(getCurrentUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Create Profile
      .addCase(createProfile.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profiles.push(action.payload);
        // Also update personalWorkspaces
        state.personalWorkspaces.push(action.payload);
        state.error = null;
      })
      .addCase(createProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Update Profile
      .addCase(updateProfile.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.profiles.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.profiles[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Delete Profile
      .addCase(deleteProfile.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profiles = state.profiles.filter(
          p => p.id !== action.payload.profile_id
        );
        // Also update personalWorkspaces
        state.personalWorkspaces = state.personalWorkspaces.filter(
          p => p.id !== action.payload.profile_id
        );
        // If the deleted profile was the current profile/workspace, select the first available profile
        if (state.currentProfile?.id === action.payload.profile_id) {
          state.currentProfile =
            state.profiles.length > 0 ? state.profiles[0] : null;
          if (state.currentProfile) {
            localStorage.setItem(
              'current_profile',
              JSON.stringify(state.currentProfile)
            );
            // Also update workspace state
            state.currentWorkspace = profileToUnifiedWorkspace(
              state.currentProfile
            );
            localStorage.setItem(
              'current_workspace',
              JSON.stringify(state.currentWorkspace)
            );
          } else {
            localStorage.removeItem('current_profile');
            localStorage.removeItem('current_workspace');
            state.currentWorkspace = null;
          }
        }
        state.error = null;
      })
      .addCase(deleteProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Initialize Auth
      .addCase(initializeAuth.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.profiles = action.payload.profiles;
          state.currentProfile = action.payload.currentProfile;
          // Update unified workspace state
          state.personalWorkspaces =
            action.payload.personalWorkspaces || action.payload.profiles;
          state.currentWorkspace = action.payload.currentWorkspace;
          state.isAuthenticated = true;
        } else {
          // No valid auth found - user needs to log in
          state.isAuthenticated = false;
        }
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
      })

      // Logout
      .addCase(logout.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, state => {
        state.isLoading = false;
        state.user = null;
        state.currentProfile = null;
        state.profiles = [];
        // Clear unified workspace state
        state.currentWorkspace = null;
        state.personalWorkspaces = [];
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        // Still clear state even if some steps failed
        state.user = null;
        state.currentProfile = null;
        state.profiles = [];
        // Clear unified workspace state
        state.currentWorkspace = null;
        state.personalWorkspaces = [];
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setCurrentProfile,
  setCurrentWorkspace,
  clearError,
  setLoading,
} = authSlice.actions;
export default authSlice.reducer;
