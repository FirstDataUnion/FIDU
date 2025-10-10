import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Button, Typography,
  Box, Collapse, IconButton, Alert, Card, CardContent, CardActions,
  CircularProgress
} from '@mui/material';
import {
  CloudUpload as CloudIcon, FolderOpen as FileSystemIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Close as CloseIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateStorageMode, markStorageConfigured, authenticateGoogleDrive } from '../../store/slices/unifiedStorageSlice';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

interface StorageSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onStorageConfigured: () => void;
}

export const StorageSelectionModal: React.FC<StorageSelectionModalProps> = ({
  open, onClose, onStorageConfigured
}) => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  
  // Determine if we're in dark mode
  const isDarkMode = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleDriveAuth = async () => {
    setIsAuthenticating(true);
    setError(null);
    
    try {
      // First set the storage mode to cloud
      dispatch(updateStorageMode('cloud'));
      
      // Then authenticate with Google Drive - this will redirect to OAuth
      await dispatch(authenticateGoogleDrive());
      
      // Don't close the modal here - let the OAuth redirect handle it
      // The modal will be closed when the user returns from OAuth
    } catch (error: any) {
      setError(error.message || 'Failed to authenticate with Google Drive');
      setIsAuthenticating(false);
    }
  };

  const handleSelectDirectory = async () => {
    setIsSelectingDirectory(true);
    setError(null);
    
    try {
      const storageService = getUnifiedStorageService();
      
      // First switch the storage service to filesystem mode
      await storageService.switchMode('filesystem');
      
      // Then get the adapter (which should now be FileSystemStorageAdapter)
      const adapter = storageService.getAdapter();
      
      if (!adapter) {
        throw new Error('Local storage adapter not available');
      }

      // Request directory access - use the correct method signature
      const result = await (adapter as any).requestDirectoryAccessWithHints();

      if (result && result.success) {
        dispatch(updateStorageMode('filesystem'));
        dispatch(markStorageConfigured());
        onStorageConfigured();
        onClose();
      } else {
        throw new Error(result?.error || 'Failed to access directory');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to select directory');
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  const isLocalSupported = () => {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={isAuthenticating || isSelectingDirectory}
      PaperProps={{
        sx: { 
          borderRadius: 2,
          backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FA',
          color: isDarkMode ? '#FFFFFF' : '#212121'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, position: 'relative', backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FA', color: isDarkMode ? '#FFFFFF' : '#212121' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Welcome to the FIDU Chat Lab!
        </Typography>
        <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575' }}>
          Choose your storage preference to get started
        </Typography>
        <IconButton 
          onClick={handleDismiss}
          disabled={isAuthenticating || isSelectingDirectory}
          size="small"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: isDarkMode ? '#FFFFFF' : '#212121',
            '&:hover': {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FA', color: isDarkMode ? '#FFFFFF' : '#212121' }}>
        <Typography variant="body1" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', mb: 3 }}>
          Before you get started, you need to tell us where you'd like to store your chat data:
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {/* Google Drive Option */}
          <Card variant="outlined" sx={{ p: 0, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E0E0E0' }}>
            <CardContent sx={{ pb: 1, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CloudIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ color: isDarkMode ? '#FFFFFF' : '#212121' }}>Google Drive:</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', ml: 4 }}>
                Allows you to access your data across multiple devices
              </Typography>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }}>
              <Button
                variant="contained"
                onClick={handleGoogleDriveAuth}
                disabled={isAuthenticating}
                startIcon={isAuthenticating ? <CircularProgress size={20} /> : <CloudIcon />}
                sx={{ minWidth: 180 }}
              >
                {isAuthenticating ? 'Authenticating...' : 'Auth with google'}
              </Button>
            </CardActions>
          </Card>

          {/* Local Storage Option */}
          <Card variant="outlined" sx={{ p: 0, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E0E0E0' }}>
            <CardContent sx={{ pb: 1, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FileSystemIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ color: isDarkMode ? '#FFFFFF' : '#212121' }}>Locally On My Machine:</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', ml: 4 }}>
                Keeps all your data on your machine only, never stored online. Will NOT be synced across multiple devices.
              </Typography>
              {!isLocalSupported() && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, ml: 4 }}>
                  <WarningIcon sx={{ mr: 1, color: 'warning.main', fontSize: 16 }} />
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', fontStyle: 'italic' }}>
                    NOTE: Unavailable on Firefox and Safari
                  </Typography>
                </Box>
              )}
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2, backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF' }}>
              <Button
                variant="contained"
                onClick={handleSelectDirectory}
                disabled={isSelectingDirectory || !isLocalSupported()}
                startIcon={isSelectingDirectory ? <CircularProgress size={20} /> : <FileSystemIcon />}
                sx={{ minWidth: 180 }}
              >
                {isSelectingDirectory ? 'Selecting Directory...' : 'Select Directory'}
              </Button>
            </CardActions>
          </Card>
        </Box>

        <Box sx={{ mt: 3, mb: 2 }}>
          <Button
            variant="text"
            startIcon={showLearnMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowLearnMore(!showLearnMore)}
            sx={{ textTransform: 'none' }}
          >
            Learn more about how your data is stored
          </Button>
          
          <Collapse in={showLearnMore}>
            <Box sx={{ mt: 2, p: 2, backgroundColor: isDarkMode ? '#2A2A2A' : '#F8F9FA', borderRadius: 1, border: 1, borderColor: isDarkMode ? '#404040' : '#E0E0E0' }}>
              <Typography variant="h6" gutterBottom sx={{ color: isDarkMode ? '#FFFFFF' : '#212121' }}>
                Google Drive:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? '#B0B0B0' : '#757575' }}>
                We store your conversations, contexts and custom system prompts and stored API keys in the AppData folder of your Google Drive. When you launch this app, it is fetched and stored temporarily in your browser for the app to use, and regularly synced back to your google drive. All the data is encrypted at rest, and your personal encryption key is stored separately with your user account on our servers, completely separate from the data itself.
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: isDarkMode ? '#B0B0B0' : '#757575' }}>
                We hold none of your data, we can only read from the FIDU AppData folder in your drive, and no one else can read the data without the encryption key.
              </Typography>
              
              <Typography variant="h6" gutterBottom sx={{ color: isDarkMode ? '#FFFFFF' : '#212121' }}>
                Local File System:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? '#B0B0B0' : '#757575' }}>
                NOTE: Unavailable on Firefox and Safari
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: isDarkMode ? '#B0B0B0' : '#757575' }}>
                We store your conversations, contexts and custom system prompts and stored API keys in files in the directory on your computer that you choose. All the data is encrypted at rest, and your personal encryption key is stored separately with your user account on our servers, completely separate from the data itself.
              </Typography>
              <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575' }}>
                All your data is stored on your own computer only, we hold none of it. No other malicious apps can read the data without the encryption key.
              </Typography>
            </Box>
          </Collapse>
        </Box>

        <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', textAlign: 'center', mt: 2 }}>
          You can change your selection anytime in the Settings page.
        </Typography>
        
        <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', textAlign: 'center', mt: 1 }}>
          This is an early version of our offerings, so there may be some bugs and features missing.
        </Typography>
        
        <Typography variant="body2" sx={{ color: isDarkMode ? '#B0B0B0' : '#757575', textAlign: 'center', mt: 1 }}>
          Found an issue? Got a feature you'd love us to add? let us know! hello@firstdataunion.org
        </Typography>
      </DialogContent>
    </Dialog>
  );
};