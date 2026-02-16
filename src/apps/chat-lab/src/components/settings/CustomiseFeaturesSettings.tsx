import React, { useState } from 'react';
import { Typography, Button, Alert } from '@mui/material';
import { Tune as TuneIcon } from '@mui/icons-material';
import { FeatureFlagsModal } from './FeatureFlagsModal';

export const CustomiseFeaturesSettings: React.FC = () => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <TuneIcon />
        Customise Features
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enable or disable optional features to customize your FIDU Chat Lab
        experience. You can toggle features on or off, or use the default
        recommended settings.
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> These changes only affect the UI visibility of
          features, not their underlying functionality. Disabled features will
          be hidden from the interface but may still operate in the background.
        </Typography>
      </Alert>

      <Button
        variant="contained"
        startIcon={<TuneIcon />}
        onClick={handleOpen}
        sx={{ textTransform: 'none' }}
      >
        Customise Features
      </Button>

      <FeatureFlagsModal open={open} onClose={handleClose} />
    </>
  );
};
