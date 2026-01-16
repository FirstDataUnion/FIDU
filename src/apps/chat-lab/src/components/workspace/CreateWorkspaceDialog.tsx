/**
 * Create Workspace Dialog
 * Dialog for creating new shared workspaces
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  LinearProgress,
  IconButton,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  getWorkspaceCreationService,
  type CreateWorkspaceOptions,
  type WorkspaceCreationProgress,
} from '../../services/workspace/WorkspaceCreationService';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (workspaceId: string) => void;
}

export default function CreateWorkspaceDialog({
  open,
  onClose,
  onSuccess,
}: CreateWorkspaceDialogProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [memberEmails, setMemberEmails] = useState<string[]>(['']);
  const [folderName, setFolderName] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkspaceCreationProgress | null>(
    null
  );
  const [emailValidationErrors, setEmailValidationErrors] = useState<
    Map<number, string>
  >(new Map());

  // Debounce timer for email validation
  const emailValidationTimerRef = useRef<Map<number, NodeJS.Timeout>>(
    new Map()
  );
  const creationServiceRef = useRef<ReturnType<
    typeof getWorkspaceCreationService
  > | null>(null);
  const memberEmailsRef = useRef(memberEmails);

  // Keep ref in sync with state
  useEffect(() => {
    memberEmailsRef.current = memberEmails;
  }, [memberEmails]);

  const handleAddMember = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleRemoveMember = (index: number) => {
    const newEmails = memberEmails.filter((_, i) => i !== index);
    setMemberEmails(newEmails);

    // Clear validation error for removed member
    setEmailValidationErrors(prevErrors => {
      const errors = new Map(prevErrors);
      errors.delete(index);

      // Re-index errors for members after the removed one
      const reindexedErrors = new Map<number, string>();
      errors.forEach((value, key) => {
        if (key > index) {
          reindexedErrors.set(key - 1, value);
        } else if (key < index) {
          reindexedErrors.set(key, value);
        }
      });

      return reindexedErrors;
    });

    // Clear any pending validation timer for this index
    const timer = emailValidationTimerRef.current.get(index);
    if (timer) {
      clearTimeout(timer);
      emailValidationTimerRef.current.delete(index);
    }

    // Re-validate remaining emails that might have been duplicates
    // Wait a bit for state to update, then validate all remaining emails
    setTimeout(() => {
      newEmails.forEach((_, i) => {
        if (newEmails[i].trim()) {
          validateEmailDebounced(i);
        }
      });
    }, 100);
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

  const handleCreate = useCallback(async () => {
    // Validation
    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    // Validate member emails
    const invalidEmails = memberEmails.filter(
      email => email.trim() && !validateEmail(email)
    );
    if (invalidEmails.length > 0) {
      setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    // Check for duplicate emails
    const emailMap = new Map<string, number>();
    const duplicateEmails: string[] = [];
    memberEmails.forEach((email, index) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail) {
        if (emailMap.has(trimmedEmail)) {
          duplicateEmails.push(email.trim());
        } else {
          emailMap.set(trimmedEmail, index);
        }
      }
    });

    if (duplicateEmails.length > 0) {
      setError(`Duplicate email addresses: ${duplicateEmails.join(', ')}`);
      return;
    }

    // Filter out empty emails
    const validMemberEmails = memberEmails.filter(
      email => email.trim().length > 0
    );

    setError(null);
    setIsCreating(true);
    setProgress(null);

    try {
      const creationService = getWorkspaceCreationService();
      creationServiceRef.current = creationService;

      // Set progress callback
      creationService.setProgressCallback(progress => {
        setProgress(progress);
      });

      const options: CreateWorkspaceOptions = {
        name: workspaceName.trim(),
        memberEmails: validMemberEmails,
        folderCreationMethod: 'create',
        folderName: folderName.trim() || workspaceName.trim(),
      };

      const result = await creationService.createWorkspace(options);

      // Clear progress callback (set to no-op)
      creationService.setProgressCallback(() => {});
      creationServiceRef.current = null;

      // Reset form only after successful creation
      setWorkspaceName('');
      setMemberEmails(['']);
      setFolderName('');
      setEmailValidationErrors(new Map());

      onSuccess?.(result.workspaceId);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create workspace:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to create workspace. Please try again.';
      setError(errorMessage);

      // Clear progress callback on error (set to no-op)
      if (creationServiceRef.current) {
        creationServiceRef.current.setProgressCallback(() => {});
        creationServiceRef.current = null;
      }
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  }, [workspaceName, memberEmails, folderName, onSuccess, onClose]);

  const handleClose = () => {
    if (!isCreating) {
      // Clear progress callback if set (set to no-op)
      if (creationServiceRef.current) {
        creationServiceRef.current.setProgressCallback(() => {});
        creationServiceRef.current = null;
      }

      setError(null);
      setProgress(null);
      setWorkspaceName('');
      setMemberEmails(['']);
      setFolderName('');
      setEmailValidationErrors(new Map());

      // Clear any pending email validation timers
      emailValidationTimerRef.current.forEach(timer => {
        clearTimeout(timer);
      });
      emailValidationTimerRef.current.clear();

      onClose();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    const timerRef = emailValidationTimerRef.current;
    const serviceRef = creationServiceRef.current;
    return () => {
      // Clear progress callback (set to no-op)
      if (serviceRef) {
        serviceRef.setProgressCallback(() => {});
      }

      // Clear email validation timers
      timerRef.forEach(timer => {
        clearTimeout(timer);
      });
      timerRef.clear();
    };
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle>Create Shared Workspace</DialogTitle>

      <DialogContent>
        {/* Progress indicator */}
        {isCreating && progress && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {progress.message}
            </Typography>
            <LinearProgress variant="determinate" value={progress.progress} />
          </Box>
        )}

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Workspace name */}
        <TextField
          fullWidth
          label="Workspace Name"
          value={workspaceName}
          onChange={e => setWorkspaceName(e.target.value)}
          disabled={isCreating}
          required
          sx={{ mb: 2 }}
        />

        {/* Folder name */}
        <TextField
          fullWidth
          label="Google Drive Folder Name (Optional)"
          value={folderName}
          onChange={e => setFolderName(e.target.value)}
          disabled={isCreating}
          placeholder={workspaceName || 'My Workspace'}
          helperText="Leave empty to use workspace name. A new folder will be created in your Google Drive."
          sx={{ mb: 2 }}
        />

        {/* Member emails */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Team Members (Optional)
          </Typography>
          {memberEmails.map((email, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                fullWidth
                type="email"
                label={`Member ${index + 1} Email`}
                value={email}
                onChange={e => handleMemberEmailChange(index, e.target.value)}
                disabled={isCreating}
                error={
                  emailValidationErrors.has(index)
                  || (email.trim() !== '' && !validateEmail(email))
                }
                helperText={
                  emailValidationErrors.get(index)
                  || (email.trim() !== '' && !validateEmail(email)
                    ? 'Invalid email address'
                    : '')
                }
              />
              {memberEmails.length > 1 && (
                <IconButton
                  onClick={() => handleRemoveMember(index)}
                  disabled={isCreating}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddMember}
            disabled={isCreating}
            size="small"
          >
            Add Member
          </Button>
        </Box>

        {/* Info about API keys */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> API keys are not shared in workspaces. Each
            user will use their own API keys.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={isCreating || !workspaceName.trim()}
          startIcon={isCreating ? <CircularProgress size={16} /> : null}
        >
          {isCreating ? 'Creating...' : 'Create Workspace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
