import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/redux';

import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ProfileSelector from './ProfileSelector';

const AuthWrapper: React.FC = () => {
  const { isAuthenticated, currentProfile, isInitialized } = useAppSelector((state) => state.auth);
  const [showRegister, setShowRegister] = useState(false);

  // Show loading while auth is initializing
  if (!isInitialized) {
    return null; // This will be handled by the main App component
  }

  // If not authenticated, show login/register forms
  if (!isAuthenticated) {
    return showRegister ? (
      <RegisterForm onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <LoginForm onSwitchToRegister={() => setShowRegister(true)} />
    );
  }

  // If authenticated but no profile selected, show profile selector
  if (!currentProfile) {
    return <ProfileSelector />;
  }

  // If authenticated and profile selected, render children (main app)
  return null;
};

export default AuthWrapper; 