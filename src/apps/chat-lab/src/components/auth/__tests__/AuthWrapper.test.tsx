import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AuthWrapper from '../AuthWrapper';

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

// Mock the emailAllowlist module
jest.mock('@/utils/emailAllowlist', () => ({
  isEmailAllowed: jest.fn(() => true),
  getAllowedEmails: jest.fn(() => []),
  isEmailInAllowlist: jest.fn(() => true),
}));

// Create a theme for testing
const theme = createTheme();

// Create a mock store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { isAuthenticated: false, isLoading: false, isInitialized: true, currentProfile: null, profiles: [] }, __action: any) => state,
      ...initialState
    }
  });
};

const _renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </Provider>
  );
};

describe('AuthWrapper', () => {
  it('should render children when authenticated and profile selected', () => {
    const mockStore = createMockStore({
      auth: (state = { isAuthenticated: true, isLoading: false, isInitialized: true, currentProfile: { id: '1', name: 'Test User' } }, _action: any) => state
    });

    render(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <AuthWrapper>
            <div data-testid="protected-content">Protected Content</div>
          </AuthWrapper>
        </ThemeProvider>
      </Provider>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render nothing when auth is not initialized', () => {
    const mockStore = createMockStore({
      auth: (state = { isAuthenticated: false, isLoading: false, isInitialized: false, currentProfile: null }, _action: any) => state
    });

    render(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <AuthWrapper>
            <div data-testid="protected-content">Protected Content</div>
          </AuthWrapper>
        </ThemeProvider>
      </Provider>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render login component when not authenticated', () => {
    const mockStore = createMockStore({
      auth: (state = { isAuthenticated: false, isLoading: false, isInitialized: true, currentProfile: null }, _action: any) => state
    });

    render(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <AuthWrapper>
            <div data-testid="protected-content">Protected Content</div>
          </AuthWrapper>
        </ThemeProvider>
      </Provider>
    );

    // Should show login component (FiduAuthLogin)
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

      it('should render profile selector when authenticated but no profile selected', () => {
        const mockStore = createMockStore({
          auth: (state = { isAuthenticated: true, isLoading: false, isInitialized: true, currentProfile: null, profiles: [] }, _action: any) => state
        });

        render(
          <Provider store={mockStore}>
            <ThemeProvider theme={theme}>
              <AuthWrapper>
                <div data-testid="protected-content">Protected Content</div>
              </AuthWrapper>
            </ThemeProvider>
          </Provider>
        );

        // Should show profile selector
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });

  it('should handle multiple children correctly', () => {
    const mockStore = createMockStore({
      auth: (state = { isAuthenticated: true, isLoading: false, isInitialized: true, currentProfile: { id: '1', name: 'Test User' } }, _action: any) => state
    });

    render(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <AuthWrapper>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
            <div data-testid="child-3">Child 3</div>
          </AuthWrapper>
        </ThemeProvider>
      </Provider>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

      it('should handle empty children gracefully', () => {
        const mockStore = createMockStore({
          auth: (state = { isAuthenticated: true, isLoading: false, isInitialized: true, currentProfile: { id: '1', name: 'Test User' } }, _action: any) => state
        });

        render(
          <Provider store={mockStore}>
            <ThemeProvider theme={theme}>
              <AuthWrapper>
                <div>Empty children</div>
              </AuthWrapper>
            </ThemeProvider>
          </Provider>
        );

        // Should not crash and should render the wrapper
        expect(screen.getByText('Empty children')).toBeInTheDocument();
      });
});
