import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Link,
  Checkbox,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  Divider,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  RocketLaunch as RocketIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';

const WELCOME_DISMISSED_KEY = 'fidu_chatlab_welcome_dismissed';

interface WelcomeDismissedState {
  dismissed: boolean;
  doNotShowAgain: boolean;
  timestamp: number;
}

/**
 * Welcome Landing Page Component
 * 
 * Displays a full-page modal that introduces new users to ChatLab features.
 * The modal appears after login and can be dismissed with an option to
 * never show it again, using the same localStorage mechanism as the cookie banner.
 */
export const WelcomeLandingPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);
  
  const [showModal, setShowModal] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    // Only show if user is authenticated and auth is initialized
    if (!isInitialized || !isAuthenticated) {
      setShowModal(false);
      return;
    }

    // Check if user has already dismissed the welcome page
    const dismissedStr = localStorage.getItem(WELCOME_DISMISSED_KEY);
    
    if (!dismissedStr) {
      // No dismissal recorded, show modal after a short delay
      const timer = setTimeout(() => {
        setShowModal(true);
        // Trigger fade in after modal is shown
        setTimeout(() => setFadeIn(true), 50);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Check if user chose "do not show again"
    try {
      const dismissed: WelcomeDismissedState = JSON.parse(dismissedStr);
      
      if (dismissed.doNotShowAgain) {
        // User chose to never show again
        setShowModal(false);
        return;
      }
      
      // If dismissed but "do not show again" was not checked, show it again
      // (This means the previous dismissal was temporary - clear it and show modal)
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
      const timer = setTimeout(() => {
        setShowModal(true);
        // Trigger fade in after modal is shown
        setTimeout(() => setFadeIn(true), 50);
      }, 1000);
      
      return () => clearTimeout(timer);
    } catch (err) {
      console.error('Error parsing welcome dismissal:', err);
      // On error, clear invalid data and show the modal after a short delay
      localStorage.removeItem(WELCOME_DISMISSED_KEY);
      const timer = setTimeout(() => {
        setShowModal(true);
        // Trigger fade in after modal is shown
        setTimeout(() => setFadeIn(true), 50);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isInitialized]);

  const handleDismiss = () => {
    // Fade out first, then hide modal
    setFadeIn(false);
    setTimeout(() => {
      // Only save dismissal state if "do not show again" is checked
      if (doNotShowAgain) {
        const dismissedState: WelcomeDismissedState = {
          dismissed: true,
          doNotShowAgain: true,
          timestamp: Date.now(),
        };
        
        localStorage.setItem(WELCOME_DISMISSED_KEY, JSON.stringify(dismissedState));
      } else {
        // If not checked, don't save anything - it will show again next time
        localStorage.removeItem(WELCOME_DISMISSED_KEY);
      }
      
      setShowModal(false);
    }, 300); // Match Fade transition duration
  };

  const handleGitHubLink = () => {
    window.open('https://github.com/FirstDataUnion/FIDU', '_blank', 'noopener,noreferrer');
  };

  if (!showModal) {
    return null;
  }

  return (
    <Fade in={fadeIn} timeout={300}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: isMobile ? 2 : 4,
          overflow: 'auto',
        }}
      >
        <Fade in={fadeIn} timeout={400} style={{ transitionDelay: fadeIn ? '100ms' : '0ms' }}>
          <Paper
            elevation={24}
            sx={{
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          margin: '0 auto',
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={handleDismiss}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1,
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
          aria-label="Close"
        >
          <CloseIcon />
        </IconButton>

        {/* Content */}
        <Box
          sx={{
            p: isMobile ? 3 : 4,
            overflow: 'auto',
            flex: 1,
          }}
        >
          {/* Header */}
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <RocketIcon sx={{ fontSize: 40, color: 'primary.main', flexShrink: 0 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Welcome to FIDU ChatLab
            </Typography>
          </Box>

          <Typography variant="h6" component="h2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
            Your unified workspace for AI conversations.
          </Typography>

          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
            ChatLab is a web application that brings together the world's leading AI models 
            (ChatGPT, Claude, Gemini, and more) in one simple interface. Unlike other platforms, 
            you maintain complete control over your data – all your conversations, custom prompts, 
            and contexts are stored on your Google Drive, never on our servers.
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* What makes ChatLab different */}
          <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
            What makes ChatLab different:
          </Typography>
          
          <Box component="ul" sx={{ pl: 3, mb: 3, '& li': { mb: 1.5 } }}>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Chat with multiple AI models from a single interface
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Your data stays yours – stored in your Google Drive
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Build a personal library of custom prompts and contexts
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Reference previous conversations across any model
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Run asynchronous background agents to help you with your tasks
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Share your conversations, prompts and contexts with others
            </Typography>
            <Typography component="li" variant="body1" sx={{ lineHeight: 1.8 }}>
              Open-source and transparent
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Getting Started */}
          <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
            Getting Started is Easy:
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
              <strong>1. Quick Start:</strong> Use our paid service to access premium AI models instantly – no API keys needed.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
              <strong>2. Bring Your Own Keys:</strong> Have API keys already? Use them for free with ChatLab's enhanced interface.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2,lineHeight: 1.8 }}>
              <strong>3. Explore & Customize:</strong> Browse our prompt library, create contexts from past chats, and tailor the experience to your needs.
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
              <strong>4. Get Help:</strong> If you need help, please ask a question on our{' '}
              <Link
                component="button"
                variant="body1"
                onClick={() => window.open('https://github.com/FirstDataUnion/FIDU/issues', '_blank', 'noopener,noreferrer')}
                sx={{
                  textDecoration: 'none',
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >GitHub Issues</Link> page (there's a link in the sidebar too).
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Call to Action */}
          <Box sx={{ textAlign: 'center', mb: 0 }}>
            <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
              Ready to take control of your AI conversations? Start chatting now or explore our{' '}
              <Link
                component="button"
                variant="body1"
                onClick={handleGitHubLink}
                sx={{
                  textDecoration: 'none',
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                open-source code on GitHub
              </Link>
              .
            </Typography>
          </Box>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            p: isMobile ? 2 : 3,
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.02)' 
              : 'rgba(0, 0, 0, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Do Not Show Again Checkbox */}
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={doNotShowAgain}
                  onChange={(e) => setDoNotShowAgain(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Do not show me this again
                </Typography>
              }
            />
          </Box>
          
          <Button
            variant="contained"
            onClick={handleDismiss}
            fullWidth={isMobile}
            size="large"
            sx={{
              py: 1,
              fontSize: '1.1rem',
              fontWeight: 600,
              maxWidth: isMobile ? '100%' : '400px',
            }}
          >
            Get Started
          </Button>
        </Box>
      </Paper>
      </Fade>
    </Box>
    </Fade>
  );
};

export default WelcomeLandingPage;

