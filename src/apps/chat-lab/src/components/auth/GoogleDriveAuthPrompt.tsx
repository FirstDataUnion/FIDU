/**
 * Google Drive Authentication Prompt
 * Shows when user needs to authenticate with Google Drive for cloud mode
 */

import { useState } from 'react';
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
// Import the image from the public directory
const DataPermissionGuide = './DataPermissionGuide.png';

interface GoogleDriveAuthPromptProps {
  open?: boolean;
  onClose?: () => void;
  onAuthenticated?: () => void;
}

export default function GoogleDriveAuthPrompt({ open = true, onClose }: GoogleDriveAuthPromptProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

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
      open={open}
      onClose={onClose}
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
          onClick={onClose}
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

          {/* Permission guide */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 2, 
              mb: 3,
              bgcolor: theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light', 
              borderRadius: 2,
              border: `2px solid ${theme.palette.warning.main}`,
              boxShadow: `0 0 0 1px ${theme.palette.warning.main}20`
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              📋 Important: Check the Google Drive permission box
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              When Google asks for permissions, make sure to check the box for Google Drive access:
            </Typography>
            
            <Box sx={{ textAlign: 'center' }}>
              <Box
                component="img"
                src={DataPermissionGuide}
                alt="Google Drive permission checkbox guide"
                sx={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 1
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Look for this Google Drive permission and make sure to check the box before clicking "Continue"
              </Typography>
            </Box>
          </Paper>

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
                <strong>Check the Google Drive permission box</strong> (see guide above)
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
