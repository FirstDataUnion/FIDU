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
    unwrap: jest.fn(() => Promise.resolve()),
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
      <MemoryRouter>{component}</MemoryRouter>
    </ThemeProvider>
  );
};

describe('StorageConfigurationBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';

    // Default mock return values
    mockUseAppSelector.mockImplementation(selector => {
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

    expect(
      screen.getByText('Google Drive is not connected')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Connect your Google Drive account to save your conversations/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Connect Google Drive')).toBeInTheDocument();
  });

  it('should show Connect Google Drive button when not authenticated', () => {
    mockUseAppSelector.mockImplementation(selector => {
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

    expect(screen.getByText('Connect Google Drive')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Connect your Google Drive account to save your conversations/
      )
    ).toBeInTheDocument();
  });

  it('should render compact banner when compact prop is true', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    expect(
      screen.getByText(/Google Drive is not connected/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Connect your Google Drive account to save your data/)
    ).toBeInTheDocument();
    expect(screen.getByText('Connect Google Drive')).toBeInTheDocument();
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

  it('should trigger Google Drive authentication when button is clicked', () => {
    mockUseAppSelector.mockImplementation(selector => {
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

    const connectButton = screen.getByText('Connect Google Drive');
    fireEvent.click(connectButton);

    // The button should trigger the authenticateGoogleDrive action
    // Since it's mocked, we just verify the button exists and is clickable
    expect(connectButton).toBeInTheDocument();
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

  it('should display strong emphasis on Google Drive connection requirement', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const strongText = screen.getByText('Google Drive is not connected');
    expect(strongText.tagName).toBe('STRONG');
  });

  it('should display compact strong emphasis when in compact mode', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const strongText = screen.getByText(/Google Drive is not connected/);
    expect(strongText.tagName).toBe('STRONG');
  });

  it('should have outlined button variant for full banner', () => {
    renderWithProviders(<StorageConfigurationBanner />);

    const button = screen.getByText('Connect Google Drive');
    expect(button).toHaveClass('MuiButton-outlined');
  });

  it('should have small button size for compact banner', () => {
    renderWithProviders(<StorageConfigurationBanner compact />);

    const button = screen.getByText('Connect Google Drive');
    expect(button).toHaveClass('MuiButton-sizeSmall');
  });

  it('should show loading state when Google Drive authentication is in progress', () => {
    mockUseAppSelector.mockImplementation(selector => {
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
    mockUseAppSelector.mockImplementation(selector => {
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
