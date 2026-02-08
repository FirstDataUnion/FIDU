import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { DeleteForever as DeleteForeverIcon } from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

export const CloudDataManagement: React.FC = () => {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<{
    success: boolean | null;
    message: string | null;
  }>({ success: null, message: null });

  const handleClearCloudData = async () => {
    setIsClearing(true);
    setClearStatus({ success: null, message: null });

    try {
      const storageService = getUnifiedStorageService();
      await storageService.clearAllCloudDatabaseFiles();
      setClearStatus({
        success: true,
        message: 'All cloud database files have been successfully cleared.',
      });
      setShowClearDialog(false);
    } catch (error: any) {
      console.error('Failed to clear cloud database files:', error);
      setClearStatus({
        success: false,
        message: `Failed to clear cloud data: ${error.message || 'Unknown error'}`,
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

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <DeleteForeverIcon />
        Cloud Data Management
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Use this option to clear all database files from Google Drive. WARNING:
        This will delete all your conversations, contexts, custom system prompts
        and stored API keys from Google Drive.
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
          severity={clearStatus.success ? 'success' : 'error'}
          sx={{ mt: 2 }}
          onClose={() => setClearStatus({ success: null, message: null })}
        >
          {clearStatus.message}
        </Alert>
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
            <br />
            <br />
            This is useful for testing with a fresh slate but should be used with
            caution.
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
    </>
  );
};
