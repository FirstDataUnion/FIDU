import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import type { FeatureFlagKey } from '../../types/featureFlags';

interface FeatureFlagGuardProps {
  children: React.ReactNode;
  featureFlag: FeatureFlagKey;
  featureName: string;
  disabledMessage?: string;
}

export const FeatureFlagGuard: React.FC<FeatureFlagGuardProps> = ({
  children,
  featureFlag,
  featureName,
  disabledMessage,
}) => {
  const navigate = useNavigate();
  const isEnabled = useFeatureFlag(featureFlag);

  // Feature is disabled
  if (!isEnabled) {
    const defaultMessage =
      disabledMessage
      || `${featureName} is currently disabled. You can enable it in Settings > Customise Features.`;

    return (
      <Box
        sx={{
          p: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Feature Not Available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {defaultMessage}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/settings')}>
              Go to Settings
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Feature is enabled, render children
  return <>{children}</>;
};
