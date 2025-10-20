import React, { useEffect, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Box, CircularProgress } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { fetchSettings } from './store/slices/settingsSlice';
import { initializeAuth } from './store/slices/authSlice';
import { 
  initializeGoogleDriveAuth, 
  checkGoogleDriveAuthStatus,
  markStorageConfigured,
  resetStorageConfiguration,
  updateFilesystemStatus
} from './store/slices/unifiedStorageSlice';
import { authenticateGoogleDrive } from './store/slices/unifiedStorageSlice';
import { useStorageUserId } from './hooks/useStorageUserId';
import { getThemeColors } from './utils/themeColors';
import { logEnvironmentInfo, getEnvironmentInfo } from './utils/environment';
import Layout from './components/common/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import AuthWrapper from './components/auth/AuthWrapper';
import GoogleDriveAuthPrompt from './components/auth/GoogleDriveAuthPrompt';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import { StorageSelectionModal } from './components/storage/StorageSelectionModal';
import { StorageConfigurationBanner } from './components/storage/StorageConfigurationBanner';
import { getUnifiedStorageService } from './services/storage/UnifiedStorageService';
import { serverLogger } from './utils/serverLogger';
import { initializeErrorTracking } from './utils/errorTracking';
import { MetricsService } from './services/metrics/MetricsService';
import { CookieBanner } from './components/common/CookieBanner';

// Lazy load page components for code splitting
const ConversationsPage = React.lazy(() => import('./pages/ConversationsPage'));
const ContextsPage = React.lazy(() => import('./pages/ContextsPage'));
const SystemPromptsPage = React.lazy(() => import('./pages/SystemPromptsPage'));
const PromptLabPage = React.lazy(() => import('./pages/PromptLabPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CloudModeTest = React.lazy(() => import('./components/CloudModeTest'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfUsePage = React.lazy(() => import('./pages/TermsOfUsePage'));
const WhatsNewPage = React.lazy(() => import('./pages/WhatsNewPage'));

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

// Route tracker component for page view metrics
const RouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const basePath = '/fidu-chat-lab';
    let cleanPath = path.startsWith(basePath) ? path.substring(basePath.length) : path;
    cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    const page = cleanPath || 'root';

    // Record page view
    MetricsService.recordPageView(page);
    console.log(`📊 [Metrics] Page view: ${page}`);
  }, [location]);

  return null;
};

interface AppContentProps {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const AppContent: React.FC<AppContentProps> = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  const { isInitialized: authInitialized, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [showStorageSelectionModal, setShowStorageSelectionModal] = useState(false);
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);

  // Sync user ID with storage service when auth state changes
  useStorageUserId();

  const [storageModeInfo, setStorageModeInfo] = useState<{mode: string, loadingMessage: string}>({mode: 'local', loadingMessage: 'Initializing storage service...'});


  useEffect(() => {
    // Initialize error tracking
    initializeErrorTracking();
    
    logEnvironmentInfo();
    
    dispatch(fetchSettings());
    dispatch(initializeAuth());
    // Only initialize Google Drive auth if we're in cloud mode
    // This will be handled in the settings effect below
  }, [dispatch]);

  // Check if storage configuration is needed
  useEffect(() => {
    if (!authInitialized || !unifiedStorage.mode) return;
    
    const envInfo = getEnvironmentInfo();
    
    // Only show storage selection modal in cloud deployment mode
    if (envInfo.storageMode === 'cloud' && unifiedStorage.status !== 'configured' && !unifiedStorage.userSelectedMode) {
      // Only show storage selection modal for completely new users who haven't made any selection
      setShowStorageSelectionModal(true);
    }
  }, [authInitialized, unifiedStorage.mode, unifiedStorage.status, unifiedStorage.userSelectedMode]);

  // Auto-start Google Drive OAuth for returning users who chose cloud mode previously
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    const shouldAutoStart = envInfo.storageMode === 'cloud'
      && unifiedStorage.mode === 'cloud'
      && unifiedStorage.googleDrive.showAuthModal
      && !unifiedStorage.googleDrive.isAuthenticated
      && !unifiedStorage.googleDrive.isLoading
      && unifiedStorage.userSelectedMode
      && !autoAuthAttempted; // avoid loops

    if (!shouldAutoStart) return;

    // Optional user override via localStorage; default to true
    let autoEnable = true;
    try {
      const stored = localStorage.getItem('chatlab_auto_gdrive_auth');
      if (stored === 'false') autoEnable = false;
    } catch {}

    if (!autoEnable) return;

    setAutoAuthAttempted(true);
    // Defer slightly to let modal render/logging, then initiate OAuth redirect
    const t = setTimeout(() => {
      dispatch(authenticateGoogleDrive());
    }, 150);
    return () => clearTimeout(t);
  }, [dispatch, unifiedStorage.mode, unifiedStorage.googleDrive.showAuthModal, unifiedStorage.googleDrive.isAuthenticated, unifiedStorage.googleDrive.isLoading, autoAuthAttempted]);

  // Handle Google Drive authentication status changes
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    
    // If we're in cloud mode and Google Drive is authenticated but storage isn't marked as configured
    if (envInfo.storageMode === 'cloud' && 
        unifiedStorage.mode === 'cloud' && 
        unifiedStorage.googleDrive.isAuthenticated && 
        unifiedStorage.status !== 'configured' && 
        !unifiedStorage.googleDrive.isLoading) {
      // Auto-configure storage since Google Drive is already authenticated
      dispatch(markStorageConfigured());
    }
    
    // If we're in cloud mode and Google Drive auth is lost, reset storage configuration
    if (envInfo.storageMode === 'cloud' && 
        unifiedStorage.mode === 'cloud' && 
        unifiedStorage.status === 'configured' && 
        !unifiedStorage.googleDrive.isAuthenticated && 
        !unifiedStorage.googleDrive.isLoading) {
      dispatch(resetStorageConfiguration());
    }
  }, [dispatch, unifiedStorage.mode, unifiedStorage.status, unifiedStorage.googleDrive.isAuthenticated, unifiedStorage.googleDrive.isLoading]);

  useEffect(() => {
    if (!unifiedStorage.mode) return;
    
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
  }, [unifiedStorage.mode, dispatch]);

  // Sync filesystem status from adapter to unified state
  useEffect(() => {
    if (unifiedStorage.mode === 'filesystem' && storageInitialized) {
      try {
        const storageService = getUnifiedStorageService();
        const adapter = storageService.getAdapter();
        
        // Check if this is a filesystem adapter
        if ('isDirectoryAccessible' in adapter && 'hasDirectoryMetadata' in adapter) {
          const isAccessible = (adapter as any).isDirectoryAccessible();
          const hasMetadata = (adapter as any).hasDirectoryMetadata();
          const directoryName = hasMetadata ? 'FIDU-Data' : null; // We use a consistent name
          
          dispatch(updateFilesystemStatus({
            isAccessible,
            directoryName: directoryName || undefined,
            permissionState: isAccessible ? 'granted' : (hasMetadata ? 'denied' : 'prompt')
          }));
        }
      } catch (error) {
        console.error('Error syncing filesystem status:', error);
      }
    }
  }, [unifiedStorage.mode, storageInitialized, dispatch]);

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

  if (authLoading || !storageInitialized || unifiedStorage.googleDrive.isLoading) {
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
           unifiedStorage.googleDrive.isLoading ? 'Checking Google Drive connection...' :
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

  const envInfo = getEnvironmentInfo();
  
  // Handler for when storage is configured
  const handleStorageConfigured = () => {
    dispatch(markStorageConfigured());
    setShowStorageSelectionModal(false);
  };

  // Handler for dismissing the storage selection modal
  const handleDismissStorageModal = () => {
    setShowStorageSelectionModal(false);
  };

  // Check if we should show the storage configuration banner
  const shouldShowStorageBanner = envInfo.storageMode === 'cloud' && 
    unifiedStorage.status !== 'configured' && 
    !showStorageSelectionModal;

  const mainAppContent = (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename="/fidu-chat-lab">
        <RouteTracker />
        <ErrorBoundary>
          <AuthWrapper>
            <Layout banner={shouldShowStorageBanner ? <StorageConfigurationBanner /> : undefined}>
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<PromptLabPage />} />
                  <Route path="/prompt-lab" element={<PromptLabPage />} />
                  <Route path="/conversations" element={<ConversationsPage />} />
                  <Route path="/contexts" element={<ContextsPage />} />
                  <Route path="/system-prompts" element={<SystemPromptsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms-of-use" element={<TermsOfUsePage />} />
                  <Route path="/whats-new" element={<WhatsNewPage />} />
                  <Route path="/cloud-test" element={<CloudModeTest />} />
                  <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
                </Routes>
              </Suspense>
            </Layout>
          </AuthWrapper>
        </ErrorBoundary>
      </Router>
    </ThemeProvider>
  );

  return (
    <>
      {mainAppContent}
      
      {/* Cookie Consent Banner */}
      <CookieBanner />
      
      {/* Storage Selection Modal - Priority over Google Drive auth modal */}
      <StorageSelectionModal
        open={showStorageSelectionModal}
        onClose={handleDismissStorageModal}
        onStorageConfigured={handleStorageConfigured}
      />
      
      {/* Google Drive Auth Modal - Show when user needs to auth (either configured or initializing) */}
      {envInfo.storageMode === 'cloud' && unifiedStorage.mode === 'cloud' && unifiedStorage.googleDrive.showAuthModal && (
        <GoogleDriveAuthPrompt 
          onAuthenticated={() => {
            // This callback is now handled by the OAuthCallbackPage
            // The OAuth flow will redirect to /oauth-callback which handles everything
            serverLogger.info('🔄 OAuth flow initiated - will redirect to callback page');
          }} 
        />
      )}
    </>
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
