/**
 * WorkspaceSelector Component
 * Unified workspace selector widget for the top-right of the Layout
 * Replaces the profile selector and combines personal + shared workspaces
 */

import React, { useState, useCallback } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Badge,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  FolderSpecial as WorkspaceIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  Mail as MailIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  setCurrentWorkspace,
  setCurrentProfile,
  createProfile,
} from '../../store/slices/authSlice';
import { switchWorkspace } from '../../store/slices/unifiedStorageSlice';
import { getWorkspaceRegistry } from '../../services/workspace/WorkspaceRegistry';
import { useWorkspaceInvitations } from '../../hooks/useWorkspaceInvitations';
import type { UnifiedWorkspace, Profile } from '../../types';
import {
  profileToUnifiedWorkspace,
  workspaceMetadataToUnifiedWorkspace,
  isPersonalWorkspace,
} from '../../utils/workspaceHelpers';
import { refreshAllDataFromStorage } from '../../store/refreshAllData';
import CreateWorkspaceDialog from './CreateWorkspaceDialog';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const WorkspaceSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentWorkspace, personalWorkspaces } = useAppSelector(
    state => state.auth
  );
  const isSharedWorkspacesEnabled = useFeatureFlag('shared_workspaces');

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreatePersonalDialog, setShowCreatePersonalDialog] =
    useState(false);
  const [showCreateSharedDialog, setShowCreateSharedDialog] = useState(false);
  const [loadingWorkspaceId, setLoadingWorkspaceId] = useState<string | null>(
    null
  );

  // Load shared workspaces from registry (only if feature is enabled)
  const workspaceRegistry = getWorkspaceRegistry();
  const allWorkspaces = isSharedWorkspacesEnabled
    ? workspaceRegistry.getWorkspaces()
    : [];
  // Filter to only show valid shared workspaces
  // Real shared workspaces must have a driveFolderId (they're stored in a Drive folder)
  const sharedWorkspaces = isSharedWorkspacesEnabled
    ? allWorkspaces.filter(
        w => w.type === 'shared' && w.id && w.name && w.driveFolderId
      )
    : [];

  // Get invitations (only if feature is enabled)
  const { invitations } = useWorkspaceInvitations();
  const filteredInvitations = isSharedWorkspacesEnabled ? invitations : [];

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleWorkspaceSwitch = useCallback(
    async (workspace: UnifiedWorkspace) => {
      if (workspace.id === currentWorkspace?.id) {
        handleClose();
        return; // Already selected
      }

      // Set loading state and keep menu open
      setLoadingWorkspaceId(workspace.id);

      try {
        if (isPersonalWorkspace(workspace)) {
          // Personal workspace: use profile switching
          const profile = personalWorkspaces.find(
            p => p.id === workspace.profileId
          );
          if (profile) {
            // Check if we're switching from shared to personal, or personal to personal
            const isCurrentlyPersonal = currentWorkspace?.type === 'personal';

            if (isCurrentlyPersonal) {
              // Switching between personal workspaces: just update profile, no storage switch needed
              // Personal workspaces share the same storage (AppData), isolated by profile_id
              dispatch(setCurrentProfile(profile));
              // Wait a bit for the profile switch to complete
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              // Switching from shared to personal: update profile FIRST
              // Then switch storage so refreshAllDataFromStorage (called during sync) uses the correct profile
              dispatch(setCurrentProfile(profile));
              await dispatch(switchWorkspace(null)).unwrap();
              // Explicitly refresh all data after workspace switch completes
              // This ensures data is loaded even if the sync's refreshAllDataFromStorage didn't work correctly
              await refreshAllDataFromStorage();
            }
          }
        } else {
          // Shared workspace: use workspace switching
          dispatch(setCurrentWorkspace(workspace));
          await dispatch(switchWorkspace(workspace.id)).unwrap();
          // Wait for data to load
          await refreshAllDataFromStorage();
        }
      } catch (error) {
        console.error('Failed to switch workspace:', error);
      } finally {
        // Clear loading state and close menu
        setLoadingWorkspaceId(null);
        handleClose();
      }
    },
    [dispatch, currentWorkspace, personalWorkspaces]
  );

  const handleCreatePersonalWorkspace = () => {
    handleClose();
    setShowCreatePersonalDialog(true);
  };

  const handleCreateSharedWorkspace = () => {
    handleClose();
    setShowCreateSharedDialog(true);
  };

  const handleOpenSettings = () => {
    handleClose();
    navigate('/workspaces');
  };

  const handleCreatePersonalComplete = useCallback(
    async (profile: Profile) => {
      setShowCreatePersonalDialog(false);
      // Switch to the newly created workspace
      const workspace = profileToUnifiedWorkspace(profile);
      await handleWorkspaceSwitch(workspace);
    },
    [handleWorkspaceSwitch]
  );

  const open = Boolean(anchorEl);
  const hasInvitations = filteredInvitations.length > 0;

  if (!currentWorkspace) {
    return null; // Should not happen, but safety check
  }

  return (
    <>
      <Badge
        badgeContent={hasInvitations ? invitations.length : 0}
        color="error"
        overlap="circular"
      >
        <Chip
          label={currentWorkspace.name}
          size="small"
          color="secondary"
          variant="outlined"
          onClick={handleOpen}
          icon={
            isPersonalWorkspace(currentWorkspace) ? (
              <AccountIcon />
            ) : (
              <WorkspaceIcon />
            )
          }
          sx={{
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'action.hover' },
          }}
        />
      </Badge>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={loadingWorkspaceId ? undefined : handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            maxHeight: 500,
            width: 300,
          },
        }}
      >
        {/* Personal Workspaces Section */}
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            Personal Workspaces
          </Typography>
        </MenuItem>
        <Divider />
        {personalWorkspaces.map(profile => {
          const workspace = profileToUnifiedWorkspace(profile);
          const isActive = currentWorkspace?.id === workspace.id;
          const isLoading = loadingWorkspaceId === workspace.id;
          return (
            <MenuItem
              key={workspace.id}
              onClick={() => handleWorkspaceSwitch(workspace)}
              selected={isActive}
              disabled={isLoading}
            >
              <ListItemIcon>
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : isActive ? (
                  <CheckIcon fontSize="small" color="primary" />
                ) : (
                  <AccountIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={workspace.name}
                secondary={
                  isLoading ? 'Loading...' : isActive ? 'Active' : undefined
                }
              />
            </MenuItem>
          );
        })}
        <MenuItem onClick={handleCreatePersonalWorkspace}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Create Personal Workspace" />
        </MenuItem>

        {/* Shared Workspaces Section - only show if feature is enabled */}
        {isSharedWorkspacesEnabled && [
          <Divider key="shared-divider-1" sx={{ my: 1 }} />,
          <MenuItem key="shared-header" disabled>
            <Typography variant="body2" color="text.secondary">
              Shared Workspaces
            </Typography>
          </MenuItem>,
          <Divider key="shared-divider-2" />,
          ...(sharedWorkspaces.length === 0
            ? [
                <MenuItem key="shared-empty" disabled>
                  <ListItemText
                    primary="No shared workspaces"
                    secondary="Create one to get started"
                  />
                </MenuItem>,
              ]
            : sharedWorkspaces.map(metadata => {
                const workspace = workspaceMetadataToUnifiedWorkspace(metadata);
                const isActive = currentWorkspace?.id === workspace.id;
                const isLoading = loadingWorkspaceId === workspace.id;
                return (
                  <MenuItem
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    selected={isActive}
                    disabled={isLoading}
                  >
                    <ListItemIcon>
                      {isLoading ? (
                        <CircularProgress size={20} />
                      ) : isActive ? (
                        <CheckIcon fontSize="small" color="primary" />
                      ) : (
                        <WorkspaceIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={workspace.name}
                      secondary={
                        isLoading
                          ? 'Loading...'
                          : isActive
                            ? 'Active'
                            : workspace.role
                              ? `${workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}`
                              : undefined
                      }
                    />
                  </MenuItem>
                );
              })),
          <MenuItem key="shared-create" onClick={handleCreateSharedWorkspace}>
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Create Shared Workspace" />
          </MenuItem>,
        ]}

        {/* Pending Invitations - only show if feature is enabled */}
        {isSharedWorkspacesEnabled
          && hasInvitations && [
            <Divider key="invitations-divider-1" sx={{ my: 1 }} />,
            <MenuItem key="invitations-header" disabled>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MailIcon fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Pending Invitations ({filteredInvitations.length})
                </Typography>
              </Box>
            </MenuItem>,
            <Divider key="invitations-divider-2" />,
            ...filteredInvitations.map(invitation => (
              <MenuItem
                key={invitation.workspace_id}
                onClick={() => {
                  handleClose();
                  navigate('/workspaces');
                }}
              >
                <ListItemIcon>
                  <MailIcon fontSize="small" color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={invitation.workspace_name}
                  secondary={`Invited by ${invitation.owner_name || invitation.owner_email || 'Unknown'}`}
                />
              </MenuItem>
            )),
          ]}

        {/* Settings */}
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleOpenSettings}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Workspace Settings" />
        </MenuItem>
      </Menu>

      {/* Create Personal Workspace Dialog */}
      {showCreatePersonalDialog && (
        <CreatePersonalWorkspaceDialog
          open={showCreatePersonalDialog}
          onClose={() => setShowCreatePersonalDialog(false)}
          onSuccess={handleCreatePersonalComplete}
        />
      )}

      {/* Create Shared Workspace Dialog - only show if feature is enabled */}
      {isSharedWorkspacesEnabled && showCreateSharedDialog && (
        <CreateWorkspaceDialog
          open={showCreateSharedDialog}
          onClose={() => setShowCreateSharedDialog(false)}
          onSuccess={() => {
            setShowCreateSharedDialog(false);
            // Refresh workspaces - the registry will be updated
            const updatedWorkspaces = workspaceRegistry.getWorkspaces();
            if (updatedWorkspaces.length > 0) {
              const latest = updatedWorkspaces[updatedWorkspaces.length - 1];
              const workspace = workspaceMetadataToUnifiedWorkspace(latest);
              handleWorkspaceSwitch(workspace);
            }
          }}
        />
      )}
    </>
  );
};

// Simple dialog for creating personal workspace (profile)
interface CreatePersonalWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (profile: Profile) => void;
}

const CreatePersonalWorkspaceDialog: React.FC<
  CreatePersonalWorkspaceDialogProps
> = ({ open, onClose, onSuccess }) => {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { error } = useAppSelector(state => state.auth);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const result = await dispatch(createProfile(name.trim()));
      if (createProfile.fulfilled.match(result)) {
        onSuccess(result.payload);
        setName('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Create Personal Workspace</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Workspace Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyPress={e => {
            if (e.key === 'Enter') {
              handleCreate();
            }
          }}
          inputProps={{
            maxLength: 100,
          }}
          helperText={`${name.length}/100 characters`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!name.trim() || isLoading}
        >
          {isLoading ? <CircularProgress size={20} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkspaceSelector;
