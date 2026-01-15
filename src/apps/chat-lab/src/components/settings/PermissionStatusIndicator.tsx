import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'checking';

interface PermissionStatusIndicatorProps {
  permissionState: PermissionState;
  directoryName?: string | null;
  onRenewPermission?: () => Promise<void>;
  isRenewing?: boolean;
  compact?: boolean;
}

export const PermissionStatusIndicator: React.FC<PermissionStatusIndicatorProps> = ({
  permissionState,
  directoryName,
  onRenewPermission,
  isRenewing = false,
  compact = false
}) => {
  const getStatusConfig = () => {
    switch (permissionState) {
      case 'granted':
        return {
          icon: <CheckCircleIcon />,
          label: 'Active',
          color: 'success' as const,
          severity: 'success' as const,
          message: directoryName 
            ? `Access granted to ${directoryName}` 
            : 'Directory access is active'
        };
      case 'denied':
        return {
          icon: <ErrorIcon />,
          label: 'Denied',
          color: 'error' as const,
          severity: 'error' as const,
          message: 'Directory access has been denied or revoked'
        };
      case 'checking':
        return {
          icon: <CircularProgress size={16} />,
          label: 'Checking...',
          color: 'default' as const,
          severity: 'info' as const,
          message: 'Verifying directory permissions...'
        };
      default: // 'prompt'
        return {
          icon: <WarningIcon />,
          label: 'Not Selected',
          color: 'warning' as const,
          severity: 'warning' as const,
          message: 'No directory selected'
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant={permissionState === 'granted' ? 'filled' : 'outlined'}
      />
    );
  }

  return (
    <Box>
      <Alert 
        severity={config.severity}
        icon={config.icon}
        action={
          permissionState === 'denied' && onRenewPermission ? (
            <Button
              color="inherit"
              size="small"
              onClick={onRenewPermission}
              disabled={isRenewing}
              startIcon={isRenewing ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              {isRenewing ? 'Renewing...' : 'Renew Access'}
            </Button>
          ) : undefined
        }
      >
        <Typography variant="body2">
          {config.message}
        </Typography>
      </Alert>
    </Box>
  );
};
