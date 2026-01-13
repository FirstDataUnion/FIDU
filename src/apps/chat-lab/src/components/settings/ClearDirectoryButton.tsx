import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Box,
  Typography
} from '@mui/material';
import {
  Clear as ClearIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface ClearDirectoryButtonProps {
  onClearDirectory: () => Promise<void>;
  disabled?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  showWarning?: boolean;
}

export const ClearDirectoryButton: React.FC<ClearDirectoryButtonProps> = ({
  onClearDirectory,
  disabled = false,
  variant = 'outlined',
  size = 'medium',
  fullWidth = false,
  showWarning = true
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClearClick = () => {
    setShowDialog(true);
    setClearError(null);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    setClearError(null);

    try {
      await onClearDirectory();
      setShowDialog(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear directory access';
      setClearError(errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCancelClear = () => {
    setShowDialog(false);
    setClearError(null);
  };

  return (
    <Box>
      <Button
        onClick={handleClearClick}
        disabled={disabled}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        color="warning"
        startIcon={<ClearIcon />}
      >
        Clear Directory
      </Button>

      <Dialog
        open={showDialog}
        onClose={handleCancelClear}
        aria-labelledby="clear-directory-dialog-title"
        aria-describedby="clear-directory-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="clear-directory-dialog-title">
          Clear Directory Access
        </DialogTitle>
        
        <DialogContent>
          <DialogContentText id="clear-directory-dialog-description" sx={{ mb: 2 }}>
            Are you sure you want to clear the selected directory access? This will:
          </DialogContentText>
          
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Remove the directory access permission
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Clear the stored directory information
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Require you to re-select a directory to continue using file system storage
            </Typography>
          </Box>

          {showWarning && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="body2">
                <strong>Note:</strong> Your data files will remain in the directory. 
                This only clears the browser's access permission.
              </Typography>
            </Alert>
          )}

          {clearError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {clearError}
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleCancelClear} 
            disabled={isClearing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmClear}
            color="warning"
            variant="contained"
            disabled={isClearing}
            autoFocus
          >
            {isClearing ? 'Clearing...' : 'Yes, Clear Access'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
