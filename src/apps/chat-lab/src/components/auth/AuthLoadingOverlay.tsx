/**
 * Alternative Approach: Loading Overlay Component
 * This provides an even smoother experience by showing a loading overlay
 * instead of redirecting to a separate page
 */

import React from 'react';
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material';
import { CheckCircle, CloudSync } from '@mui/icons-material';

interface AuthLoadingOverlayProps {
  open: boolean;
  status: 'processing' | 'success' | 'error';
  message: string;
}

export const AuthLoadingOverlay: React.FC<AuthLoadingOverlayProps> = ({ 
  open, 
  status, 
  message 
}) => {
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

  return (
    <Backdrop
      open={open}
      sx={{
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3
      }}
    >
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 3,
          p: 4,
          textAlign: 'center',
          maxWidth: 400,
          width: '90%',
          boxShadow: 24
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
      </Box>
    </Backdrop>
  );
};
