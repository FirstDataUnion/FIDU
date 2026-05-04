import React, { useEffect, Suspense, useRef, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Box, CircularProgress } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { fetchSettings } from './store/slices/settingsSlice';
import { initializeAuth } from './store/slices/authSlice';
import {
  markStorageConfigured,
  resetStorageConfiguration,
  checkGoogleDriveAuthStatus,
  loadWorkspaces,
  switchWorkspace,
  setGoogleDriveLoading,
} from './store/slices/unifiedStorageSlice';
import { authenticateGoogleDrive } from './store/slices/unifiedStorageSlice';
import { useStorageUserId } from './hooks/useStorageUserId';
import { getThemeColors } from './utils/themeColors';
import { logEnvironmentInfo, getEnvironmentInfo } from './utils/environment';
import Layout from './components/common/Layout';
import PublicPageWrapper from './components/common/PublicPageWrapper';
import ErrorBoundary from './components/common/ErrorBoundary';
import AuthWrapper from './components/auth/AuthWrapper';
import { AuthErrorBoundary } from './components/auth/AuthErrorBoundary';
import GoogleDriveAuthPrompt from './components/auth/GoogleDriveAuthPrompt';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import { StorageSelectionModal } from './components/storage/StorageSelectionModal';
import { StorageConfigurationBanner } from './components/storage/StorageConfigurationBanner';
import { isPublicRoute } from './utils/publicRoutes';
import { getUnifiedStorageService } from './services/storage/UnifiedStorageService';
import { getStorageService } from './services/storage/StorageService';
import { serverLogger } from './utils/serverLogger';
import { initializeErrorTracking } from './utils/errorTracking';
import { MetricsService } from './services/metrics/MetricsService';
import { CookieBanner } from './components/common/CookieBanner';
import { WelcomeLandingPage } from './components/common/WelcomeLandingPage';
import { getGoogleDriveAuthService } from './services/auth/GoogleDriveAuth';
import { getAuthManager } from './services/auth/AuthManager';
import LoadingProgress from './components/common/LoadingProgress';
import type { LoadingStep } from './components/common/LoadingProgress';
import { AlertClickProvider } from './contexts/AlertClickContext';
import { StorageFeatureGuard } from './components/common/StorageFeatureGuard';
import { FeatureFlagGuard } from './components/common/FeatureFlagGuard';
import {
  supportsDocuments,
  supportsBackgroundAgents,
} from './utils/storageFeatureChecks';
import { fetchSystemFeatureFlags } from './store/slices/systemFeatureFlagsSlice';
import { FEATURE_FLAGS_REFRESH_INTERVAL_MS } from './services/featureFlags/FeatureFlagsService';
import {
  endPerfMark,
  recordPerfMetric,
  startPerfMark,
} from './utils/perfMarks';

// Lazy load page components for code splitting
const ConversationsPage = React.lazy(() => import('./pages/ConversationsPage'));
const ContextsPage = React.lazy(() => import('./pages/ContextsPage'));
const SystemPromptsPage = React.lazy(() => import('./pages/SystemPromptsPage'));
const PromptLabPage = React.lazy(() => import('./pages/PromptLabPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const BackgroundAgentsPage = React.lazy(
  () => import('./pages/BackgroundAgentsPage')
);
const WorkspacesPage = React.lazy(() => import('./pages/WorkspacesPage'));
const CloudModeTest = React.lazy(() => import('./components/CloudModeTest'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfUsePage = React.lazy(() => import('./pages/TermsOfUsePage'));
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage'));
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
    let cleanPath = path.startsWith(basePath)
      ? path.substring(basePath.length)
      : path;
    cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    const page = cleanPath || 'root';

    // Record page view
    MetricsService.recordPageView(page);
    console.log(`📊 [Metrics] Page view: ${page}`);
  }, [location]);

  return null;
};

// Conditional layout wrapper that renders Layout for authenticated routes
// and PublicPageWrapper for public routes
const ConditionalLayout: React.FC<{
  children: React.ReactNode;
  banner?: React.ReactNode;
}> = ({ children, banner }) => {
  const location = useLocation();
  const isPublic = isPublicRoute(location.pathname);

  if (isPublic) {
    return <PublicPageWrapper>{children}</PublicPageWrapper>;
  }

  return <Layout banner={banner}>{children}</Layout>;
};

// Wrapper for modals/banners that only renders them on non-public routes
const ConditionalModals: React.FC<{
  showStorageModal: boolean;
  onDismissStorageModal: () => void;
  onStorageConfigured: () => void;
  envInfo: any;
  unifiedStorage: any;
}> = ({
  showStorageModal,
  onDismissStorageModal,
  onStorageConfigured,
  envInfo,
  unifiedStorage,
}) => {
  const location = useLocation();
  const isPublic = isPublicRoute(location.pathname);

  if (isPublic) {
    return null;
  }

  return (
    <>
      {/* Cookie Consent Banner */}
      <CookieBanner />

      {/* Welcome Landing Page - Show when user is authenticated */}
      <WelcomeLandingPage />

      {/* Storage Selection Modal - Priority over Google Drive auth modal */}
      <StorageSelectionModal
        open={showStorageModal}
        onClose={onDismissStorageModal}
        onStorageConfigured={onStorageConfigured}
      />

      {/* Google Drive Auth Modal - Show when user needs to auth (either configured or initializing) */}
      {envInfo.storageMode === 'cloud'
        && unifiedStorage.mode === 'cloud'
        && unifiedStorage.googleDrive.showAuthModal && (
          <GoogleDriveAuthPrompt
            onAuthenticated={() => {
              // This callback is now handled by the OAuthCallbackPage
              // The OAuth flow will redirect to /oauth-callback which handles everything
              serverLogger.info(
                '🔄 OAuth flow initiated - will redirect to callback page'
              );
            }}
          />
        )}
    </>
  );
};

const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { settings } = useAppSelector(state => state.settings);
  const currentMode =
    settings.theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : settings.theme;

  const themeColors = getThemeColors(currentMode);
  const theme = createTheme({
    palette: {
      mode: currentMode,
      ...themeColors,
    },
    typography: {
      fontFamily: '"Poppins", sans-serif',
      fontWeightRegular: 400,
      h1: {
        fontWeight: 500,
      },
      h2: {
        fontWeight: 500,
      },
      h3: {
        fontWeight: 500,
      },
      h4: {
        fontWeight: 500,
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
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
              background: (theme: any) =>
                theme.palette.mode === 'dark' ? '#424242' : '#f1f1f1',
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
      MuiDialogActions: {
        styleOverrides: {
          root: ({ theme }) => ({
            gap: theme.spacing(1),
            paddingInline: theme.spacing(3),
            paddingBottom: theme.spacing(2),
            borderTop: `1px solid ${theme.palette.divider}`,
            '& .MuiButton-text': {
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            },
            '& .MuiButton-contained': {
              fontWeight: 600,
            },
          }),
        },
      },
    },
  });

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

interface AppContentProps {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const AppContent: React.FC<AppContentProps> = () => {
  const dispatch = useAppDispatch();
  const {
    isInitialized: authInitialized,
    isLoading: authLoading,
    isAuthenticated: hasFIDUAuth,
  } = useAppSelector(state => state.auth);
  const unifiedStorage = useAppSelector(state => state.unifiedStorage);
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [_, setStorageError] = useState<string | null>(null);
  const [showStorageSelectionModal, setShowStorageSelectionModal] =
    useState(false);
  const [autoAuthAttempted, setAutoAuthAttempted] = useState(false);
  const [cloudAdapterFullyInitialized, setCloudAdapterFullyInitialized] =
    useState(false);
  const skipStorageInitRef = useRef(false);
  const [earlyNoAuthDetected, setEarlyNoAuthDetected] = useState(false);
  const [earlyAuthCheckComplete, setEarlyAuthCheckComplete] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [workspaceRestoreWaitExceeded, setWorkspaceRestoreWaitExceeded] =
    useState(false);
  const visibilityRestoreInFlightRef = useRef(false);
  const lastFullVisibilityRestoreAtRef = useRef(0);
  const lastAuthOnlyRestoreAtRef = useRef(0);
  const visibilityRestoreTimeoutRef = useRef<number | null>(null);
  const appWasHiddenRef = useRef(false);
  const cloudFinalizeStartedRef = useRef(false);
  const appStartupMarkRef = useRef<string | null>(
    startPerfMark('app_open_total_ms')
  );
  const loadingScreenVisibleMarkRef = useRef<string | null>(null);

  // Sync user ID with storage service when auth state changes
  useStorageUserId();

  useEffect(() => {
    dispatch(fetchSystemFeatureFlags());
    const intervalId = window.setInterval(() => {
      dispatch(fetchSystemFeatureFlags());
    }, FEATURE_FLAGS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch]);

  const [storageModeInfo, setStorageModeInfo] = useState<{
    mode: string;
    loadingMessage: string;
  }>({ mode: 'local', loadingMessage: 'Initializing storage service...' });

  // Loading progress steps for unified loading screen
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: 'settings', label: 'Loading settings', status: 'pending' },
    { id: 'auth', label: 'Checking authentication', status: 'pending' },
    { id: 'storage', label: 'Initializing storage', status: 'pending' },
    {
      id: 'google-drive',
      label: 'Connecting to Google Drive',
      status: 'pending',
    },
    { id: 'data-sync', label: 'Syncing your data', status: 'pending' },
  ]);

  // Helper to update a step's status
  const updateLoadingStep = (
    stepId: string,
    status: LoadingStep['status'],
    errorMessage?: string
  ) => {
    setLoadingSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, errorMessage } : step
      )
    );
  };

  // Early check: Detect if there are no FIDU tokens BEFORE starting full initialization
  useEffect(() => {
    const checkForFiduTokensEarly = async () => {
      const envInfo = getEnvironmentInfo();

      // Only do early check in cloud mode
      if (envInfo.storageMode !== 'cloud') {
        setEarlyAuthCheckComplete(true);
        return;
      }

      try {
        // Quick check for FIDU tokens before starting full initialization
        const { getFiduAuthService } =
          await import('./services/auth/FiduAuthService');
        const fiduAuthService = getFiduAuthService();
        const isAuthenticated = await fiduAuthService.isAuthenticated();

        if (!isAuthenticated) {
          console.log(
            '⚡ [Early Check] No FIDU tokens found - skipping loading screen'
          );
          setEarlyNoAuthDetected(true);
          setStorageInitialized(true);
          setCloudAdapterFullyInitialized(true);
          skipStorageInitRef.current = true;

          // Mark all loading steps as completed immediately
          updateLoadingStep('settings', 'completed');
          updateLoadingStep('auth', 'completed');
          updateLoadingStep('storage', 'completed');
          updateLoadingStep('google-drive', 'completed');
          updateLoadingStep('data-sync', 'completed');
        }
      } catch (error) {
        console.warn('Early auth check failed:', error);
      } finally {
        setEarlyAuthCheckComplete(true);
      }
    };

    checkForFiduTokensEarly();
  }, []);

  useEffect(() => {
    // Wait for early auth check to complete
    if (!earlyAuthCheckComplete) {
      return;
    }

    // If early check detected no auth in cloud mode, skip full initialization
    if (earlyNoAuthDetected) {
      console.log(
        '⚡ [Optimization] Skipping full initialization - no FIDU auth detected early'
      );
      // Still need to initialize settings and auth for proper app state
      dispatch(fetchSettings());
      dispatch(initializeAuth());
      return;
    }

    // Initialize error tracking
    initializeErrorTracking();

    logEnvironmentInfo();

    // Initialize settings and auth
    const initializeApp = async () => {
      try {
        // Parallelize independent operations and gracefully handle failures
        // Settings require auth tokens, but we attempt both in parallel
        // If auth fails, settings will also fail gracefully and use defaults
        console.log(
          '🔄 Initializing app with parallel cookie-based settings and auth...'
        );

        // Update loading steps
        updateLoadingStep('settings', 'in_progress');
        updateLoadingStep('auth', 'in_progress');

        const settingsMark = startPerfMark('app_open_settings_init_ms');
        const authMark = startPerfMark('app_open_auth_init_ms');
        const [settingsResult, authResult] = await Promise.allSettled([
          dispatch(fetchSettings())
            .unwrap()
            .finally(() => {
              recordPerfMetric(
                'app_open_settings_init_ms',
                endPerfMark(settingsMark)
              );
            }),
          dispatch(initializeAuth())
            .unwrap()
            .finally(() => {
              recordPerfMetric('app_open_auth_init_ms', endPerfMark(authMark));
            }),
        ]);

        // Update settings step status
        if (settingsResult.status === 'fulfilled') {
          updateLoadingStep('settings', 'completed');
        } else {
          // Settings failure is expected when no auth exists
          if (authResult.status === 'rejected' || authResult.value === null) {
            console.log(
              'ℹ️  [Optimization] No authentication - using default settings'
            );
            updateLoadingStep('settings', 'completed'); // Still count as completed (using defaults)
          } else {
            console.warn(
              '⚠️  Settings failed to load despite authentication:',
              settingsResult.reason
            );
            updateLoadingStep('settings', 'error', 'Failed to load settings');
          }
        }

        // Update auth step status
        if (authResult.status === 'fulfilled') {
          updateLoadingStep('auth', 'completed');

          // Load workspaces after auth is initialized
          // This ensures the active workspace is set in Redux state
          // IMPORTANT: Await this to ensure workspace restoration happens after workspaces are loaded
          try {
            const workspacesMark = startPerfMark('app_open_load_workspaces_ms');
            await dispatch(loadWorkspaces()).unwrap();
            recordPerfMetric(
              'app_open_load_workspaces_ms',
              endPerfMark(workspacesMark)
            );
          } catch (error) {
            console.warn('Failed to load workspaces on initialization:', error);
          }

          // Early exit for cloud mode without FIDU auth - skip loading screen
          // Check if auth returned null (no auth available)
          if (authResult.value === null) {
            const envInfo = getEnvironmentInfo();
            if (envInfo.storageMode === 'cloud') {
              console.log(
                '⚡ [Optimization] No FIDU auth in cloud mode - showing login screen immediately'
              );
              // Mark all remaining steps as completed to show the app
              updateLoadingStep('storage', 'completed');
              updateLoadingStep('google-drive', 'completed');
              updateLoadingStep('data-sync', 'completed');
              setStorageInitialized(true);
              setCloudAdapterFullyInitialized(true);
              // Persistently skip any storage initialization thereafter
              skipStorageInitRef.current = true;
            }
          }
        } else {
          updateLoadingStep('auth', 'completed'); // No auth is also a valid state
          // Still try to load workspaces even if auth failed (workspace registry might have data)
          // IMPORTANT: Await this to ensure workspace restoration happens after workspaces are loaded
          try {
            const workspacesMark = startPerfMark('app_open_load_workspaces_ms');
            await dispatch(loadWorkspaces()).unwrap();
            recordPerfMetric(
              'app_open_load_workspaces_ms',
              endPerfMark(workspacesMark)
            );
          } catch (error) {
            console.warn('Failed to load workspaces on initialization:', error);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize app:', error);
        updateLoadingStep('settings', 'error', 'Initialization failed');
        updateLoadingStep('auth', 'error', 'Initialization failed');
        // Fallback to default initialization
        dispatch(fetchSettings());
        dispatch(initializeAuth());
      }
    };

    initializeApp();
  }, [dispatch, earlyAuthCheckComplete, earlyNoAuthDetected]);

  // Check if storage configuration is needed
  useEffect(() => {
    if (!authInitialized || !unifiedStorage.mode) return;

    const envInfo = getEnvironmentInfo();

    // Only show storage selection modal in cloud deployment mode
    if (
      envInfo.storageMode === 'cloud'
      && unifiedStorage.status !== 'configured'
      && !unifiedStorage.userSelectedMode
    ) {
      // Only show storage selection modal for completely new users who haven't made any selection
      setShowStorageSelectionModal(true);
    }
  }, [
    authInitialized,
    unifiedStorage.mode,
    unifiedStorage.status,
    unifiedStorage.userSelectedMode,
  ]);

  // Auto-start Google Drive OAuth for returning users who chose cloud mode previously
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    const shouldAutoStart =
      envInfo.storageMode === 'cloud'
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
    } catch {
      // Ignore localStorage errors
    }

    if (!autoEnable) return;

    setAutoAuthAttempted(true);
    // Defer slightly to let modal render/logging, then initiate OAuth redirect
    const t = setTimeout(() => {
      dispatch(authenticateGoogleDrive());
    }, 150);
    return () => clearTimeout(t);
  }, [
    dispatch,
    unifiedStorage.mode,
    unifiedStorage.googleDrive.showAuthModal,
    unifiedStorage.googleDrive.isAuthenticated,
    unifiedStorage.googleDrive.isLoading,
    unifiedStorage.userSelectedMode,
    autoAuthAttempted,
  ]);

  // Handle Google Drive authentication status changes
  useEffect(() => {
    const envInfo = getEnvironmentInfo();

    // If we're in cloud mode and Google Drive is authenticated but storage isn't marked as configured
    if (
      envInfo.storageMode === 'cloud'
      && unifiedStorage.mode === 'cloud'
      && unifiedStorage.googleDrive.isAuthenticated
      && unifiedStorage.status !== 'configured'
      && !unifiedStorage.googleDrive.isLoading
    ) {
      // Auto-configure storage since Google Drive is already authenticated
      dispatch(markStorageConfigured());
    }

    // Only reset storage configuration if Google Drive auth is truly lost (not just temporarily unavailable)
    // Don't reset during initial storage initialization
    if (
      envInfo.storageMode === 'cloud'
      && unifiedStorage.mode === 'cloud'
      && unifiedStorage.status === 'configured'
      && !unifiedStorage.googleDrive.isAuthenticated
      && !unifiedStorage.googleDrive.isLoading
      && storageInitialized
    ) {
      // Only consider resetting if storage was previously initialized

      // Set a timeout to delay the reset, allowing time for cookie restoration
      const resetTimeout = setTimeout(() => {
        // Double-check that we're still not authenticated after the delay
        if (
          !unifiedStorage.googleDrive.isAuthenticated
          && !unifiedStorage.googleDrive.isLoading
        ) {
          console.log(
            '🔄 Google Drive authentication lost, resetting storage configuration'
          );
          dispatch(resetStorageConfiguration());
        }
      }, 5000); // 5 second delay to allow for cookie restoration and visibility changes

      return () => clearTimeout(resetTimeout);
    }
  }, [
    dispatch,
    unifiedStorage.mode,
    unifiedStorage.status,
    unifiedStorage.googleDrive.isAuthenticated,
    unifiedStorage.googleDrive.isLoading,
    storageInitialized,
  ]);

  useEffect(() => {
    if (!unifiedStorage.mode) return;

    const initializeStorage = async () => {
      try {
        // If we've decided to skip storage initialization, exit early
        if (skipStorageInitRef.current) {
          return;
        }
        const envInfo = getEnvironmentInfo();
        const storageMode = envInfo.storageMode;

        // Skip storage initialization in cloud mode if no FIDU auth AND auth has been checked
        // This prevents skipping on first load when auth hasn't been checked yet
        if (storageMode === 'cloud' && authInitialized && !hasFIDUAuth) {
          // Don't re-run if we've already marked storage as initialized
          if (!storageInitialized) {
            console.log(
              '⚡ [Optimization] Skipping storage initialization - no FIDU auth in cloud mode'
            );
            setStorageInitialized(true);
            setCloudAdapterFullyInitialized(true);
            updateLoadingStep('storage', 'completed');
            updateLoadingStep('google-drive', 'completed');
            updateLoadingStep('data-sync', 'completed');
          }
          // Persistently skip any storage initialization thereafter
          skipStorageInitRef.current = true;
          return;
        }

        // Don't re-initialize if already done
        if (storageInitialized) {
          return;
        }

        const loadingMessage =
          storageMode === 'cloud'
            ? 'Fetching your cloud data...'
            : 'Initializing storage service...';

        setStorageModeInfo({ mode: storageMode, loadingMessage });

        // Update loading step
        updateLoadingStep('storage', 'in_progress');

        // Initialize storage service (for cloud mode, this will also initialize Google Drive auth)
        const storageService = getUnifiedStorageService();
        const storageInitMark = startPerfMark('app_open_storage_initialize_ms');
        await storageService.initialize();
        recordPerfMetric(
          'app_open_storage_initialize_ms',
          endPerfMark(storageInitMark)
        );
        updateLoadingStep('storage', 'completed');

        // For cloud mode, initialize AuthManager with the Google Drive auth service
        if (storageMode === 'cloud') {
          console.log('🔄 Initializing centralized AuthManager...');
          updateLoadingStep('google-drive', 'in_progress');

          // Drive cookie restore / token refresh can take up to HTTP timeouts; this flag
          // lets the global loader reflect only that in-flight probe (see waitingForCloudAuth).
          dispatch(setGoogleDriveLoading(true));
          try {
            const authManager = getAuthManager(dispatch);
            const googleDriveAuthService = await getGoogleDriveAuthService();
            authManager.setGoogleDriveAuthService(googleDriveAuthService);

            const authManagerInitMark = startPerfMark(
              'app_open_auth_manager_initialize_ms'
            );
            await authManager.initialize();
            recordPerfMetric(
              'app_open_auth_manager_initialize_ms',
              endPerfMark(authManagerInitMark)
            );
            console.log('✅ AuthManager initialization complete');

            const authStatus = authManager.getAuthStatus();

            if (authStatus.isAuthenticated && authStatus.user) {
              console.log(
                '✅ [Optimization] AuthManager confirms authentication - skipping probe loop'
              );
              updateLoadingStep('google-drive', 'completed');
              updateLoadingStep('data-sync', 'completed');
            } else {
              console.log(
                'ℹ️  [Optimization] No authentication confirmed - user needs to connect'
              );
              updateLoadingStep('google-drive', 'completed');
              updateLoadingStep('data-sync', 'completed');
            }
          } finally {
            dispatch(setGoogleDriveLoading(false));
          }
        } else {
          // Local mode - skip Google Drive and sync steps
          updateLoadingStep('google-drive', 'completed');
          updateLoadingStep('data-sync', 'completed');
        }

        console.log('✅ Storage service initialized successfully');
        setStorageInitialized(true);
        setStorageError(null);

        // Mark storage as configured after successful initialization
        // For cloud mode, auth status was already updated earlier
        // For local mode, storage is ready after successful initialization
        dispatch(markStorageConfigured());
        console.log('✅ Storage marked as configured');
      } catch (error: any) {
        console.error('❌ Failed to initialize storage service:', error);
        updateLoadingStep(
          'storage',
          'error',
          error.message || 'Storage initialization failed'
        );
        setStorageError(
          error.message || 'Failed to initialize storage service'
        );
        setStorageInitialized(false);
      }
    };

    initializeStorage();
  }, [
    unifiedStorage.mode,
    dispatch,
    authInitialized,
    hasFIDUAuth,
    storageInitialized,
  ]);

  // Re-initialize CloudStorageAdapter when authentication becomes available
  useEffect(() => {
    const checkAndCompleteInitialization = async () => {
      const envInfo = getEnvironmentInfo();
      if (envInfo.storageMode !== 'cloud') {
        // Not cloud mode - set as initialized
        setCloudAdapterFullyInitialized(true);
        return;
      }

      if (!storageInitialized) return;

      // If no FIDU auth, set flag to allow login screen to show
      if (!unifiedStorage.googleDrive.isAuthenticated) {
        console.log(
          'ℹ️  [App] No authentication - setting cloud adapter flag to allow login screen'
        );
        setCloudAdapterFullyInitialized(true);
        return;
      }

      try {
        const storageService = getUnifiedStorageService();
        const adapter = storageService.getAdapter();

        // Check if adapter is a CloudStorageAdapter
        if (
          'isFullyInitialized' in adapter
          && typeof adapter.isFullyInitialized === 'function'
        ) {
          const isFullyInitialized = adapter.isFullyInitialized();

          if (!isFullyInitialized) {
            // Don't block app render on full cloud adapter finalization.
            // This can involve a large Drive sync; we run it in background instead.
            if (!cloudFinalizeStartedRef.current) {
              cloudFinalizeStartedRef.current = true;
              updateLoadingStep('google-drive', 'in_progress');
              const cloudAdapterMark = startPerfMark(
                'app_open_cloud_adapter_finalize_ms'
              );
              void (adapter as any)
                .initialize()
                .then(() => {
                  recordPerfMetric(
                    'app_open_cloud_adapter_finalize_ms',
                    endPerfMark(cloudAdapterMark)
                  );
                  updateLoadingStep('google-drive', 'completed');
                  updateLoadingStep('data-sync', 'completed');
                })
                .catch((error: any) => {
                  console.warn(
                    'Background CloudStorageAdapter initialization failed:',
                    error
                  );
                  recordPerfMetric(
                    'app_open_cloud_adapter_finalize_ms',
                    endPerfMark(cloudAdapterMark)
                  );
                  updateLoadingStep(
                    'google-drive',
                    'error',
                    'Background sync failed'
                  );
                })
                .finally(() => {
                  cloudFinalizeStartedRef.current = false;
                });
            }
          }

          // Set ready flag immediately: page data loading can proceed and
          // adapter finalization continues in background if needed.
          setCloudAdapterFullyInitialized(true);
        } else {
          // Not a CloudStorageAdapter - set as initialized
          setCloudAdapterFullyInitialized(true);
        }
      } catch (error) {
        console.warn(
          'Failed to complete CloudStorageAdapter initialization:',
          error
        );
        updateLoadingStep('google-drive', 'error', 'Initialization failed');
        setCloudAdapterFullyInitialized(true); // Continue anyway to avoid infinite loading
      }
    };

    checkAndCompleteInitialization();
  }, [unifiedStorage.googleDrive.isAuthenticated, storageInitialized]);

  // Automatically switch to active workspace after storage and workspaces are loaded
  // This handles the case where storage initializes before workspaces are loaded (on page reload)
  useEffect(() => {
    const restoreActiveWorkspace = async () => {
      // Wait for storage to be initialized
      if (!storageInitialized || !cloudAdapterFullyInitialized) {
        return;
      }

      // Wait for workspaces to be loaded
      // On first login, activeWorkspace starts as null (not set) and is set by loadWorkspaces.fulfilled
      // After loadWorkspaces.fulfilled, activeWorkspace will be an object (even if id is null for personal)
      // So we check if activeWorkspace is still the initial null state (workspaces not loaded yet)
      if (unifiedStorage.activeWorkspace === null) {
        // Workspaces haven't been loaded yet - wait for loadWorkspaces to complete
        // This will set activeWorkspace to an object (even if id is null for personal workspace)
        return;
      }

      // Skip if we're in the middle of switching (user-initiated switch in progress)
      if (unifiedStorage.isSwitchingWorkspace) {
        return;
      }

      try {
        const restoreMark = startPerfMark('app_open_workspace_restore_ms');
        const storageService = getStorageService();
        const currentWorkspaceId = storageService.getCurrentWorkspaceId();
        const activeWorkspaceId = unifiedStorage.activeWorkspace.id;

        // Compare current workspace with active workspace
        // If activeWorkspaceId is null, that means personal workspace
        // If currentWorkspaceId is undefined, that also means personal workspace
        const currentIsPersonal =
          currentWorkspaceId === undefined || currentWorkspaceId === null;
        const activeIsPersonal = activeWorkspaceId === null;

        // If they match, no need to switch - mark as restored
        if (currentIsPersonal && activeIsPersonal) {
          setWorkspaceRestored(true);
          recordPerfMetric(
            'app_open_workspace_restore_ms',
            endPerfMark(restoreMark)
          );
          return;
        }
        if (
          !currentIsPersonal
          && !activeIsPersonal
          && currentWorkspaceId === activeWorkspaceId
        ) {
          setWorkspaceRestored(true);
          recordPerfMetric(
            'app_open_workspace_restore_ms',
            endPerfMark(restoreMark)
          );
          return;
        }

        // They don't match - switch to the active workspace
        // This happens when storage initialized with default (personal) but active workspace is shared
        await dispatch(switchWorkspace(activeWorkspaceId)).unwrap();
        setWorkspaceRestored(true);
        recordPerfMetric(
          'app_open_workspace_restore_ms',
          endPerfMark(restoreMark)
        );
      } catch (error) {
        console.warn(
          'Failed to restore active workspace on initialization:',
          error
        );
        // Even on error, mark as restored to avoid infinite loading
        // The workspace might still be usable, or user can manually switch
        setWorkspaceRestored(true);
      }
    };

    restoreActiveWorkspace();
  }, [
    dispatch,
    storageInitialized,
    cloudAdapterFullyInitialized,
    unifiedStorage.activeWorkspace,
    unifiedStorage.isSwitchingWorkspace,
  ]);

  useEffect(() => {
    if (
      !storageInitialized
      || !cloudAdapterFullyInitialized
      || workspaceRestored
    ) {
      setWorkspaceRestoreWaitExceeded(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setWorkspaceRestoreWaitExceeded(true);
      if (import.meta.env.DEV) {
        console.info(
          '[App Startup] Workspace restore exceeded wait budget; continuing render'
        );
      }
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [storageInitialized, cloudAdapterFullyInitialized, workspaceRestored]);

  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    if (envInfo.storageMode !== 'cloud') {
      return;
    }

    // Use AuthManager for periodic auth checks (reduced frequency since we handle visibility)
    const interval = setInterval(async () => {
      const authManager = getAuthManager(dispatch);
      await authManager.checkAndRestore();
    }, 60000); // Check every 60 seconds instead of 30

    const performVisibilityRestore = async (
      reason: string,
      options?: { includeSettings?: boolean }
    ) => {
      if (document.hidden) return;
      if (visibilityRestoreInFlightRef.current) return;
      const includeSettings = options?.includeSettings ?? true;

      const now = Date.now();
      if (includeSettings) {
        // Heavy full restore: keep this sparse to avoid UI jank.
        if (now - lastFullVisibilityRestoreAtRef.current < 30000) {
          return;
        }
      } else {
        // Auth-only focus restore: lightweight but still coalesce quick bursts.
        if (now - lastAuthOnlyRestoreAtRef.current < 15000) {
          return;
        }
      }

      visibilityRestoreInFlightRef.current = true;
      if (includeSettings) {
        lastFullVisibilityRestoreAtRef.current = now;
      } else {
        lastAuthOnlyRestoreAtRef.current = now;
      }
      console.log(
        `🔄 App visible (${reason}); restoring ${includeSettings ? 'settings + authentication' : 'authentication'}`
      );

      if (includeSettings) {
        try {
          await dispatch(fetchSettings()).unwrap();
        } catch (error) {
          console.warn('Failed to restore settings on app visibility:', error);
        }
      }

      try {
        const authManager = getAuthManager(dispatch);
        await authManager.checkAndRestore();
      } catch (error) {
        console.warn(
          'Failed to restore authentication on app visibility:',
          error
        );
      } finally {
        visibilityRestoreInFlightRef.current = false;
      }
    };

    const scheduleVisibilityRestore = (
      reason: string,
      delayMs: number,
      options?: { includeSettings?: boolean }
    ) => {
      if (visibilityRestoreTimeoutRef.current !== null) {
        window.clearTimeout(visibilityRestoreTimeoutRef.current);
      }
      visibilityRestoreTimeoutRef.current = window.setTimeout(() => {
        visibilityRestoreTimeoutRef.current = null;
        void performVisibilityRestore(reason, options);
      }, delayMs);
    };

    // Mobile-specific handling for app state changes
    const handlePageShow = (event: PageTransitionEvent) => {
      console.log('🔄 Page show event (mobile app restoration)', {
        persisted: event.persisted,
      });
      scheduleVisibilityRestore('pageshow', 100);
    };

    const handlePageHide = () => {
      console.log('🔄 Page hide event (mobile app backgrounded)');
      // Optionally save any pending state here
    };

    // Additional mobile-specific events
    const handleFocus = () => {
      console.log('🔄 Window focus event (mobile app focused)');
      if (!appWasHiddenRef.current) {
        return;
      }
      appWasHiddenRef.current = false;
      // Focus after hidden often occurs right before user input. Keep this auth-only.
      scheduleVisibilityRestore('focus-after-hidden', 50, {
        includeSettings: false,
      });
    };

    const handleBlur = () => {
      console.log('🔄 Window blur event (mobile app lost focus)');
      // App lost focus - could be minimized or switched to another app
    };

    const handleOnline = () => {
      console.log('🔄 Network online event (mobile network restored)');
      scheduleVisibilityRestore('online', 200);
    };

    const handleBeforeUnload = () => {
      console.log('🔄 Before unload event (mobile app closing)');
      // App is about to close - save any critical state
    };

    // Add comprehensive mobile-specific event listeners
    const handleVisibilityChange = () => {
      if (document.hidden) {
        appWasHiddenRef.current = true;
        return;
      }
      if (!document.hidden) {
        appWasHiddenRef.current = false;
        scheduleVisibilityRestore('visibilitychange', 0, {
          includeSettings: true,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_drive_tokens' && e.newValue !== e.oldValue) {
        dispatch(checkGoogleDriveAuthStatus());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      if (visibilityRestoreTimeoutRef.current !== null) {
        window.clearTimeout(visibilityRestoreTimeoutRef.current);
        visibilityRestoreTimeoutRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [dispatch, unifiedStorage.googleDrive.isAuthenticated]);

  // In cloud mode, wait for Google Drive authentication AND CloudStorageAdapter initialization before rendering pages
  // BUT: if auth failed (has error) or storage is not configured, let the app render to show login
  const isOAuthCallbackRoute =
    typeof window !== 'undefined'
    && window.location.pathname.includes('/oauth-callback');
  const isCloudMode = unifiedStorage.mode === 'cloud';
  const authFailed = unifiedStorage.googleDrive.error !== null;
  const needsConfiguration = unifiedStorage.status !== 'configured';
  // Only hold the full-screen loader while we are actively resolving Drive auth (cookie
  // restore, token refresh). If the user simply is not connected, we show the in-app
  // connect flow instead of blocking here indefinitely—or for the whole HTTP timeout window
  // after we already know the outcome.
  const waitingForCloudAuth =
    isCloudMode
    && !unifiedStorage.googleDrive.isAuthenticated
    && storageInitialized
    && !authFailed
    && !needsConfiguration
    && unifiedStorage.googleDrive.isLoading;

  // In cloud mode, also wait for CloudStorageAdapter to be fully initialized
  const waitingForCloudAdapter = isCloudMode && !cloudAdapterFullyInitialized;

  // Wait for workspace restoration to complete (ensures active workspace is loaded on page reload)
  const waitingForWorkspaceRestoreCritical =
    isCloudMode
    && hasFIDUAuth
    && unifiedStorage.googleDrive.isAuthenticated
    && !workspaceRestoreWaitExceeded
    && !workspaceRestored
    && storageInitialized
    && cloudAdapterFullyInitialized;

  // Skip loading screen if early check detected no FIDU auth in cloud mode
  const shouldShowLoadingScreen =
    !isOAuthCallbackRoute
    && !earlyNoAuthDetected
    && (authLoading
      || !storageInitialized
      || waitingForCloudAuth
      || waitingForCloudAdapter
      || waitingForWorkspaceRestoreCritical);

  useEffect(() => {
    if (shouldShowLoadingScreen) {
      if (!loadingScreenVisibleMarkRef.current) {
        loadingScreenVisibleMarkRef.current = startPerfMark(
          'app_open_loading_screen_visible_ms'
        );
      }
      return;
    }

    recordPerfMetric(
      'app_open_loading_screen_visible_ms',
      endPerfMark(loadingScreenVisibleMarkRef.current)
    );
    loadingScreenVisibleMarkRef.current = null;
    recordPerfMetric(
      'app_open_total_ms',
      endPerfMark(appStartupMarkRef.current)
    );
    appStartupMarkRef.current = null;
  }, [shouldShowLoadingScreen]);

  if (shouldShowLoadingScreen) {
    // Use the new unified loading progress component
    const subtitle =
      storageModeInfo.mode === 'cloud'
        ? 'Setting up Google Drive connection and syncing your data'
        : 'Preparing your local workspace';

    return (
      <LoadingProgress
        steps={loadingSteps}
        title="Initializing FIDU Chat Lab..."
        subtitle={subtitle}
        showProgress={true}
      />
    );
  }

  if (!authInitialized && !isOAuthCallbackRoute) {
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
  // Show when in cloud mode and Google Drive is not authenticated
  const shouldShowStorageBanner =
    envInfo.storageMode === 'cloud'
    && !unifiedStorage.googleDrive.isAuthenticated
    && !showStorageSelectionModal;

  const mainAppContent = (
    <Router basename="/fidu-chat-lab">
      <RouteTracker />
      <ErrorBoundary>
        <AuthErrorBoundary>
          <AuthWrapper>
            <AlertClickProvider>
              <ConditionalLayout
                banner={
                  shouldShowStorageBanner ? (
                    <StorageConfigurationBanner />
                  ) : undefined
                }
              >
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<PromptLabPage />} />
                    <Route path="/prompt-lab" element={<PromptLabPage />} />
                    <Route
                      path="/conversations"
                      element={<ConversationsPage />}
                    />
                    <Route
                      path="/contexts"
                      element={
                        <FeatureFlagGuard
                          featureFlag="context"
                          featureName="Contexts"
                        >
                          <ContextsPage />
                        </FeatureFlagGuard>
                      }
                    />
                    <Route
                      path="/system-prompts"
                      element={
                        <FeatureFlagGuard
                          featureFlag="system_prompts"
                          featureName="System Prompts"
                        >
                          <SystemPromptsPage />
                        </FeatureFlagGuard>
                      }
                    />
                    <Route
                      path="/background-agents"
                      element={
                        <FeatureFlagGuard
                          featureFlag="background_agents"
                          featureName="Background Agents"
                        >
                          <StorageFeatureGuard
                            featureName="Background Agents"
                            checkFeature={supportsBackgroundAgents}
                          >
                            <BackgroundAgentsPage />
                          </StorageFeatureGuard>
                        </FeatureFlagGuard>
                      }
                    />
                    <Route
                      path="/documents"
                      element={
                        <FeatureFlagGuard
                          featureFlag="documents"
                          featureName="Documents"
                        >
                          <StorageFeatureGuard
                            featureName="Documents"
                            checkFeature={supportsDocuments}
                          >
                            <DocumentsPage />
                          </StorageFeatureGuard>
                        </FeatureFlagGuard>
                      }
                    />
                    <Route path="/workspaces" element={<WorkspacesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route
                      path="/privacy-policy"
                      element={<PrivacyPolicyPage />}
                    />
                    <Route path="/whats-new" element={<WhatsNewPage />} />
                    <Route path="/terms-of-use" element={<TermsOfUsePage />} />
                    <Route path="/cloud-test" element={<CloudModeTest />} />
                    <Route
                      path="/oauth-callback"
                      element={<OAuthCallbackPage />}
                    />
                  </Routes>
                </Suspense>
              </ConditionalLayout>
            </AlertClickProvider>
          </AuthWrapper>
        </AuthErrorBoundary>
      </ErrorBoundary>
      {/* Modals and banners - must be inside Router for useLocation() */}
      <ConditionalModals
        showStorageModal={showStorageSelectionModal}
        onDismissStorageModal={handleDismissStorageModal}
        onStorageConfigured={handleStorageConfigured}
        envInfo={envInfo}
        unifiedStorage={unifiedStorage}
      />
    </Router>
  );

  return <>{mainAppContent}</>;
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeWrapper>
        <CssBaseline />
        <AppContent />
      </ThemeWrapper>
    </Provider>
  );
};

export default App;
