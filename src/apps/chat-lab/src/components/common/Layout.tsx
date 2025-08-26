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
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { logout, setCurrentProfile, createProfile } from '../../store/slices/authSlice';
import { getPrimaryColor } from '../../utils/themeColors';
import type { Profile } from '../../types';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user, currentProfile, profiles } = useAppSelector((state) => state.auth);
  
  // Always keep sidebar open on desktop
  const sidebarOpen = !isMobile;
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateProfileDialog, setShowCreateProfileDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

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

  const handleLogout = () => {
    dispatch(logout());
    handleProfileMenuClose();
  };

  const handleProfileSwitch = (profile: Profile) => {
    console.log('Layout: Switching to profile:', profile);
    dispatch(setCurrentProfile(profile));
    handleProfileSwitcherClose();
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    
    const result = await dispatch(createProfile(newProfileName.trim()));
    
    if (createProfile.fulfilled.match(result)) {
      setShowCreateProfileDialog(false);
      setNewProfileName('');
      // Automatically switch to the newly created profile
      dispatch(setCurrentProfile(result.payload));
    }
  };

  const mainMenuItems = [
    { text: 'Prompt Lab', icon: <PromptLabIcon />, path: '/prompt-lab' },
    { text: 'Conversations', icon: <ChatIcon />, path: '/conversations' },
  ];

  const advancedMenuItems = [
    { text: 'Contexts', icon: <ContextIcon />, path: '/contexts' },
    { text: 'System Prompts', icon: <PersonaIcon />, path: '/system-prompts' },
    { text: 'Embellishments', icon: <AddIcon />, path: '/embellishments' },
  ];



  const systemMenuItems = [
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const handleDrawerToggle = () => {
    dispatch(toggleSidebar());
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      dispatch(toggleSidebar());
    }
  };

  const renderMenuSection = (title: string, items: any[]) => (
    <>
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
        {items.map((item) => (
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
                  fontWeight: location.pathname.startsWith(item.path) ? 600 : 400 
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </>
  );

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          FIDU Chat Lab
        </Typography>
      </Toolbar>
      <Divider />
      
      {renderMenuSection('', mainMenuItems)}
      
      <Divider sx={{ my: 1 }} />
      {renderMenuSection('Advanced', advancedMenuItems)}
      
      <Divider sx={{ my: 1 }} />
      {renderMenuSection('System', systemMenuItems)}
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
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            AI Conversation Memory Lab
          </Typography>
          
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
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout; 