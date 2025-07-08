import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { authApi } from '../../services/api/auth';
import type { 
  AuthState, 
  Profile, 
  LoginRequest, 
  RegisterRequest, 
  CreateProfileRequest 
} from '../../types';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      // Store token in localStorage for persistence
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData: Omit<RegisterRequest, 'request_id'>, { rejectWithValue }) => {
    try {
      const requestData: RegisterRequest = {
        ...userData,
        request_id: uuidv4(),
      };
      const response = await authApi.register(requestData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Registration failed');
    }
  }
);

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

export const fetchProfiles = createAsyncThunk(
  'auth/fetchProfiles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfiles();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch profiles');
    }
  }
);

export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async (profileData: Omit<CreateProfileRequest, 'request_id'>, { rejectWithValue }) => {
    try {
      const requestData: CreateProfileRequest = {
        ...profileData,
        request_id: uuidv4(),
      };
      const response = await authApi.createProfile(requestData);
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
        const currentUser = await dispatch(getCurrentUser()).unwrap();
        
        // Fetch profiles
        const profiles = await dispatch(fetchProfiles()).unwrap();
        
        // Check for existing saved profile first, then default to first profile
        let currentProfile = null;
        const savedProfile = localStorage.getItem('current_profile');
        
        console.log('initializeAuth: savedProfile from localStorage:', savedProfile);
        console.log('initializeAuth: fetched profiles:', profiles);
        
        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            console.log('initializeAuth: parsed saved profile:', parsedProfile);
            // Verify the saved profile still exists in the fetched profiles
            const profileExists = profiles.find(p => p.id === parsedProfile.id);
            if (profileExists) {
              currentProfile = profileExists;
              console.log('initializeAuth: using saved profile:', currentProfile);
            } else {
              console.log('initializeAuth: saved profile not found in fetched profiles');
            }
          } catch (error) {
            console.warn('Failed to parse saved profile:', error);
          }
        }
        
        // If no saved profile or saved profile doesn't exist anymore, use first profile
        if (!currentProfile && profiles.length > 0) {
          currentProfile = profiles[0];
          console.log('initializeAuth: using first profile as default:', currentProfile);
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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('current_profile');
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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('current_profile');
    },
    
    setCurrentProfile: (state, action: PayloadAction<Profile>) => {
      console.log('Redux: setCurrentProfile called with:', action.payload);
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
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
        state.error = null;
        // Note: Profiles will be fetched by the component after login
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Register
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
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
      
      // Fetch Profiles
      .addCase(fetchProfiles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProfiles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profiles = action.payload;
        state.error = null;
      })
      .addCase(fetchProfiles.rejected, (state, action) => {
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
          console.log('Redux: initializeAuth.fulfilled setting currentProfile to:', action.payload.currentProfile);
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