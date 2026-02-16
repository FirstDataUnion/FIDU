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
  Avatar,
  Menu,
  MenuItem,
  Button,
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
  SmartToy as SmartToyIcon,
  Description as DocumentIcon,
  Help as HelpIcon,
  Home as HomeIcon,
  // CloudUpload as MigrationIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { getPrimaryColor } from '../../utils/themeColors';
import { UnifiedSyncStatus } from './UnifiedSyncStatus';
import { useCallback } from 'react';
import { getEnvironmentInfo } from '../../utils/environment';
import { revokeGoogleDriveAccess } from '../../store/slices/googleDriveAuthSlice';
import { authenticateGoogleDrive } from '../../store/slices/unifiedStorageSlice';
import InsufficientPermissionsModal from '../auth/InsufficientPermissionsModal';
import { getVersionDisplay } from '../../utils/version';
import AgentAlertsToaster from '../alerts/AgentAlertsToaster';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import WorkspaceSelector from '../workspace/WorkspaceSelector';

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
  const { user, currentWorkspace } = useAppSelector(state => state.auth);
  const unifiedStorage = useUnifiedStorage();

  // Mobile sidebar state management
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sidebar state: always open on desktop, controlled on mobile
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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

  const handleLogout = async () => {
    handleProfileMenuClose();
    await dispatch(logout());
  };

  const handleManageAccount = () => {
    const identityServiceUrl = envInfo.identityServiceUrl;
    window.open(identityServiceUrl, '_blank');
    handleProfileMenuClose();
  };

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
    {
      text: 'Chat',
      icon: <PromptLabIcon />,
      path: '/prompt-lab',
      enabled: true,
    },
    {
      text: 'Conversations',
      icon: <ChatIcon />,
      path: '/conversations',
      enabled: true,
    },
  ];

  const advancedMenuItems = [
    {
      text: 'Contexts',
      icon: <ContextIcon />,
      path: '/contexts',
      enabled: useFeatureFlag('context'),
    },
    {
      text: 'System Prompts',
      icon: <PersonaIcon />,
      path: '/system-prompts',
      enabled: useFeatureFlag('system_prompts'),
    },
    {
      text: 'Background Agents',
      icon: <SmartToyIcon />,
      path: '/background-agents',
      enabled: useFeatureFlag('background_agents'),
    },
    {
      text: 'Documents',
      icon: <DocumentIcon />,
      path: '/documents',
      enabled: useFeatureFlag('documents'),
    },
  ];

  const systemMenuItems = [
    // NOTE: Data Migration temporarily disabled due to stability issues
    // The UI remains in place but is hidden from navigation for future re-implementation
    // ...(isLocalDeployment ? [] : [{ text: 'Data Migration', icon: <MigrationIcon />, path: '/data-migration' }]),
    {
      text: 'Settings',
      icon: <SettingsIcon />,
      path: '/settings',
      enabled: true,
    },
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

  const renderMenuItems = (items: any[]) => {
    return items.map(
      item =>
        item.enabled && (
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
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: location.pathname.startsWith(item.path)
                    ? 600
                    : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        )
    );
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontWeight: 600 }}
          >
            FIDU Chat Lab
          </Typography>
        </Toolbar>

        <List dense>
          {renderMenuItems(mainMenuItems)}
          {renderMenuItems(advancedMenuItems)}
          {renderMenuItems(systemMenuItems)}
        </List>
      </Box>

      {/* Footer with Policy Links */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button
          fullWidth
          size="small"
          startIcon={<HelpIcon fontSize="small" />}
          onClick={() =>
            window.open(
              'https://github.com/FirstDataUnion/FIDU/issues',
              '_blank',
              'noopener'
            )
          }
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
          Get help/report a bug
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            mt: 0.5,
          }}
        >
          <Typography
            component="button"
            variant="caption"
            onClick={() => handleNavigation('/privacy-policy')}
            sx={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.5,
              textDecoration: 'none',
              '&:hover': {
                opacity: 0.8,
                textDecoration: 'underline',
              },
            }}
          >
            Privacy Policy
          </Typography>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.5,
            }}
          >
            •
          </Typography>
          <Typography
            component="button"
            variant="caption"
            onClick={() => handleNavigation('/terms-of-use')}
            sx={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.5,
              textDecoration: 'none',
              '&:hover': {
                opacity: 0.8,
                textDecoration: 'underline',
              },
            }}
          >
            Terms of Use
          </Typography>
        </Box>
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
          color: 'primary.contrastText',
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
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Go back to FIDU Vault Dashboard
            </Button>
          )}

          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1 }}
          ></Typography>

          {/* Unified Sync Status - combines all sync-related indicators */}
          {isCloudStorageMode && (
            <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
              <UnifiedSyncStatus />
            </Box>
          )}

          {/* Workspace Selector and User Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentWorkspace && <WorkspaceSelector />}
            <IconButton
              color="inherit"
              onClick={handleProfileMenuOpen}
              sx={{ ml: 1 }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.name?.[0] || user?.email?.[0] || <AccountIcon />}
              </Avatar>
            </IconButton>

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

      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          height: '100vh',
        }}
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
              color: 'primary.contrastText',
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
          flexDirection: 'column',
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />
        {/* Fixed banner outside scrollable area */}
        {banner && <Box sx={{ flexShrink: 0 }}>{banner}</Box>}
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
