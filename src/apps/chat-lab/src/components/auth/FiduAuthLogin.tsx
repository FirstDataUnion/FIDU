// Add global type for FIDUAuth
declare global {
  interface Window {
    FIDUAuth?: any;
  }
}

import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { useAppDispatch } from '../../hooks/redux';
import { initializeAuth } from '../../store/slices/authSlice';
import { fetchCurrentUser } from '../../services/api/apiClientIdentityService';
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

  // Helper function to clear all auth tokens consistently
  const clearAllAuthTokens = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('fiduToken');
    localStorage.removeItem('user');
    localStorage.removeItem('current_profile');
    document.cookie = 'auth_token=; path=/; max-age=0; samesite=lax';
  };

  // Inject SDK script if not present
  useEffect(() => {
    if (document.getElementById(FIDU_SDK_ID)) {
      sdkLoaded.current = true;
      setLoading(false);
      return;
    }
    const script = document.createElement('script');
    script.id = FIDU_SDK_ID;
    script.src = `${getFiduHost()}/static/js/fidu-sdk.js`;
    script.async = true;
    script.onload = () => {
      sdkLoaded.current = true;
      setLoading(false);
    };
    script.onerror = () => {
      setError('Failed to load FIDU Auth SDK.');
      setLoading(false);
    };
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Initialize SDK and widget
  useEffect(() => {
    if (loading || error) return;
    if (!window.FIDUAuth) return;

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
        clearAllAuthTokens();
        console.error('Error fetching user info:', error);
        setError('Authentication succeeded, but failed to fetch user info. Please try again.');
      }
    });

    fidu.on('onAuthError', (_err: any) => {
      // Clear any existing auth data to prevent loops
      clearAllAuthTokens();
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
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default FiduAuthLogin; 