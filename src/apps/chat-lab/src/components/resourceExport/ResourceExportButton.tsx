/**
 * Resource Export Button
 * Reusable button component for triggering resource export
 */

import React, { useState } from 'react';
import { Button, type ButtonProps } from '@mui/material';
import { FileUpload as ExportIcon } from '@mui/icons-material';
import ResourceExportDialog from './ResourceExportDialog';
import { useAppSelector } from '../../hooks/redux';

interface ResourceExportButtonProps extends Omit<ButtonProps, 'onClick'> {
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
}

export default function ResourceExportButton({
  variant = 'outlined',
  size = 'medium',
  ...props
}: ResourceExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentProfile, user } = useAppSelector((state) => state.auth);

  const handleClick = () => {
    if (currentProfile?.id) {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={<ExportIcon />}
        onClick={handleClick}
        disabled={!currentProfile?.id}
        {...props}
      >
        Export Resources
      </Button>
      <ResourceExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        profileId={currentProfile?.id || ''}
        userEmail={user?.email}
      />
    </>
  );
}

