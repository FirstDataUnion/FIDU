import React from 'react';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import {
  NewReleases as WhatsNewIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export const WhatsNewSettings: React.FC = () => {
  const navigate = useNavigate();

  const handleOpenWhatsNew = () => {
    navigate('/whats-new');
  };

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <WhatsNewIcon />
        What's New
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        View the latest features, improvements, and fixes in FIDU Chat Lab. The
        changelog is updated regularly with new releases.
      </Typography>

      <Button
        variant="contained"
        startIcon={<WhatsNewIcon />}
        endIcon={<OpenInNewIcon />}
        onClick={handleOpenWhatsNew}
        sx={{ textTransform: 'none' }}
      >
        View What's New
      </Button>
    </>
  );
};
