import React, { useEffect, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Box, CircularProgress } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { fetchSettings } from './store/slices/settingsSlice';
import { initializeAuth } from './store/slices/authSlice';
import { initializeGoogleDriveAuth, checkGoogleDriveAuthStatus } from './store/slices/googleDriveAuthSlice';
import { useStorageUserId } from './hooks/useStorageUserId';
import { getThemeColors } from './utils/themeColors';
import { logEnvironmentInfo, getEnvironmentInfo } from './utils/environment';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import AuthWrapper from './components/auth/AuthWrapper';
import GoogleDriveAuthPrompt from './components/auth/GoogleDriveAuthPrompt';
import { getUnifiedStorageService } from './services/storage/UnifiedStorageService';
import { serverLogger } from './utils/serverLogger';

// Lazy load page components for code splitting
const ConversationsPage = React.lazy(() => import('./pages/ConversationsPage'));
const ContextsPage = React.lazy(() => import('./pages/ContextsPage'));
const SystemPromptsPage = React.lazy(() => import('./pages/SystemPromptsPage'));
const PromptLabPage = React.lazy(() => import('./pages/PromptLabPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CloudModeTest = React.lazy(() => import('./components/CloudModeTest'));

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
  const { showAuthModal, isLoading: googleDriveLoading } = useAppSelector((state) => state.googleDriveAuth);
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Sync user ID with storage service when auth state changes
  useStorageUserId();

  const [storageModeInfo, setStorageModeInfo] = useState<{mode: string, loadingMessage: string}>({mode: 'local', loadingMessage: 'Initializing storage service...'});


  useEffect(() => {
    logEnvironmentInfo();
    
    dispatch(fetchSettings());
    dispatch(initializeAuth());
    // Only initialize Google Drive auth if we're in cloud mode
    // This will be handled in the settings effect below
  }, [dispatch]);

  useEffect(() => {
    if (!settings.storageMode) return;
    
    const initializeStorage = async () => {
      try {
        const envInfo = getEnvironmentInfo();
        const storageMode = envInfo.storageMode;
        const loadingMessage = storageMode === 'cloud' 
          ? 'Fetching your cloud data...' 
          : 'Initializing storage service...';
        
        setStorageModeInfo({ mode: storageMode, loadingMessage });
        
        // Only initialize Google Drive auth if we're in cloud mode
        if (storageMode === 'cloud') {
          dispatch(initializeGoogleDriveAuth());
        }
        
        const storageService = getUnifiedStorageService();
        await storageService.initialize();
        
        if (storageMode === 'cloud') {
          const maxAttempts = 20;
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            try {
              const adapter = storageService.getAdapter();
              const _probeAdapterStart = Date.now();
              
              if ('isAuthenticated' in adapter && typeof adapter.isAuthenticated === 'function') {
                const isAuthenticated = adapter.isAuthenticated();
                if (!isAuthenticated) {
                  break;
                }
                
                await adapter.getContexts(undefined, 1, 1);
              } else {
                if ('isDirectoryAccessible' in adapter && typeof adapter.isDirectoryAccessible === 'function') {
                  const isAccessible = adapter.isDirectoryAccessible();
                  if (!isAccessible) {
                    break;
                  }
                }
                await adapter.getContexts(undefined, 1, 1);
              }
              
              const _probeAdapterEnd = Date.now();
              break;
            } catch (probeError: any) {
              attempts++;
              
              if (probeError.message?.includes('Cloud storage adapter not initialized')) {
                // Adapter not ready yet
              } else if (probeError.message?.includes('User must authenticate with Google Drive first')) {
                break;
              } else if (probeError.message?.includes('No directory access. Please select a directory first')) {
                break;
              } else {
                console.error('🚫 [App.Filter] Probe hit a non initialization error', { error: probeError });
                setStorageError(`Adapter probe failed: ${probeError.message || 'Unknown probe error'}`);
                setStorageInitialized(false);
                return;
              }
              
              if (attempts >= maxAttempts) {
                console.warn('⚠️ Cloud adapter never became operation-ready within total probe timeout. Will continue since initial sync was attempted.');
                setStorageError(`Cloud storage adapter took longer than expected to come fully online.  Please reload if issues persist.`);
              }
              
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        console.log('✅ Storage service initialized successfully');
        setStorageInitialized(true);
        setStorageError(null);
      } catch (error: any) {
        console.error('❌ Failed to initialize storage service:', error);
        setStorageError(error.message || 'Failed to initialize storage service');
        setStorageInitialized(false);
      }
    };
    
    initializeStorage();
  }, [settings.storageMode, dispatch]);

  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    if (envInfo.storageMode !== 'cloud') {
      return;
    }

    const interval = setInterval(() => {
      dispatch(checkGoogleDriveAuthStatus());
    }, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        dispatch(checkGoogleDriveAuthStatus());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_drive_tokens' && e.newValue !== e.oldValue) {
        dispatch(checkGoogleDriveAuthStatus());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [dispatch]);

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

  if (authLoading || !storageInitialized || googleDriveLoading) {
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
        <Box>
          {authLoading ? 'Initializing FIDU Chat Lab...' : 
           googleDriveLoading ? 'Checking Google Drive connection...' :
           storageModeInfo.loadingMessage}
        </Box>
        {storageModeInfo.mode === 'cloud' && !storageError && (
          <Box color="text.secondary" textAlign="center" maxWidth="400px" fontSize="0.9em">
            <Box>Setting up Google Drive connection</Box>
            <Box fontSize="0.8em" mt={0.5}>
              This may take a few moments the first time...
            </Box>
          </Box>
        )}
        {storageError && (
          <Box color="error.main" textAlign="center" maxWidth="400px">
            <Box fontWeight="bold" mb={1}>Storage Initialization Error:</Box>
            <Box fontSize="0.9em">{storageError}</Box>
            <Box fontSize="0.8em" mt={1} color="text.secondary">
              Please check your configuration and try again.
            </Box>
          </Box>
        )}
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

  const mainAppContent = (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename="/fidu-chat-lab">
        <ErrorBoundary>
          <AuthWrapper>
            <Layout>
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<PromptLabPage />} />
                  <Route path="/prompt-lab" element={<PromptLabPage />} />
                  <Route path="/conversations" element={<ConversationsPage />} />
                  <Route path="/contexts" element={<ContextsPage />} />
                  <Route path="/system-prompts" element={<SystemPromptsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/cloud-test" element={<CloudModeTest />} />
                </Routes>
              </Suspense>
            </Layout>
          </AuthWrapper>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );

  const envInfo = getEnvironmentInfo();
  
  // Only show Google Drive auth modal if we're in cloud environment AND cloud storage mode
  if (envInfo.storageMode === 'cloud' && settings.storageMode === 'cloud' && showAuthModal) {
    serverLogger.info('🚀 Showing Google Drive auth modal');
    return (
      <>
        {mainAppContent}
        <GoogleDriveAuthPrompt 
          onAuthenticated={() => {
            serverLogger.info('🔄 onAuthenticated callback called, refreshing auth status');
            dispatch(initializeGoogleDriveAuth());
          }} 
        />
      </>
    );
  }

  return mainAppContent;
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
