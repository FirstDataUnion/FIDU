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
import { useUnifiedStorage } from '../../hooks/useStorageCompatibility';
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
  const unifiedStorage = useUnifiedStorage();
  const navigate = useNavigate();

  // Check if we should show the banner
  const shouldShowBanner = React.useMemo(() => {
    // Hide banner in local mode - FIDU Vault API handles storage
    if (unifiedStorage.mode === 'local') {
      return false;
    }
    
    // Only show if storage mode is filesystem
    if (unifiedStorage.mode !== 'filesystem') {
      return false;
    }

    // Show banner if filesystem mode is selected but no directory is accessible
    return !unifiedStorage.filesystem.isAccessible;
  }, [unifiedStorage.mode, unifiedStorage.filesystem.isAccessible]);

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
        explanation: 'Your conversations will not be saved until you select a directory.',
        actionText: actionText
      };
    } else {
      return {
        severity: 'error' as const,
        icon: <FolderOpenIcon />,
        title: 'Local Storage Directory Required',
        message: 'You\'ve selected Local File System storage, but no directory has been selected yet.',
        explanation: 'Operations on this page will fail until you select a directory.',
        actionText: actionText
      };
    }
  };

  // Hide if banner shouldn't be shown
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
