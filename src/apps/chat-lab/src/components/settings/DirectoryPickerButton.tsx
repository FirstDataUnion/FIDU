import React, { useState } from 'react';
import {
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { FileSystemService } from '../../services/storage/filesystem/FileSystemService';

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
  onDirectorySelected,
  onError,
  disabled = false,
  variant = 'contained',
  size = 'medium',
  fullWidth = false,
  isReselection = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSelectDirectory = async () => {
    setIsLoading(true);
    setLastError(null);

    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      if ('requestDirectoryAccessWithHints' in adapter) {
        const result = await adapter.requestDirectoryAccessWithHints();
        if (result.success) {
          // Get directory info from the adapter
          const directoryName = adapter.getDirectoryName();
          onDirectorySelected?.({
            path: directoryName || 'Selected Directory',
            permissionState: 'granted'
          });
        } else {
          throw new Error(result.error || 'Failed to access directory');
        }
      } else if ('requestDirectoryAccess' in adapter) {
        // Fallback to regular method
        const result = await adapter.requestDirectoryAccess();
        if (result.success) {
          const directoryName = adapter.getDirectoryName();
          onDirectorySelected?.({
            path: directoryName || 'Selected Directory',
            permissionState: 'granted'
          });
        } else {
          throw new Error(result.error || 'Failed to access directory');
        }
      } else {
        throw new Error('File system storage not available');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select directory';
      setLastError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isSupported = FileSystemService.isSupported();

  if (!isSupported) {
    const compatibility = FileSystemService.getBrowserCompatibility();
    return (
      <Box>
        <Button
          disabled
          variant={variant}
          size={size}
          fullWidth={fullWidth}
          startIcon={<FolderOpenIcon />}
        >
          Select Directory
        </Button>
        <Alert severity="warning" sx={{ mt: 1 }}>
          {compatibility.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        onClick={handleSelectDirectory}
        disabled={disabled || isLoading}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        startIcon={isLoading ? <CircularProgress size={16} /> : <FolderOpenIcon />}
      >
        {isLoading ? 'Selecting...' : (isReselection ? 'Re-select Directory' : 'Select Directory')}
      </Button>
      
      {lastError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setLastError(null)}>
          {lastError}
        </Alert>
      )}
    </Box>
  );
};

export default DirectoryPickerButton;
