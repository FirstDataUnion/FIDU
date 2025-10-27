import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { StorageConfigurationBanner } from '../StorageConfigurationBanner';

// Mock Redux hooks
const mockDispatch = jest.fn();
const mockUseAppSelector = jest.fn();

jest.mock('../../../store', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => mockUseAppSelector(selector),
}));

// Mock the authenticateGoogleDrive action
jest.mock('../../../store/slices/unifiedStorageSlice', () => ({
  authenticateGoogleDrive: jest.fn(() => ({
    type: 'unifiedStorage/authenticateGoogleDrive',
    payload: Promise.resolve(),
  })),
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Create a theme for testing
const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('StorageConfigurationBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    
    // Default mock return values
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: false,
          },
        },
        settings: {
          settings: {
            storageMode: 'local',
          },
        },
      };
      return selector(mockState);
    });
  });

  it('should render full banner by default', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    expect(screen.getByText('Storage Configuration Required')).toBeInTheDocument();
    expect(screen.getByText('You need to configure your storage choices to save any of your data. Please go to Settings to set up your preferred storage option.')).toBeInTheDocument();
    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
  });

  it('should show Google Drive reconnect button when user has cloud storage mode but is not authenticated', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: false,
          },
        },
        settings: {
          settings: {
            storageMode: 'cloud',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner />);

    expect(screen.getByText('Reconnect Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Your Google Drive connection has expired. Please reconnect to continue saving your data, or go to Settings to change your storage option.')).toBeInTheDocument();
  });

  it('should not show Google Drive reconnect button when user is authenticated', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: true,
            isLoading: false,
          },
        },
        settings: {
          settings: {
            storageMode: 'cloud',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner />);

    expect(screen.queryByText('Reconnect Google Drive')).not.toBeInTheDocument();
  });

  it('should not show Google Drive reconnect button when user has local storage mode', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: false,
          },
        },
        settings: {
          settings: {
            storageMode: 'local',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner />);

    expect(screen.queryByText('Reconnect Google Drive')).not.toBeInTheDocument();
  });

  it('should render compact banner when compact prop is true', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    expect(screen.getByText('Storage configuration required.')).toBeInTheDocument();
    expect(screen.getByText('You need to configure your storage choices to save any data.')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should show Google Drive reconnect button in compact banner when user has cloud storage mode but is not authenticated', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: false,
          },
        },
        settings: {
          settings: {
            storageMode: 'cloud',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner compact />);

    expect(screen.getByText('Reconnect Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Your Google Drive connection has expired. Please reconnect to continue saving your data.')).toBeInTheDocument();
  });

  it('should have correct styling for full banner', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('MuiAlert-standardError');
  });

  it('should have correct styling for compact banner', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('MuiAlert-standardError');
  });

  it('should navigate to settings when full banner button is clicked', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const settingsButton = screen.getByText('Go to Settings');
    fireEvent.click(settingsButton);

    expect(mockLocation.href).toBe('/fidu-chat-lab/settings');
  });

  it('should navigate to settings when compact banner button is clicked', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    expect(mockLocation.href).toBe('/fidu-chat-lab/settings');
  });

  it('should display warning icon', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    // The warning icon should be present in the alert
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // MUI Alert component automatically handles aria-live
    expect(alert).toHaveAttribute('role', 'alert');
  });

  it('should render with error severity styling', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardError');
  });

  it('should display strong emphasis on storage requirement', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const strongText = screen.getByText('Storage Configuration Required');
    expect(strongText.tagName).toBe('STRONG');
  });

  it('should display compact strong emphasis when in compact mode', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const strongText = screen.getByText('Storage configuration required.');
    expect(strongText.tagName).toBe('STRONG');
  });

  it('should have outlined button variant for full banner', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const button = screen.getByText('Go to Settings');
    expect(button).toHaveClass('MuiButton-outlined');
  });

  it('should have small button size for compact banner', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const button = screen.getByText('Settings');
    expect(button).toHaveClass('MuiButton-sizeSmall');
  });

  it('should show loading state when Google Drive authentication is in progress', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: true,
          },
        },
        settings: {
          settings: {
            storageMode: 'cloud',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeDisabled();
  });

  it('should show loading state in compact banner when Google Drive authentication is in progress', () => {
    mockUseAppSelector.mockImplementation((selector) => {
      const mockState = {
        unifiedStorage: {
          googleDrive: {
            isAuthenticated: false,
            isLoading: true,
          },
        },
        settings: {
          settings: {
            storageMode: 'cloud',
          },
        },
      };
      return selector(mockState);
    });

    renderWithProviders(<StorageConfigurationBanner compact />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeDisabled();
  });
});
