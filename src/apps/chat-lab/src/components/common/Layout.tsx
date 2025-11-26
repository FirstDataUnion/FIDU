import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Settings as SettingsIcon,
  ViewKanban as ContextIcon,
  Science as PromptLabIcon,
  Psychology as PersonaIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Home as HomeIcon,
  Sync as SyncIcon,
  PrivacyTip as PrivacyIcon,
  NewReleases as WhatsNewIcon,
  SmartToy as SmartToyIcon,
  ImportExport as ImportExportIcon,
  Description as DocumentIcon,
  Help as HelpIcon,
  // CloudUpload as MigrationIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { logout, setCurrentProfile, createProfile } from '../../store/slices/authSlice';
import { getPrimaryColor } from '../../utils/themeColors';
import type { Profile } from '../../types';
import GoogleDriveStatus from '../auth/GoogleDriveStatus';
import UnsyncedDataIndicator from './UnsyncedDataIndicator';
import { AutoSyncCountdown } from './AutoSyncCountdown';
import { useCallback } from 'react';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { getEnvironmentInfo } from '../../utils/environment';
import { InsufficientPermissionsError } from '../../services/storage/drive/GoogleDriveService';
import { setInsufficientPermissions, revokeGoogleDriveAccess } from '../../store/slices/googleDriveAuthSlice';
import { authenticateGoogleDrive } from '../../store/slices/unifiedStorageSlice';
import InsufficientPermissionsModal from '../auth/InsufficientPermissionsModal';
import { getVersionDisplay } from '../../utils/version';
import AgentAlertsToaster from '../alerts/AgentAlertsToaster';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
  banner?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, banner }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user, currentProfile, profiles } = useAppSelector((state) => state.auth);
  const unifiedStorage = useUnifiedStorage();
  
  // Mobile sidebar state management
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Sidebar state: always open on desktop, controlled on mobile
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateProfileDialog, setShowCreateProfileDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  
  // Check if we're in cloud storage mode (Google Drive)
  const isCloudStorageMode = unifiedStorage.mode === 'cloud';
  
  // Check environment mode - this determines deployment type
  const envInfo = getEnvironmentInfo();
  const isCloudDeployment = envInfo.storageMode === 'cloud';


  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileSwitcherOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchorEl(event.currentTarget);
  };

  const handleProfileSwitcherClose = () => {
    setProfileMenuAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await dispatch(logout());
  };

  const handleManageAccount = () => {
    const identityServiceUrl = envInfo.identityServiceUrl;
    window.open(identityServiceUrl, '_blank');
    handleProfileMenuClose();
  };

  const handleProfileSwitch = (profile: Profile) => {

    dispatch(setCurrentProfile(profile));
    handleProfileSwitcherClose();
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    
    const result = await dispatch(createProfile(newProfileName.trim()));
    
    if (createProfile.fulfilled.match(result)) {
      setShowCreateProfileDialog(false);
      setNewProfileName('');
      // Switch to the newly created profile
      dispatch(setCurrentProfile(result.payload));
    }
  };

  const handleManualSync = useCallback(async () => {
    if (!currentProfile) {
      console.log('Cannot sync: no current profile');
      return;
    }

    setIsSyncInProgress(true);
    try {
      console.log('Starting manual sync to Google Drive...');
      const storageService = getUnifiedStorageService();
      await storageService.sync();
      console.log('Manual sync completed successfully');
    } catch (error) {
      console.error('Manual sync failed:', error);
      
      // Check if this is an insufficient permissions error
      if (error instanceof InsufficientPermissionsError) {
        console.warn('⚠️ Insufficient permissions detected during sync');
        dispatch(setInsufficientPermissions(true));
        setShowPermissionsModal(true);
      }
    } finally {
      setIsSyncInProgress(false);
    }
  }, [currentProfile, dispatch]);

  const handleReconnect = useCallback(async () => {
    try {
      console.log('🔄 Reconnecting with correct permissions...');
      
      // Close modal first
      setShowPermissionsModal(false);
      
      // Revoke current access to clear tokens
      await dispatch(revokeGoogleDriveAccess()).unwrap();
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Directly initiate OAuth flow with fresh permissions
      await dispatch(authenticateGoogleDrive()).unwrap();
      
      // The authenticateGoogleDrive will redirect to Google OAuth, so we won't reach here
    } catch (error) {
      console.error('❌ Failed to reconnect:', error);
      // If OAuth fails, navigate to settings as fallback
      navigate('/settings');
    }
  }, [dispatch, navigate]);

  const handleCancelPermissionsModal = useCallback(() => {
    setShowPermissionsModal(false);
  }, []);

  const mainMenuItems = [
    { text: 'Chat', icon: <PromptLabIcon />, path: '/prompt-lab' },
    { text: 'Conversations', icon: <ChatIcon />, path: '/conversations' },
  ];

  const advancedMenuItems = [
    { text: 'Contexts', icon: <ContextIcon />, path: '/contexts', flag: 'context' },
    { text: 'System Prompts', icon: <PersonaIcon />, path: '/system-prompts', flag: 'system_prompts' },
    { text: 'Background Agents', icon: <SmartToyIcon />, path: '/background-agents', flag: 'background_agents' },
    { text: 'Documents', icon: <DocumentIcon />, path: '/documents', flag: 'documents' },
  ];



  const systemMenuItems = [
    // NOTE: Data Migration temporarily disabled due to stability issues
    // The UI remains in place but is hidden from navigation for future re-implementation
    // ...(isLocalDeployment ? [] : [{ text: 'Data Migration', icon: <MigrationIcon />, path: '/data-migration' }]),
    { text: 'Import & Export', icon: <ImportExportIcon />, path: '/import-export' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];


  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    }
    dispatch(toggleSidebar());
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileSidebarOpen(false);
      dispatch(toggleSidebar());
    }
  };

  const renderMenuSection = (title: string, items: any[]) => (
    items.some(item => !item.flag || useFeatureFlag(item.flag)) && (
    <>
      <Divider sx={{ my: 1 }} />
      {title && (
        <Typography 
          variant="overline" 
          sx={{ 
            px: 2, 
            py: 1, 
            color: 'text.secondary',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: 1
          }}
        >
          {title}
        </Typography> 
      )}
      <List dense>
        {items.map((item) => ( (!item.flag || useFeatureFlag(item.flag)) && (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': {
                    color: 'inherit',
                  },
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontSize: '0.875rem',
                  fontWeight: location.pathname.startsWith(item.path) ? 600 : 400 
                }}
              />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
    </>
    )
  );

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            FIDU Chat Lab
          </Typography>
        </Toolbar>
        
        {renderMenuSection('', mainMenuItems)}
        {renderMenuSection('Advanced', advancedMenuItems)}
        {renderMenuSection('System', systemMenuItems)}
      </Box>
      
      {/* Footer with Policy Links */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button
          fullWidth
          size="small"
          startIcon={<HelpIcon fontSize="small" />}
          onClick={() => window.open('https://github.com/FirstDataUnion/FIDU/issues', '_blank', 'noopener')}
          sx={{
            textTransform: 'none',
            justifyContent: 'flex-start',
            color: 'inherit',
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          Get help/report a problem
        </Button>
        <Button
          fullWidth
          size="small"
          startIcon={<WhatsNewIcon fontSize="small" />}
          onClick={() => handleNavigation('/whats-new')}
          sx={{
            textTransform: 'none',
            justifyContent: 'flex-start',
            color: 'inherit',
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          What's New
        </Button>
        <Button
          fullWidth
          size="small"
          startIcon={<PrivacyIcon fontSize="small" />}
          onClick={() => handleNavigation('/privacy-policy')}
          sx={{
            textTransform: 'none',
            justifyContent: 'flex-start',
            color: 'inherit',
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          Privacy Policy
        </Button>
        <Button
          fullWidth
          size="small"
          startIcon={<PrivacyIcon fontSize="small" />}
          onClick={() => handleNavigation('/terms-of-use')}
          sx={{
            textTransform: 'none',
            justifyContent: 'flex-start',
            color: 'inherit',
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          Terms of Use
        </Button>
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            mt: 1, 
            textAlign: 'center',
            opacity: 0.5,
          }}
        >
          {getVersionDisplay()} • FIDU
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: getPrimaryColor(theme.palette.mode, 'light'),
          color: 'primary.contrastText'
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          {/* FIDU Vault Dashboard Button - only show in local deployment */}
          {!isCloudDeployment && (
            <Button
              color="inherit"
              startIcon={<HomeIcon />}
              onClick={() => window.open('http://127.0.0.1:4000', '_blank')}
              sx={{ 
                mr: 2,
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Go back to FIDU Vault Dashboard
            </Button>
          )}
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            
          </Typography>
          
                 {/* Google Drive Status - only show in cloud storage mode */}
                 {isCloudStorageMode && (
                   <Box sx={{ mr: 2 }}>
                     <GoogleDriveStatus variant="compact" />
                   </Box>
                 )}
                 
                 {/* Unsynced Data Indicator - only show in cloud storage mode */}
                 {isCloudStorageMode && (
                   <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                     <UnsyncedDataIndicator variant="compact" />
                   </Box>
                 )}
                 
                 {/* Auto-Sync Countdown - only show in cloud storage mode */}
                 {isCloudStorageMode && (
                   <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                     <AutoSyncCountdown variant="compact" />
                   </Box>
                 )}
                 
                 {/* Manual Sync Button - only show in cloud storage mode */}
                 {isCloudStorageMode && (
                   <Tooltip title={isSyncInProgress ? "Syncing..." : "Sync Now to Google Drive"} arrow>
                     <Button
                       color="inherit"
                       variant="outlined"
                       size="small"
                       startIcon={isSyncInProgress ? <SyncIcon /> : <SyncIcon />}
                       onClick={handleManualSync}
                       disabled={isSyncInProgress}
                       sx={{ 
                         mr: 2,
                         textTransform: 'none',
                         borderColor: 'rgba(255,255,255,0.3)',
                         '&:hover': {
                           backgroundColor: 'rgba(255, 255, 255, 0.1)',
                           borderColor: 'rgba(255,255,255,0.8)'
                         },
                         '&:disabled': {
                           opacity: 0.5
                         }
                       }}
                     >
                       {isSyncInProgress ? 'Syncing...' : 'Sync Now'}
                     </Button>
                   </Tooltip>
                 )}
          
          {/* Profile and Logout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentProfile && (
              <Chip
                label={currentProfile.name}
                size="small"
                color="secondary"
                variant="outlined"
                onClick={handleProfileSwitcherOpen}
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
              />
            )}
            <IconButton
              color="inherit"
              onClick={handleProfileMenuOpen}
              sx={{ ml: 1 }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.name?.[0] || user?.email?.[0] || <AccountIcon />}
              </Avatar>
            </IconButton>
            
            {/* Profile Switcher Menu */}
            <Menu
              anchorEl={profileMenuAnchorEl}
              open={Boolean(profileMenuAnchorEl)}
              onClose={handleProfileSwitcherClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  Switch Profile
                </Typography>
              </MenuItem>
              <Divider />
              {profiles.map((profile) => (
                <MenuItem 
                  key={profile.id} 
                  onClick={() => handleProfileSwitch(profile)}
                  selected={currentProfile?.id === profile.id}
                >
                  <ListItemIcon>
                    {currentProfile?.id === profile.id ? (
                      <CheckIcon fontSize="small" color="primary" />
                    ) : (
                      <AccountIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText 
                    primary={profile.name}
                    secondary={currentProfile?.id === profile.id ? 'Active' : undefined}
                  />
                </MenuItem>
              ))}
              <Divider />
              <MenuItem onClick={() => setShowCreateProfileDialog(true)}>
                <ListItemIcon>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                Create New Profile
              </MenuItem>
            </Menu>
            
            {/* User Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </MenuItem>
              <MenuItem onClick={handleManageAccount}>
                <ListItemIcon>
                  <AccountIcon fontSize="small" />
                </ListItemIcon>
                Manage Account
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Create Profile Dialog */}
      <Dialog open={showCreateProfileDialog} onClose={() => setShowCreateProfileDialog(false)}>
        <DialogTitle>Create New Profile</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Profile Name"
            fullWidth
            variant="outlined"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateProfile();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateProfileDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateProfile} 
            variant="contained"
            disabled={!newProfileName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, height: '100vh' }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={sidebarOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              height: '100vh',
              backgroundColor: getPrimaryColor(theme.palette.mode, 'light'),
              color: 'primary.contrastText'
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100vw - ${drawerWidth}px)` },
          maxWidth: { md: `calc(100vw - ${drawerWidth}px)` },
          overflow: 'hidden',
          height: '100vh',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />
        {/* Fixed banner outside scrollable area */}
        {banner && (
          <Box sx={{ flexShrink: 0 }}>
            {banner}
          </Box>
        )}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
        {children}
        {/* Background Agent Alerts */}
        <AgentAlertsToaster />
        </Box>
      </Box>
      
      {/* Insufficient Permissions Modal */}
      <InsufficientPermissionsModal
        open={showPermissionsModal}
        onReconnect={handleReconnect}
        onCancel={handleCancelPermissionsModal}
      />
    </Box>
  );
};

export default Layout; 