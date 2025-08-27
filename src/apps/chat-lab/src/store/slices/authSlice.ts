import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/auth';
import type { 
  AuthState, 
  Profile, 
} from '../../types';

// Helper function to clear all auth tokens consistently
const clearAllAuthTokens = () => {
  // Clear localStorage
  localStorage.removeItem('auth_token');
  localStorage.removeItem('fiduToken');
  localStorage.removeItem('user');
  localStorage.removeItem('current_profile');
  
  // Clear cookie
  document.cookie = 'auth_token=; path=/; max-age=0; samesite=lax';
};

// Async thunks
export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await authApi.getCurrentUser(token);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to get current user');
    }
  }
);

export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async (display_name: string,
    { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const response = await authApi.createProfile(token, display_name);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create profile');
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        // Set token in API client
        localStorage.setItem('auth_token', token);
        
        // Get current user info
        const currentUser = await dispatch(getCurrentUser(token)).unwrap();
        
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
          token,
        };
      }
      
      return null;
    } catch (error: any) {
      // Clear invalid auth data
      clearAllAuthTokens();
      return rejectWithValue(error.message || 'Failed to initialize auth');
    }
  }
);

const initialState: AuthState = {
  user: null,
  currentProfile: null,
  profiles: [],
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.currentProfile = null;
      state.profiles = [];
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      
      // Clear localStorage
      clearAllAuthTokens();
    },
    
    setCurrentProfile: (state, action: PayloadAction<Profile>) => {
      state.currentProfile = action.payload;
      localStorage.setItem('current_profile', JSON.stringify(action.payload));
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Current User
      .addCase(getCurrentUser.pending, (state) => {
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
      .addCase(createProfile.pending, (state) => {
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
      
      // Initialize Auth
      .addCase(initializeAuth.pending, (state) => {
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
          state.token = action.payload.token;
          state.isAuthenticated = true;
        }
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
      });
  },
});

export const { logout, setCurrentProfile, clearError, setLoading } = authSlice.actions;
export default authSlice.reducer; 