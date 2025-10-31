import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, AlertTitle, IconButton, Box, Chip } from '@mui/material';
import { Close as CloseIcon, SmartToy as SmartToyIcon } from '@mui/icons-material';
import { subscribeToAgentAlerts, type AgentAlert } from '../../services/agents/agentAlerts';
import { ALERT_AUTO_HIDE_DURATION } from '../../services/agents/agentConstants';

export default function AgentAlertsToaster(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<AgentAlert | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAgentAlerts((newAlert) => {
      setAlert(newAlert);
      setOpen(true);
    });
    return unsubscribe;
  }, []);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    // Don't close on clickaway to ensure users see important alerts
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  if (!alert) return null;

  const severityMap = {
    error: 'error' as const,
    warn: 'warning' as const,
    info: 'info' as const,
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={ALERT_AUTO_HIDE_DURATION}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{
        '& .MuiSnackbarContent-root': {
          minWidth: { xs: '100%', sm: 400 },
        },
      }}
    >
      <Alert
        severity={severityMap[alert.severity]}
        variant="filled"
        onClose={handleClose}
        icon={<SmartToyIcon />}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          width: '100%',
          alignItems: 'flex-start',
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>
          Background Agent Alert
        </AlertTitle>
        <Box sx={{ mb: 1 }}>
          {alert.message || 'An issue was detected in your conversation.'}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          <Chip
            label={`Rating: ${alert.rating}/100`}
            size="small"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              color: 'inherit',
              fontWeight: 500,
            }}
          />
          <Chip
            label={alert.severity.toUpperCase()}
            size="small"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              color: 'inherit',
              fontWeight: 500,
            }}
          />
        </Box>
      </Alert>
    </Snackbar>
  );
}
