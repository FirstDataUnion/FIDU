import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { PrivacyTip as PrivacyTipIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateShareAnalytics } from '../../store/slices/settingsSlice';

export const PrivacySettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector(state => state.settings);

  const handleShareAnalyticsChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    dispatch(updateShareAnalytics(event.target.checked));
  };

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <PrivacyTipIcon />
        Privacy & Data Collection
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Control how your usage data is collected and shared.
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={settings.privacySettings.shareAnalytics}
            onChange={handleShareAnalyticsChange}
            color="primary"
          />
        }
        label={
          <Box>
            <Typography variant="body1">
              Share Anonymous Usage Metrics
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Help us improve FIDU Chat Lab by sharing anonymous usage metrics,
              error reports, and performance data. No personal data,
              conversations, or sensitive information is ever collected.
            </Typography>
          </Box>
        }
      />

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontStyle: 'italic' }}
      >
        {settings.privacySettings.shareAnalytics ? (
          <>
            ✅ You are currently sharing anonymous metrics to help improve the
            application. Thank you!
          </>
        ) : (
          <>
            🔒 Metrics collection is disabled. No usage data is being collected
            or sent.
          </>
        )}
      </Typography>
    </>
  );
};
