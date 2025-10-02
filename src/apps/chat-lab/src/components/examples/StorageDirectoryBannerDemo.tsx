import React from 'react';
import { Box, Typography } from '@mui/material';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';

/**
 * Demo component to test the StorageDirectoryBanner
 * This shows how the banner appears when filesystem storage is selected but no directory is chosen
 */
export const StorageDirectoryBannerDemo: React.FC = () => {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Storage Directory Banner Demo
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        This demo shows how the StorageDirectoryBanner component appears when users have selected 
        "Local File System" storage but haven't selected a directory yet, or their directory access has been lost.
      </Typography>

      <Typography variant="h6" gutterBottom>
        Prompt Lab Banner (Warning):
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner pageType="prompt-lab" />
      </Box>

      <Typography variant="h6" gutterBottom>
        Conversations Banner (Error):
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner pageType="conversations" />
      </Box>

      <Typography variant="h6" gutterBottom>
        System Prompts Banner (Error):
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner pageType="system-prompts" />
      </Box>

      <Typography variant="h6" gutterBottom>
        Contexts Banner (Error):
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner pageType="contexts" />
      </Box>

      <Typography variant="h6" gutterBottom>
        Compact Banner (Warning):
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner compact pageType="prompt-lab" />
      </Box>

      <Typography variant="h6" gutterBottom>
        Custom Action Banner:
      </Typography>
      <Box sx={{ mb: 3 }}>
        <StorageDirectoryBanner 
          pageType="conversations"
          actionText="Custom Action"
          onAction={() => alert('Custom action clicked!')}
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        Note: The banner will only appear if storage mode is set to "filesystem" and no directory is accessible.
        To test this, go to Settings and switch to "Local File System" storage mode without selecting a directory.
      </Typography>
    </Box>
  );
};

export default StorageDirectoryBannerDemo;
