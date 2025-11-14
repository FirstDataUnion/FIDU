import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Collapse,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  AutoAwesome as AutoModeIcon,
  DeleteForever as DeleteForeverIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PrivacyTip as PrivacyTipIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { updateTheme, updateShareAnalytics } from '../store/slices/settingsSlice';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { SyncSettings, APIKeyManager } from '../components/settings';
import { getEnvironmentInfo } from '../utils/environment';

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  // Check environment mode - this determines deployment type
  const envInfo = getEnvironmentInfo();
  const isLocalDeployment = envInfo.storageMode === 'local';
  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<{
    success: boolean | null;
    message: string | null;
  }>({ success: null, message: null });
  const [showLearnMore, setShowLearnMore] = useState(false);

  const handleThemeChange = (event: SelectChangeEvent<string>) => {
    const newTheme = event.target.value as 'light' | 'dark' | 'auto';
    dispatch(updateTheme(newTheme));
  };

  const handleShareAnalyticsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateShareAnalytics(event.target.checked));
  };

  const handleClearCloudData = async () => {
    setIsClearing(true);
    setClearStatus({ success: null, message: null });
    
    try {
      const storageService = getUnifiedStorageService();
      await storageService.clearAllCloudDatabaseFiles();
      setClearStatus({
        success: true,
        message: 'All cloud database files have been successfully cleared.'
      });
      setShowClearDialog(false);
    } catch (error: any) {
      console.error('Failed to clear cloud database files:', error);
      setClearStatus({
        success: false,
        message: `Failed to clear cloud data: ${error.message || 'Unknown error'}`
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleConfirmClear = () => {
    setShowClearDialog(true);
    setClearStatus({ success: null, message: null });
  };

  const handleCancelClear = () => {
    setShowClearDialog(false);
    setClearStatus({ success: null, message: null });
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <LightModeIcon />;
      case 'dark':
        return <DarkModeIcon />;
      case 'auto':
        return <AutoModeIcon />;
      default:
        return <AutoModeIcon />;
    }
  };

  const getThemeDescription = (theme: string) => {
    switch (theme) {
      case 'light':
        return 'Always use light theme regardless of system preference';
      case 'dark':
        return 'Always use dark theme regardless of system preference';
      case 'auto':
        return 'Automatically switch between light and dark based on system preference';
      default:
        return 'Automatically switch between light and dark based on system preference';
    }
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        minHeight: '100vh',
        py: 3,
        px: 3,
        boxSizing: 'border-box'
      }}
    >
      <Box sx={{ maxWidth: 600, width: '100%', mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Customize your FIDU Chat Lab experience with these personal preferences.
        </Typography>

        {/* Theme Settings */}
        <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getThemeIcon(settings.theme)}
            Appearance
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose how FIDU Chat Lab looks. You can set a specific theme or let it automatically match your system preference.
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel id="theme-select-label">Theme</InputLabel>
            <Select
              labelId="theme-select-label"
              id="theme-select"
              value={settings.theme}
              label="Theme"
              onChange={handleThemeChange}
            >
              <MenuItem value="auto">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoModeIcon />
                  Auto (System)
            </Box>
              </MenuItem>
              <MenuItem value="light">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LightModeIcon />
                  Light
              </Box>
              </MenuItem>
              <MenuItem value="dark">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DarkModeIcon />
                  Dark
            </Box>
              </MenuItem>
            </Select>
          </FormControl>
          
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'action.hover', 
              borderRadius: 1,
              fontStyle: 'italic'
            }}
          >
            {getThemeDescription(settings.theme)}
          </Typography>
        </CardContent>
      </Card>

      {/* Learn More About Data Storage */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Button
            variant="text"
            startIcon={showLearnMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowLearnMore(!showLearnMore)}
            sx={{ textTransform: 'none' }}
          >
            Learn more about how your data is stored
          </Button>
          
          <Collapse in={showLearnMore}>
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                Google Drive:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                We store your conversations, contexts and custom system prompts and stored API keys in the AppData folder of your Google Drive. When you launch this app, it is fetched and stored temporarily in your browser for the app to use, and regularly synced back to your google drive. All the data is encrypted at rest, and your personal encryption key is stored separately with your user account on our servers, completely separate from the data itself.
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                We hold none of your data, we can only read from the FIDU AppData folder in your drive, and no one else can read the data without the encryption key.
              </Typography>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Sync Settings - Only show for cloud storage mode */}
      <SyncSettings />

      {/* Privacy Settings */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrivacyTipIcon />
            Privacy & Data Collection
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Control how your usage data is collected and shared.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.privacySettings.shareAnalytics}
                onChange={handleShareAnalyticsChange}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  Share Anonymous Usage Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Help us improve FIDU Chat Lab by sharing anonymous usage metrics, error reports, and performance data. 
                  No personal data, conversations, or sensitive information is ever collected.
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {settings.privacySettings.shareAnalytics ? (
              <>
                ✅ You are currently sharing anonymous metrics to help improve the application. Thank you!
              </>
            ) : (
              <>
                🔒 Metrics collection is disabled. No usage data is being collected or sent.
              </>
            )}
          </Typography>
        </CardContent>
      </Card>

      {/* API Key Management - Only show in cloud deployment */}
      {!isLocalDeployment && <APIKeyManager />}

      {/* Cloud Data Management - Hide in local deployment */}
      {!isLocalDeployment && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteForeverIcon />
              Cloud Data Management
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use this option to clear all database files from Google Drive. WARNING: This will delete all your conversations, contexts, custom system prompts and stored API keys from Google Drive.
            </Typography>
            
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={handleConfirmClear}
              disabled={isClearing}
              sx={{ mb: 2 }}
            >
              Clear Cloud Data
            </Button>
            
            {clearStatus.message && (
              <Alert 
                severity={clearStatus.success ? "success" : "error"}
                sx={{ mt: 2 }}
                onClose={() => setClearStatus({ success: null, message: null })}
              >
                {clearStatus.message}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clear Cloud Data Confirmation Dialog */}
      <Dialog
        open={showClearDialog}
        onClose={handleCancelClear}
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-description"
      >
        <DialogTitle id="clear-dialog-title">
          Clear All Cloud Database Files
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-dialog-description">
            Are you sure you want to delete all database files from Google Drive?
            This action cannot be undone and will remove:
            <br />
            • Conversation database files
            <br />
            • API keys database files  
            <br />
            • Metadata files
            <br /><br />
            This is useful for testing with a fresh slate but should be used with caution.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClear} disabled={isClearing}>
            Cancel
          </Button>
          <Button 
            onClick={handleClearCloudData} 
            color="warning" 
            autoFocus 
            disabled={isClearing}
            variant="contained"
          >
            {isClearing ? 'Clearing...' : 'Yes, Clear All Data'}
          </Button>
        </DialogActions>
      </Dialog>

      </Box>
    </Box>
  );
};

export default SettingsPage; 