import { useMemo } from 'react';
import { useUnifiedStorage } from './useStorageCompatibility';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';

/**
 * Custom hook to detect if filesystem storage is selected but no directory is accessible
 * This is useful for disabling create buttons and other operations that require directory access
 */
export const useFilesystemDirectoryRequired = () => {
  const unifiedStorage = useUnifiedStorage();

  const isDirectoryRequired = useMemo(() => {
    // Don't require directory in local mode - FIDU Vault API handles storage
    if (unifiedStorage.mode === 'local') {
      return false;
    }
    
    // Only check if storage mode is filesystem
    if (unifiedStorage.mode !== 'filesystem') {
      return false;
    }

    // Directory is required if filesystem mode is selected but no directory is accessible
    return !unifiedStorage.filesystem.isAccessible;
  }, [unifiedStorage.mode, unifiedStorage.filesystem.isAccessible]);

  return isDirectoryRequired;
};

export default useFilesystemDirectoryRequired;
