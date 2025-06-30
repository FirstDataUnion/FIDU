import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchProfiles } from '../../store/slices/authSlice';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ProfileSelector from './ProfileSelector';

const AuthWrapper: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, currentProfile, profiles, isInitialized } = useAppSelector((state) => state.auth);
  const [showRegister, setShowRegister] = useState(false);

  // Fetch profiles when authenticated but no profile selected
  useEffect(() => {
    if (isAuthenticated && !currentProfile && profiles.length === 0) {
      dispatch(fetchProfiles());
    }
  }, [isAuthenticated, currentProfile, profiles.length, dispatch]);

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