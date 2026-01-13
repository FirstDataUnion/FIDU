import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import {
  Sync as SyncIcon
} from '@mui/icons-material';

interface MigrationWizardProps {
  open: boolean;
  onClose: () => void;
  fromMode: 'local' | 'cloud';
  toMode: 'local' | 'cloud';
  onMigrationComplete?: () => void;
}

/**
 * Storage Migration Wizard - Placeholder Component
 * 
 * This component is currently disabled and will be implemented in the future.
 * It maintains the interface for the migration wizard button in StorageModeSelector.
 */
export const StorageMigrationWizard: React.FC<MigrationWizardProps> = ({
  open,
  onClose,
  fromMode,
  toMode,
}) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="migration-wizard-title"
    >
      <DialogTitle id="migration-wizard-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon />
          Storage Migration Wizard
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            The Storage Migration Wizard is currently under development.
          </Typography>
        </Alert>
        
        <Typography variant="body1" paragraph>
          This feature will allow you to migrate your data from <strong>{fromMode}</strong> storage 
          to <strong>{toMode}</strong> storage with a guided step-by-step process.
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          For now, you can use the "Switch Without Migration" option to change storage modes. 
          Your existing data will remain in the current storage location, and new data will be 
          stored in the new location.
        </Typography>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};