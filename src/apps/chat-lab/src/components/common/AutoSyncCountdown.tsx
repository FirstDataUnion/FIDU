/**
 * Auto-Sync Countdown Indicator
 * Shows countdown to next auto-sync in the header
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { Schedule } from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

interface AutoSyncCountdownProps {
  variant?: 'compact' | 'full';
}

export const AutoSyncCountdown: React.FC<AutoSyncCountdownProps> = ({ variant = 'compact' }) => {
  const [countdown, setCountdown] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  useEffect(() => {
    const updateCountdown = async () => {
      try {
        const storageService = getUnifiedStorageService();
        const adapter = storageService.getAdapter();
        
        if ('getSyncStatus' in adapter) {
          const status = await (adapter as any).getSyncStatus();
          const smartStatus = status.smartAutoSync;
          
          if (smartStatus && smartStatus.enabled && smartStatus.hasUnsyncedData) {
            setCountdown(smartStatus.countdownSeconds || 0);
            setIsEnabled(true);
          } else {
            setCountdown(0);
            setIsEnabled(false);
          }
        }
      } catch (error) {
        console.error('Failed to get sync countdown:', error);
        setCountdown(0);
        setIsEnabled(false);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show countdown if enabled and we have unsynced data
  if (!isEnabled) {
    return null;
  }

  // If countdown is 0 but we still have unsynced data, 
  // it means sync should happen soon or is stuck
  if (countdown <= 0) {
    return (
      <Tooltip title="Auto-sync should trigger soon..." arrow>
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
            borderColor: 'divider',
            minWidth: 'fit-content'
          }}
        >
          <Schedule sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography
            variant="caption"
            sx={{
              color: 'warning.main',
              fontWeight: 500
            }}
          >
            auto-sync pending...
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getColor = (seconds: number): string => {
    if (seconds <= 30) return 'warning.main';
    if (seconds <= 60) return 'info.main';
    return 'text.secondary';
  };

  if (variant === 'compact') {
    return (
      <Tooltip title={`Auto-sync in ${formatTime(countdown)}`} arrow>
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
            borderColor: 'divider',
            minWidth: 'fit-content'
          }}
        >
          <Schedule sx={{ fontSize: 14, color: getColor(countdown) }} />
          <Typography
            variant="caption"
            sx={{
              color: getColor(countdown),
              fontWeight: 500,
              fontFamily: 'monospace'
            }}
          >
            auto-sync in {formatTime(countdown)}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Schedule sx={{ fontSize: 16, color: getColor(countdown) }} />
      <Box>
        <Typography variant="caption" color="text.secondary">
          Next auto-sync:
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: getColor(countdown),
            fontWeight: 600,
            fontFamily: 'monospace'
          }}
        >
          {formatTime(countdown)}
        </Typography>
      </Box>
    </Box>
  );
};
