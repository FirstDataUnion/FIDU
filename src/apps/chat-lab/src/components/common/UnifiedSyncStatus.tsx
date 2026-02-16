/**
 * Unified Sync Status Widget
 * Displays Google Drive connection status, sync health, unsynced data indicators,
 * auto-sync countdown, and provides sync controls in a single clickable box with context menu
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  CloudDone as CloudDoneIcon,
  CloudSync as CloudSyncIcon,
  CloudOff as CloudOffIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { unsyncedDataManager } from '../../services/storage/UnsyncedDataManager';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
import { useAppDispatch } from '../../hooks/redux';
import {
  checkGoogleDriveAuthStatus,
  authenticateGoogleDrive,
} from '../../store/slices/unifiedStorageSlice';
import { setInsufficientPermissions } from '../../store/slices/googleDriveAuthSlice';
import { InsufficientPermissionsError } from '../../services/storage/drive/GoogleDriveService';
import type { SyncHealth } from '../../services/storage/sync/SmartAutoSyncService';
import { useNavigate } from 'react-router-dom';

interface SyncStatusData {
  // Sync Health
  syncHealth: SyncHealth;
  lastSuccessfulSync: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
  
  // Unsynced Data
  hasUnsyncedData: boolean;
  
  // Auto-sync Countdown
  countdownSeconds: number;
  autoSyncEnabled: boolean;
  
  // Google Drive Status
  isAuthenticated: boolean;
  user: { name?: string; email?: string } | null;
  driveError: string | null;
  driveLoading: boolean;
}

export const UnifiedSyncStatus: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const unifiedStorage = useUnifiedStorage();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [status, setStatus] = useState<SyncStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);

  const isCloudStorageMode = unifiedStorage.mode === 'cloud';

  // Update status from all sources
  const updateStatus = useCallback(async () => {
    if (!isCloudStorageMode) {
      setIsLoading(false);
      return;
    }

    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();

      // Get sync status
      let syncHealth: SyncHealth = 'healthy';
      let lastSuccessfulSync: Date | null = null;
      let consecutiveFailures = 0;
      let lastError: string | null = null;
      let hasUnsyncedData = false;
      let countdownSeconds = 0;
      let autoSyncEnabled = false;

      // Type guard: check if adapter has getSyncStatus method
      if ('getSyncStatus' in adapter && typeof (adapter as any).getSyncStatus === 'function') {
        const syncStatus = await (adapter as any).getSyncStatus();
        const smartStatus = syncStatus?.smartAutoSync;

        if (smartStatus) {
          syncHealth = smartStatus.syncHealth || 'healthy';
          lastSuccessfulSync = smartStatus.lastSuccessfulSync
            ? new Date(smartStatus.lastSuccessfulSync)
            : null;
          consecutiveFailures = smartStatus.consecutiveFailures || 0;
          lastError = smartStatus.lastError || null;
          hasUnsyncedData = smartStatus.hasUnsyncedData || false;
          countdownSeconds = smartStatus.countdownSeconds || 0;
          autoSyncEnabled = smartStatus.enabled || false;
        }
      }

      // Get unsynced data status
      const hasUnsynced = unsyncedDataManager.hasUnsynced();

      // Get Google Drive status
      const { isAuthenticated, user, error, isLoading: driveLoading } =
        unifiedStorage.googleDrive;

      setStatus({
        syncHealth,
        lastSuccessfulSync,
        consecutiveFailures,
        lastError,
        hasUnsyncedData: hasUnsynced || hasUnsyncedData,
        countdownSeconds,
        autoSyncEnabled,
        isAuthenticated: isAuthenticated || false,
        user: user || null,
        driveError: error || null,
        driveLoading: driveLoading || false,
      });
    } catch (error) {
      console.error('Failed to get unified sync status:', error);
      // Set error state so component can still render
      setStatus(prev => prev ? { ...prev, driveError: 'Failed to load sync status' } : null);
    } finally {
      setIsLoading(false);
    }
  }, [
    isCloudStorageMode,
    unifiedStorage.googleDrive.isAuthenticated,
    unifiedStorage.googleDrive.user,
    unifiedStorage.googleDrive.error,
    unifiedStorage.googleDrive.isLoading,
  ]);

  useEffect(() => {
    // Initial check
    dispatch(checkGoogleDriveAuthStatus());
    
    // Update immediately
    updateStatus();

    // Update every 10 seconds
    const interval = setInterval(updateStatus, 10000);
    
    // Subscribe to unsynced data changes
    const unsubscribe = unsyncedDataManager.addListener(() => {
      updateStatus();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [updateStatus, dispatch]);

  // Update countdown every second if we have unsynced data
  useEffect(() => {
    if (!status || !status.hasUnsyncedData || !status.autoSyncEnabled) {
      return;
    }

    const countdownInterval = setInterval(() => {
      setStatus(prev => {
        if (!prev || prev.countdownSeconds <= 0) {
          // Refresh full status when countdown reaches 0
          updateStatus();
          return prev;
        }
        return { ...prev, countdownSeconds: prev.countdownSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [status?.hasUnsyncedData, status?.autoSyncEnabled, updateStatus]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Handle connect button click
  const handleConnect = useCallback(async () => {
    setAnchorEl(null); // Close menu
    try {
      await dispatch(authenticateGoogleDrive()).unwrap();
    } catch (error) {
      console.error('Failed to initiate Google Drive connection:', error);
    }
  }, [dispatch]);

  // Handle navigate to Google Drive settings
  const handleGoToSettings = useCallback(() => {
    setAnchorEl(null); // Close menu
    navigate('/settings#sync-settings');
  }, [navigate]);

  // Handle manual sync
  const handleManualSync = useCallback(async () => {
    if (!status?.isAuthenticated) {
      return;
    }

    setAnchorEl(null); // Close menu when sync starts
    setIsSyncInProgress(true);
    try {
      console.log('Starting manual sync to Google Drive...');
      const storageService = getUnifiedStorageService();
      await storageService.sync();
      console.log('Manual sync completed successfully');
      // Refresh status after sync
      updateStatus();
    } catch (error) {
      console.error('Manual sync failed:', error);

      // Check if this is an insufficient permissions error
      if (error instanceof InsufficientPermissionsError) {
        console.warn('⚠️ Insufficient permissions detected during sync');
        dispatch(setInsufficientPermissions(true));
      }
    } finally {
      setIsSyncInProgress(false);
    }
  }, [status?.isAuthenticated, dispatch, updateStatus]);

  // Format time since last sync (memoized to avoid recreation)
  const formatTimeSince = useCallback((date: Date | null): string => {
    if (!date) return 'Never synced';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  // Format countdown time (memoized)
  const formatCountdown = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  }, []);

  // Get health color (memoized)
  const getHealthColor = useCallback((health: SyncHealth): string => {
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
  }, []);

  // Get health icon (memoized)
  const getHealthIcon = useCallback((health: SyncHealth) => {
    const color = getHealthColor(health);
    switch (health) {
      case 'healthy':
        return <CloudDoneIcon sx={{ fontSize: 16, color }} />;
      case 'degraded':
        return <CloudSyncIcon sx={{ fontSize: 16, color }} />;
      case 'failing':
        return <CloudOffIcon sx={{ fontSize: 16, color }} />;
      default:
        return <CloudDoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
  }, [getHealthColor]);

  // Get display text for the main box (memoized)
  const displayText = useMemo((): string => {
    // If syncing, show "Syncing..."
    if (isSyncInProgress) {
      return 'Syncing...';
    }
    
    // If not connected, show "Not Connected"
    if (!status?.isAuthenticated) {
      return 'Not Connected';
    }
    
    // If connected but no last sync time, show "Synced"
    if (!status.lastSuccessfulSync) {
      return 'Synced';
    }
    
    // If connected with last sync time, show "Last sync xxx hours ago"
    return `Last sync ${formatTimeSince(status.lastSuccessfulSync)}`;
  }, [isSyncInProgress, status?.isAuthenticated, status?.lastSuccessfulSync, formatTimeSince]);

  // Get border color based on status (memoized)
  const borderColor = useMemo((): string => {
    // If syncing, use primary color
    if (isSyncInProgress) return 'primary.main';
    // If not connected, use error color
    if (!status?.isAuthenticated) return 'error.main';
    if (status.hasUnsyncedData) return 'warning.main';
    if (status.syncHealth === 'failing') return 'error.main';
    if (status.syncHealth === 'degraded') return 'warning.main';
    return 'divider';
  }, [isSyncInProgress, status?.isAuthenticated, status?.hasUnsyncedData, status?.syncHealth]);

  // Get icon for the main box (memoized)
  const mainIcon = useMemo(() => {
    // If syncing, show syncing icon (same as "Sync Now" button)
    if (isSyncInProgress) {
      return (
        <SyncIcon
          sx={{
            fontSize: 16,
            color: 'primary.main',
            animation: 'spinCounterClockwise 2s linear infinite',
            '@keyframes spinCounterClockwise': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(-360deg)' },
            },
          }}
        />
      );
    }
    
    if (!status?.isAuthenticated) {
      return <CloudOffIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    }
    return getHealthIcon(status.syncHealth);
  }, [isSyncInProgress, status?.isAuthenticated, status?.syncHealth, getHealthIcon]);

  // Get text color for the main box (memoized)
  const textColor = useMemo((): string => {
    if (isSyncInProgress) return 'primary.main';
    if (!status?.isAuthenticated) return 'error.main';
    return getHealthColor(status?.syncHealth || 'healthy');
  }, [isSyncInProgress, status?.isAuthenticated, status?.syncHealth, getHealthColor]);

  const menuOpen = Boolean(anchorEl);

  // Don't render if not in cloud storage mode
  if (!isCloudStorageMode) {
    return null;
  }

  // Don't render if still loading
  if (isLoading || !status) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          minWidth: 'fit-content',
        }}
      >
        <CircularProgress size={14} />
      </Box>
    );
  }

  // After early returns, status is guaranteed to be non-null
  const safeStatus: SyncStatusData = status;

  return (
    <>
      <Tooltip
        title={
          !safeStatus.isAuthenticated
            ? 'Click to connect Google Drive'
            : 'Google Drive Sync Details'
        }
        arrow
      >
        <Box
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label={
            !safeStatus.isAuthenticated
              ? 'Connect Google Drive'
              : 'Google Drive sync status and details'
          }
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e as any);
            }
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: borderColor,
            minWidth: 'fit-content',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: !safeStatus.isAuthenticated
                ? 'error.dark'
                : getHealthColor(safeStatus.syncHealth),
              transform: 'translateY(-1px)',
              boxShadow: 1,
            },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          {mainIcon}
          <Typography
            variant="caption"
            sx={{
              color: textColor,
              fontWeight:
                isSyncInProgress ||
                !safeStatus.isAuthenticated ||
                safeStatus.syncHealth !== 'healthy'
                  ? 600
                  : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {displayText}
          </Typography>
          {safeStatus.isAuthenticated && safeStatus.hasUnsyncedData && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'warning.main',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
          )}
        </Box>
      </Tooltip>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        MenuListProps={{
          'aria-labelledby': 'sync-status-button',
        }}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxWidth: 400,
            mt: 1,
          },
        }}
      >
        {!safeStatus.isAuthenticated ? (
          /* Not Connected - Show only Connect button */
          [
            <MenuItem key="drive-status" disabled>
              <ListItemIcon>
                {safeStatus.driveLoading ? (
                  <CircularProgress size={16} />
                ) : (
                  <ErrorIcon color="error" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary="Google Drive"
                secondary={
                  safeStatus.driveLoading
                    ? 'Checking connection...'
                    : safeStatus.driveError || 'Not connected'
                }
              />
            </MenuItem>,
            <Divider key="divider-1" />,
            <MenuItem
              key="connect"
              onClick={handleConnect}
              disabled={safeStatus.driveLoading}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon>
                <CloudUploadIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Connect Now"
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: 600,
                      color: 'primary.main',
                    },
                  },
                }}
              />
            </MenuItem>,
          ]
        ) : (
          /* Connected - Show normal content */
          [
            /* Google Drive Connection Status */
            <MenuItem key="drive-status" disabled>
              <ListItemIcon>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Connected Account"
                secondary={
                  safeStatus.user
                    ? `${safeStatus.user.name || safeStatus.user.email}`
                    : 'Connected'
                }
              />
            </MenuItem>,

            <Divider key="divider-1" />,

            /* Sync Health Status */
            <MenuItem key="sync-status" disabled>
              <ListItemIcon>{getHealthIcon(safeStatus.syncHealth)}</ListItemIcon>
              <ListItemText
                primary="Sync Status"
                secondary={
                  safeStatus.lastSuccessfulSync
                    ? `Last sync: ${formatTimeSince(safeStatus.lastSuccessfulSync)}`
                    : 'Synced'
                }
              />
            </MenuItem>,

            safeStatus.consecutiveFailures > 0 && (
              <MenuItem key="failures" disabled>
                <ListItemIcon>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Failures"
                  secondary={`${safeStatus.consecutiveFailures} consecutive failure(s)`}
                />
              </MenuItem>
            ),

            safeStatus.lastError && (
              <MenuItem key="last-error" disabled>
                <ListItemIcon>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Last Error"
                  secondary={safeStatus.lastError.substring(0, 60)}
                  secondaryTypographyProps={{
                    sx: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              </MenuItem>
            ),

            <Divider key="divider-2" />,

            /* Sync Now Button */
            <MenuItem
              key="sync-now"
              onClick={handleManualSync}
              disabled={isSyncInProgress}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon>
                {isSyncInProgress ? (
                  <CircularProgress size={16} />
                ) : (
                  <SyncIcon color="primary" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={isSyncInProgress ? 'Syncing...' : 'Sync Now'}
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: 500,
                      color: 'primary.main',
                    },
                  },
                }}
              />
            </MenuItem>,

            <Divider key="divider-3" />,

            /* Unsynced Data Indicator */
            safeStatus.hasUnsyncedData && (
              <MenuItem key="unsynced-data" disabled>
                <ListItemIcon>
                  <WarningIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Unsaved Changes"
                  secondary="Local changes pending sync"
                />
              </MenuItem>
            ),

            /* Auto-sync Countdown */
            safeStatus.autoSyncEnabled && safeStatus.hasUnsyncedData && (
              <MenuItem key="auto-sync-countdown" disabled>
                <ListItemIcon>
                  <ScheduleIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Auto-sync"
                  secondary={
                    safeStatus.countdownSeconds > 0
                      ? `Next sync in ${formatCountdown(safeStatus.countdownSeconds)}`
                      : 'Sync pending...'
                  }
                />
              </MenuItem>
            ),

            !safeStatus.autoSyncEnabled && (
              <MenuItem key="auto-sync-disabled" disabled>
                <ListItemIcon>
                  <ScheduleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Auto-sync"
                  secondary="Disabled"
                />
              </MenuItem>
            ),

            /* Google Drive Settings Button */
            <MenuItem
              key="settings"
              onClick={handleGoToSettings}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon>
                <SettingsIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Google Drive Settings"
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: 500,
                      color: 'primary.main',
                    },
                  },
                }}
              />
            </MenuItem>,
          ].filter(Boolean)
        )}
      </Menu>
    </>
  );
};
