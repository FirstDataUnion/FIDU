/**
 * Google Drive Status Widget
 * Shows Google Drive connection status in the app bar
 */

import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Paper
} from '@mui/material';
import { 
  CloudUpload, 
  CloudDone, 
  CloudOff,
  Person,
  CheckCircle,
  Error,
  Google,
  Close
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { checkGoogleDriveAuthStatus, authenticateGoogleDrive, revokeGoogleDriveAccess } from '../../store/slices/googleDriveAuthSlice';

interface GoogleDriveStatusProps {
  variant?: 'compact' | 'full';
}

export default function GoogleDriveStatus({ variant = 'compact' }: GoogleDriveStatusProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, error, isLoading } = useAppSelector((state) => state.googleDriveAuth);
  const [showAuthDialog, setShowAuthDialog] = useState(false);


  const handleAuthenticate = async () => {
    try {
      await dispatch(authenticateGoogleDrive()).unwrap();
      // Authentication will redirect the page, so we won't reach here
    } catch (error: any) {
      console.error('Auth failed:', error);
      // Error is already handled by Redux state
    }
  };

  const handleDeauthenticate = async () => {
    try {
      await dispatch(revokeGoogleDriveAccess()).unwrap();
      setShowAuthDialog(false);
    } catch (error: any) {
      console.error('Deauth failed:', error);
      // Error is already handled by Redux state
    }
  };

  // Trigger initial auth status check when component mounts
  useEffect(() => {
    dispatch(checkGoogleDriveAuthStatus());
  }, [dispatch]);

  const getStatusIcon = () => {
    if (isLoading) {
      return <CircularProgress size={16} />;
    }
    if (isAuthenticated && user) {
      return <CloudDone />;
    }
    if (error) {
      return <Error />;
    }
    return <CloudOff />;
  };

  const getStatusColor = () => {
    if (isLoading) return 'default';
    if (isAuthenticated) return 'success';
    if (error) return 'error';
    return 'default';
  };

  const getTooltipText = () => {
    if (isLoading) return 'Checking Google Drive connection...';
    if (isAuthenticated && user) {
      return `Connected as ${user.name || user.email}`;
    }
    if (error) {
      return `Connection error: ${error}`;
    }
    return 'Not connected to Google Drive';
  };

  // For storage mode detection
  const storageMode = import.meta.env.VITE_STORAGE_MODE || 'local';
  const isCloudMode = storageMode === 'cloud';

  // Don't show widget in local mode
  if (!isCloudMode) {
    return null;
  }

  
  return (
    <>
      {variant === 'compact' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={getTooltipText()}>
            <IconButton
              color={getStatusColor() as any}
              onClick={() => {
                setShowAuthDialog(true);
              }}
              disabled={isLoading}
              size="small"
            >
              {getStatusIcon()}
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isAuthenticated ? (
            <Chip
              icon={user ? <Person /> : <CheckCircle />}
              label={
                user 
                  ? `${user.name || 'Connected'}`
                  : 'Google Drive'
              }
              color={getStatusColor() as any}
              variant="outlined"
              onClick={() => setShowAuthDialog(true)}
              sx={{ cursor: 'pointer' }}
            />
          ) : (
            <Button
              variant="outlined"
              color={error ? 'error' : 'primary'}
              size="small"
              startIcon={<CloudUpload />}
              onClick={() => setShowAuthDialog(true)}
              disabled={isLoading}
              sx={{ textTransform: 'none' }}
            >
              {error ? 'Fix Connection' : 'Connect Google Drive'}
            </Button>
          )}
        </Box>
      )}

      {/* Authentication Dialog */}
      <Dialog 
        open={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAuthenticated ? <CloudDone /> : <CloudUpload />}
            {isAuthenticated ? 'Google Drive Connected' : 'Connect Google Drive'}
          </Box>
          <IconButton onClick={() => setShowAuthDialog(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            {isAuthenticated ? (
              <>
                <Typography variant="body1" color="text.secondary" paragraph>
                  You're connected to Google Drive. Your data is being synchronized with your personal Google Drive storage.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Connected as: <strong>{user?.name || user?.email || 'Google user'}</strong>
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Connect your Google Drive to enable cloud storage for your conversations and data.
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Your data will be stored securely in your personal Google Drive in a private folder.
                </Typography>
              </>
            )}
          </Paper>

          {error && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
              <Typography variant="body2">
                <strong>Error:</strong> {error}
              </Typography>
            </Paper>
          )}

          {!isAuthenticated && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Ready to connect?
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Click the button below to authenticate with Google Drive
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowAuthDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          {isAuthenticated ? (
            <Button
              onClick={handleDeauthenticate}
              variant="outlined"
              color="error"
              startIcon={isLoading ? <CircularProgress size={20} /> : <CloudOff />}
              disabled={isLoading}
              sx={{ minWidth: 160 }}
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect Google Drive'}
            </Button>
          ) : (
            <Button
              onClick={handleAuthenticate}
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={20} /> : <Google />}
              disabled={isLoading}
              sx={{ minWidth: 160 }}
            >
              {isLoading ? 'Connecting...' : 'Connect Google Drive'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
