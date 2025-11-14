import unifiedStorageSlice, {
  updateStorageMode,
  markStorageConfigured,
  resetStorageConfiguration,
  setShowAuthModal,
  clearGoogleDriveError,
  setGoogleDriveLoading,
  clearError,
  resetToDefaults,
  initializeGoogleDriveAuth,
  authenticateGoogleDrive,
  checkGoogleDriveAuthStatus,
  revokeGoogleDriveAccess,
} from '../unifiedStorageSlice';
import type { UnifiedStorageState } from '../unifiedStorageSlice';

// Mock the environment module
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: () => ({
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'cloud',
    syncInterval: 300000,
  }),
}));

// Mock GoogleDriveAuth service
jest.mock('../../../services/auth/GoogleDriveAuth', () => ({
  getGoogleDriveAuthService: jest.fn(() => ({
    initialize: jest.fn(),
    getAuthStatus: jest.fn(() => ({
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    })),
    authenticate: jest.fn(),
    revokeAccess: jest.fn(),
  })),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

const initialState: UnifiedStorageState = {
  mode: 'cloud',
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
  isLoading: false,
  error: null,
};

describe('unifiedStorageSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reducers', () => {
    it('should handle updateStorageMode', () => {
      const action = updateStorageMode('cloud');
      const state = unifiedStorageSlice(initialState, action);
      
      expect(state.mode).toBe('cloud');
      expect(state.userSelectedMode).toBe(true);
      expect(state.status).toBe('unconfigured'); // Should reset when changing modes
    });

    it('should handle markStorageConfigured', () => {
      const action = markStorageConfigured();
      const state = unifiedStorageSlice(initialState, action);
      
      expect(state.status).toBe('configured');
    });

    it('should handle resetStorageConfiguration', () => {
      const stateWithConfigured = {
        ...initialState,
        status: 'configured' as const,
      };
      
      const action = resetStorageConfiguration();
      const state = unifiedStorageSlice(stateWithConfigured, action);
      
      expect(state.status).toBe('unconfigured');
    });

    it('should handle setShowAuthModal', () => {
      const action = setShowAuthModal(true);
      const state = unifiedStorageSlice(initialState, action);
      
      expect(state.googleDrive.showAuthModal).toBe(true);
    });

    it('should handle clearGoogleDriveError', () => {
      const stateWithError = {
        ...initialState,
        googleDrive: {
          ...initialState.googleDrive,
          error: 'Test error',
        },
      };
      
      const action = clearGoogleDriveError();
      const state = unifiedStorageSlice(stateWithError, action);
      
      expect(state.googleDrive.error).toBeNull();
    });

    it('should handle setGoogleDriveLoading', () => {
      const action = setGoogleDriveLoading(true);
      const state = unifiedStorageSlice(initialState, action);
      
      expect(state.googleDrive.isLoading).toBe(true);
    });

    it('should handle clearError', () => {
      const stateWithError = {
        ...initialState,
        error: 'Test error',
      };
      
      const action = clearError();
      const state = unifiedStorageSlice(stateWithError, action);
      
      expect(state.error).toBeNull();
    });

    it('should handle resetToDefaults', () => {
      const stateWithData: UnifiedStorageState = {
        ...initialState,
        mode: 'cloud' as const,
        status: 'configured' as const,
        userSelectedMode: true,
        googleDrive: {
          ...initialState.googleDrive,
          isAuthenticated: true,
          user: { id: 'test', name: 'Test User', email: 'test@example.com' },
        },
      };
      
      const action = resetToDefaults();
      const state = unifiedStorageSlice(stateWithData, action);
      
      expect(state.mode).toBe('cloud'); // Should reset to environment default
      expect(state.status).toBe('unconfigured');
      expect(state.userSelectedMode).toBe(false);
      expect(state.googleDrive.isAuthenticated).toBe(false);
      expect(state.googleDrive.user).toBeNull();
    });
  });

  describe('async thunks', () => {
    describe('initializeGoogleDriveAuth', () => {
      it('should handle initializeGoogleDriveAuth.pending', () => {
        const action = initializeGoogleDriveAuth.pending('', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(true);
        expect(state.googleDrive.error).toBeNull();
      });

      it('should handle initializeGoogleDriveAuth.fulfilled', () => {
        const mockPayload = {
          isAuthenticated: true,
          user: { id: 'test', name: 'Test User', email: 'test@example.com' },
          expiresAt: 1234567890,
        };
        
        const action = initializeGoogleDriveAuth.fulfilled(mockPayload, '', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
        expect(state.googleDrive.isAuthenticated).toBe(true);
        expect(state.googleDrive.user).toEqual(mockPayload.user);
        expect(state.googleDrive.expiresAt).toBe(1234567890);
        expect(state.googleDrive.error).toBeNull();
        expect(state.googleDrive.showAuthModal).toBe(false);
      });

      it('should handle initializeGoogleDriveAuth.rejected', () => {
        const action = initializeGoogleDriveAuth.rejected(
          new Error('Auth failed'),
          '',
          undefined
        );
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
        expect(state.googleDrive.isAuthenticated).toBe(false);
        expect(state.googleDrive.user).toBeNull();
        expect(state.googleDrive.expiresAt).toBeNull();
        expect(state.googleDrive.showAuthModal).toBe(false);
      });
    });

    describe('authenticateGoogleDrive', () => {
      it('should handle authenticateGoogleDrive.pending', () => {
        const action = authenticateGoogleDrive.pending('', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(true);
        expect(state.googleDrive.error).toBeNull();
      });

      it('should handle authenticateGoogleDrive.fulfilled', () => {
        const action = authenticateGoogleDrive.fulfilled({ isAuthenticated: true }, '', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
        expect(state.googleDrive.isAuthenticated).toBe(true);
        expect(state.googleDrive.showAuthModal).toBe(false);
        expect(state.googleDrive.error).toBeNull();
      });

      it('should handle authenticateGoogleDrive.rejected', () => {
        const action = authenticateGoogleDrive.rejected(
          new Error('Auth failed'),
          '',
          undefined
        );
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
        expect(state.googleDrive.showAuthModal).toBe(false);
      });
    });

    describe('checkGoogleDriveAuthStatus', () => {
      it('should handle checkGoogleDriveAuthStatus.pending', () => {
        const action = checkGoogleDriveAuthStatus.pending('', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        // Should not set isLoading for background checks
        expect(state.googleDrive.isLoading).toBe(false);
      });

      it('should handle checkGoogleDriveAuthStatus.fulfilled', () => {
        const mockPayload = {
          isAuthenticated: true,
          user: { id: 'test', name: 'Test User', email: 'test@example.com' },
          expiresAt: 1234567890,
        };
        
        const action = checkGoogleDriveAuthStatus.fulfilled(mockPayload, '', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isAuthenticated).toBe(true);
        expect(state.googleDrive.user).toEqual(mockPayload.user);
        expect(state.googleDrive.expiresAt).toBe(1234567890);
        expect(state.googleDrive.error).toBeNull();
        expect(state.googleDrive.showAuthModal).toBe(false);
      });

      it('should handle checkGoogleDriveAuthStatus.rejected', () => {
        const action = checkGoogleDriveAuthStatus.rejected(
          new Error('Check failed'),
          '',
          undefined
        );
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isAuthenticated).toBe(false);
        expect(state.googleDrive.user).toBeNull();
        expect(state.googleDrive.expiresAt).toBeNull();
        expect(state.googleDrive.showAuthModal).toBe(false);
      });
    });

    describe('revokeGoogleDriveAccess', () => {
      it('should handle revokeGoogleDriveAccess.pending', () => {
        const action = revokeGoogleDriveAccess.pending('', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(true);
        expect(state.googleDrive.error).toBeNull();
      });

      it('should handle revokeGoogleDriveAccess.fulfilled', () => {
        const mockPayload = {
          isAuthenticated: false,
          user: null,
          expiresAt: null,
        };
        
        const action = revokeGoogleDriveAccess.fulfilled(mockPayload, '', undefined);
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
        expect(state.googleDrive.isAuthenticated).toBe(false);
        expect(state.googleDrive.user).toBeNull();
        expect(state.googleDrive.expiresAt).toBeNull();
        expect(state.googleDrive.showAuthModal).toBe(false);
        expect(state.googleDrive.error).toBeNull();
      });

      it('should handle revokeGoogleDriveAccess.rejected', () => {
        const action = revokeGoogleDriveAccess.rejected(
          new Error('Revoke failed'),
          '',
          undefined
        );
        const state = unifiedStorageSlice(initialState, action);
        
        expect(state.googleDrive.isLoading).toBe(false);
      });
    });
  });

  describe('localStorage integration', () => {
    it('should save state to localStorage when updating storage mode', () => {
      const action = updateStorageMode('cloud');
      unifiedStorageSlice(initialState, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'fidu-chat-lab-settings',
        expect.stringContaining('"storageMode":"cloud"')
      );
    });

    it('should save state to localStorage when marking storage configured', () => {
      const action = markStorageConfigured();
      unifiedStorageSlice(initialState, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'fidu-chat-lab-settings',
        expect.stringContaining('"storageConfigured":true')
      );
    });
  });
});
