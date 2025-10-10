import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { StorageDirectoryBanner } from '../StorageDirectoryBanner';

// Mock the environment module
jest.mock('@/utils/environment', () => ({
  environment: {
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  },
  getIdentityServiceUrl: () => 'https://identity.firstdataunion.org',
  getGatewayUrl: () => 'https://gateway.firstdataunion.org',
  getEnvironmentInfo: () => ({
    mode: 'test',
    isDevelopment: true,
    isProduction: false,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'local',
    syncInterval: 300000,
  }),
}));

// Mock the GoogleDriveAuth module
jest.mock('@/services/auth/GoogleDriveAuth', () => ({
  GoogleDriveAuth: jest.fn().mockImplementation(() => ({
    isAuthenticated: jest.fn(() => false),
    authenticate: jest.fn(),
    revoke: jest.fn(),
  })),
}));

// Mock the UnifiedStorageService
jest.mock('../../../services/storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getAdapter: jest.fn(() => ({
      isDirectoryAccessible: jest.fn(() => false),
      hasDirectoryMetadata: jest.fn(() => false),
    })),
  })),
}));

// Create a theme for testing
const theme = createTheme();

// Create a mock store
const createMockStore = (initialState: any = {}) => {
  const defaultState = {
    settings: {
      settings: {
        storageMode: 'filesystem',
        directoryPath: '/Users/test/Documents'
      },
      loading: false,
      error: null
    },
    unifiedStorage: {
      mode: 'filesystem',
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
    }
  };

  // Merge initial state with default state
  const mergedState = { ...defaultState, ...initialState };

  const reducers = {
    settings: (state = mergedState.settings, _action: any) => state,
    unifiedStorage: (state = mergedState.unifiedStorage, _action: any) => state,
  };
  
  return configureStore({
    reducer: reducers
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          {component}
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
};

describe('StorageDirectoryBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render filesystem mode banner when no directory is selected', () => {
    renderWithProviders(<StorageDirectoryBanner />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();
  });

  it('should render compact version when compact prop is true', () => {
    renderWithProviders(<StorageDirectoryBanner compact />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();
  });

  it('should call custom action when provided', () => {
    const mockOnAction = jest.fn();
    renderWithProviders(<StorageDirectoryBanner onAction={mockOnAction} actionText="Custom Action" />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    const actionButton = screen.getByText('Custom Action');
    fireEvent.click(actionButton);

    expect(mockOnAction).toHaveBeenCalledTimes(1);
  });

  it('should use default action text when not provided', () => {
    renderWithProviders(<StorageDirectoryBanner />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
  });

  it('should handle different page types correctly', () => {
    renderWithProviders(<StorageDirectoryBanner pageType="conversations" />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();

    // Clear the screen and render with different page type
    screen.getByText(/File System Storage/i).remove();

    renderWithProviders(<StorageDirectoryBanner pageType="system-prompts" />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();
  });

  it('should not render when directory is already selected', () => {
    renderWithProviders(<StorageDirectoryBanner />, {
      unifiedStorage: {
        mode: 'filesystem',
        status: 'configured',
        userSelectedMode: true,
        googleDrive: {
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
          showAuthModal: false,
          expiresAt: null,
        },
        filesystem: {
          isAccessible: true, // Directory is accessible
          directoryName: '/Users/test/Documents',
          permissionState: 'granted',
        },
        isLoading: false,
        error: null,
      }
    });

    expect(screen.queryByText(/File System Storage/i)).not.toBeInTheDocument();
  });

  it('should not render when not in filesystem mode', () => {
    renderWithProviders(<StorageDirectoryBanner />, {
      unifiedStorage: {
        mode: 'cloud', // Not in filesystem mode
        status: 'configured',
        userSelectedMode: true,
        googleDrive: {
          isAuthenticated: true,
          user: { id: 'test', name: 'Test User', email: 'test@example.com' },
          isLoading: false,
          error: null,
          showAuthModal: false,
          expiresAt: 1234567890,
        },
        filesystem: {
          isAccessible: false,
          directoryName: null,
          permissionState: 'checking',
        },
        isLoading: false,
        error: null,
      }
    });

    expect(screen.queryByText(/File System Storage/i)).not.toBeInTheDocument();
  });

  it('should render with correct styling for different page types', () => {
    renderWithProviders(<StorageDirectoryBanner pageType="prompt-lab" />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();

    // Clear the screen and render with different page type
    screen.getByText(/File System Storage/i).remove();

    renderWithProviders(<StorageDirectoryBanner pageType="contexts" />, {
      settings: {
        settings: {
          storageMode: 'filesystem',
          directoryPath: null
        },
        loading: false,
        error: null
      }
    });

    expect(screen.getByText(/File System Storage/i)).toBeInTheDocument();
  });
});