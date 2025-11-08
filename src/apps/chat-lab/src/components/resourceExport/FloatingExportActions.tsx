/**
 * FloatingExportActions Component
 * 
 * Floating action buttons that appear in the bottom right corner
 * when in multi-select mode for exporting resources.
 */

import React from 'react';
import { Box, Fab, useTheme, useMediaQuery } from '@mui/material';
import {
  FileUpload as ExportIcon,
  Close as CancelIcon,
} from '@mui/icons-material';

export interface FloatingExportActionsProps {
  selectionCount: number;
  onExport: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const FloatingExportActions: React.FC<FloatingExportActionsProps> = ({
  selectionCount,
  onExport,
  onCancel,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (selectionCount === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: isMobile ? 16 : 24,
        right: isMobile ? 16 : 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        zIndex: 1300, // Higher than MUI Dialog (1300) to ensure visibility
        alignItems: 'flex-end',
      }}
    >
      {/* Selection count badge */}
      <Box
        sx={{
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 2,
          px: 2,
          py: 0.75,
          fontSize: '0.875rem',
          fontWeight: 600,
          boxShadow: 3,
          minWidth: 'fit-content',
        }}
      >
        {selectionCount} {selectionCount === 1 ? 'item' : 'items'} selected
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        {/* Cancel button */}
        <Fab
          color="default"
          size={isMobile ? 'medium' : 'large'}
          onClick={onCancel}
          aria-label="Cancel selection"
          sx={{
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
            },
          }}
        >
          <CancelIcon />
        </Fab>

        {/* Export button */}
        <Fab
          color="primary"
          size={isMobile ? 'medium' : 'large'}
          onClick={onExport}
          disabled={disabled || selectionCount === 0}
          aria-label="Export selected"
          sx={{
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
            },
            '&.Mui-disabled': {
              backgroundColor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          <ExportIcon />
        </Fab>
      </Box>
    </Box>
  );
};

