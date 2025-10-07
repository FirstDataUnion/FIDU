/**
 * Sync Settings Component
 * Allows configuration of auto-sync delay for Google Drive storage
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert
} from '@mui/material';
import { Schedule } from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
import { updateSyncDelay } from '../../store/slices/settingsSlice';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

export const SyncSettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  const unifiedStorage = useUnifiedStorage();
  
  // Only show sync settings for Google Drive (cloud) mode
  const isCloudStorageMode = unifiedStorage.mode === 'cloud';

  const handleSyncDelayChange = (event: SelectChangeEvent<number>) => {
    const newDelay = event.target.value as number;
    console.log('🔍 [SyncSettings] Changing delay to:', newDelay);
    
    dispatch(updateSyncDelay(newDelay));
    
    // Update the smart auto-sync service with new delay
    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      console.log('🔍 [SyncSettings] Adapter:', adapter);
      
      if ('updateAutoSyncConfig' in adapter) {
        console.log('🔍 [SyncSettings] Calling updateAutoSyncConfig with:', { delayMinutes: newDelay });
        (adapter as any).updateAutoSyncConfig({ delayMinutes: newDelay });
      } else {
        console.warn('🔍 [SyncSettings] Adapter does not have updateAutoSyncConfig method');
      }
    } catch (error) {
      console.error('Failed to update auto-sync config:', error);
    }
  };

  const delayOptions = [
    { value: 1, label: '1 minute (immediate)' },
    { value: 2, label: '2 minutes' },
    { value: 5, label: '5 minutes (recommended)' },
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
  ];

  if (!isCloudStorageMode) {
    return null; // Only show for cloud storage mode
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Schedule sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h3">
            Auto-Sync Settings
          </Typography>
        </Box>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Auto-sync automatically uploads your data to Google Drive after changes are made. 
          The delay determines how long to wait before syncing to avoid interrupting your workflow.
        </Alert>

        <FormControl fullWidth>
          <InputLabel id="sync-delay-label">Auto-Sync Delay</InputLabel>
          <Select
            labelId="sync-delay-label"
            value={settings.syncSettings.autoSyncDelayMinutes}
            label="Auto-Sync Delay"
            onChange={handleSyncDelayChange}
          >
            {delayOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            How long to wait before automatically syncing changes to Google Drive
          </FormHelperText>
        </FormControl>

        <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Current setting:</strong> Auto-sync will trigger {settings.syncSettings.autoSyncDelayMinutes === 1 ? 'immediately' : `after ${settings.syncSettings.autoSyncDelayMinutes} minutes`} when data changes are detected.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
