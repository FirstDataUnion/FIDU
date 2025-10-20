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
} from '@mui/icons-material';

interface StorageConfigurationBannerProps {
  compact?: boolean;
}

export const StorageConfigurationBanner: React.FC<StorageConfigurationBannerProps> = ({
  compact = false,
}) => {
  const handleGoToSettings = () => {
    // Use window.location instead of useNavigate to avoid Router context issues
    window.location.href = '/fidu-chat-lab/settings';
  };

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
        }
      >
        <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
          <strong>Storage configuration required.</strong> You need to configure your storage choices to save any data.
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
      }
    >
      <Box>
        <Typography variant="body1" gutterBottom sx={{ color: 'error.contrastText' }}>
          <strong>Storage Configuration Required</strong>
        </Typography>
        <Typography variant="body2" sx={{ color: 'error.contrastText' }}>
          You need to configure your storage choices to save any of your data. Please go to Settings to set up your preferred storage option.
        </Typography>
      </Box>
    </Alert>
  );
};
