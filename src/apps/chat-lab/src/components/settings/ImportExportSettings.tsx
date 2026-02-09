import React, { useState } from 'react';
import { Box, Typography, Button, Stack, Alert } from '@mui/material';
import {
  FileUpload as ExportIcon,
  FileDownload as ImportIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';
import ResourceExportDialog from '../resourceExport/ResourceExportDialog';
import ResourceImportDialog from '../resourceExport/ResourceImportDialog';

export const ImportExportSettings: React.FC = () => {
  const { currentProfile, user } = useAppSelector(state => state.auth);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const canTransferResources = Boolean(currentProfile?.id);

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <BackupIcon />
            Import & Export Resources
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Export all conversations, prompts, contexts, and agent settings into
            a single JSON backup or import them from a trusted source.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="contained"
            startIcon={<ExportIcon />}
            onClick={() => setShowExportDialog(true)}
            disabled={!canTransferResources}
          >
            Export Resources
          </Button>
          <Button
            variant="outlined"
            startIcon={<ImportIcon />}
            onClick={() => setShowImportDialog(true)}
            disabled={!canTransferResources}
          >
            Import Resources
          </Button>
        </Stack>
      </Stack>
      {!canTransferResources && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Select or create a profile before exporting or importing resources.
        </Alert>
      )}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2, fontStyle: 'italic' }}
      >
        Exported files are unencrypted JSON. Imported resources receive new IDs
        and become part of your active profile.
      </Typography>

      {/* Dialogs */}
      {currentProfile?.id && (
        <ResourceExportDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          profileId={currentProfile.id}
          userEmail={user?.email}
        />
      )}

      <ResourceImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          /* no-op */
        }}
      />
    </>
  );
};
