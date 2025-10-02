import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { getEnvironmentInfo } from '../../utils/environment';
import type { GoogleDriveAuthState, GoogleDriveUser } from '../../types';

// Async thunks
export const initializeGoogleDriveAuth = createAsyncThunk(
  'googleDriveAuth/initialize',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { settings: { settings: { storageMode: string } } };
      const storageMode = state.settings.settings.storageMode;
      
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
  'googleDriveAuth/authenticate',
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
  'googleDriveAuth/checkStatus',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { settings: { settings: { storageMode: string } } };
      const storageMode = state.settings.settings.storageMode;
      
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
  'googleDriveAuth/revokeAccess',
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

const initialState: GoogleDriveAuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
  showAuthModal: false,
  expiresAt: null,
};

const googleDriveAuthSlice = createSlice({
  name: 'googleDriveAuth',
  initialState,
  reducers: {
    setShowAuthModal: (state, action: PayloadAction<boolean>) => {
      state.showAuthModal = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Action to show auth modal when authentication is needed
    showAuthModalIfNeeded: (state) => {
      // Note: The actual modal display is controlled by App.tsx based on settings.storageMode
      if (!state.isAuthenticated && !state.isLoading) {
        state.showAuthModal = true;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Google Drive Auth
      .addCase(initializeGoogleDriveAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeGoogleDriveAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.error = null;
        
        // Update modal visibility based on authentication status
        // Note: The actual modal display is controlled by App.tsx based on settings.storageMode
        state.showAuthModal = !action.payload.isAuthenticated;
      })
      .addCase(initializeGoogleDriveAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.expiresAt = null;
        
        // Show auth modal on error
        // Note: The actual modal display is controlled by App.tsx based on settings.storageMode
        state.showAuthModal = true;
      })
      
      // Authenticate Google Drive
      .addCase(authenticateGoogleDrive.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateGoogleDrive.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.showAuthModal = false;
        state.error = null;
      })
      .addCase(authenticateGoogleDrive.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.showAuthModal = true; // Keep modal open on error
      })
      
      // Check Google Drive Auth Status
      // Note: We don't set isLoading for status checks to avoid unnecessary re-renders
      .addCase(checkGoogleDriveAuthStatus.pending, (state) => {
        // Don't set isLoading for background checks
        state.error = null;
      })
      .addCase(checkGoogleDriveAuthStatus.fulfilled, (state, action) => {
        // Don't set isLoading = false for background checks
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.error = null;
        
        // Update modal visibility based on authentication status
        // Note: The actual modal display is controlled by App.tsx based on settings.storageMode
        state.showAuthModal = !action.payload.isAuthenticated;
      })
      .addCase(checkGoogleDriveAuthStatus.rejected, (state, action) => {
        // Don't set isLoading = false for background checks
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.expiresAt = null;
        
        // Show auth modal on error
        // Note: The actual modal display is controlled by App.tsx based on settings.storageMode
        state.showAuthModal = true;
      })
      
      // Revoke Google Drive Access
      .addCase(revokeGoogleDriveAccess.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(revokeGoogleDriveAccess.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.showAuthModal = false;
        state.error = null;
      })
      .addCase(revokeGoogleDriveAccess.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { 
  setShowAuthModal, 
  clearError, 
  setLoading, 
  showAuthModalIfNeeded 
} = googleDriveAuthSlice.actions;

export default googleDriveAuthSlice.reducer;
