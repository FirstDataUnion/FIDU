/**
 * Google Drive Authentication Prompt
 * Shows when user needs to authenticate with Google Drive for cloud mode
 */

import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Alert,
  CircularProgress,
  Stack,
  Dialog,
  DialogContent,
  DialogTitle,
  Backdrop,
  useTheme,
  IconButton
} from '@mui/material';
import { CloudUpload, Google, Close } from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { serverLogger } from '../../utils/serverLogger';
import { useAppDispatch } from '../../hooks/redux';
import { checkGoogleDriveAuthStatus } from '../../store/slices/unifiedStorageSlice';

interface GoogleDriveAuthPromptProps {
  onAuthenticated?: () => void;
}

export default function GoogleDriveAuthPrompt({ onAuthenticated }: GoogleDriveAuthPromptProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const dispatch = useAppDispatch();

  // Note: OAuth callback handling is now done in the dedicated OAuthCallbackPage

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      // Check if the adapter has an authenticate method
      if ('authenticate' in adapter && typeof adapter.authenticate === 'function') {
        await (adapter as any).authenticate();
        console.log('Google Drive authentication initiated - redirecting to OAuth flow');
        // The authenticate method will redirect to Google OAuth, which will then redirect to our callback page
        // No need to call onAuthenticated here as the callback page will handle it
      } else {
        throw new Error('Authentication not supported by current storage adapter');
      }
    } catch (err: any) {
      console.error('Google Drive authentication failed:', err);
      setError(err.message || 'Failed to authenticate with Google Drive');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <Dialog
      open={true}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isAuthenticating}
      BackdropComponent={Backdrop}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: theme.shadows[24],
          border: `1px solid ${theme.palette.divider}`,
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        position: 'relative'
      }}>
        <CloudUpload sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h5" component="span">
          Connect Google Drive
        </Typography>
        <IconButton
          aria-label="close"
          onClick={() => window.location.reload()}
          disabled={isAuthenticating}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ px: 4, pb: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            To use cloud mode, you need to connect your Google Drive account. 
            This allows FIDU Chat Lab to store your conversations securely in your personal Google Drive.
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Your data will be stored in a private folder that only you can access.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>Authentication Error:</strong> {error}
              </Typography>
            </Alert>
          )}

          <Stack spacing={3} alignItems="center" sx={{ mb: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isAuthenticating ? <CircularProgress size={20} /> : <Google />}
              onClick={handleAuthenticate}
              disabled={isAuthenticating}
              sx={{ 
                minWidth: 220,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              {isAuthenticating ? 'Connecting...' : 'Connect Google Drive'}
            </Button>

            <Typography variant="caption" color="text.secondary">
              You'll be redirected to Google to authorize access
            </Typography>
          </Stack>

          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50', 
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              What happens next:
            </Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <Typography variant="body2" color="text.secondary" component="li" sx={{ mb: 1 }}>
                Click "Connect Google Drive" above
              </Typography>
              <Typography variant="body2" color="text.secondary" component="li" sx={{ mb: 1 }}>
                Sign in to your Google account
              </Typography>
              <Typography variant="body2" color="text.secondary" component="li" sx={{ mb: 1 }}>
                Grant permission for FIDU Chat Lab to access your Drive
              </Typography>
              <Typography variant="body2" color="text.secondary" component="li">
                Your conversations will sync automatically
              </Typography>
            </Box>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
