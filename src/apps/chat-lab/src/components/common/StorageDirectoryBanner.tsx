import React from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Typography
} from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { useNavigate } from 'react-router-dom';

interface StorageDirectoryBannerProps {
  /**
   * Whether to show the banner in a compact format
   */
  compact?: boolean;
  /**
   * Custom action to perform when the user clicks the action button
   * If not provided, defaults to navigating to settings
   */
  onAction?: () => void;
  /**
   * Custom text for the action button
   * If not provided, defaults to "Go to Settings"
   */
  actionText?: string;
  /**
   * The type of page this banner is displayed on
   * Determines the severity and messaging
   */
  pageType?: 'prompt-lab' | 'conversations' | 'system-prompts' | 'contexts';
}

/**
 * Banner component that appears when users have selected "Local File System" storage
 * but haven't selected a directory yet, or their directory access has been lost.
 * 
 * This banner helps users understand they need to reselect their directory
 * and provides a quick way to navigate to the settings page.
 */
export const StorageDirectoryBanner: React.FC<StorageDirectoryBannerProps> = ({
  compact = false,
  onAction,
  actionText = "Go to Settings",
  pageType = 'prompt-lab'
}) => {
  const { settings } = useAppSelector((state) => state.settings);
  const navigate = useNavigate();

  // Check if we should show the banner
  const shouldShowBanner = React.useMemo(() => {
    // Only show if storage mode is filesystem
    if (settings.storageMode !== 'filesystem') {
      return false;
    }

    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      // Check if this is a filesystem adapter
      if (!('isDirectoryAccessible' in adapter) || !('hasDirectoryMetadata' in adapter)) {
        return false;
      }

      const isAccessible = (adapter as any).isDirectoryAccessible();
      
      // Show banner if:
      // 1. No directory is accessible AND no metadata exists (never selected)
      // 2. No directory is accessible BUT metadata exists (lost access after refresh)
      return !isAccessible;
    } catch (error) {
      console.error('Error checking directory status for banner:', error);
      return false;
    }
  }, [settings.storageMode]);

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate('/settings');
    }
  };

  // Determine banner content based on page type
  const getBannerContent = () => {
    const isPromptLab = pageType === 'prompt-lab';
    
    if (isPromptLab) {
      return {
        severity: 'warning' as const,
        icon: <WarningIcon />,
        title: 'Conversations Will Not Be Saved',
        message: 'You\'ve selected Local File System storage, but no directory has been selected yet.',
        explanation: 'Due to browser security limitations, you\'ll need to re-select your chosen directory each time you reload the page. Your conversations will not be saved until you select a directory.',
        actionText: actionText
      };
    } else {
      return {
        severity: 'error' as const,
        icon: <FolderOpenIcon />,
        title: 'Local Storage Directory Required',
        message: 'You\'ve selected Local File System storage, but no directory has been selected yet.',
        explanation: 'Due to browser security limitations, you\'ll need to re-select your chosen directory each time you reload the page. Operations on this page will fail until you select a directory.',
        actionText: actionText
      };
    }
  };

  // Don't render if we shouldn't show the banner
  if (!shouldShowBanner) {
    return null;
  }

  const bannerContent = getBannerContent();

  if (compact) {
    return (
      <Alert 
        severity={bannerContent.severity}
        icon={bannerContent.icon}
        sx={{ mb: 2 }}
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={handleAction}
            startIcon={<SettingsIcon />}
          >
            {bannerContent.actionText}
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>{bannerContent.title}.</strong> {bannerContent.message}
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert 
      severity={bannerContent.severity}
      icon={bannerContent.icon}
      sx={{ mb: 3 }}
      action={
        <Button 
          color="inherit" 
          variant="outlined"
          onClick={handleAction}
          startIcon={<SettingsIcon />}
        >
          {bannerContent.actionText}
        </Button>
      }
    >
      <AlertTitle>{bannerContent.title}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {bannerContent.message}
      </Typography>
      <Typography variant="body2">
        {bannerContent.explanation}
      </Typography>
    </Alert>
  );
};

export default StorageDirectoryBanner;
