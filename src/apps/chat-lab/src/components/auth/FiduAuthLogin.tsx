// Add global type for FIDUAuth
declare global {
  interface Window {
    FIDUAuth?: any;
    __fiduAuthInstance?: any;
  }
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useAppDispatch } from '../../hooks/redux';
import { initializeAuth, logout } from '../../store/slices/authSlice';
import { fetchCurrentUser } from '../../services/api/apiClientIdentityService';
import { refreshTokenService } from '../../services/api/refreshTokenService';
import { getIdentityServiceUrl } from '../../utils/environment';
import { isEmailAllowed, getAllowedEmails } from '../../utils/emailAllowlist';
import { getFiduAuthCookieService } from '../../services/auth/FiduAuthCookieService';
import { getEnvironmentInfo } from '../../utils/environment';

const FIDU_SDK_ID = 'fidu-sdk-script';

const getFiduHost = () => {
  // Use the environment utility for consistency
  return getIdentityServiceUrl();
};

const FiduAuthLogin: React.FC = () => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sdkLoaded = useRef(false);


  const checkAndClearAuthState = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    const profile = localStorage.getItem('current_profile');
    
    if ((token || user || profile) && !token) {
      refreshTokenService.clearAllAuthTokens();
    }
  }, []);

  // Check auth state on component mount
  useEffect(() => {
    checkAndClearAuthState();
  }, [checkAndClearAuthState]);

  // Inject SDK script if not present
  useEffect(() => {
    
    // Set a timeout to detect if SDK loading is taking too long
    const loadingTimeout = setTimeout(() => {
      if (!sdkLoaded.current) {
        console.warn('🔑 FiduAuthLogin: SDK loading timeout - taking longer than expected');
        setError('Authentication system is taking longer than expected to load. Please wait or try refreshing the page.');
      }
    }, 10000);
    
    if (document.getElementById(FIDU_SDK_ID)) {
      sdkLoaded.current = true;
      setLoading(false);
      clearTimeout(loadingTimeout);
      return;
    }
    const script = document.createElement('script');
    script.id = FIDU_SDK_ID;
    script.src = `${getFiduHost()}/static/js/fidu-sdk.js`;
    script.async = true;
    script.onload = () => {
      sdkLoaded.current = true;
      setLoading(false);
      clearTimeout(loadingTimeout);
    };
    script.onerror = () => {
      setError('Failed to load FIDU Auth SDK.');
      setLoading(false);
      clearTimeout(loadingTimeout);
    };
    document.body.appendChild(script);
    return () => {
      clearTimeout(loadingTimeout);
      // Do NOT remove the script on unmount to avoid double-loading and re-declaration errors
    };
  }, []);

  // Initialize SDK and widget
  useEffect(() => {
    if (loading || error) {
      return;
    }

    let cancelled = false;

    const waitForFIDUAuth = async (maxWaitMs: number = 15000, pollIntervalMs: number = 100) => {
      const start = Date.now();
      // Fast path
      if (window.FIDUAuth) return true;
      // Poll until available or timeout
      return await new Promise<boolean>((resolve) => {
        const interval = setInterval(() => {
          if (cancelled) {
            clearInterval(interval);
            resolve(false);
            return;
          }
          if (window.FIDUAuth) {
            clearInterval(interval);
            resolve(true);
            return;
          }
          if (Date.now() - start >= maxWaitMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, pollIntervalMs);
      });
    };

    const initWhenReady = async () => {
      const ready = await waitForFIDUAuth();
      if (!ready || cancelled) {
        if (!error) {
          setError('Authentication system did not initialize in time. Please reload or click Retry.');
        }
        return;
      }

      // Reuse existing instance if present to avoid double init
      // SDK automatically detects SSO tokens in URL when init() is called
      const fidu = window.__fiduAuthInstance || new window.FIDUAuth({
        fiduHost: getFiduHost(),
        origin: window.location.origin, // Required for SSO validation
        debug: false, // Set to true for debugging if needed
      });
      window.__fiduAuthInstance = fidu;

      fidu.on('onAuthSuccess', async (_user: any, token: string | any, _portalUrl: any, refreshToken?: string) => {
      try {
        // Store tokens in HTTP-only cookies (primary storage)
        const fiduAuthService = getFiduAuthCookieService();
        
        // Extract access token and refresh token
        // The SDK now passes the refresh token as the 4th parameter
        let accessToken: string;
        let refreshTokenValue: string;
        
        if (typeof token === 'object' && token !== null && token.access_token) {
          // New format: token is an object with access_token, refresh_token, expires_in
          accessToken = token.access_token;
          refreshTokenValue = token.refresh_token || token.access_token; // Fallback to access token if no refresh token
        } else {
          // Standard format: token is a string (access token)
          accessToken = token as string;
          
          // Use the refresh token parameter if provided, otherwise fallback to localStorage
          if (refreshToken && refreshToken.trim() !== '') {
            refreshTokenValue = refreshToken;
          } else {
            // Fallback: Get refresh token from localStorage (SDK stores it as 'fiduRefreshToken')
            refreshTokenValue = localStorage.getItem('fiduRefreshToken') || accessToken;
          }
        }
        
        // Fetch user info from identity service
        const user = await fetchCurrentUser(accessToken);
        
        // Check email allowlist (development only)
        if (!isEmailAllowed(user.email)) {
          await fiduAuthService.clearTokens();
          refreshTokenService.clearAllAuthTokens();
          
          const allowedEmails = getAllowedEmails();
          const emailListStr = allowedEmails ? allowedEmails.join(', ') : 'configured list';
          setError(
            `Access restricted. Your email (${user.email}) is not authorized for this development environment. ` +
            `Authorized emails: ${emailListStr}. Please contact an administrator for access.`
          );
          return;
        }
        
        // Store tokens in HTTP-only cookies with proper access and refresh tokens
        const success = await fiduAuthService.setTokens(accessToken, refreshTokenValue, user);
        
        if (success) {
          
          // Keep localStorage as fallback for backward compatibility
          localStorage.setItem('auth_token', accessToken);
          localStorage.setItem('user', JSON.stringify(user));
          
          // Set auth_token cookie for backend compatibility (expires in 1 hour)
          document.cookie = `auth_token=${accessToken}; path=/; max-age=3600; samesite=lax`;
          
          // Re-initialize Redux auth state (fetches profiles, etc.)
          await dispatch(initializeAuth());
          
          // After FIDU auth, use AuthManager to check and restore Google Drive authentication
          const envInfo = getEnvironmentInfo();
          if (envInfo.storageMode === 'cloud') {
            try {
              const { getAuthManager } = await import('../../services/auth/AuthManager');
              const { store } = await import('../../store');
              const { getUnifiedStorageService } = await import('../../services/storage/UnifiedStorageService');
              const authManager = getAuthManager(store.dispatch);
              
              // Use AuthManager to check and restore
              const restored = await authManager.checkAndRestore();
              
              if (restored) {
                try {
                  // Re-initialize storage to trigger data sync
                  const storageService = getUnifiedStorageService();
                  await storageService.reinitialize();
                  // No redirect needed - user stays on current page with data loaded
                  return;
                } catch (storageError) {
                  console.warn('Failed to reinitialize storage, falling back to OAuth callback redirect:', storageError);
                  // Fallback: If direct reinit fails, use the OAuth callback flow
                  window.location.href = '/fidu-chat-lab/oauth-callback?postLogin=1';
                  return;
                }
              }
            } catch (error) {
              console.warn('Failed to restore Google Drive authentication via AuthManager:', error);
              // Don't fail the login if Google Drive restore fails
            }
          }
        } else {
          throw new Error('Failed to store auth tokens in HTTP-only cookies');
        }
      } catch (error) {
        // Clear tokens if user info fetching fails to prevent loops
        const fiduAuthService = getFiduAuthCookieService();
        await fiduAuthService.clearTokens();
        refreshTokenService.clearAllAuthTokens();
        console.error('Error fetching user info:', error);
        setError('Authentication succeeded, but failed to fetch user info. Please try again.');
      }
    });

    fidu.on('onAuthError', (_err: any) => {
      // Clear any existing auth data to prevent loops
      refreshTokenService.clearAllAuthTokens();
      setError('Authentication failed. Please try again.');
    });

    fidu.on('onLogout', () => {
      // Handle logout - SDK handles SSO token detection automatically
      dispatch(logout()).catch(() => {
        refreshTokenService.clearAllAuthTokens();
      });
    });

      // Clear any previous widget content
      const container = document.getElementById('fiduAuthContainer');
      if (container) {
        container.innerHTML = '';
      }

      // Initialize SDK - this automatically detects SSO tokens in URL
      fidu.init().then((isAuthenticated: boolean) => {
        if (!isAuthenticated) {
          // Show login widget if user is not authenticated
          fidu.showLoginWidget('fiduAuthContainer');
        }
      });
    };

    initWhenReady();

    return () => {
      cancelled = true;
    };
  }, [loading, error, dispatch]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2
      }}
    >
      <Paper
        elevation={24}
        sx={{ 
          p: 4, 
          width: '100%', 
          maxWidth: 450, 
          mx: 2,
          borderRadius: 3,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            pointerEvents: 'none'
          }
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom 
          align="center"
          sx={{ 
            fontWeight: 600,
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}
        >
          Welcome Back
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary" 
          align="center" 
          sx={{ mb: 4, opacity: 0.8 }}
        >
          Sign in to your FIDU account to continue
        </Typography>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 2,
              '& .MuiAlert-icon': {
                fontSize: '1.5rem'
              }
            }}
          >
            {error}
          </Alert>
        )}
        {loading ? (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            minHeight={250}
            gap={2}
          >
            <CircularProgress size={48} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              Loading authentication...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ minHeight: 250 }}>
            <div id="fiduAuthContainer" style={{ minHeight: 250 }} />
            {error && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  If the login form doesn't appear, you can try:
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={() => window.location.reload()}
                  sx={{ mr: 1 }}
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    refreshTokenService.clearAllAuthTokens();
                    window.location.reload();
                  }}
                  sx={{ mr: 1 }}
                >
                  Clear Cache & Reload
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    // Force re-initialization of the auth flow
                    checkAndClearAuthState();
                    setError(null);
                    setLoading(true);
                    sdkLoaded.current = false;
                    const existingScript = document.getElementById(FIDU_SDK_ID);
                    if (existingScript) {
                      existingScript.remove();
                    }
                    setTimeout(() => setLoading(false), 100);
                  }}
                >
                  Retry Authentication
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default FiduAuthLogin; 