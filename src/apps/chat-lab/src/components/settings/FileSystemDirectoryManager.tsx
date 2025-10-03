import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';
import { DirectoryPickerButton } from './DirectoryPickerButton';
import { PermissionStatusIndicator } from './PermissionStatusIndicator';
import { DirectoryPathDisplay } from './DirectoryPathDisplay';
import { ClearDirectoryButton } from './ClearDirectoryButton';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import type { PermissionState } from './PermissionStatusIndicator';

interface FileSystemDirectoryManagerProps {
  onDirectoryChange?: (isAccessible: boolean, directoryName: string | null) => void;
  showTitle?: boolean;
  compact?: boolean;
}

export const FileSystemDirectoryManager: React.FC<FileSystemDirectoryManagerProps> = ({
  onDirectoryChange,
  showTitle = true,
  compact = false
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [isAccessible, setIsAccessible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasMetadata, setHasMetadata] = useState(false);

  // Check initial state
  useEffect(() => {
    checkDirectoryStatus();
  }, []);

  const checkDirectoryStatus = async () => {
    setIsChecking(true);
    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      // Check if this is a filesystem adapter
      if (!('isDirectoryAccessible' in adapter) || !('hasDirectoryMetadata' in adapter)) {
        setPermissionState('prompt');
        setDirectoryName(null);
        setIsAccessible(false);
        setHasMetadata(false);
        return;
      }

      const isAccessible = (adapter as any).isDirectoryAccessible();
      const hasMetadata = (adapter as any).hasDirectoryMetadata();
      const directoryName = (adapter as any).getDirectoryName();

      setDirectoryName(directoryName);
      setHasMetadata(hasMetadata);
      setIsAccessible(isAccessible);
      
      if (isAccessible) {
        setPermissionState('granted');
      } else if (hasMetadata) {
        setPermissionState('denied'); // Lost access but have metadata
      } else {
        setPermissionState('prompt');
      }
      
    } catch (error) {
      console.error('Error checking directory status:', error);
      setPermissionState('denied');
      setIsAccessible(false);
      setHasMetadata(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDirectorySelected = async (directoryInfo: { path: string; permissionState: string }) => {
    setDirectoryName(directoryInfo.path);
    setPermissionState(directoryInfo.permissionState as PermissionState);
    setIsAccessible(directoryInfo.permissionState === 'granted');
    setHasMetadata(false); // Reset metadata flag since we have fresh access
    onDirectoryChange?.(directoryInfo.permissionState === 'granted', directoryInfo.path);
  };

  const handleError = (error: string) => {
    console.error('Directory selection error:', error);
    // Keep current state on error
  };

  const handleRenewPermission = async () => {
    setIsChecking(true);
    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter() as any;
      
      if ('requestDirectoryAccess' in adapter) {
        const result = await adapter.requestDirectoryAccess();
        if (result.success) {
          await checkDirectoryStatus(); // Refresh status
        } else {
          console.error('Failed to renew permission:', result.error);
        }
      }
    } catch (error) {
      console.error('Error renewing permission:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearDirectory = async () => {
    setIsChecking(true);
    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      if ('clearDirectoryAccess' in adapter) {
        await (adapter as any).clearDirectoryAccess();
        await checkDirectoryStatus(); // Refresh status
      }
    } catch (error) {
      console.error('Error clearing directory:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const currentPermissionState = isChecking ? 'checking' : permissionState;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <PermissionStatusIndicator
          permissionState={currentPermissionState}
          directoryName={directoryName}
          onRenewPermission={handleRenewPermission}
          isRenewing={isChecking}
          compact
        />
        
        {directoryName && (
          <DirectoryPathDisplay
            directoryName={directoryName}
            isAccessible={isAccessible}
            compact
          />
        )}
        
        <DirectoryPickerButton
          onDirectorySelected={handleDirectorySelected}
          onError={handleError}
          disabled={isChecking}
          variant="outlined"
          size="small"
        />
        
        {directoryName && (
          <ClearDirectoryButton
            onClearDirectory={handleClearDirectory}
            disabled={isChecking}
            variant="text"
            size="small"
            showWarning={false}
          />
        )}
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        {showTitle && (
          <>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderOpenIcon />
              Local Directory Access
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select a local directory to store your FIDU Chat Lab data files. This gives you full control over your data location.
            </Typography>
          </>
        )}

        <PermissionStatusIndicator
          permissionState={currentPermissionState}
          directoryName={directoryName}
          onRenewPermission={handleRenewPermission}
          isRenewing={isChecking}
        />

        {hasMetadata && !isAccessible && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Directory access was lost after page refresh.</strong> This is normal for security reasons. 
              Please re-select your FIDU data directory to continue using local file storage.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              Your data files are safe - you just need to grant access again.
            </Typography>
          </Alert>
        )}

        {directoryName && (
          <>
            <Box sx={{ my: 2 }}>
              <DirectoryPathDisplay
                directoryName={directoryName}
                isAccessible={isAccessible}
              />
            </Box>
          </>
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <DirectoryPickerButton
            onDirectorySelected={handleDirectorySelected}
            onError={handleError}
            disabled={isChecking}
            variant="contained"
            isReselection={hasMetadata && !isAccessible}
          />
          
          {directoryName && (
            <ClearDirectoryButton
              onClearDirectory={handleClearDirectory}
              disabled={isChecking}
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default FileSystemDirectoryManager;
