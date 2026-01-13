import React, { useState } from 'react';
import {
  Button,
  Box,
  Alert
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';

interface DirectoryPickerButtonProps {
  onDirectorySelected?: (directoryInfo: { path: string; permissionState: string }) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  isReselection?: boolean; // New prop to indicate if this is a re-selection
}

export const DirectoryPickerButton: React.FC<DirectoryPickerButtonProps> = ({
  onDirectorySelected: _onDirectorySelected,
  onError,
  disabled = false,
  variant = 'contained',
  size = 'medium',
  fullWidth = false,
  isReselection = false
}) => {
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSelectDirectory = async () => {
    // File system storage is no longer supported in cloud mode
    const errorMessage = 'Local file system storage is no longer supported. Please use Google Drive storage.';
    setLastError(errorMessage);
    onError?.(errorMessage);
  };

  // File system storage is no longer supported in cloud mode
  // This component is deprecated
  return (
    <Box>
      <Button
        onClick={handleSelectDirectory}
        disabled={disabled}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        startIcon={<FolderOpenIcon />}
      >
        {isReselection ? 'Re-select Directory' : 'Select Directory'}
      </Button>
      
      {lastError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setLastError(null)}>
          {lastError}
        </Alert>
      )}
    </Box>
  );
};
