/**
 * OAuth Callback Page
 * Handles Google Drive OAuth completion with smooth reload experience
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { CheckCircle, CloudSync } from '@mui/icons-material';
import { useAppDispatch } from '../hooks/redux';
import { initializeGoogleDriveAuth } from '../store/slices/googleDriveAuthSlice';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { serverLogger } from '../utils/serverLogger';

const OAuthCallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setStatus('processing');
        setMessage('Completing Google Drive authentication...');
        
        // Wait a moment for the auth service to process the callback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check auth status
        serverLogger.info('🔍 Checking Google Drive auth status...');
        const result = await dispatch(initializeGoogleDriveAuth()).unwrap();
        
        if (result.isAuthenticated) {
          setStatus('success');
          setMessage('Authentication successful! Syncing your data...');
          
          // Re-initialize storage service to trigger data sync
          try {
            serverLogger.info('🔄 Re-initializing storage service to sync cloud data...');
            const storageService = getUnifiedStorageService();
            await storageService.reinitialize();
            serverLogger.info('✅ Storage service re-initialized successfully');
            
            // Show success message briefly before redirecting
            setMessage('Data synced! Redirecting to your conversations...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Redirect to main app
            window.location.href = '/fidu-chat-lab/';
          } catch (error) {
            serverLogger.error('❌ Failed to re-initialize storage service:', error);
            setStatus('error');
            setMessage('Authentication successful, but sync failed. Please refresh the page.');
          }
        } else {
          setStatus('error');
          setMessage('Authentication failed. Please try again.');
        }
      } catch (error) {
        serverLogger.error('❌ OAuth callback processing failed:', error);
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
      }
    };

    handleOAuthCallback();
  }, [dispatch]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />;
      case 'error':
        return <CloudSync sx={{ fontSize: 48, color: 'error.main' }} />;
      default:
        return <CircularProgress size={48} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'success.main';
      case 'error':
        return 'error.main';
      default:
        return 'primary.main';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 3
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 400,
          width: '100%',
          borderRadius: 3
        }}
      >
        <Box sx={{ mb: 3 }}>
          {getStatusIcon()}
        </Box>
        
        <Typography
          variant="h6"
          component="h1"
          gutterBottom
          sx={{ color: getStatusColor() }}
        >
          {status === 'processing' && 'Connecting to Google Drive'}
          {status === 'success' && 'Connected Successfully!'}
          {status === 'error' && 'Connection Failed'}
        </Typography>
        
        <Typography variant="body1" color="text.secondary">
          {message}
        </Typography>
        
        {status === 'error' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You can try again or go back to the main app.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <button
                onClick={() => window.location.href = '/fidu-chat-lab/'}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Go to App
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #1976d2',
                  borderRadius: '4px',
                  background: '#1976d2',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default OAuthCallbackPage;
