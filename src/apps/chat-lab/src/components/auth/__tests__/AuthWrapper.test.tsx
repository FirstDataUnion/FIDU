import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AuthWrapper from '../AuthWrapper';
import { MemoryRouter } from 'react-router-dom';

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
}));

// Create a theme for testing
const theme = createTheme();

// Create a mock store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (
        state = {
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          currentProfile: null,
          profiles: [],
        },
        __action: any
      ) => state,
      ...initialState,
    },
  });
};

const renderWithProvidersAndRouter = (ui: React.ReactElement, store: any) => {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
};

describe('AuthWrapper', () => {
  it('should render children when authenticated and profile selected', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          currentProfile: { id: '1', name: 'Test User' },
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div data-testid="protected-content">Protected Content</div>
      </AuthWrapper>,
      mockStore
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render nothing when auth is not initialized', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: false,
          isLoading: false,
          isInitialized: false,
          currentProfile: null,
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div data-testid="protected-content">Protected Content</div>
      </AuthWrapper>,
      mockStore
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render login component when not authenticated', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          currentProfile: null,
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div data-testid="protected-content">Protected Content</div>
      </AuthWrapper>,
      mockStore
    );

    // Should show login component (FiduAuthLogin)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated (workspace is always selected)', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          currentProfile: null,
          profiles: [],
          currentWorkspace: null,
          personalWorkspaces: [],
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div data-testid="protected-content">Protected Content</div>
      </AuthWrapper>,
      mockStore
    );

    // AuthWrapper now always shows children when authenticated
    // (initializeAuth ensures workspace is always selected)
    expect(screen.queryByTestId('protected-content')).toBeInTheDocument();
  });

  it('should handle multiple children correctly', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          currentProfile: { id: '1', name: 'Test User' },
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </AuthWrapper>,
      mockStore
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should handle empty children gracefully', () => {
    const mockStore = createMockStore({
      auth: (
        state = {
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          currentProfile: { id: '1', name: 'Test User' },
        },
        _action: any
      ) => state,
    });

    renderWithProvidersAndRouter(
      <AuthWrapper>
        <div>Empty children</div>
      </AuthWrapper>,
      mockStore
    );

    // Should not crash and should render the wrapper
    expect(screen.getByText('Empty children')).toBeInTheDocument();
  });
});
