/**
 * Add Members Dialog
 * Allows workspace owners to invite additional members to an existing workspace
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { identityServiceAPIClient } from '../../services/api/apiClientIdentityService';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { ApiError } from '../../services/api/apiClients';

interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  workspaceId: string;
  workspaceName: string;
  driveFolderId: string;
}

export default function AddMembersDialog({
  open,
  onClose,
  onSuccess,
  workspaceId,
  workspaceName,
  driveFolderId,
}: AddMembersDialogProps) {
  const [memberEmails, setMemberEmails] = useState<string[]>(['']);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailValidationErrors, setEmailValidationErrors] = useState<
    Map<number, string>
  >(new Map());

  // Debounce timer for email validation
  const emailValidationTimerRef = useRef<Map<number, NodeJS.Timeout>>(
    new Map()
  );
  const memberEmailsRef = useRef(memberEmails);

  // Keep ref in sync with state
  useEffect(() => {
    memberEmailsRef.current = memberEmails;
  }, [memberEmails]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMemberEmails(['']);
      setError(null);
      setEmailValidationErrors(new Map());
    }
  }, [open]);

  const handleAddMemberField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleRemoveMember = (index: number) => {
    if (memberEmails.length === 1) {
      // Keep at least one field
      setMemberEmails(['']);
    } else {
      const newEmails = memberEmails.filter((_, i) => i !== index);
      setMemberEmails(newEmails);

      // Clear validation error for removed field
      setEmailValidationErrors(prev => {
        const errors = new Map(prev);
        errors.delete(index);
        // Shift errors for fields after the removed one
        const shiftedErrors = new Map();
        errors.forEach((value, key) => {
          if (key < index) {
            shiftedErrors.set(key, value);
          } else if (key > index) {
            shiftedErrors.set(key - 1, value);
          }
        });
        return shiftedErrors;
      });
    }
  };

  const handleMemberEmailChange = (index: number, value: string) => {
    const newEmails = [...memberEmails];
    newEmails[index] = value;
    setMemberEmails(newEmails);

    // Clear existing timer for this field
    const existingTimer = emailValidationTimerRef.current.get(index);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce email validation (300ms delay)
    const timer = setTimeout(() => {
      validateEmailDebounced(index);
      emailValidationTimerRef.current.delete(index);
    }, 300);

    emailValidationTimerRef.current.set(index, timer);
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty is OK (will be filtered)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEmailDebounced = (index: number) => {
    // Use ref to get latest memberEmails state
    const allEmails = memberEmailsRef.current;
    const email = allEmails[index] || '';

    setEmailValidationErrors(prevErrors => {
      const errors = new Map(prevErrors);

      // Check for duplicate emails (case-insensitive)
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail) {
        const duplicates = allEmails
          .map((e, i) => ({ email: e.trim().toLowerCase(), index: i }))
          .filter(e => e.email === trimmedEmail && e.index !== index);

        if (duplicates.length > 0) {
          errors.set(index, 'This email is already added');
        } else if (!validateEmail(email)) {
          errors.set(index, 'Invalid email address');
        } else {
          errors.delete(index);
        }
      } else {
        errors.delete(index);
      }

      return errors;
    });
  };

  // Cleanup email validation timers on unmount
  useEffect(() => {
    const timerRef = emailValidationTimerRef.current;
    return () => {
      timerRef.forEach(timer => {
        clearTimeout(timer);
      });
      timerRef.clear();
    };
  }, []);

  const handleAddMembers = useCallback(async () => {
    // Filter out empty emails and trim
    const validEmails = memberEmails
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (validEmails.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    // Check for validation errors
    const hasErrors = Array.from(emailValidationErrors.values()).some(
      error => error !== undefined
    );
    if (hasErrors) {
      setError('Please fix email validation errors before adding members');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      // Step 1: Add members via ID service (validates and returns Google emails)
      const result = await identityServiceAPIClient.addMembers(
        workspaceId,
        validEmails
      );

      // Check if any members are missing Google emails
      // Match members back to original emails by index (API returns in same order)
      const membersWithoutGoogle = result.members
        .map((m, index) => ({ member: m, email: validEmails[index] }))
        .filter(({ member }) => !member.google_email);

      if (membersWithoutGoogle.length > 0) {
        const emails = membersWithoutGoogle
          .map(({ email }) => email)
          .join(', ');
        throw new Error(
          `The following members have not connected their Google Drive accounts: ${emails}. `
            + `Please ask them to connect their Google Drive account in Chat Lab before inviting them.`
        );
      }

      // Step 2: Share Drive folder with new members using their Google emails
      const newMemberGoogleEmails = result.members
        .filter(m => m.google_email)
        .map(m => m.google_email!);

      if (newMemberGoogleEmails.length > 0) {
        const authService = await getGoogleDriveAuthService();
        const accessToken = await authService.getAccessToken();

        // Share with each new member
        // Include supportsAllDrives=true to support shared folders and shared drives
        const shareResults = await Promise.allSettled(
          newMemberGoogleEmails.map(async email => {
            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${driveFolderId}/permissions?supportsAllDrives=true`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  role: 'writer',
                  type: 'user',
                  emailAddress: email,
                }),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `Failed to share folder with ${email}: ${response.status} ${response.statusText}. ${errorText}`
              );
            }
          })
        );

        // Check for failures
        const failures = shareResults.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          const failureMessages = failures
            .map(r =>
              r.status === 'rejected'
                ? r.reason?.message || String(r.reason)
                : ''
            )
            .filter(Boolean);
          console.warn(
            'Some members could not be shared with:',
            failureMessages
          );

          // If all shares failed, throw an error
          if (failures.length === newMemberGoogleEmails.length) {
            throw new Error(
              `Failed to share folder with any members: ${failureMessages.join('; ')}`
            );
          }
          // If some failed, show warning but continue
          setError(
            `Members added, but some folder shares failed: ${failureMessages.join('; ')}`
          );
        }
      }

      // Success - close dialog and refresh
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to add members:', err);

      if (err instanceof ApiError) {
        const errorMessage =
          err.data?.error || err.data?.details || err.message;
        setError(errorMessage);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to add members. Please try again.');
      }
    } finally {
      setIsAdding(false);
    }
  }, [
    memberEmails,
    emailValidationErrors,
    workspaceId,
    driveFolderId,
    onSuccess,
    onClose,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Members to {workspaceName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Invite team members to this workspace. They will receive an invitation
          and can accept it from their Workspaces page.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {memberEmails.map((email, index) => (
            <Box
              key={index}
              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
            >
              <TextField
                fullWidth
                label={`Member ${index + 1} Email`}
                placeholder="member@example.com"
                value={email}
                onChange={e => handleMemberEmailChange(index, e.target.value)}
                error={emailValidationErrors.has(index)}
                helperText={emailValidationErrors.get(index)}
                disabled={isAdding}
                type="email"
              />
              {memberEmails.length > 1 && (
                <IconButton
                  onClick={() => handleRemoveMember(index)}
                  disabled={isAdding}
                  color="error"
                  sx={{ mt: 1 }}
                >
                  <RemoveIcon />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>

        <Button
          startIcon={<AddIcon />}
          onClick={handleAddMemberField}
          disabled={isAdding}
          sx={{ mt: 2 }}
        >
          Add Another Member
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isAdding}>
          Cancel
        </Button>
        <Button
          onClick={handleAddMembers}
          variant="contained"
          disabled={isAdding}
          startIcon={isAdding ? <CircularProgress size={16} /> : undefined}
        >
          {isAdding ? 'Adding Members...' : 'Add Members'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
