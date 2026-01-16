/**
 * Sync Health Indicator
 * Shows the last successful sync time and visual health status in the header.
 *
 * Visual states:
 * - Green: "Synced Xm ago" (healthy - no failures)
 * - Yellow: "Synced Xm ago - retrying..." (degraded - 1-2 failures)
 * - Orange/Red: "Synced Xh ago - sync failing" (failing - 3+ failures)
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
  CloudDone as CloudDoneIcon,
  CloudSync as CloudSyncIcon,
  CloudOff as CloudOffIcon,
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import type { SyncHealth } from '../../services/storage/sync/SmartAutoSyncService';

interface SyncHealthIndicatorProps {
  variant?: 'compact' | 'full';
}

interface SyncHealthStatus {
  syncHealth: SyncHealth;
  lastSuccessfulSync: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
  hasUnsyncedData: boolean;
}

export const SyncHealthIndicator: React.FC<SyncHealthIndicatorProps> = ({
  variant = 'compact',
}) => {
  const [status, setStatus] = useState<SyncHealthStatus | null>(null);

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const storageService = getUnifiedStorageService();
        const adapter = storageService.getAdapter();

        if ('getSyncStatus' in adapter) {
          const syncStatus = await (adapter as any).getSyncStatus();
          const smartStatus = syncStatus.smartAutoSync;

          if (smartStatus) {
            setStatus({
              syncHealth: smartStatus.syncHealth || 'healthy',
              lastSuccessfulSync: smartStatus.lastSuccessfulSync
                ? new Date(smartStatus.lastSuccessfulSync)
                : null,
              consecutiveFailures: smartStatus.consecutiveFailures || 0,
              lastError: smartStatus.lastError || null,
              hasUnsyncedData: smartStatus.hasUnsyncedData || false,
            });
          }
        }
      } catch (error) {
        console.error('Failed to get sync health status:', error);
      }
    };

    // Update immediately
    updateStatus();

    // Update every 10 seconds (less frequent than countdown)
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if we don't have status yet
  if (!status) {
    return null;
  }

  const formatTimeSince = (date: Date | null): string => {
    if (!date) return 'Never synced';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Synced just now';
    if (diffMinutes < 60) return `Synced ${diffMinutes}m ago`;
    if (diffHours < 24) return `Synced ${diffHours}h ago`;
    return `Synced ${diffDays}d ago`;
  };

  const getHealthColor = (health: SyncHealth): string => {
    switch (health) {
      case 'healthy':
        return 'success.main';
      case 'degraded':
        return 'warning.main';
      case 'failing':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  const getHealthIcon = (health: SyncHealth) => {
    const color = getHealthColor(health);
    switch (health) {
      case 'healthy':
        return <CloudDoneIcon sx={{ fontSize: 14, color }} />;
      case 'degraded':
        return <CloudSyncIcon sx={{ fontSize: 14, color }} />;
      case 'failing':
        return <CloudOffIcon sx={{ fontSize: 14, color }} />;
      default:
        return <CloudDoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />;
    }
  };

  const getStatusSuffix = (health: SyncHealth, failures: number): string => {
    switch (health) {
      case 'healthy':
        return '';
      case 'degraded':
        return ` (retrying ${failures}/2)`;
      case 'failing':
        return ` (sync failing - ${failures} attempts)`;
      default:
        return '';
    }
  };

  const getTooltipContent = (): string => {
    const timeSince = formatTimeSince(status.lastSuccessfulSync);

    if (status.syncHealth === 'healthy') {
      if (status.hasUnsyncedData) {
        return `${timeSince}. Local changes pending sync.`;
      }
      return `${timeSince}. All data synced to Google Drive.`;
    }

    if (status.syncHealth === 'degraded') {
      return `${timeSince}. Sync is retrying after ${status.consecutiveFailures} failure(s). Will recover automatically.`;
    }

    // Failing
    let tooltip = `${timeSince}. Sync has failed ${status.consecutiveFailures} times and is still retrying.`;
    if (status.lastError) {
      tooltip += ` Last error: ${status.lastError}`;
    }
    tooltip += ' Try "Sync Now" or check your Google Drive connection.';
    return tooltip;
  };

  const timeText = formatTimeSince(status.lastSuccessfulSync);
  const suffix = getStatusSuffix(status.syncHealth, status.consecutiveFailures);

  if (variant === 'compact') {
    return (
      <Tooltip title={getTooltipContent()} arrow>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor:
              status.syncHealth === 'healthy'
                ? 'divider'
                : getHealthColor(status.syncHealth),
            minWidth: 'fit-content',
            cursor: 'default',
          }}
        >
          {getHealthIcon(status.syncHealth)}
          <Typography
            variant="caption"
            sx={{
              color: getHealthColor(status.syncHealth),
              fontWeight: status.syncHealth !== 'healthy' ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {status.lastSuccessfulSync ? timeText : 'Never synced'}
            {suffix}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  // Full variant
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor:
          status.syncHealth === 'healthy'
            ? 'divider'
            : getHealthColor(status.syncHealth),
      }}
    >
      {getHealthIcon(status.syncHealth)}
      <Box>
        <Typography variant="caption" color="text.secondary">
          Sync Status
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: getHealthColor(status.syncHealth),
            fontWeight: status.syncHealth !== 'healthy' ? 600 : 400,
          }}
        >
          {timeText}
          {suffix}
        </Typography>
        {status.lastError && status.syncHealth === 'failing' && (
          <Typography
            variant="caption"
            color="error.main"
            sx={{ display: 'block', mt: 0.5 }}
          >
            Error: {status.lastError.substring(0, 50)}
            {status.lastError.length > 50 ? '...' : ''}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
