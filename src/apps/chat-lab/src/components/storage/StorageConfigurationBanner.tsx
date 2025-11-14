import React from 'react';
import {
  Alert,
  Button,
  Box,
  Typography,
} from '@mui/material';
import {
  Warning,
  CloudSync,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store';
import { authenticateGoogleDrive } from '../../store/slices/unifiedStorageSlice';

interface StorageConfigurationBannerProps {
  compact?: boolean;
}

export const StorageConfigurationBanner: React.FC<StorageConfigurationBannerProps> = ({
  compact = false,
}) => {
  const dispatch = useAppDispatch();
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const isGoogleDriveLoading = unifiedStorage.googleDrive.isLoading;

  const handleGoogleDriveAuth = async () => {
    try {
      await dispatch(authenticateGoogleDrive()).unwrap();
      // The authentication will redirect to Google OAuth, so we don't need to handle success here
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
    }
  };

  const buttonSize = compact ? 'small' : 'medium';
  const buttonVariant = compact ? undefined : 'outlined';

  return (
    <Alert 
      severity="error"
      icon={<Warning />}
      sx={{ 
        backgroundColor: 'error.main',
        color: 'error.contrastText',
        border: 'none !important',
        borderRadius: 0,
        outline: 'none',
        boxShadow: 'none',
        '&::before': {
          display: 'none'
        },
        '&::after': {
          display: 'none'
        },
        '& .MuiAlert-icon': {
          color: 'error.contrastText'
        },
        '& .MuiAlert-action': {
          color: 'error.contrastText'
        },
        '& .MuiAlert-message': {
          color: 'error.contrastText'
        }
      }}
      action={
        <Button 
          color="inherit" 
          size={buttonSize} 
          onClick={handleGoogleDriveAuth}
          disabled={isGoogleDriveLoading}
          startIcon={<CloudSync />}
          variant={buttonVariant}
          sx={{
            color: 'error.contrastText',
            borderColor: 'error.contrastText',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'error.contrastText'
            }
          }}
        >
          {isGoogleDriveLoading ? 'Connecting...' : 'Connect Google Drive'}
        </Button>
      }
    >
      {compact ? (
        <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
          <strong>Google Drive is not connected.</strong> Connect your Google Drive account to save your data.
        </Typography>
      ) : (
        <Box>
          <Typography variant="body1" gutterBottom sx={{ color: 'error.contrastText' }}>
            <strong>Google Drive is not connected</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
            Connect your Google Drive account to save your conversations, contexts, and other data. Your data will be stored securely in your personal Google Drive.
          </Typography>
        </Box>
      )}
    </Alert>
  );
};
