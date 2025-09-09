// Add global type for FIDUAuth
declare global {
  interface Window {
    FIDUAuth?: any;
  }
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useAppDispatch } from '../../hooks/redux';
import { initializeAuth } from '../../store/slices/authSlice';
import { fetchCurrentUser } from '../../services/api/apiClientIdentityService';
import { refreshTokenService } from '../../services/api/refreshTokenService';
import { getIdentityServiceUrl } from '../../utils/environment';

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


  // Function to check and clear problematic auth state
  const checkAndClearAuthState = useCallback(() => {
    console.log('🔑 FiduAuthLogin: Checking current auth state...');
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    const profile = localStorage.getItem('current_profile');
    
    console.log('🔑 FiduAuthLogin: Current localStorage state:', {
      hasToken: !!token,
      hasUser: !!user,
      hasProfile: !!profile
    });
    
    // If we have partial auth state but no valid session, clear it
    if ((token || user || profile) && !token) {
      console.log('🔑 FiduAuthLogin: Found partial auth state without token, clearing...');
      refreshTokenService.clearAllAuthTokens();
    }
  }, []);

  // Log the FIDU host for debugging
  console.log('🔑 FiduAuthLogin: FIDU host URL:', getFiduHost());
  console.log('🔑 FiduAuthLogin: Environment info:', {
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    identityServiceUrl: import.meta.env.VITE_IDENTITY_SERVICE_URL
  });

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
    }, 10000); // 10 second timeout
    
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
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Initialize SDK and widget
  useEffect(() => {
    if (loading || error) {
      return;
    }
    if (!window.FIDUAuth) {
      return;
    }

    // Remove any previous widget
    const container = document.getElementById('fiduAuthContainer');
    if (container) container.innerHTML = '';

    const fidu = new window.FIDUAuth({
      fiduHost: getFiduHost(),
      debug: true,
    });

    fidu.on('onAuthSuccess', async (_user: any, token: string) => {
      try {
        // Store token
        localStorage.setItem('auth_token', token);
        // Fetch user info from identity service
        const user = await fetchCurrentUser(token);
        localStorage.setItem('user', JSON.stringify(user));
        // Set auth_token cookie for backend compatibility (expires in 1 hour)
        document.cookie = `auth_token=${token}; path=/; max-age=3600; samesite=lax`;
        // Re-initialize Redux auth state (fetches profiles, etc.)
        await dispatch(initializeAuth());
      } catch (error) {
        // Clear tokens if user info fetching fails to prevent loops
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

    fidu.init().then((isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        fidu.showLoginWidget();
      }
    });
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
                    // Clear any cached data and retry
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
                    // Remove existing script and retry
                    const existingScript = document.getElementById(FIDU_SDK_ID);
                    if (existingScript) {
                      existingScript.remove();
                    }
                    // Force a re-render by updating state
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