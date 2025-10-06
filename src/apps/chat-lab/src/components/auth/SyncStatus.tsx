/**
 * Sync Status Component
 * Shows the current sync status and allows manual sync
 */

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Button, 
  Chip, 
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface SyncStatusProps {
  syncStatus?: any;
  onManualSync?: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  syncStatus, 
  onManualSync
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await onManualSync?.();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatLastSyncTime = (lastSyncTime: Date | null): string => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (): 'success' | 'warning' | 'error' | 'default' => {
    if (!syncStatus) return 'default';
    
    if (syncStatus.error) return 'error';
    if (syncStatus.syncInProgress) return 'warning';
    return 'success'; // Always online in web app
  };

  const getStatusIcon = () => {
    if (!syncStatus) return <ScheduleIcon />;
    
    if (syncStatus.error) return <ErrorIcon />;
    if (syncStatus.syncInProgress) return <CircularProgress size={20} />;
    return <CheckCircleIcon />; // Always online in web app
  };

  const getStatusText = (): string => {
    if (!syncStatus) return 'Unknown';
    
    if (syncStatus.error) return 'Sync Error';
    if (syncStatus.syncInProgress) return 'Syncing...';
    return 'Online'; // Always online in web app
  };

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <CloudSyncIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Sync Status</Typography>
          </Box>
          
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={getStatusColor()}
            size="small"
          />
        </Box>

        {syncStatus && (
          <>
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">
                <strong>Last Sync:</strong> {formatLastSyncTime(syncStatus.lastSyncTime)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                <strong>Connection:</strong> Online
              </Typography>
            </Box>

            {syncStatus.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {syncStatus.error}
              </Alert>
            )}

            {syncStatus.filesStatus && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Files Status:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    label={`Conversations: ${syncStatus.filesStatus.conversations ? '✓' : '✗'}`}
                    size="small"
                    color={syncStatus.filesStatus.conversations ? 'success' : 'default'}
                  />
                  <Chip
                    label={`API Keys: ${syncStatus.filesStatus.apiKeys ? '✓' : '✗'}`}
                    size="small"
                    color={syncStatus.filesStatus.apiKeys ? 'success' : 'default'}
                  />
                  <Chip
                    label={`Metadata: ${syncStatus.filesStatus.metadata ? '✓' : '✗'}`}
                    size="small"
                    color={syncStatus.filesStatus.metadata ? 'success' : 'default'}
                  />
                </Box>
              </Box>
            )}

            {syncStatus.smartAutoSync && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Auto-Sync Status:
                </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Chip
            label={`Unsynced Data: ${syncStatus.smartAutoSync.hasUnsyncedData ? 'Yes' : 'No'}`}
            size="small"
            color={syncStatus.smartAutoSync.hasUnsyncedData ? 'warning' : 'success'}
          />
          <Chip
            label={`Next Sync: ${syncStatus.smartAutoSync.nextSyncScheduled ? 'Scheduled' : 'None'}`}
            size="small"
            color={syncStatus.smartAutoSync.nextSyncScheduled ? 'primary' : 'default'}
          />
          <Chip
            label={`Delay: ${syncStatus.smartAutoSync.config.delayMinutes}min`}
            size="small"
            color="info"
          />
        </Box>
              </Box>
            )}

            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                onClick={handleManualSync}
                disabled={isManualSyncing || syncStatus.syncInProgress}
                startIcon={isManualSyncing ? <CircularProgress size={20} /> : <CloudSyncIcon />}
              >
                {isManualSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              
              <Tooltip title={syncStatus.autoSyncEnabled ? "Smart auto-sync enabled (5min delay, activity-aware)" : "Auto-sync disabled"}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled
                  color={syncStatus.autoSyncEnabled ? "success" : "inherit"}
                >
                  {syncStatus.autoSyncEnabled ? "Smart Auto-sync: ON" : "Auto-sync: OFF"}
                </Button>
              </Tooltip>
            </Box>
          </>
        )}

        {!syncStatus && (
          <Typography variant="body2" color="text.secondary">
            Sync status not available. Make sure you're connected to Google Drive.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
