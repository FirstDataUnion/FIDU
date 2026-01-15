import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Link,
  Collapse,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Cookie as CookieIcon,
} from '@mui/icons-material';

const COOKIE_CONSENT_KEY = 'fidu_chatlab_cookie_consent';

interface CookieConsentState {
  accepted: boolean;
  timestamp: number;
}

/**
 * Cookie Consent Banner Component
 * 
 * Displays a GDPR-compliant cookie consent banner that informs users about:
 * - Essential cookies and browser storage
 * - Anonymous metrics collection
 * - Link to full privacy policy
 * 
 * The banner appears on first visit and remembers the user's choice.
 */
export const CookieBanner: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consentStr = localStorage.getItem(COOKIE_CONSENT_KEY);
    
    if (!consentStr) {
      // No consent recorded, show banner after a short delay
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Check if consent is still valid (refresh every 365 days)
    try {
      const consent: CookieConsentState = JSON.parse(consentStr);
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      
      if (consent.timestamp < oneYearAgo) {
        // Consent expired, show banner again
        setShowBanner(true);
      }
    } catch (err) {
      console.error('Error parsing cookie consent:', err);
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    const consent: CookieConsentState = {
      accepted: true,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    setShowBanner(false);
  };

  const handleViewPolicy = () => {
    // Use window.location to navigate (works outside Router context)
    const basePath = import.meta.env.BASE_URL || '/fidu-chat-lab/';
    window.location.href = `${basePath}privacy-policy`;
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        p: 2,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: '800px',
          margin: '0 auto',
          pointerEvents: 'auto',
          borderRadius: 2,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Main Banner Content */}
        <Box p={isMobile ? 2 : 3}>
          {/* Header */}
          <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
            <CookieIcon sx={{ fontSize: 32, color: 'primary.main', flexShrink: 0 }} />
            
            <Box flex={1}>
              <Typography variant="h6" gutterBottom>
                We Value Your Privacy
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                FIDU Chat Lab uses essential cookies and browser storage to keep you logged in 
                and store your conversations securely on your device. We also collect anonymous 
                usage metrics to improve the service.
              </Typography>
            </Box>

            <IconButton
              size="small"
              onClick={handleAccept}
              sx={{ flexShrink: 0 }}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Expandable Details */}
          <Box mb={2}>
            <Button
              size="small"
              startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowDetails(!showDetails)}
              sx={{ textTransform: 'none', pl: 0 }}
            >
              {showDetails ? 'Hide Details' : 'What do we collect?'}
            </Button>
            
            <Collapse in={showDetails}>
              <Box mt={2} pl={2} sx={{ borderLeft: `3px solid ${theme.palette.divider}` }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Essential Cookies & Storage:
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  • Authentication cookies (keep you logged in)
                  <br />
                  • Local storage (your preferences and settings)
                  <br />
                  • IndexedDB (your conversations and contexts - stored locally)
                  <br />
                  • Google Drive tokens (if you enable cloud sync)
                </Typography>

                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Anonymous Metrics:
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  • Error tracking (to fix bugs)
                  <br />
                  • Page views (which features are used)
                  <br />
                  • AI model usage (success rates)
                  <br />
                  • API performance (response times)
                  <br />
                  <br />
                  <em>
                    We never collect the content of your conversations or any personally 
                    identifiable information in metrics. You can opt out in Settings.
                  </em>
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary">
                  <strong>We do NOT use:</strong> Advertising cookies, tracking pixels, 
                  social media trackers, or third-party analytics.
                </Typography>
              </Box>
            </Collapse>
          </Box>

          {/* Actions */}
          <Box 
            display="flex" 
            gap={1.5}
            flexDirection={isMobile ? 'column' : 'row'}
            alignItems="stretch"
          >
            <Button
              variant="contained"
              onClick={handleAccept}
              fullWidth={isMobile}
              sx={{ flexGrow: isMobile ? 0 : 1 }}
            >
              Accept & Continue
            </Button>
            
            <Button
              variant="outlined"
              onClick={handleViewPolicy}
              fullWidth={isMobile}
            >
              View Full Privacy Policy
            </Button>
          </Box>

          {/* Footer Note */}
          <Typography 
            variant="caption" 
            color="text.secondary" 
            display="block" 
            mt={2}
            textAlign="center"
          >
            By continuing to use Chat Lab, you agree to our{' '}
            <Link
              component="button"
              variant="caption"
              onClick={() => {
                const basePath = import.meta.env.BASE_URL || '/fidu-chat-lab/';
                window.location.href = `${basePath}terms-of-use`;
              }}
              sx={{ verticalAlign: 'baseline' }}
            >
              Terms of Use
            </Link>
            {' '}and{' '}
            <Link
              component="button"
              variant="caption"
              onClick={handleViewPolicy}
              sx={{ verticalAlign: 'baseline' }}
            >
              Privacy Policy
            </Link>
            .
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

