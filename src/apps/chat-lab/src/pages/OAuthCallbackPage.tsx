/**
 * OAuth Callback Page
 * Handles Google Drive OAuth completion with smooth reload experience
 */

import React, { useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { CheckCircle, CloudSync } from '@mui/icons-material';
import { useAppDispatch } from '../hooks/redux';
import { setShowAuthModal, markStorageConfigured, authenticateGoogleDrive } from '../store/slices/unifiedStorageSlice';
import { revokeGoogleDriveAccess, setInsufficientPermissions } from '../store/slices/googleDriveAuthSlice';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { serverLogger } from '../utils/serverLogger';
import InsufficientPermissionsModal from '../components/auth/InsufficientPermissionsModal';
import { InsufficientScopesError, getGoogleDriveAuthService } from '../services/auth/GoogleDriveAuth';

const OAuthCallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [callbackProcessed, setCallbackProcessed] = useState(false);
  const processingRef = useRef(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Prevent multiple callback processing attempts
      if (callbackProcessed || processingRef.current) {
        console.log('🔄 Callback already processed or processing, skipping...');
        return;
      }
      
      processingRef.current = true;
      
      try {
        setStatus('processing');
        setMessage('Completing Google Drive authentication...');
        setCallbackProcessed(true);
        
        // Check if we have OAuth parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        if (!code) {
          throw new Error('No authorization code found in callback URL');
        }
        
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Authentication timeout')), 30000); // 30 second timeout
        });
        
        // Process OAuth callback directly
        serverLogger.info('🔍 Processing OAuth callback directly...');
        const authService = await getGoogleDriveAuthService();
        
        // Process the callback using the dedicated callback method
        await Promise.race([
          authService.processOAuthCallback(),
          timeoutPromise
        ]);
        
        // Get the auth status after processing
        const authStatus = authService.getAuthStatus();
        const result = {
          isAuthenticated: authStatus.isAuthenticated,
          user: authStatus.user,
          expiresAt: authStatus.expiresAt
        };
        
        if (result.isAuthenticated) {
          setStatus('success');
          setMessage('Authentication successful! Syncing your data...');
          
          // Update Redux state to reflect successful authentication
          dispatch(setInsufficientPermissions(false));
          
          // Mark storage as configured since Google Drive auth was successful
          dispatch(markStorageConfigured());
          
          // Close the auth modal
          dispatch(setShowAuthModal(false));
          
          // Add a small delay to ensure settings are saved before redirect
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
      } catch (error: any) {
        serverLogger.error('❌ OAuth callback processing failed:', error);
        
        // Check if this is an insufficient permissions error
        const errorMessage = error?.message || String(error);
        console.log('Error message:', errorMessage); // Debug log
        
        if (error instanceof InsufficientScopesError ||
            errorMessage.includes('did not grant all required permissions') ||
            errorMessage.includes('InsufficientScopesError') ||
            errorMessage.includes('User did not grant all required permissions')) {
          serverLogger.warn('⚠️ Insufficient OAuth permissions detected');
          dispatch(setInsufficientPermissions(true));
          setStatus('error');
          setMessage('Missing required permissions.');
          setShowPermissionsModal(true);
        } else if (errorMessage.includes('Invalid state parameter')) {
          serverLogger.warn('⚠️ Invalid OAuth state parameter - redirecting to main app');
          setStatus('error');
          setMessage('Authentication session expired. Redirecting to main app...');
          // Redirect to main app after a short delay
          setTimeout(() => {
            window.location.href = '/fidu-chat-lab/';
          }, 2000);
        } else {
          setStatus('error');
          setMessage(`Authentication failed: ${errorMessage}. Please try again.`);
        }
      } finally {
        processingRef.current = false;
      }
    };

    handleOAuthCallback();
  }, [dispatch, callbackProcessed]);

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

  const handleReconnect = async () => {
    try {
      serverLogger.info('🔄 Reconnecting with correct permissions...');
      
      // Close the modal first
      setShowPermissionsModal(false);
      
      // Revoke current access to clear tokens
      await dispatch(revokeGoogleDriveAccess()).unwrap();
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Directly initiate OAuth flow with fresh permissions
      await dispatch(authenticateGoogleDrive()).unwrap();
      
      // The authenticateGoogleDrive will redirect to Google OAuth, so we won't reach here
    } catch (error) {
      serverLogger.error('❌ Failed to reconnect:', error);
      // If OAuth fails, redirect to main app as fallback
      window.location.href = '/fidu-chat-lab/';
    }
  };

  const handleCancelPermissionsModal = () => {
    setShowPermissionsModal(false);
    // Redirect to main app
    window.location.href = '/fidu-chat-lab/';
  };

  return (
    <>
      <InsufficientPermissionsModal
        open={showPermissionsModal}
        onReconnect={handleReconnect}
        onCancel={handleCancelPermissionsModal}
      />
      
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
    </>
  );
};

export default OAuthCallbackPage;
