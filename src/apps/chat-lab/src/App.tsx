import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Box, CircularProgress } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { fetchSettings } from './store/slices/settingsSlice';
import { initializeAuth } from './store/slices/authSlice';
import { getThemeColors } from './utils/themeColors';
import { logEnvironmentInfo } from './utils/environment';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy load page components for code splitting
const ConversationsPage = React.lazy(() => import('./pages/ConversationsPage'));
const ContextsPage = React.lazy(() => import('./pages/ContextsPage'));
const SystemPromptsPage = React.lazy(() => import('./pages/SystemPromptsPage'));
const PromptLabPage = React.lazy(() => import('./pages/PromptLabPage'));
const EmbellishmentsPage = React.lazy(() => import('./pages/EmbellishmentsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// Loading fallback component for lazy-loaded routes
const PageLoadingFallback: React.FC = () => (
  <Box 
    display="flex" 
    justifyContent="center" 
    alignItems="center" 
    height="50vh"
    flexDirection="column"
    gap={2}
  >
    <CircularProgress size={40} />
    <Box>Loading page...</Box>
  </Box>
);

interface AppContentProps {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const AppContent: React.FC<AppContentProps> = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  const { isInitialized: authInitialized, isLoading: authLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    logEnvironmentInfo();
    
    // Initialize settings and auth
    dispatch(fetchSettings());
    dispatch(initializeAuth());
  }, [dispatch]);

  // Create theme based on user settings
  const currentMode = settings.theme === 'auto' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme;
  
  const themeColors = getThemeColors(currentMode);
  
  const theme = createTheme({
    palette: {
      mode: currentMode,
      primary: {
        main: themeColors.primary.main,
        light: themeColors.primary.light,
        dark: themeColors.primary.dark,
        contrastText: themeColors.primary.contrastText,
      },
      secondary: {
        main: themeColors.secondary.main,
        light: themeColors.secondary.light,
        dark: themeColors.secondary.dark,
        contrastText: themeColors.secondary.contrastText,
      },
      background: {
        default: themeColors.background.default,
        paper: themeColors.background.paper,
      },
      text: {
        primary: themeColors.text.primary,
        secondary: themeColors.text.secondary,
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: (theme: any) => theme.palette.mode === 'dark' ? '#424242' : '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          },
        },
      },
    },
  });

  if (authLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Box>Initializing FIDU Chat Lab...</Box>
      </Box>
    );
  }

  if (!authInitialized) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Box>Initializing authentication...</Box>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename="/fidu-chat-lab">
        <ErrorBoundary>
          <Layout>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/" element={<PromptLabPage />} />
                <Route path="/prompt-lab" element={<PromptLabPage />} />
                <Route path="/conversations" element={<ConversationsPage />} />
                <Route path="/contexts" element={<ContextsPage />} />
                <Route path="/system-prompts" element={<SystemPromptsPage />} />
                <Route path="/embellishments" element={<EmbellishmentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
