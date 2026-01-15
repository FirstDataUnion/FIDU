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
import type { AuthState, Profile } from '../../types';

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
  async (_, { dispatch, rejectWithValue }) => {
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

      // Fetch profiles
      const profiles = currentUser.profiles;

      // Check for existing saved profile first, then default to first profile
      let currentProfile = null;
      const savedProfile = localStorage.getItem('current_profile');

      if (savedProfile) {
        try {
          const parsedProfile = JSON.parse(savedProfile);
          // Verify the saved profile still exists in the fetched profiles
          const profileExists = profiles.find(p => p.id === parsedProfile.id);
          if (profileExists) {
            currentProfile = profileExists;
          }
        } catch (error) {
          console.warn('Failed to parse saved profile:', error);
        }
      }

      // If no saved profile or saved profile doesn't exist anymore, use first profile
      if (!currentProfile && profiles.length > 0) {
        currentProfile = profiles[0];
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
      }

      return {
        user: currentUser,
        profiles,
        currentProfile,
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
  currentProfile: null,
  profiles: [],
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
        // If the deleted profile was the current profile, select the first available profile
        if (state.currentProfile?.id === action.payload.profile_id) {
          state.currentProfile =
            state.profiles.length > 0 ? state.profiles[0] : null;
          if (state.currentProfile) {
            localStorage.setItem(
              'current_profile',
              JSON.stringify(state.currentProfile)
            );
          } else {
            localStorage.removeItem('current_profile');
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
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        // Still clear state even if some steps failed
        state.user = null;
        state.currentProfile = null;
        state.profiles = [];
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentProfile, clearError, setLoading } = authSlice.actions;
export default authSlice.reducer;
