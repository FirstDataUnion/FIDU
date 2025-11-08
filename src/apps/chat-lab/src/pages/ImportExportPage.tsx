import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Stack, Alert } from '@mui/material';
import {
  FileUpload as ExportIcon,
  FileDownload as ImportIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../hooks/redux';
import ResourceExportDialog from '../components/resourceExport/ResourceExportDialog';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';

const ImportExportPage: React.FC = () => {
  const { currentProfile, user } = useAppSelector((state) => state.auth);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const canTransferResources = Boolean(currentProfile?.id);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        py: 4,
        px: 3,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box sx={{ maxWidth: 720, width: '100%' }}>
        <Typography variant="h4" gutterBottom>
          Import & Export Resources
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Quickly back up, restore, and share your FIDU Chat Lab resources (System Prompts, Contexts, Conversations, Background Agents). 
        </Typography>

        {!canTransferResources && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Select or create a profile before exporting or importing resources.
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
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
                  Mass Resource Import & Export
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Export all conversations, prompts, contexts, and agent settings into a single JSON
                  backup or import them from a trusted source.
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
              Exported files are unencrypted JSON. Imported resources receive new IDs and become part
              of your active profile.
            </Typography>
          </CardContent>
        </Card>
      </Box>

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
    </Box>
  );
};

export default ImportExportPage;

