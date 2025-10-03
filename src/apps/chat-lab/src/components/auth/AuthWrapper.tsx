import React from 'react';
import { useAppSelector } from '../../hooks/redux';

import FiduAuthLogin from './FiduAuthLogin';
import ProfileSelector from './ProfileSelector';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, currentProfile, isInitialized } = useAppSelector((state) => state.auth);

  // Show loading while auth is initializing
  if (!isInitialized) {
    return null; // Handled by the main App component
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