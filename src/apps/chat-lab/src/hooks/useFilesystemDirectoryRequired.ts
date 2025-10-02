import { useMemo } from 'react';
import { useAppSelector } from '../hooks/redux';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';

/**
 * Custom hook to detect if filesystem storage is selected but no directory is accessible
 * This is useful for disabling create buttons and other operations that require directory access
 */
export const useFilesystemDirectoryRequired = () => {
  const { settings } = useAppSelector((state) => state.settings);

  const isDirectoryRequired = useMemo(() => {
    // Don't require directory in local mode - FIDU Vault API handles storage
    if (settings.storageMode === 'local') {
      return false;
    }
    
    // Only check if storage mode is filesystem
    if (settings.storageMode !== 'filesystem') {
      return false;
    }

    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      // Check if this is a filesystem adapter
      if (!('isDirectoryAccessible' in adapter)) {
        return false;
      }

      const isAccessible = (adapter as any).isDirectoryAccessible();
      
      // Directory is required if filesystem mode is selected but no directory is accessible
      return !isAccessible;
    } catch (error) {
      console.error('Error checking directory status:', error);
      return false;
    }
  }, [settings.storageMode]);

  return isDirectoryRequired;
};

export default useFilesystemDirectoryRequired;
