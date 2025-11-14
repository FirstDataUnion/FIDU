import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, AlertTitle, IconButton, Box, Chip } from '@mui/material';
import { Close as CloseIcon, SmartToy as SmartToyIcon } from '@mui/icons-material';
import { subscribeToAgentAlerts, type AgentAlert, markAlertAsRead } from '../../services/agents/agentAlerts';
import { ALERT_AUTO_HIDE_DURATION } from '../../services/agents/agentConstants';
import { useAlertClick } from '../../contexts/AlertClickContext';

interface QueuedAlert extends AgentAlert {
  open: boolean;
}

export default function AgentAlertsToaster(): React.JSX.Element | null {
  const [alerts, setAlerts] = useState<QueuedAlert[]>([]);
  const alertClickContext = useAlertClick();
  // Use a ref to track timeouts separately from state to avoid race conditions
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubscribe = subscribeToAgentAlerts((newAlert) => {
      // Add new alert to the queue
      const queuedAlert: QueuedAlert = {
        ...newAlert,
        open: true,
      };
      
      setAlerts((prev) => [...prev, queuedAlert]);
      
      // Set up auto-hide timeout and store it in the ref Map
      const timeout = setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
        timeoutRefs.current.delete(newAlert.id);
      }, ALERT_AUTO_HIDE_DURATION);
      
      // Store timeout reference in the Map before state update completes
      timeoutRefs.current.set(newAlert.id, timeout);
    });
    return unsubscribe;
  }, []);

  const handleClose = useCallback((alertId: string) => {
    // Clear the timeout from the ref Map
    const timeout = timeoutRefs.current.get(alertId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(alertId);
    }
    // Remove the alert from state
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const handleAlertClick = useCallback((alert: AgentAlert) => {
    if (alertClickContext?.onAlertClick) {
      // Mark the alert as read when clicked
      markAlertAsRead(alert.id);
      alertClickContext.onAlertClick(alert.id);
      handleClose(alert.id); // Close this specific alert when clicked
    }
  }, [alertClickContext, handleClose]);

  if (alerts.length === 0) return null;

  const severityMap = {
    error: 'error' as const,
    warn: 'warning' as const,
    info: 'info' as const,
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxWidth: { xs: 'calc(100% - 32px)', sm: 400 },
        width: { xs: 'calc(100% - 32px)', sm: 400 },
        pointerEvents: 'none', // Allow clicks to pass through the container
      }}
    >
      {alerts.map((alert) => (
        <Box
          key={alert.id}
          sx={{
            pointerEvents: 'auto', // Re-enable pointer events for the alert itself
            animation: 'slideIn 0.3s ease-out',
            '@keyframes slideIn': {
              from: {
                transform: 'translateX(100%)',
                opacity: 0,
              },
              to: {
                transform: 'translateX(0)',
                opacity: 1,
              },
            },
          }}
        >
          <Alert
            severity={severityMap[alert.severity]}
            variant="filled"
            onClose={() => handleClose(alert.id)}
            icon={<SmartToyIcon />}
            onClick={() => handleAlertClick(alert)}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the alert click
                  handleClose(alert.id);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{
              width: '100%',
              alignItems: 'flex-start',
              cursor: alertClickContext?.onAlertClick ? 'pointer' : 'default',
              '& .MuiAlert-message': {
                width: '100%',
              },
              '&:hover': alertClickContext?.onAlertClick ? {
                opacity: 0.9,
              } : {},
            }}
          >
            <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>
              Background Agent Alert
            </AlertTitle>
            <Box sx={{ mb: 1 }}>
              {alert.shortMessage || alert.message || 'An issue was detected in your conversation.'}
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
        </Box>
      ))}
    </Box>
  );
}
