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
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateStorageMode } from '../../store/slices/settingsSlice';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { FileSystemService } from '../../services/storage/filesystem/FileSystemService';
import { FileSystemDirectoryManager } from './FileSystemDirectoryManager';
import { StorageMigrationWizard } from './StorageMigrationWizard';
import { getEnvironmentInfo } from '../../utils/environment';

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
  const { settings } = useAppSelector((state) => state.settings);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);

  const envInfo = getEnvironmentInfo();
  const isCloudMode = envInfo.storageMode === 'cloud';
  const fileSystemSupported = FileSystemService.isSupported();

  const storageModes: StorageModeInfo[] = isCloudMode ? [
    {
      id: 'cloud',
      label: 'Google Drive Sync',
      description: 'Store data in Google Drive with local caching for fast access. Syncs across devices and browsers.',
      icon: <CloudIcon />,
      supported: true
    },
    {
      id: 'filesystem',
      label: 'Local File System',
      description: 'Store data in a local directory on your computer. Full control over your data location and backup.',
      icon: <FileSystemIcon />,
      supported: fileSystemSupported,
      warning: !fileSystemSupported ? 'Requires Chrome, Edge, or other Chromium-based browsers' : undefined
    }
  ] : [
    {
      id: 'local',
      label: 'FIDU Vault',
      description: 'Store data in your local FIDU Vault instance running at http://127.0.0.1:4000/api/v1',
      icon: <LocalStorageIcon />,
      supported: true
    }
  ];

  const handleModeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.value as 'local' | 'cloud' | 'filesystem';
    
    // If switching from one mode to another, show migration dialog
    if (settings.storageMode !== newMode) {
      setPendingMode(newMode);
      setShowMigrationDialog(true);
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
      
      // If switching to filesystem mode, check if directory access is needed
      if (pendingMode === 'filesystem') {
        const adapter = storageService.getAdapter();
        if ('requiresDirectoryAccessAfterMigration' in adapter && 
            typeof adapter.requiresDirectoryAccessAfterMigration === 'function' &&
            adapter.requiresDirectoryAccessAfterMigration()) {
          // Directory access is required after migration
          // The user will need to select a directory when they try to use the app
          console.log('Directory access required after migration to filesystem mode');
        }
      }
      
      // Update the settings
      dispatch(updateStorageMode(pendingMode));
      
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
        return isCloudMode 
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
          {isCloudMode 
            ? 'Choose how FIDU Chat Lab stores your data in cloud mode. Each option has different benefits and requirements.'
            : 'FIDU Chat Lab is running in local mode and connects to your local FIDU Vault instance.'
          }
        </Typography>

        {isCloudMode ? (
          <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={settings.storageMode}
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
                          {mode.supported && (
                            <Chip 
                              label="Active" 
                              size="small" 
                              color="primary" 
                              variant={settings.storageMode === mode.id ? 'filled' : 'outlined'}
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
                
                {mode.id === 'filesystem' && settings.storageMode === 'filesystem' && (
                  <Box sx={{ ml: 4, mt: 2 }}>
                    <FileSystemDirectoryManager
                      onDirectoryChange={(_isAccessible, _directoryName) => {
                        // Handle directory changes if needed
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

        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoIcon />}>
          <Typography variant="body2">
            <strong>Current Mode:</strong> {getModeDescription(settings.storageMode)}
          </Typography>
        </Alert>
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
            You are switching from <strong>{settings.storageMode}</strong> to <strong>{pendingMode}</strong> storage mode.
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
        fromMode={settings.storageMode}
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
