/**
 * Compatibility hooks for migrating from old state structure to unified storage state
 * These hooks provide the same interface as the old slices while using the new unified state
 */

import { useAppSelector } from '../hooks/redux';
import type { GoogleDriveAuthState, GoogleDriveUser } from '../types';
import { getEnvironmentInfo } from '../utils/environment';

/**
 * Compatibility hook that provides the same interface as the old settings slice
 * but uses the unified storage state internally
 */
export const useSettingsCompatibility = () => {
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const settings = useAppSelector((state) => state.settings);
  
  return {
    settings: {
      ...settings.settings,
      // Override storage-related fields with unified state
      storageMode: unifiedStorage.mode,
      storageConfigured: unifiedStorage.status === 'configured',
      userSelectedStorageMode: unifiedStorage.userSelectedMode,
    },
    loading: settings.loading,
    error: settings.error,
  };
};

/**
 * Compatibility hook that provides the same interface as the old googleDriveAuth slice
 * but uses the unified storage state internally
 */
export const useGoogleDriveAuthCompatibility = (): GoogleDriveAuthState => {
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  
  return {
    isAuthenticated: unifiedStorage.googleDrive.isAuthenticated,
    user: unifiedStorage.googleDrive.user as GoogleDriveUser | null,
    isLoading: unifiedStorage.googleDrive.isLoading,
    error: unifiedStorage.googleDrive.error,
    showAuthModal: unifiedStorage.googleDrive.showAuthModal,
    expiresAt: unifiedStorage.googleDrive.expiresAt,
  };
};

/**
 * Hook to get unified storage state with environment-based mode restrictions
 */
export const useUnifiedStorage = () => {
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const envInfo = getEnvironmentInfo();
  
  // Apply environment-based restrictions
  const getAvailableModes = (): Array<'local' | 'cloud' | 'filesystem'> => {
    if (envInfo.storageMode === 'local') {
      // In local app mode, only FIDU Vault API is available
      return ['local'];
    } else {
      // In cloud hosted mode, both Google Drive and Local File System are available
      return ['cloud', 'filesystem'];
    }
  };
  
  const isModeAvailable = (mode: 'local' | 'cloud' | 'filesystem'): boolean => {
    return getAvailableModes().includes(mode);
  };
  
  const getCurrentEnvironmentMode = (): 'local' | 'cloud' | 'filesystem' => {
    return envInfo.storageMode as 'local' | 'cloud' | 'filesystem';
  };
  
  return {
    ...unifiedStorage,
    availableModes: getAvailableModes(),
    isModeAvailable,
    environmentMode: getCurrentEnvironmentMode(),
    isLocalAppMode: envInfo.storageMode === 'local',
    isCloudHostedMode: envInfo.storageMode === 'cloud',
  };
};
