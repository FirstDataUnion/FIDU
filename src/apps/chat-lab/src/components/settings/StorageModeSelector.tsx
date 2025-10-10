import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Storage as LocalStorageIcon,
  Cloud as CloudIcon,
  FolderOpen as FileSystemIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import { useAppDispatch } from '../../hooks/redux';
import { 
  updateStorageMode, 
  markStorageConfigured, 
  resetStorageConfiguration,
  setShowAuthModal,
  updateFilesystemStatus
} from '../../store/slices/unifiedStorageSlice';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { FileSystemService } from '../../services/storage/filesystem/FileSystemService';
import { FileSystemDirectoryManager } from './FileSystemDirectoryManager';
import { StorageMigrationWizard } from './StorageMigrationWizard';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';

interface StorageModeInfo {
  id: 'local' | 'cloud' | 'filesystem';
  label: string;
  description: string;
  icon: React.ReactNode;
  supported: boolean;
  warning?: string;
}

export const StorageModeSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const unifiedStorage = useUnifiedStorage(); // Use the enhanced hook with environment restrictions
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);

  const fileSystemSupported = FileSystemService.isSupported();

  const storageModes: StorageModeInfo[] = [
    {
      id: 'local' as const,
      label: 'FIDU Vault',
      description: 'Store data in your local FIDU Vault instance running at http://127.0.0.1:4000/api/v1',
      icon: <LocalStorageIcon />,
      supported: unifiedStorage.isModeAvailable('local'),
      warning: unifiedStorage.isModeAvailable('local') ? undefined : 'Only available in desktop app mode'
    },
    {
      id: 'cloud' as const,
      label: 'Google Drive Sync',
      description: 'Store data in Google Drive with local caching for fast access. Syncs across devices and browsers.',
      icon: <CloudIcon />,
      supported: unifiedStorage.isModeAvailable('cloud'),
      warning: unifiedStorage.isModeAvailable('cloud') ? undefined : 'Only available in cloud hosted mode'
    },
    {
      id: 'filesystem' as const,
      label: 'Local File System',
      description: 'Store data in a local directory on your computer. Full control over your data location and backup.',
      icon: <FileSystemIcon />,
      supported: unifiedStorage.isModeAvailable('filesystem') && fileSystemSupported,
      warning: !unifiedStorage.isModeAvailable('filesystem') 
        ? 'Only available in cloud hosted mode'
        : !fileSystemSupported 
        ? 'Requires Chrome, Edge, or other Chromium-based browsers' 
        : undefined
    }
  ].filter(mode => unifiedStorage.isModeAvailable(mode.id)); // Filter out unavailable modes completely

  const handleModeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.value as 'local' | 'cloud' | 'filesystem';
    
    // If storage is not configured, handle initialization
    if (unifiedStorage.status !== 'configured') {
      if (newMode === 'cloud') {
        // For Google Drive, update storage mode first, then trigger the auth modal
        dispatch(updateStorageMode('cloud'));
        // Small delay to ensure the storage mode is updated before showing auth modal
        setTimeout(() => {
          dispatch(setShowAuthModal(true));
        }, 100);
      } else if (newMode === 'filesystem') {
        // For filesystem, update the mode and switch the storage service
        dispatch(updateStorageMode('filesystem'));
        
        // Switch the storage service to filesystem adapter
        try {
          const storageService = getUnifiedStorageService();
          await storageService.switchMode('filesystem');
        } catch (error) {
          console.error('Failed to switch storage service to filesystem mode:', error);
        }
        
        // The FileSystemDirectoryManager will be shown below and handle directory selection
      }
    } else {
      // If storage is configured and switching modes, show migration dialog
      if (unifiedStorage.mode !== newMode) {
        setPendingMode(newMode);
        setShowMigrationDialog(true);
      }
    }
  };

  const handleConfirmMigration = async () => {
    if (!pendingMode) return;

    setIsSwitching(true);
    setSwitchError(null);

    try {
      const storageService = getUnifiedStorageService();
      
      // Switch to the new storage mode
      await storageService.switchMode(pendingMode as 'local' | 'cloud' | 'filesystem');
      
      // Update the settings
      dispatch(updateStorageMode(pendingMode as 'local' | 'cloud' | 'filesystem'));
      
      // Handle specific mode requirements after switching
      if (pendingMode === 'cloud') {
        // For Google Drive mode, reset storage configuration since user needs to authenticate
        dispatch(resetStorageConfiguration());
        // Trigger OAuth process
        // Add a small delay to ensure state updates are processed
        setTimeout(() => {
          dispatch(setShowAuthModal(true));
        }, 100);
      } else if (pendingMode === 'filesystem') {
        // If switching to filesystem mode, check if directory access is needed
        const adapter = storageService.getAdapter();
        if ('requiresDirectoryAccessAfterMigration' in adapter && 
            typeof adapter.requiresDirectoryAccessAfterMigration === 'function' &&
            adapter.requiresDirectoryAccessAfterMigration()) {
          // Directory access is required after migration
          // The user will need to select a directory when they try to use the app
          console.log('Directory access required after migration to filesystem mode');
        }
        // Mark storage as configured since filesystem mode doesn't require OAuth
        dispatch(markStorageConfigured());
      } else {
        // For other modes (like local), mark as configured
        dispatch(markStorageConfigured());
      }
      
      setShowMigrationDialog(false);
      setPendingMode(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch storage mode';
      setSwitchError(errorMessage);
      console.error('Storage mode switch error:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCancelMigration = () => {
    setShowMigrationDialog(false);
    setPendingMode(null);
    setSwitchError(null);
  };

  const getModeDescription = (modeId: string) => {
    switch (modeId) {
      case 'local':
        return unifiedStorage.isCloudHostedMode 
          ? 'Data is stored in your local FIDU Vault instance for local development and testing.'
          : 'Data is stored in your local FIDU Vault instance running at http://127.0.0.1:4000/api/v1';
      case 'cloud':
        return 'Data is synced with Google Drive and accessible from multiple devices with local caching for performance.';
      case 'filesystem':
        return 'Data is stored in a local directory on your computer that you control.';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon />
          Data Storage Options
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {unifiedStorage.isCloudHostedMode 
            ? 'Choose how FIDU Chat Lab stores your data in cloud mode. Each option has different benefits and requirements.'
            : 'FIDU Chat Lab is running in local mode and connects to your local FIDU Vault instance.'
          }
        </Typography>

        {unifiedStorage.isCloudHostedMode ? (
          <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={unifiedStorage.status === 'configured' ? unifiedStorage.mode : ''}
            onChange={handleModeChange}
            aria-label="storage mode"
          >
            {storageModes.map((mode) => (
              <Box key={mode.id} sx={{ mb: 2 }}>
                <FormControlLabel
                  value={mode.id}
                  control={<Radio />}
                  disabled={!mode.supported || isSwitching}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      {mode.icon}
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body1" component="span">
                            {mode.label}
                          </Typography>
                          {mode.supported && unifiedStorage.status === 'configured' && (
                            <Chip 
                              label="Active" 
                              size="small" 
                              color="primary" 
                              variant={unifiedStorage.mode === mode.id ? 'filled' : 'outlined'}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {mode.description}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', width: '100%' }}
                />
                
                {mode.warning && (
                  <Alert severity="warning" sx={{ mt: 1, ml: 4 }}>
                    <Typography variant="body2">
                      {mode.warning}
                    </Typography>
                  </Alert>
                )}
                
                {mode.id === 'filesystem' && unifiedStorage.mode === 'filesystem' && (
                  <Box sx={{ ml: 4, mt: 2 }}>
                    <FileSystemDirectoryManager
                      onDirectoryChange={(isAccessible, directoryName) => {
                        // Update filesystem status in unified state
                        dispatch(updateFilesystemStatus({
                          isAccessible,
                          directoryName: directoryName || undefined,
                          permissionState: isAccessible ? 'granted' : 'denied'
                        }));
                        
                        // When directory is successfully selected, mark storage as configured
                        if (isAccessible) {
                          dispatch(markStorageConfigured());
                        }
                      }}
                      showTitle={false}
                      compact
                    />
                  </Box>
                )}
              </Box>
            ))}
          </RadioGroup>
        </FormControl>
        ) : (
          // Local mode - show single option without radio buttons
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
              {storageModes[0].icon}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" component="span">
                    {storageModes[0].label}
                  </Typography>
                  <Chip label="Active" size="small" color="primary" variant="filled" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {storageModes[0].description}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {switchError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSwitchError(null)}>
            {switchError}
          </Alert>
        )}

        {unifiedStorage.status === 'configured' && (
          <Alert severity="info" sx={{ mt: 3 }} icon={<InfoIcon />}>
            <Typography variant="body2">
              <strong>Current Mode:</strong> {getModeDescription(unifiedStorage.mode)}
            </Typography>
          </Alert>
        )}
      </CardContent>

      {/* Migration Confirmation Dialog */}
      <Dialog
        open={showMigrationDialog}
        onClose={handleCancelMigration}
        aria-labelledby="migration-dialog-title"
        aria-describedby="migration-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="migration-dialog-title">
          Switch Storage Mode
        </DialogTitle>
        
        <DialogContent>
          <DialogContentText id="migration-dialog-description" sx={{ mb: 2 }}>
            You are switching from <strong>{unifiedStorage.mode}</strong> to <strong>{pendingMode}</strong> storage mode.
          </DialogContentText>
          
          <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
            <Typography variant="body2">
              <strong>Important:</strong> This will change how your data is stored and accessed. 
              Your existing data will remain in the current storage location, but new data will be stored in the new location.
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            To migrate existing data between storage modes, you can:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <SyncIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Use the Migration Wizard"
                secondary="Guided step-by-step data migration with verification"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WarningIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Manual Migration"
                secondary="Switch modes and manually export/import data as needed"
              />
            </ListItem>
          </List>

          {switchError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {switchError}
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleCancelMigration} 
            disabled={isSwitching}
          >
            Cancel
          </Button>
          
          <Button 
            disabled
            variant="outlined"
            sx={{ opacity: 0.6 }}
          >
            <SyncIcon sx={{ mr: 1 }} />
            Use Migration Wizard
            <Chip 
              label="Coming Soon" 
              size="small" 
              color="default" 
              sx={{ ml: 1, fontSize: '0.7rem', height: '20px' }}
            />
          </Button>
          
          <Button 
            onClick={handleConfirmMigration}
            color="primary"
            variant="contained"
            disabled={isSwitching}
            autoFocus
          >
            {isSwitching ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Switching...
              </>
            ) : (
              'Switch Without Migration'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Storage Migration Wizard - Disabled for now */}
      <StorageMigrationWizard
        open={showMigrationWizard}
        onClose={() => setShowMigrationWizard(false)}
        fromMode={unifiedStorage.mode}
        toMode={pendingMode as 'local' | 'cloud' | 'filesystem'}
        onMigrationComplete={() => {
          setShowMigrationWizard(false);
          handleConfirmMigration();
        }}
      />
    </Card>
  );
};

export default StorageModeSelector;
