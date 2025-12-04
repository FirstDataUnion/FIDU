/**
 * Auto-Sync Countdown Indicator
 * Shows countdown to next auto-sync in the header
 */

import React, { useState, useEffect } from 'react';
import { Typography, Button } from '@mui/material';
import { Schedule as ScheduleIcon, Sync as SyncIcon } from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { unsyncedDataManager } from '../../services/storage/UnsyncedDataManager';

interface AutoSyncCountdownProps {
  variant?: 'compact' | 'full';
  onClick?: () => void;
  isSyncInProgress: boolean;
}

export const AutoSyncCountdown: React.FC<AutoSyncCountdownProps> = ({ variant = 'compact', onClick, isSyncInProgress }) => {
  const [countdown, setCountdown] = useState<number>(0);
  const [hasUnsyncedData, setHasUnsyncedData] = useState(false);

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
          } else {
            setCountdown(0);
          }
        }
      } catch (error) {
        console.error('Failed to get sync countdown:', error);
        setCountdown(0);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set initial state
    setHasUnsyncedData(unsyncedDataManager.hasUnsynced());

    // Subscribe to changes
    const unsubscribe = unsyncedDataManager.addListener((hasUnsynced: boolean) => {
      setHasUnsyncedData(hasUnsynced);
    });

    return unsubscribe;
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  return (
    <>
    <Button onClick={onClick} sx={{ textTransform: 'none', minWidth: '8rem', justifyContent: 'flex-start' }}>
      <SyncIcon sx={{ color: hasUnsyncedData ? 'warning.main' : 'text.secondary' }} />
      {countdown > 0 ? (
        <>
        <ScheduleIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '1rem', ml: '0.1rem'}}>
          {formatTime(countdown)}
        </Typography>
        </>
      ) : (hasUnsyncedData || isSyncInProgress) && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem', ml: '0.1rem'}}>
          {isSyncInProgress ? 'Syncing...' : 'Sync pending'}
        </Typography>
      )}
    </Button>
    </>
  );
};
