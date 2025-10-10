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
  Close
} from '@mui/icons-material';
import { useAppDispatch } from '../../hooks/redux';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
import { checkGoogleDriveAuthStatus, revokeGoogleDriveAccess } from '../../store/slices/unifiedStorageSlice';
import GoogleDriveAuthPrompt from './GoogleDriveAuthPrompt';

interface GoogleDriveStatusProps {
  variant?: 'compact' | 'full';
}

export default function GoogleDriveStatus({ variant = 'compact' }: GoogleDriveStatusProps) {
  const dispatch = useAppDispatch();
  const unifiedStorage = useUnifiedStorage();
  
  // Use unified storage state for Google Drive auth
  const { isAuthenticated, user, error, isLoading } = unifiedStorage.googleDrive;
  
  const isCloudStorageMode = unifiedStorage.mode === 'cloud';
  const [showAuthDialog, setShowAuthDialog] = useState(false);

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

  // Hide widget if not in cloud storage mode
  if (!isCloudStorageMode) {
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

      {/* Enhanced Authentication Dialog with Screenshot Guidance */}
      {!isAuthenticated && (
        <GoogleDriveAuthPrompt
          open={showAuthDialog}
          onClose={() => setShowAuthDialog(false)}
          onAuthenticated={() => {
            setShowAuthDialog(false);
            // The OAuth flow will handle the rest
          }}
        />
      )}

      {/* Connected Status Dialog */}
      {isAuthenticated && (
        <Dialog 
          open={showAuthDialog} 
          onClose={() => setShowAuthDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloudDone />
              Google Drive Connected
            </Box>
            <IconButton onClick={() => setShowAuthDialog(false)} size="small">
              <Close />
            </IconButton>
          </DialogTitle>
          
          <DialogContent>
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
              <Typography variant="body1" color="text.secondary" paragraph>
                You're connected to Google Drive. Your data is being synchronized with your personal Google Drive storage.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Connected as: <strong>{user?.name || user?.email || 'Google user'}</strong>
              </Typography>
            </Paper>
          </DialogContent>
          
          <DialogActions sx={{ p: 2 }}>
            <Button 
              onClick={() => setShowAuthDialog(false)}
              variant="outlined"
            >
              Close
            </Button>
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
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
