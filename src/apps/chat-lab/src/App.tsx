import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, Alert } from '@mui/material';
import { store } from './store';
import { useDatabase } from './hooks/useDatabase';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { fetchSettings } from './store/slices/settingsSlice';
import { initializeAuth } from './store/slices/authSlice';
import AuthWrapper from './components/auth/AuthWrapper';
import { logEnvironmentInfo } from './utils/environment';

// Import pages (we'll create these next)
import ConversationsPage from './pages/ConversationsPage';
import MemoriesPage from './pages/MemoriesPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/common/Layout';
import TagsPage from './pages/TagsPage';
import ContextsPage from './pages/ContextsPage';
import SystemPromptsPage from './pages/SystemPromptsPage';
import PromptLabPage from './pages/PromptLabPage';
import PersonasPage from './pages/PersonasPage';
import EmbellishmentsPage from './pages/EmbellishmentsPage';

interface AppContentProps {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const AppContent: React.FC<AppContentProps> = () => {
  const { isInitialized, isLoading, error } = useDatabase();
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  const { isInitialized: authInitialized, isLoading: authLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Log environment info for debugging
    logEnvironmentInfo();
    
    if (isInitialized) {
      dispatch(fetchSettings());
      dispatch(initializeAuth());
    }
  }, [isInitialized, dispatch]);

  // Create theme based on user settings
  const theme = createTheme({
    palette: {
      mode: settings.theme === 'auto' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme,
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
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

  if (isLoading || authLoading) {
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
        <Box>Initializing FIDU Chat Grabber...</Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        p={2}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <strong>Failed to initialize database:</strong> {error}
        </Alert>
      </Box>
    );
  }

  if (!isInitialized) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
      >
        <Alert severity="warning">
          Database not initialized. Please refresh the page.
        </Alert>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename="/fidu-chat-lab">
        <AuthWrapper />
        {authInitialized && (
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/prompt-lab" replace />} />
              <Route path="/conversations" element={<ConversationsPage />} />
              <Route path="/conversations/:id" element={<ConversationsPage />} />
              <Route path="/contexts" element={<ContextsPage />} />
              <Route path="/system-prompts" element={<SystemPromptsPage />} />
              <Route path="/prompt-lab" element={<PromptLabPage />} />
              <Route path="/personas" element={<PersonasPage />} />
              <Route path="/embellishments" element={<EmbellishmentsPage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/prompt-lab" replace />} />
            </Routes>
          </Layout>
        )}
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
