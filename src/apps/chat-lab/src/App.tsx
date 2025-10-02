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
import { getThemeColors } from './utils/themeColors';
import { logEnvironmentInfo, getEnvironmentInfo } from './utils/environment';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import AuthWrapper from './components/auth/AuthWrapper';
import GoogleDriveAuthPrompt from './components/auth/GoogleDriveAuthPrompt';
import { getUnifiedStorageService } from './services/storage/UnifiedStorageService';

// Lazy load page components for code splitting
const ConversationsPage = React.lazy(() => import('./pages/ConversationsPage'));
const ContextsPage = React.lazy(() => import('./pages/ContextsPage'));
const SystemPromptsPage = React.lazy(() => import('./pages/SystemPromptsPage'));
const PromptLabPage = React.lazy(() => import('./pages/PromptLabPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const DataMigrationPage = React.lazy(() => import('./pages/DataMigrationPage'));
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

  const [storageModeInfo, setStorageModeInfo] = useState<{mode: string, loadingMessage: string}>({mode: 'local', loadingMessage: 'Initializing storage service...'});


  useEffect(() => {
    logEnvironmentInfo();
    
    // Initialize settings and auth
    dispatch(fetchSettings());
    dispatch(initializeAuth());
    
    // Initialize Google Drive authentication
    dispatch(initializeGoogleDriveAuth());
  }, [dispatch]);

  // Initialize storage service after settings are loaded
  useEffect(() => {
    if (!settings.storageMode) return; // Wait for settings to load
    
    const initializeStorage = async () => {
      try {
        // Check storage mode early to show appropriate loading message
        const envInfo = getEnvironmentInfo();
        const storageMode = envInfo.storageMode;
        const loadingMessage = storageMode === 'cloud' 
          ? 'Fetching your cloud data...' 
          : 'Initializing storage service...';
        
        setStorageModeInfo({ mode: storageMode, loadingMessage });
        
        const storageService = getUnifiedStorageService();
        await storageService.initialize();
        
        console.log('🚀 Storage initialize() complete, validating adapter readiness...');
        
        // For cloud mode, ensure adapter can handle READ operations before ux starts
        if (storageMode === 'cloud') {
          let maxAttempts = 20; // Test adapter repeatedly
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            try {
              // Check adapter status first before attempting any operations
              const adapter = storageService.getAdapter();
              const probeAdapterStart = Date.now();
              
              // For cloud mode, check basic readiness instead of calling database operations
              if ('isAuthenticated' in adapter && typeof adapter.isAuthenticated === 'function') {
                const isAuthenticated = adapter.isAuthenticated();
                if (!isAuthenticated) {
                  console.log(`⏳ [App.Filter] Cloud adapter not authenticated - continuing to allow auth prompt in UI`);
                  // This is expected - let the App proceed, UI will handle auth prompt
                  break;
                }
                
                // If authenticated, do a lightweight probe operation
                await adapter.getContexts(undefined, 1, 1);
              } else {
                // For local adapters, just check readiness without authentication
                // For filesystem adapter, check if directory access is available first
                if ('isDirectoryAccessible' in adapter && typeof adapter.isDirectoryAccessible === 'function') {
                  const isAccessible = adapter.isDirectoryAccessible();
                  if (!isAccessible) {
                    console.log(`⏳ [App.Filter] Filesystem adapter not accessible - continuing to allow directory selection in UI`);
                    // This is expected - let the App proceed, UI will handle directory selection
                    break;
                  }
                }
                await adapter.getContexts(undefined, 1, 1);
              }
              
              const probeAdapterEnd = Date.now();
              console.log(`✅ [App.READY] Cloud adapter probe successful in ${probeAdapterEnd - probeAdapterStart}ms — blocking entry to app beyond this point.`);
              break; // Exit the retry loop; adapter really IS ready
            } catch (probeError: any) {
              attempts++;
              
              if (probeError.message?.includes('Cloud storage adapter not initialized')) {
                console.log(`⏳ [App.Filter] Cloud adapter adapter not ready for ops yet after ${attempts} attempts`);
              } else if (probeError.message?.includes('User must authenticate with Google Drive first')) {
                console.log(`⏳ [App.Filter] Cloud adapter authentication required on attempt ${attempts} - continuing`);
                // This is expected for unauthenticated cloud mode
                break;
              } else if (probeError.message?.includes('No directory access. Please select a directory first')) {
                console.log(`⏳ [App.Filter] Filesystem adapter directory access required on attempt ${attempts} - continuing`);
                // This is expected for filesystem mode without directory access
                break;
              } else {
                // Other error (permissions, connectivity) — bail, let that error surface normally
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
  }, [settings.storageMode]);

  // Periodically check Google Drive auth status to detect changes
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    if (envInfo.storageMode !== 'cloud') {
      return;
    }

    // Check auth status every 30 seconds
    const interval = setInterval(() => {
      dispatch(checkGoogleDriveAuthStatus());
    }, 30000);

    // Also check when the page becomes visible again (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        dispatch(checkGoogleDriveAuthStatus());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for storage changes (when tokens are updated in localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_drive_tokens' && e.newValue !== e.oldValue) {
        // Tokens were updated, check auth status
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

  // Render the main app content
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
                  <Route path="/data-migration" element={<DataMigrationPage />} />
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

  // Show Google Drive auth modal as overlay if needed in cloud storage mode
  if (settings.storageMode === 'cloud' && showAuthModal) {
    return (
      <>
        {mainAppContent}
        <GoogleDriveAuthPrompt 
          onAuthenticated={() => {
            // Refresh the auth status after successful authentication
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
