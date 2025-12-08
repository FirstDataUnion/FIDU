/**
 * Hook to fetch and manage pending workspace invitations
 */

import { useState, useEffect, useCallback } from 'react';
import { identityServiceAPIClient } from '../services/api/apiClientIdentityService';

export interface WorkspaceInvitation {
  workspace_id: string;
  workspace_name: string;
  drive_folder_id: string;
  owner_email: string;
  owner_name: string;
  invited_at: string;
}

export interface UseWorkspaceInvitationsReturn {
  invitations: WorkspaceInvitation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const useWorkspaceInvitations = (): UseWorkspaceInvitationsReturn => {
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await identityServiceAPIClient.getPendingInvitations();
      
      // Debug: Log the raw API response to see what we're getting
      console.log('📬 [useWorkspaceInvitations] Raw API response:', response);
      console.log('📬 [useWorkspaceInvitations] Invitations:', response.invitations);
      
      // Validate and log each invitation
      if (response.invitations) {
        response.invitations.forEach((inv, index) => {
          console.log(`📬 [useWorkspaceInvitations] Invitation ${index}:`, {
            workspace_id: inv.workspace_id,
            workspace_name: inv.workspace_name,
            drive_folder_id: inv.drive_folder_id,
            hasDriveFolderId: !!inv.drive_folder_id,
            fullInvitation: inv,
          });
        });
      }
      
      setInvitations(response.invitations || []);
    } catch (err: any) {
      console.error('Failed to fetch invitations:', err);
      setError(err.message || 'Failed to fetch invitations');
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchInvitations();

    // Poll every 5 minutes
    const interval = setInterval(fetchInvitations, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [fetchInvitations]);

  return {
    invitations,
    isLoading,
    error,
    refresh: fetchInvitations,
  };
};

