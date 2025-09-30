/**
 * Google Drive Authentication Component
 * Provides UI for Google Drive authentication
 */

import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, Typography, Box, Alert, CircularProgress } from '@mui/material';
import { Google as GoogleIcon, CloudSync as CloudSyncIcon } from '@mui/icons-material';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';

interface GoogleDriveAuthProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
}

export const GoogleDriveAuth: React.FC<GoogleDriveAuthProps> = ({ 
  onAuthSuccess, 
  onAuthError 
}) => {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authService = getGoogleDriveAuthService();
      await authService.initialize();
      const status = authService.getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      console.error('Error checking auth status:', err);
    }
  };

  const handleAuthenticate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authService = getGoogleDriveAuthService();
      await authService.authenticate();
      // The page will redirect, so we won't reach here
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeAccess = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authService = getGoogleDriveAuthService();
      await authService.revokeAccess();
      await checkAuthStatus();
      onAuthSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke access';
      setError(errorMessage);
      onAuthError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus?.isAuthenticated) {
    return (
      <Card sx={{ maxWidth: 500, mx: 'auto', mt: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <GoogleIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Google Drive Connected</Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" mb={2}>
            Connected as: <strong>{authStatus.user?.email}</strong>
          </Typography>
          
          {authStatus.expiresAt && (
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Access expires: {new Date(authStatus.expiresAt).toLocaleString()}
            </Typography>
          )}

          <Button
            variant="outlined"
            color="error"
            onClick={handleRevokeAccess}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
          >
            Disconnect Google Drive
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ maxWidth: 500, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <GoogleIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">Connect Google Drive</Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary" mb={3}>
          Connect your Google Drive to enable cloud storage for your conversations and API keys. 
          Your data will be stored securely in your personal Google Drive.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleAuthenticate}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <CloudSyncIcon />}
          fullWidth
        >
          {isLoading ? 'Connecting...' : 'Connect Google Drive'}
        </Button>

        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          You'll be redirected to Google to authorize access to your Drive.
        </Typography>
      </CardContent>
    </Card>
  );
};
