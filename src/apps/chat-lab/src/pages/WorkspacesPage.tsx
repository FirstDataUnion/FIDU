/**
 * Workspaces Page
 * Manage and switch between workspaces
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  LinearProgress,
  Badge,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Folder as FolderIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  Mail as MailIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { switchWorkspace } from '../store/slices/unifiedStorageSlice';
import { getWorkspaceRegistry } from '../services/workspace/WorkspaceRegistry';
import { identityServiceAPIClient } from '../services/api/apiClientIdentityService';
import CreateWorkspaceDialog from '../components/workspace/CreateWorkspaceDialog';
import AddMembersDialog from '../components/workspace/AddMembersDialog';
import ManageMembersDialog from '../components/workspace/ManageMembersDialog';
import { useWorkspaceInvitations } from '../hooks/useWorkspaceInvitations';
import { getWorkspaceInvitationService } from '../services/workspace/WorkspaceInvitationService';
import { getGoogleDriveAuthService } from '../services/auth/GoogleDriveAuth';
import { GoogleDriveService } from '../services/storage/drive/GoogleDriveService';
import type { WorkspaceMetadata } from '../types';
import type { AcceptInvitationProgress } from '../services/workspace/WorkspaceInvitationService';

const WorkspacesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const unifiedStorage = useAppSelector(state => state.unifiedStorage);
  const { user } = useAppSelector(state => state.auth);

  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{
    workspace: WorkspaceMetadata;
  } | null>(null);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState<{
    workspace: WorkspaceMetadata;
  } | null>(null);
  const [showManageMembersDialog, setShowManageMembersDialog] = useState<{
    workspace: WorkspaceMetadata;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDriveFolder, setDeleteDriveFolder] = useState(true);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [hasDriveFileScope, setHasDriveFileScope] = useState<boolean | null>(
    null
  );
  const [isCheckingScope, setIsCheckingScope] = useState(false);

  // Invitation state
  const {
    invitations,
    isLoading: invitationsLoading,
    refresh: refreshInvitations,
  } = useWorkspaceInvitations();
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<
    string | null
  >(null);
  const [acceptProgress, setAcceptProgress] =
    useState<AcceptInvitationProgress | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Check for drive.file scope when dialog opens
  const checkDriveFileScope = useCallback(async () => {
    setIsCheckingScope(true);
    try {
      const authService = await getGoogleDriveAuthService();
      const hasScope = await authService.hasDriveFileScope();
      setHasDriveFileScope(hasScope);
      console.log('🔍 Drive.file scope check result:', hasScope);
    } catch (error) {
      console.error('Failed to check drive.file scope:', error);
      setHasDriveFileScope(false);
    } finally {
      setIsCheckingScope(false);
    }
  }, []);

  useEffect(() => {
    checkDriveFileScope();
  }, [checkDriveFileScope]);

  const handleRequestDriveFileScope = async () => {
    try {
      const authService = await getGoogleDriveAuthService();
      await authService.requestAdditionalScopes([
        'https://www.googleapis.com/auth/drive.file',
      ]);
      // After re-authentication, check scope again
      await checkDriveFileScope();
    } catch (error) {
      console.error('Failed to request drive.file scope:', error);
      setError('Failed to request additional permissions. Please try again.');
    }
  };

  // Handle accepting invitation
  const handleAcceptInvitation = async (invitation: {
    workspace_id: string;
    workspace_name: string;
    drive_folder_id: string;
  }) => {
    if (acceptingInvitationId) return; // Prevent multiple simultaneous acceptances

    setAcceptingInvitationId(invitation.workspace_id);
    setError(null);
    setShowAcceptDialog(true);
    setAcceptProgress(null);

    try {
      // Get Google email from auth service
      const authService = await getGoogleDriveAuthService();
      const user = await authService.getUser();

      const invitationService = getWorkspaceInvitationService();
      invitationService.setProgressCallback(setAcceptProgress);

      // Validate invitation has required fields
      // Check for both snake_case and camelCase variants
      const driveFolderId =
        invitation.drive_folder_id || (invitation as any).driveFolderId;
      if (!driveFolderId) {
        console.error(
          '❌ [WorkspacesPage] Invitation missing folder ID:',
          invitation
        );
        throw new Error(
          'Invitation is missing folder ID. Please contact the workspace owner.'
        );
      }

      await invitationService.acceptInvitation({
        workspaceId: invitation.workspace_id,
        workspaceName: invitation.workspace_name,
        driveFolderId: driveFolderId,
        googleEmail: user.email,
      });

      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Close dialog and refresh
      setShowAcceptDialog(false);
      setAcceptProgress(null);
      refreshInvitations();
      loadWorkspaces(); // Reload workspaces to show new one
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setError(err.message || 'Failed to accept invitation');
      setAcceptProgress(null);
      setShowAcceptDialog(false);
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  // Handle declining invitation (placeholder for now)
  const handleDeclineInvitation = async (invitation: {
    workspace_id: string;
  }) => {
    // TODO: Implement decline API call when available
    console.log('Decline invitation:', invitation.workspace_id);
    setError('Decline functionality not yet implemented');
  };

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registry = getWorkspaceRegistry();

      // Sync workspaces from API first to ensure we have the latest data
      // This is critical for members who were added to workspaces in previous sessions
      try {
        await registry.syncFromAPI();
      } catch {
        // Continue with local registry if sync fails (e.g., offline, API error)
      }

      const allWorkspaces = registry.getWorkspaces();
      setWorkspaces(allWorkspaces);
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorkspace = () => {
    setShowCreateDialog(true);
  };

  const handleCreateSuccess = (_workspaceId: string) => {
    setShowCreateDialog(false);
    loadWorkspaces(); // Reload to show new workspace
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (isSwitching) return; // Prevent multiple switches

    setIsSwitching(workspaceId);
    setError(null);

    try {
      await dispatch(switchWorkspace(workspaceId)).unwrap();
      loadWorkspaces(); // Reload to update active status
    } catch (err: any) {
      console.error('Failed to switch workspace:', err);
      setError(err.message || 'Failed to switch workspace');
    } finally {
      setIsSwitching(null);
    }
  };

  const handleDeleteClick = (workspace: WorkspaceMetadata) => {
    if (workspace.type === 'personal') {
      setError('Personal workspaces cannot be deleted');
      return;
    }
    if (workspace.role !== 'owner') {
      setError('Only workspace owners can delete workspaces');
      return;
    }
    setShowDeleteDialog({ workspace });
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteDialog) return;

    const { workspace } = showDeleteDialog;
    setIsDeleting(true);
    setError(null);

    try {
      // Delete Google Drive folder if option is checked and folder exists
      if (deleteDriveFolder && workspace.driveFolderId) {
        try {
          console.log(
            '🗑️ Deleting Google Drive folder:',
            workspace.driveFolderId
          );
          const authService = await getGoogleDriveAuthService();
          const driveService = new GoogleDriveService(authService);
          await driveService.initialize();
          await driveService.deleteFile(workspace.driveFolderId);
          console.log('✅ Google Drive folder deleted successfully');
        } catch (driveErr: any) {
          // Log but don't fail the whole operation if Drive deletion fails
          console.warn(
            '⚠️ Failed to delete Google Drive folder (continuing with workspace deletion):',
            driveErr
          );
          // Only show error if it's not a 404 (folder already deleted)
          if (!driveErr.message?.includes('404')) {
            setError(
              `Note: Could not delete Google Drive folder: ${driveErr.message}. Workspace will still be deleted.`
            );
          }
        }
      }

      // Delete from ID service
      await identityServiceAPIClient.deleteWorkspace(workspace.id);

      // Remove from local registry
      const registry = getWorkspaceRegistry();
      registry.removeWorkspace(workspace.id);

      // If this was the active workspace, switch to personal (virtual)
      const activeWorkspace = registry.getActiveWorkspace();
      if (!activeWorkspace || activeWorkspace.id === workspace.id) {
        // Switch to personal workspace (virtual - pass null)
        await dispatch(switchWorkspace(null)).unwrap();
      }

      setShowDeleteDialog(null);
      setDeleteDriveFolder(true); // Reset for next time
      loadWorkspaces();
    } catch (err: any) {
      console.error('Failed to delete workspace:', err);
      setError(err.message || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(null);
    setDeleteDriveFolder(true); // Reset for next time
  };

  const handleAddMembersClick = (workspace: WorkspaceMetadata) => {
    if (workspace.type !== 'shared' || workspace.role !== 'owner') {
      setError('Only workspace owners can add members');
      return;
    }
    if (!workspace.driveFolderId) {
      setError('Workspace folder ID not found');
      return;
    }
    setShowAddMembersDialog({ workspace });
  };

  const handleAddMembersSuccess = () => {
    setShowAddMembersDialog(null);
    loadWorkspaces(); // Reload to refresh workspace data
  };

  const handleAddMembersCancel = () => {
    setShowAddMembersDialog(null);
  };

  const handleManageMembersClick = (workspace: WorkspaceMetadata) => {
    if (workspace.type !== 'shared' || workspace.role !== 'owner') {
      setError('Only workspace owners can manage members');
      return;
    }
    setShowManageMembersDialog({ workspace });
  };

  const handleManageMembersSuccess = () => {
    setShowManageMembersDialog(null);
    loadWorkspaces(); // Reload to refresh workspace data
  };

  const handleManageMembersCancel = () => {
    setShowManageMembersDialog(null);
  };

  const getActiveWorkspaceId = (): string | null => {
    const registry = getWorkspaceRegistry();
    return registry.getActiveWorkspaceId();
  };

  const activeWorkspaceId = getActiveWorkspaceId();
  const activeWorkspace = activeWorkspaceId
    ? workspaces.find(w => w.id === activeWorkspaceId)
    : null;
  const isInSharedWorkspace = activeWorkspace?.type === 'shared';

  // Personal workspace is virtual (always available, not stored)
  const personalWorkspaceName = user?.name || user?.email || 'My';

  // Handler to switch to personal workspace (virtual - no stored entry)
  const handleSwitchToPersonal = async () => {
    if (isSwitching) return; // Prevent multiple switches

    setIsSwitching('personal');
    setError(null);

    try {
      // Switch to personal workspace by passing null
      await dispatch(switchWorkspace(null)).unwrap();
      loadWorkspaces(); // Reload to update active status
    } catch (err: any) {
      console.error('Failed to switch to personal workspace:', err);
      setError(err.message || 'Failed to switch to personal workspace');
    } finally {
      setIsSwitching(null);
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1">
            Workspaces
          </Typography>
          {invitations.length > 0 && (
            <Badge badgeContent={invitations.length} color="error">
              <MailIcon color="action" />
            </Badge>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {isInSharedWorkspace && (
            <Button
              variant="outlined"
              startIcon={
                isSwitching === 'personal' ? (
                  <CircularProgress size={16} />
                ) : (
                  <HomeIcon />
                )
              }
              onClick={handleSwitchToPersonal}
              disabled={
                isSwitching !== null || unifiedStorage.isSwitchingWorkspace
              }
            >
              {isSwitching === 'personal'
                ? 'Switching...'
                : 'Back to Personal Workspace'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateWorkspace}
            disabled={
              unifiedStorage.mode !== 'cloud' || hasDriveFileScope === false
            }
          >
            Create Workspace
          </Button>
        </Box>
      </Box>

      {unifiedStorage.mode !== 'cloud' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Workspaces are only available in cloud storage mode. Please switch to
          cloud storage in Settings.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* drive.file scope check */}
      {isCheckingScope && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Checking permissions...</Typography>
          </Box>
        </Alert>
      )}
      {!isCheckingScope && hasDriveFileScope === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Additional permissions required:</strong> To create or join
            shared workspaces, the app needs access to create and manage files
            in your Google Drive (or those shared with you).
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={handleRequestDriveFileScope}
            sx={{ mt: 1 }}
          >
            Grant Access
          </Button>
        </Alert>
      )}

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <Card sx={{ mb: 3, border: 2, borderColor: 'warning.main' }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6">
                Pending Invitations ({invitations.length})
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  invitationsLoading ? (
                    <CircularProgress size={16} />
                  ) : (
                    <RefreshIcon />
                  )
                }
                onClick={() => refreshInvitations()}
                disabled={invitationsLoading}
              >
                {invitationsLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {invitations.map(invitation => (
                <Box
                  key={invitation.workspace_id}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {invitation.workspace_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invited by{' '}
                      {invitation.owner_name
                        || invitation.owner_email
                        || 'Unknown'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() => handleAcceptInvitation(invitation)}
                      disabled={
                        acceptingInvitationId !== null
                        || hasDriveFileScope === false
                      }
                      size="small"
                    >
                      {acceptingInvitationId === invitation.workspace_id
                        ? 'Accepting...'
                        : 'Accept'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleDeclineInvitation(invitation)}
                      disabled={acceptingInvitationId !== null}
                      size="small"
                    >
                      Decline
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Personal Workspace (Virtual - always available) */}
        <Card
          sx={{
            border: activeWorkspaceId === null ? 2 : 1,
            borderColor:
              activeWorkspaceId === null ? 'primary.main' : 'divider',
          }}
        >
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <Typography variant="h6" component="h2">
                    {personalWorkspaceName}'s Workspace
                  </Typography>
                  {activeWorkspaceId === null && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="Active"
                      color="primary"
                      size="small"
                    />
                  )}
                  <Chip label="Personal" size="small" color="default" />
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Your personal workspace. All your conversations, contexts, and
                  prompts are stored here.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {activeWorkspaceId !== null && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleSwitchToPersonal}
                      disabled={
                        isSwitching !== null
                        || unifiedStorage.isSwitchingWorkspace
                      }
                    >
                      {isSwitching === 'personal'
                        ? 'Switching...'
                        : 'Switch to Personal'}
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Shared Workspaces */}
        {workspaces.length === 0 ? (
          <Card>
            <CardContent>
              <Typography
                variant="body1"
                color="text.secondary"
                align="center"
                sx={{ py: 4 }}
              >
                No shared workspaces. Create a new workspace to collaborate with
                your team.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          workspaces.map(workspace => {
            const isActive = workspace.id === activeWorkspaceId;
            const isSwitchingThis = isSwitching === workspace.id;

            return (
              <Card
                key={workspace.id}
                sx={{
                  border: isActive ? 2 : 1,
                  borderColor: isActive ? 'primary.main' : 'divider',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography variant="h6" component="h2">
                          {workspace.name}
                        </Typography>
                        {isActive && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Active"
                            color="primary"
                            size="small"
                          />
                        )}
                        <Chip label="Shared" size="small" color="secondary" />
                        {workspace.role && (
                          <Chip
                            label={
                              workspace.role === 'owner' ? 'Owner' : 'Member'
                            }
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          gap: 2,
                          mt: 2,
                          flexWrap: 'wrap',
                        }}
                      >
                        {workspace.driveFolderId && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <FolderIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              Folder ID:{' '}
                              {workspace.driveFolderId.substring(0, 20)}...
                            </Typography>
                          </Box>
                        )}
                        {workspace.members && workspace.members.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <PeopleIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {workspace.members.length} member
                              {workspace.members.length !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Last accessed:{' '}
                          {new Date(
                            workspace.lastAccessed
                          ).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                    >
                      {!isActive && (
                        <Button
                          variant="outlined"
                          onClick={() => handleSwitchWorkspace(workspace.id)}
                          disabled={
                            isSwitching !== null
                            || unifiedStorage.isSwitchingWorkspace
                          }
                        >
                          {isSwitchingThis ? (
                            <CircularProgress size={16} />
                          ) : (
                            'Switch'
                          )}
                        </Button>
                      )}
                      {/* Only show management buttons for workspace owners - members should never see these */}
                      {workspace.type === 'shared'
                        && workspace.role === 'owner' && (
                          <>
                            <IconButton
                              color="primary"
                              onClick={() => handleAddMembersClick(workspace)}
                              size="small"
                              title="Add Members"
                            >
                              <PersonAddIcon />
                            </IconButton>
                            <IconButton
                              color="primary"
                              onClick={() =>
                                handleManageMembersClick(workspace)
                              }
                              size="small"
                              title="Manage Members"
                            >
                              <PeopleIcon />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteClick(workspace)}
                              disabled={isDeleting}
                              size="small"
                              title="Delete Workspace"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </>
                        )}
                      {/* Members should not see any management buttons */}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog !== null}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Workspace</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the workspace "
            {showDeleteDialog?.workspace.name}"? This action cannot be undone
            and will remove the workspace for all members.
          </DialogContentText>
          {showDeleteDialog?.workspace.driveFolderId && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteDriveFolder}
                  onChange={e => setDeleteDriveFolder(e.target.checked)}
                  disabled={isDeleting}
                />
              }
              label="Also delete Google Drive folder and files"
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={
              isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />
            }
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Accept Invitation Progress Dialog */}
      <Dialog
        open={showAcceptDialog}
        onClose={() => {}} // Don't allow closing during acceptance
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Accepting Invitation</DialogTitle>
        <DialogContent>
          {acceptProgress && (
            <>
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={acceptProgress.progress}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {acceptProgress.message}
                </Typography>
              </Box>
              {acceptProgress.step === 'granting-access' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You may be asked to select the shared folder in Google Drive
                  to grant the app access.
                  {acceptProgress.message.includes('select') && (
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, fontSize: '0.875rem' }}
                    >
                      If you don't see the folder, make sure you've accepted the
                      Google Drive share invitation first.
                    </Typography>
                  )}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (acceptProgress?.step === 'complete') {
                setShowAcceptDialog(false);
              }
            }}
            disabled={acceptProgress?.step !== 'complete'}
          >
            {acceptProgress?.step === 'complete' ? 'Close' : 'Processing...'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Members Dialog */}
      {showAddMembersDialog && (
        <AddMembersDialog
          open={showAddMembersDialog !== null}
          onClose={handleAddMembersCancel}
          onSuccess={handleAddMembersSuccess}
          workspaceId={showAddMembersDialog.workspace.id}
          workspaceName={showAddMembersDialog.workspace.name}
          driveFolderId={showAddMembersDialog.workspace.driveFolderId!}
        />
      )}

      {/* Manage Members Dialog */}
      {showManageMembersDialog && (
        <ManageMembersDialog
          open={showManageMembersDialog !== null}
          onClose={handleManageMembersCancel}
          onSuccess={handleManageMembersSuccess}
          workspaceId={showManageMembersDialog.workspace.id}
          workspaceName={showManageMembersDialog.workspace.name}
          driveFolderId={showManageMembersDialog.workspace.driveFolderId!}
        />
      )}
    </Box>
  );
};

export default WorkspacesPage;
