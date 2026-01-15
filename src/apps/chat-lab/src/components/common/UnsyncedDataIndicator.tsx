/**
 * Simple Unsynced Data Indicator
 * Shows a small indicator when there are unsynced changes
 */

import { useState, useEffect } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { CloudSync } from '@mui/icons-material';
import { unsyncedDataManager } from '../../services/storage/UnsyncedDataManager';

interface UnsyncedDataIndicatorProps {
  variant?: 'compact' | 'full';
}

export default function UnsyncedDataIndicator({
  variant = 'compact',
}: UnsyncedDataIndicatorProps) {
  const [hasUnsyncedData, setHasUnsyncedData] = useState(false);

  useEffect(() => {
    // Set initial state
    setHasUnsyncedData(unsyncedDataManager.hasUnsynced());

    // Subscribe to changes
    const unsubscribe = unsyncedDataManager.addListener(
      (hasUnsynced: boolean) => {
        setHasUnsyncedData(hasUnsynced);
      }
    );

    return unsubscribe;
  }, []);

  // Hide if no unsynced data
  if (!hasUnsyncedData) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <Tooltip
        title="You have local data that has not been synced with your Google Drive. Click 'Sync' to save it before you leave the page"
        arrow
        placement="bottom"
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            backgroundColor: 'warning.main',
            color: 'warning.contrastText',
            borderRadius: 2,
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            animation: 'pulse 2s infinite',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'warning.dark',
              transform: 'scale(1.05)',
            },
            '@keyframes pulse': {
              '0%': {
                opacity: 1,
                boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)',
              },
              '70%': {
                opacity: 0.8,
                boxShadow: '0 0 0 6px rgba(255, 152, 0, 0)',
              },
              '100%': {
                opacity: 1,
                boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)',
              },
            },
          }}
        >
          unsynced data
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title="You have local data that has not been synced with your Google Drive. Click 'Sync' to save it before you leave the page"
      arrow
      placement="bottom"
    >
      <Chip
        icon={<CloudSync />}
        label="Unsaved changes"
        color="warning"
        variant="outlined"
        size="small"
        sx={{
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': {
              opacity: 1,
              boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)',
            },
            '70%': {
              opacity: 0.8,
              boxShadow: '0 0 0 6px rgba(255, 152, 0, 0)',
            },
            '100%': {
              opacity: 1,
              boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)',
            },
          },
        }}
      />
    </Tooltip>
  );
}
