/**
 * Manage Members Dialog
 * Allows workspace owners to view and remove members from a workspace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { identityServiceAPIClient } from '../../services/api/apiClientIdentityService';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { ApiError } from '../../services/api/apiClients';

interface WorkspaceMember {
  id: string;
  workspace_id: string;
  fidu_email: string;
  google_email: string | null; // API spec says this should always be set, but keeping nullable for safety
  user_id: string | null;
  role: 'owner' | 'member';
  status: 'accepted' | 'pending';
  invited_at: string;
  accepted_at: string | null;
}

interface ManageMembersDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  workspaceId: string;
  workspaceName: string;
  driveFolderId: string;
}

export default function ManageMembersDialog({
  open,
  onClose,
  onSuccess,
  workspaceId,
  workspaceName,
  driveFolderId,
}: ManageMembersDialogProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await identityServiceAPIClient.getWorkspaceMembers(workspaceId);
      setMembers(response.members || []);
    } catch (err: any) {
      console.error('Failed to fetch members:', err);
      setError(err.message || 'Failed to fetch workspace members');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Fetch members when dialog opens
  useEffect(() => {
    if (open) {
      fetchMembers();
    } else {
      // Reset state when dialog closes
      setMembers([]);
      setError(null);
    }
  }, [open, workspaceId, fetchMembers]);

  const handleRemoveClick = (member: WorkspaceMember) => {
    if (member.role === 'owner') {
      setError('Cannot remove workspace owner');
      return;
    }
    setMemberToRemove(member);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;

    setIsRemoving(memberToRemove.id);
    setError(null);
    const member = memberToRemove;
    setMemberToRemove(null);

    try {
      // Step 1: Remove from ID service
      await identityServiceAPIClient.removeMember(workspaceId, member.fidu_email);

      // Step 2: Revoke Drive folder access (google_email should always be set per API spec)
      if (member.google_email && driveFolderId) {
        try {
          const authService = await getGoogleDriveAuthService();
          const accessToken = await authService.getAccessToken();

          // Get all permissions for the folder
          // Include supportsAllDrives=true to support shared folders and shared drives
          const permissionsResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${driveFolderId}/permissions?supportsAllDrives=true`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (permissionsResponse.ok) {
            const permissionsData = await permissionsResponse.json();
            const memberPermission = permissionsData.permissions?.find(
              (p: any) => p.emailAddress === member.google_email
            );

            if (memberPermission) {
              // Revoke the permission
              // Include supportsAllDrives=true to support shared folders and shared drives
              await fetch(
                `https://www.googleapis.com/drive/v3/files/${driveFolderId}/permissions/${memberPermission.id}?supportsAllDrives=true`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
            }
          }
        } catch (driveError) {
          console.warn('Failed to revoke Drive access (member removed from workspace anyway):', driveError);
          // Don't fail the whole operation if Drive revocation fails
        }
      }

      // Refresh members list
      await fetchMembers();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      
      if (err instanceof ApiError) {
        const errorMessage = err.data?.error || err.data?.details || err.message;
        setError(errorMessage);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to remove member. Please try again.');
      }
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Members - {workspaceName}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : members.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No members found.
          </Typography>
        ) : (
          <List>
            {members.map((member) => (
              <ListItem
                key={member.id}
                secondaryAction={
                  member.role !== 'owner' && (
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveClick(member)}
                      disabled={isRemoving === member.id}
                      color="error"
                      size="small"
                    >
                      {isRemoving === member.id ? (
                        <CircularProgress size={16} />
                      ) : (
                        <DeleteIcon />
                      )}
                    </IconButton>
                  )
                }
              >
                <PersonIcon sx={{ mr: 2, color: 'text.secondary' }} />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {member.fidu_email}
                      </Typography>
                      <Chip
                        label={member.role === 'owner' ? 'Owner' : 'Member'}
                        size="small"
                        color={member.role === 'owner' ? 'primary' : 'default'}
                      />
                      {member.status === 'pending' && (
                        <Chip
                          label="Pending"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    member.google_email && member.google_email !== member.fidu_email
                      ? `Google: ${member.google_email}`
                      : undefined
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{memberToRemove?.fidu_email}</strong> from this workspace?
            This will revoke their access to the workspace folder and they will no longer be able to access workspace data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberToRemove(null)} disabled={isRemoving !== null}>
            Cancel
          </Button>
          <Button
            onClick={handleRemoveConfirm}
            color="error"
            variant="contained"
            disabled={isRemoving !== null}
            startIcon={isRemoving ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isRemoving ? 'Removing...' : 'Remove Member'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

