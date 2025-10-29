import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppSelector } from '../../hooks/redux';
import { isPublicRoute } from '../../utils/publicRoutes';

import FiduAuthLogin from './FiduAuthLogin';
import ProfileSelector from './ProfileSelector';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, currentProfile, isInitialized } = useAppSelector((state) => state.auth);

  // Check if current route is a public route
  const pathname = location.pathname;
  const isPublic = isPublicRoute(pathname);

  // Show loading while auth is initializing (unless it's a public route)
  if (!isInitialized && !isPublic) {
    return null; // Handled by the main App component
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