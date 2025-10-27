/**
 * OAuth Callback Page
 * Handles Google Drive OAuth completion with smooth reload experience
 */

import React, { useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { CloudSync } from '@mui/icons-material';
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
        const postLogin = urlParams.get('postLogin') === '1';
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        if (!code) {
          // Support a post-login redirect that uses cookie-based restoration + full sync
          if (postLogin) {
            serverLogger.info('🔄 Post-login callback: restoring auth via AuthManager and syncing');
            const { getAuthManager } = await import('../services/auth/AuthManager');
            const authManager = getAuthManager(dispatch);
            
            const restored = await authManager.checkAndRestore();
            if (!restored) {
              throw new Error('No authorization code and no cookie-based authentication found');
            }

            const status = authManager.getAuthStatus();
            const result = {
              isAuthenticated: status.isAuthenticated,
              user: status.user,
              expiresAt: null
            };

            if (result.isAuthenticated) {
              setStatus('success');
              setMessage('Authentication successful! Syncing your data...');

              dispatch(setInsufficientPermissions(false));
              dispatch(markStorageConfigured());
              dispatch(setShowAuthModal(false));

              try {
                serverLogger.info('🔄 Re-initializing storage service to sync cloud data (post-login)...');
                const storageService = getUnifiedStorageService();
                await storageService.reinitialize();
                await storageService.sync();
                serverLogger.info('✅ Storage service re-initialized and synced successfully');

                setMessage('Data synced! Redirecting...');
                await new Promise(resolve => setTimeout(resolve, 500));
                window.location.href = '/fidu-chat-lab/';
                return;
              } catch (syncError) {
                serverLogger.error('❌ Failed to re-initialize/sync storage service:', syncError);
                setStatus('error');
                setMessage('Authentication successful, but sync failed. Please refresh the page.');
                return;
              }
            } else {
              throw new Error('Authentication restoration failed in post-login flow');
            }
          }

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
          
          // Close the auth modal
          dispatch(setShowAuthModal(false));
          
          // Use AuthManager to re-authenticate and sync state
          try {
            serverLogger.info('🔄 Using AuthManager to complete authentication...');
            const { getAuthManager } = await import('../services/auth/AuthManager');
            const authManager = getAuthManager(dispatch);
            
            // Trigger re-authentication to sync everything
            await authManager.reAuthenticate();
            serverLogger.info('✅ AuthManager authentication complete');
            
            // Re-initialize storage service to trigger data sync
            serverLogger.info('🔄 Re-initializing storage service to sync cloud data...');
            const storageService = getUnifiedStorageService();
            await storageService.reinitialize();
            serverLogger.info('✅ Storage service re-initialized successfully');
            
            // Show success message briefly before redirecting
            setMessage('Data synced! Redirecting...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Redirect to main app
            window.location.href = '/fidu-chat-lab/';
          } catch (error) {
            serverLogger.error('❌ Failed to complete authentication:', error);
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
        // Show spinner during success state since we're still syncing
        return <CircularProgress size={48} sx={{ color: 'success.main' }} />;
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
      
      {/* Full-screen blocking modal during processing */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3
        }}
      >
        <Paper
          elevation={24}
          sx={{
            p: 5,
            textAlign: 'center',
            maxWidth: 500,
            width: '100%',
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
          <Box sx={{ mb: 3 }}>
            {getStatusIcon()}
          </Box>
          
          <Typography
            variant="h5"
            component="h1"
            gutterBottom
            sx={{ 
              color: getStatusColor(),
              fontWeight: 600,
              mb: 2
            }}
          >
            {status === 'processing' && 'Connecting to Google Drive'}
            {status === 'success' && 'Connected Successfully!'}
            {status === 'error' && 'Connection Failed'}
          </Typography>
          
          <Typography 
            variant="body1" 
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            {message}
          </Typography>
          
          {(status === 'processing' || status === 'success') && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ fontStyle: 'italic', opacity: 0.7 }}
            >
              {status === 'processing' 
                ? 'Please wait while we sync your data...'
                : 'You will be redirected shortly...'
              }
            </Typography>
          )}
          
          {status === 'error' && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You can try again or go back to the main app.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <button
                  onClick={() => window.location.href = '/fidu-chat-lab/'}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Go to App
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #1976d2',
                    borderRadius: '6px',
                    background: '#1976d2',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
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
