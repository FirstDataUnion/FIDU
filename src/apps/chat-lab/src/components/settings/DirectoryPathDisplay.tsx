import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip
} from '@mui/material';
import {
  Folder as FolderIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';

interface DirectoryPathDisplayProps {
  directoryName: string | null;
  isAccessible: boolean;
  compact?: boolean;
}

export const DirectoryPathDisplay: React.FC<DirectoryPathDisplayProps> = ({
  directoryName,
  isAccessible,
  compact = false
}) => {
  if (!directoryName) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon color="disabled" />
        <Typography variant="body2" color="text.secondary">
          No directory selected
        </Typography>
      </Box>
    );
  }

  if (compact) {
    return (
      <Chip
        icon={<FolderIcon />}
        label={directoryName}
        variant={isAccessible ? 'filled' : 'outlined'}
        color={isAccessible ? 'primary' : 'default'}
        size="small"
      />
    );
  }

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        backgroundColor: isAccessible ? 'action.hover' : 'background.paper',
        borderColor: isAccessible ? 'primary.main' : 'divider'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LocationIcon color={isAccessible ? 'primary' : 'disabled'} />
        <Typography variant="subtitle2" color={isAccessible ? 'primary.main' : 'text.secondary'}>
          Selected Directory
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon color={isAccessible ? 'primary' : 'disabled'} />
        <Typography 
          variant="body1" 
          sx={{ 
            fontFamily: 'monospace',
            color: isAccessible ? 'text.primary' : 'text.secondary'
          }}
        >
          {directoryName}
        </Typography>
      </Box>
      
      {!isAccessible && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Directory access is not currently available
        </Typography>
      )}
    </Paper>
  );
};

export default DirectoryPathDisplay;
