import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAppSelector } from '../../hooks/redux';
import { isPublicRoute } from '../../utils/publicRoutes';

import FiduAuthLogin from './FiduAuthLogin';
import ProfileSelector from './ProfileSelector';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, currentProfile, isInitialized, isLoading } =
    useAppSelector(state => state.auth);

  // Check if current route is a public route
  const pathname = location.pathname;
  const isPublic = isPublicRoute(pathname);

  // Show loading while auth is initializing (unless it's a public route)
  if (!isInitialized && !isPublic) {
    return null; // Handled by the main App component
  }

  // If auth is loading after login (e.g., initializeAuth running), show loading overlay
  if (isLoading && !isAuthenticated && !isPublic) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <CircularProgress size={64} thickness={4} />
        <Typography
          variant="h5"
          sx={{ color: 'primary.main', fontWeight: 600 }}
        >
          Logging You In
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Setting up your workspace...
        </Typography>
      </Box>
    );
  }

  // Allow public routes to render without authentication
  if (isPublic) {
    return <>{children}</>;
  }

  // If not authenticated, show login/register forms
  if (!isAuthenticated) {
    return <FiduAuthLogin />;
  }

  // If authenticated but no profile selected, show profile selector
  if (!currentProfile) {
    return <ProfileSelector />;
  }

  // If authenticated and profile selected, render children (main app)
  return <>{children}</>;
};

export default AuthWrapper;
