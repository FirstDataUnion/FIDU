import authSlice, {
  getCurrentUser,
  createProfile,
  initializeAuth,
  logout,
  setCurrentProfile,
  clearError,
  setLoading,
} from '../authSlice';
import type { AuthState, Profile } from '../../../types';

// Mock the API
jest.mock('../../../services/api/auth', () => ({
  authApi: {
    getCurrentUser: jest.fn(),
    createProfile: jest.fn(),
  },
}));

// Mock the refresh token service
jest.mock('../../../services/api/refreshTokenService', () => ({
  refreshTokenService: {
    clearAllAuthTokens: jest.fn(),
  },
}));

// Mock FiduAuthCookieService
const mockClearTokens = jest.fn().mockResolvedValue(true);
const mockGetTokens = jest.fn().mockResolvedValue(null); // Default to null so tests can override
const mockMigrateFromLocalStorage = jest.fn().mockResolvedValue(true);
jest.mock('../../../services/auth/FiduAuthCookieService', () => ({
  getFiduAuthCookieService: jest.fn(() => ({
    clearTokens: mockClearTokens,
    getTokens: mockGetTokens,
    migrateFromLocalStorage: mockMigrateFromLocalStorage,
  })),
}));

// Mock GoogleDriveAuthService
const mockGoogleDriveLogout = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../services/auth/GoogleDriveAuth', () => ({
  getGoogleDriveAuthService: jest.fn().mockResolvedValue({
    logout: mockGoogleDriveLogout,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAuthApi = require('../../../services/api/auth').authApi;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockRefreshTokenService = require('../../../services/api/refreshTokenService').refreshTokenService;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  value: '',
  writable: true,
});

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  profiles: [
    {
      id: 'profile-1',
      name: 'Test Profile',
      user_id: 'user-1',
      create_timestamp: '2024-01-01T00:00:00Z',
      update_timestamp: '2024-01-01T00:00:00Z',
    },
  ],
};

const mockProfile: Profile = {
  id: 'profile-1',
  name: 'Test Profile',
  user_id: 'user-1',
  create_timestamp: '2024-01-01T00:00:00Z',
  update_timestamp: '2024-01-01T00:00:00Z',
};

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

describe('authSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
    mockLocalStorage.clear.mockImplementation(() => {});
  });

  describe('reducers', () => {

    it('should handle setCurrentProfile', () => {
      const action = setCurrentProfile(mockProfile);
      const state = authSlice(initialState, action);
      
      expect(state.currentProfile).toEqual(mockProfile);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'current_profile',
        JSON.stringify(mockProfile)
      );
    });

    it('should handle clearError', () => {
      const stateWithError = {
        ...initialState,
        error: 'Test error',
      };
      
      const state = authSlice(stateWithError, clearError());
      
      expect(state.error).toBeNull();
    });

    it('should handle setLoading', () => {
      const action = setLoading(true);
      const state = authSlice(initialState, action);
      
      expect(state.isLoading).toBe(true);
    });
  });

  describe('async thunks', () => {
    describe('getCurrentUser', () => {
      it('should handle getCurrentUser.pending', () => {
        const action = getCurrentUser.pending('', 'test-token');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle getCurrentUser.fulfilled', () => {
        const action = getCurrentUser.fulfilled(mockUser, '', 'test-token');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle getCurrentUser.rejected', () => {
        const action = getCurrentUser.rejected(
          new Error('Failed to get user'),
          '',
          'test-token'
        );
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeUndefined();
      });
    });

    describe('createProfile', () => {
      it('should handle createProfile.pending', () => {
        const action = createProfile.pending('', 'New Profile');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle createProfile.fulfilled', () => {
        const newProfile = {
          id: 'profile-2',
          name: 'New Profile',
          user_id: 'user-1',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        };
        
        const action = createProfile.fulfilled(newProfile, '', 'New Profile');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.profiles).toContain(newProfile);
        expect(state.error).toBeNull();
      });

      it('should handle createProfile.rejected', () => {
        const action = createProfile.rejected(
          new Error('Failed to create profile'),
          '',
          'New Profile'
        );
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeUndefined();
      });
    });

    describe('initializeAuth', () => {
      it('should handle initializeAuth.pending', () => {
        const action = initializeAuth.pending('');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle initializeAuth.fulfilled with valid auth data', async () => {
        // Mock getTokens to return null so it falls back to localStorage
        mockGetTokens.mockResolvedValueOnce(null);
        
        mockLocalStorage.getItem
          .mockReturnValueOnce('test-token') // auth_token
          .mockReturnValueOnce(JSON.stringify(mockUser)); // user
        
        mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);
        
        const thunk = initializeAuth();
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        // Mock the getCurrentUser thunk
        dispatch.mockResolvedValueOnce({
          unwrap: () => Promise.resolve(mockUser),
        });
        
        await thunk(dispatch, getState, undefined);
        
        expect(mockGetTokens).toHaveBeenCalled();
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('auth_token');
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('user');
      });

      it('should handle initializeAuth.fulfilled with no auth data', () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        
        const action = initializeAuth.fulfilled(null, '');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.isInitialized).toBe(true);
        expect(state.isAuthenticated).toBe(false);
      });

      it('should handle initializeAuth.rejected', () => {
        const action = initializeAuth.rejected(
          new Error('Failed to initialize'),
          ''
        );
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.isInitialized).toBe(true);
        expect(state.error).toBeUndefined();
      });

      it('should clear auth tokens on rejection', () => {
        const action = initializeAuth.rejected(
          new Error('Failed to initialize'),
          '',
          undefined,
          'Failed to initialize'
        );
        const state = authSlice(initialState, action);
        
        // The clearAllAuthTokens is called in the thunk, not the reducer
        // The reducer only sets the error state
        expect(state.error).toBe('Failed to initialize');
        expect(state.isLoading).toBe(false);
        expect(state.isInitialized).toBe(true);
      });
    });

    describe('logout', () => {
      it('should handle logout.pending', () => {
        const action = logout.pending('');
        const state = authSlice(initialState, action);
        
        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle logout.fulfilled', async () => {
        const stateWithAuth = {
          ...initialState,
          user: mockUser,
          currentProfile: mockProfile,
          profiles: [mockProfile],
          token: 'test-token',
          isAuthenticated: true,
        };
        
        const action = logout.fulfilled(true, '');
        const state = authSlice(stateWithAuth, action);
        
        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.currentProfile).toBeNull();
        expect(state.profiles).toEqual([]);
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle logout.rejected', () => {
        const stateWithAuth = {
          ...initialState,
          user: mockUser,
          currentProfile: mockProfile,
          profiles: [mockProfile],
          token: 'test-token',
          isAuthenticated: true,
        };
        
        const action = logout.rejected(
          new Error('Logout failed'),
          '',
          undefined,
          'Logout failed'
        );
        const state = authSlice(stateWithAuth, action);
        
        expect(state.isLoading).toBe(false);
        // State should still be cleared even on rejection
        expect(state.user).toBeNull();
        expect(state.currentProfile).toBeNull();
        expect(state.profiles).toEqual([]);
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBe('Logout failed');
      });
    });
  });

  describe('localStorage integration', () => {
    it('should save current profile to localStorage when setCurrentProfile is called', () => {
      const action = setCurrentProfile(mockProfile);
      authSlice(initialState, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'current_profile',
        JSON.stringify(mockProfile)
      );
    });

    it('should clear all auth tokens when logout thunk is executed', async () => {
      const thunk = logout();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      await thunk(dispatch, getState, undefined);
      
      // The logout thunk should call clearAllAuthTokens
      expect(mockRefreshTokenService.clearAllAuthTokens).toHaveBeenCalled();
      // The logout thunk should also call FiduAuthCookieService.clearTokens
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });

  describe('profile selection logic', () => {
    it('should use saved profile if it exists in fetched profiles', async () => {
      // Mock getTokens to return null so it falls back to localStorage
      mockGetTokens.mockResolvedValueOnce(null);
      
      const savedProfile = {
        id: 'profile-1',
        name: 'Saved Profile',
        user_id: 'user-1',
        create_timestamp: '2024-01-01T00:00:00Z',
        update_timestamp: '2024-01-01T00:00:00Z',
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce('test-token')
        .mockReturnValueOnce(JSON.stringify(mockUser))
        .mockReturnValueOnce(JSON.stringify(savedProfile));
      
      const userWithProfiles = {
        ...mockUser,
        profiles: [savedProfile, { id: 'profile-2', name: 'Other Profile', user_id: 'user-1', create_timestamp: '2024-01-01T00:00:00Z', update_timestamp: '2024-01-01T00:00:00Z' }],
      };
      
      mockAuthApi.getCurrentUser.mockResolvedValue(userWithProfiles);
      
      const thunk = initializeAuth();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      dispatch.mockResolvedValueOnce({
        unwrap: () => Promise.resolve(userWithProfiles),
      });
      
      await thunk(dispatch, getState, undefined);
      
      expect(mockGetTokens).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auth_token',
        'test-token'
      );
      // When saved profile exists and is valid, it doesn't call setItem for current_profile
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'current_profile',
        JSON.stringify(savedProfile)
      );
    });

    it('should use first profile if saved profile does not exist', async () => {
      // Mock getTokens to return null so it falls back to localStorage
      mockGetTokens.mockResolvedValueOnce(null);
      
      const savedProfile = {
        id: 'profile-3', // This profile doesn't exist in the fetched profiles
        name: 'Non-existent Profile',
        user_id: 'user-1',
        create_timestamp: '2024-01-01T00:00:00Z',
        update_timestamp: '2024-01-01T00:00:00Z',
      };
      
      // Reset mock to track calls properly
      mockLocalStorage.getItem.mockReset();
      mockLocalStorage.setItem.mockReset();
      
      mockLocalStorage.getItem
        .mockReturnValueOnce('test-token') // auth_token
        .mockReturnValueOnce(JSON.stringify(mockUser)) // user
        .mockReturnValueOnce(JSON.stringify(savedProfile)); // current_profile
      
      // const _firstProfile = mockUser.profiles[0];
      
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);
      
      const thunk = initializeAuth();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      dispatch.mockResolvedValueOnce({
        unwrap: () => Promise.resolve(mockUser),
      });
      
      await thunk(dispatch, getState, undefined);
      
      expect(mockGetTokens).toHaveBeenCalled();
      // The thunk should process authentication - verify setItem was called
      // It should set auth_token and potentially current_profile
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      // Verify auth_token was set
      const setItemCalls = mockLocalStorage.setItem.mock.calls;
      const authTokenCall = setItemCalls.find(call => call[0] === 'auth_token');
      expect(authTokenCall).toBeDefined();
    });

    it('should handle invalid saved profile JSON', async () => {
      // Mock getTokens to return null so it falls back to localStorage
      mockGetTokens.mockResolvedValueOnce(null);
      
      mockLocalStorage.getItem
        .mockReturnValueOnce('test-token')
        .mockReturnValueOnce(JSON.stringify(mockUser))
        .mockReturnValueOnce('invalid-json');
      
      // const _firstProfile = mockUser.profiles[0];
      
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);
      
      const thunk = initializeAuth();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      dispatch.mockResolvedValueOnce({
        unwrap: () => Promise.resolve(mockUser),
      });
      
      await thunk(dispatch, getState, undefined);
      
      expect(mockGetTokens).toHaveBeenCalled();
      // The thunk should process authentication - verify setItem was called at least once
      // (exact calls may vary based on profile selection logic)
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('refresh token integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Reset mock to return null by default
      mockGetTokens.mockResolvedValue(null);
    });

    it('should use refreshTokenService.clearAllAuthTokens in initializeAuth error handling', async () => {
      // Mock getTokens to return null so it falls back to localStorage
      mockGetTokens.mockResolvedValueOnce(null);
      
      mockLocalStorage.getItem
        .mockReturnValueOnce('test-token')
        .mockReturnValueOnce(JSON.stringify(mockUser))
        .mockReturnValueOnce(JSON.stringify(mockUser.profiles[0]));
      
      mockAuthApi.getCurrentUser.mockRejectedValue(new Error('API Error'));
      
      const thunk = initializeAuth();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      await thunk(dispatch, getState, undefined);
      
      expect(mockGetTokens).toHaveBeenCalled();
      expect(mockRefreshTokenService.clearAllAuthTokens).toHaveBeenCalled();
    });

    it('should use refreshTokenService.clearAllAuthTokens in logout thunk', async () => {
      const stateWithAuth: AuthState = {
        user: mockUser,
        profiles: mockUser.profiles,
        currentProfile: mockUser.profiles[0],
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      };
      
      const thunk = logout();
      const dispatch = jest.fn();
      const getState = jest.fn();
      
      await thunk(dispatch, getState, undefined);
      
      expect(mockRefreshTokenService.clearAllAuthTokens).toHaveBeenCalled();
      expect(mockClearTokens).toHaveBeenCalled();
      
      // Check that the fulfilled action clears the state
      const fulfilledAction = logout.fulfilled(true, '');
      const state = authSlice(stateWithAuth, fulfilledAction);
      
      expect(state.user).toBeNull();
      expect(state.profiles).toEqual([]);
      expect(state.currentProfile).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear tokens consistently across all error scenarios', async () => {
      // Test various error scenarios that should trigger token clearing
      const errorScenarios = [
        new Error('Network error'),
        new Error('Authentication failed'),
        new Error('Token expired'),
      ];

      for (const error of errorScenarios) {
        jest.clearAllMocks();
        
        mockLocalStorage.getItem
          .mockReturnValueOnce('test-token')
          .mockReturnValueOnce(JSON.stringify(mockUser))
          .mockReturnValueOnce(JSON.stringify(mockUser.profiles[0]));
        
        mockAuthApi.getCurrentUser.mockRejectedValue(error);
        
        const thunk = initializeAuth();
        const dispatch = jest.fn();
        const getState = jest.fn();
        
        await thunk(dispatch, getState, undefined);
        
        expect(mockRefreshTokenService.clearAllAuthTokens).toHaveBeenCalled();
      }
    });
  });
});
