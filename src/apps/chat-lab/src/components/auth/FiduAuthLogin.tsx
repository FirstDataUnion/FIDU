/**
 * Simplified FIDU Authentication Login Component
 * 
 * Handles user login via FIDU Auth SDK with:
 * - Automatic SDK loading and initialization
 * - OAuth flow handling
 * - Error recovery
 * 
 * Broken into smaller hooks and components for better maintainability:
 * - useFiduSDK: SDK loading and initialization
 * - useFiduAuth: Authentication event handlers
 */

// Add global type for FIDUAuth
declare global {
  interface Window {
    FIDUAuth?: any;
    __fiduAuthInstance?: any;
  }
}

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useFiduSDK } from '../../hooks/useFiduSDK';
import { useFiduAuth } from '../../hooks/useFiduAuth';
import { getFiduAuthService } from '../../services/auth/FiduAuthService';

const FiduAuthLogin: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { isLoading: sdkLoading, error: sdkError, sdk, isReady } = useFiduSDK();
  const { handleAuthSuccess, handleAuthError, handleLogout } = useFiduAuth(setError);

  // Combine SDK error with local error
  useEffect(() => {
    if (sdkError) {
      setError(sdkError);
    }
  }, [sdkError]);

  // Wrap auth handlers to track loading state
  const wrappedHandleAuthSuccess = useCallback(async (user: any, token: any, portalUrl: any, refreshToken?: string) => {
    setIsAuthenticating(true);
    try {
      await handleAuthSuccess(user, token, portalUrl, refreshToken);
    } finally {
      // Don't set false here - let Redux state take over
      // setIsAuthenticating(false) would be called but we'll transition to app
    }
  }, [handleAuthSuccess]);

  const wrappedHandleAuthError = useCallback((err: any) => {
    setIsAuthenticating(false);
    handleAuthError(err);
  }, [handleAuthError]);

  // Initialize SDK and widget when ready
  useEffect(() => {
    if (!isReady || !sdk || error) {
      return;
    }

    console.log('🔑 Initializing FIDU SDK widget...');

    // Register event handlers with wrapped versions that track loading
    sdk.on('onAuthSuccess', wrappedHandleAuthSuccess);
    sdk.on('onAuthError', wrappedHandleAuthError);
    sdk.on('onLogout', handleLogout);

    // Clear any previous widget content
    const container = document.getElementById('fiduAuthContainer');
    if (container) {
      container.innerHTML = '';
    }

    // Initialize SDK - automatically detects SSO tokens in URL
    sdk.init().then((isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        console.log('🔑 User not authenticated, showing login widget');
        sdk.showLoginWidget('fiduAuthContainer');
      } else {
        console.log('✅ User already authenticated via SSO');
      }
    }).catch((initError: Error) => {
      console.error('❌ SDK initialization failed:', initError);
      setError('Failed to initialize authentication. Please refresh the page.');
    });

  
    // Event listeners are tied to the SDK instance lifecycle
  }, [isReady, sdk, error, wrappedHandleAuthSuccess, wrappedHandleAuthError, handleLogout]);

  // Show loading overlay when authenticating
  if (isAuthenticating) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 3
        }}
      >
        <CircularProgress size={64} thickness={4} />
        <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 600 }}>
          Logging You In
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Setting up your workspace...
        </Typography>
      </Box>
    );
  }

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
        {sdkLoading ? (
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
                    getFiduAuthService().clearAllAuthTokens();
                    window.location.reload();
                  }}
                  sx={{ mr: 1 }}
                >
                  Clear Cache & Reload
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