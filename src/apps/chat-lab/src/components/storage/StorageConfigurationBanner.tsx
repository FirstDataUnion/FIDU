import React from 'react';
import {
  Alert,
  Button,
  Box,
  Typography,
} from '@mui/material';
import {
  Warning,
  Settings,
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
  const settings = useAppSelector((state) => state.settings.settings);

  const handleGoToSettings = () => {
    // Use window.location instead of useNavigate to avoid Router context issues
    window.location.href = '/fidu-chat-lab/settings';
  };

  const handleGoogleDriveAuth = async () => {
    try {
      await dispatch(authenticateGoogleDrive()).unwrap();
      // The authentication will redirect to Google OAuth, so we don't need to handle success here
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      // Fallback to settings if auth fails
      handleGoToSettings();
    }
  };

  // Check if user has Google Drive configured (cloud mode and not authenticated)
  const isGoogleDriveUser = settings.storageMode === 'cloud' && !unifiedStorage.googleDrive.isAuthenticated;
  const isGoogleDriveLoading = unifiedStorage.googleDrive.isLoading;

  if (compact) {
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isGoogleDriveUser && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleGoogleDriveAuth}
                disabled={isGoogleDriveLoading}
                startIcon={<CloudSync />}
                sx={{
                  color: 'error.contrastText',
                  borderColor: 'error.contrastText',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'error.contrastText'
                  }
                }}
              >
                {isGoogleDriveLoading ? 'Connecting...' : 'Reconnect Google Drive'}
              </Button>
            )}
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleGoToSettings}
              startIcon={<Settings />}
              sx={{
                color: 'error.contrastText',
                borderColor: 'error.contrastText',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'error.contrastText'
                }
              }}
            >
              Settings
            </Button>
          </Box>
        }
      >
        <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
          <strong>Storage configuration required.</strong> {isGoogleDriveUser 
            ? 'Your Google Drive connection has expired. Please reconnect to continue saving your data.'
            : 'You need to configure your storage choices to save any data.'
          }
        </Typography>
      </Alert>
    );
  }

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isGoogleDriveUser && (
            <Button 
              color="inherit" 
              size="medium" 
              onClick={handleGoogleDriveAuth}
              disabled={isGoogleDriveLoading}
              startIcon={<CloudSync />}
              variant="outlined"
              sx={{
                color: 'error.contrastText',
                borderColor: 'error.contrastText',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'error.contrastText'
                }
              }}
            >
              {isGoogleDriveLoading ? 'Connecting...' : 'Reconnect Google Drive'}
            </Button>
          )}
          <Button 
            color="inherit" 
            size="medium" 
            onClick={handleGoToSettings}
            startIcon={<Settings />}
            variant="outlined"
            sx={{
              color: 'error.contrastText',
              borderColor: 'error.contrastText',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'error.contrastText'
              }
            }}
          >
            Go to Settings
          </Button>
        </Box>
      }
    >
      <Box>
        <Typography variant="body1" gutterBottom sx={{ color: 'error.contrastText' }}>
          <strong>Storage Configuration Required</strong>
        </Typography>
        <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
          {isGoogleDriveUser 
            ? 'Your Google Drive connection has expired. Please reconnect to continue saving your data, or go to Settings to change your storage option.'
            : 'You need to configure your storage choices to save any of your data. Please go to Settings to set up your preferred storage option.'
          }
        </Typography>
      </Box>
    </Alert>
  );
};
