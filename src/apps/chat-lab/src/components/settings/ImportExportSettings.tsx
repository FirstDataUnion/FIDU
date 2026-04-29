import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  FileUpload as ExportIcon,
  FileDownload as ImportIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateMessageDownloadPreferences } from '../../store/slices/settingsSlice';
import ResourceExportDialog from '../resourceExport/ResourceExportDialog';
import ResourceImportDialog from '../resourceExport/ResourceImportDialog';

export const ImportExportSettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentProfile, user } = useAppSelector(state => state.auth);
  const { settings } = useAppSelector(state => state.settings);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const canTransferResources = Boolean(currentProfile?.id);
  const messageDownloadFormat =
    settings.messageDownloadFormatPreference || 'markdown';
  const askEachTime = settings.askMessageDownloadFormatEachTime ?? true;

  const handleMessageDownloadFormatChange = (
    event: SelectChangeEvent<string>
  ) => {
    dispatch(
      updateMessageDownloadPreferences({
        format: event.target.value as 'markdown' | 'txt',
      })
    );
  };

  const handleAskEachTimeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    dispatch(
      updateMessageDownloadPreferences({
        askEachTime: event.target.checked,
      })
    );
  };

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

      <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Chat Message Download Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Controls the default format for downloading a single message from the chat bubble action menu.
        </Typography>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="message-download-format-label">
              Default format
            </InputLabel>
            <Select
              labelId="message-download-format-label"
              value={messageDownloadFormat}
              label="Default format"
              onChange={handleMessageDownloadFormatChange}
            >
              <MenuItem value="markdown">Markdown (.md)</MenuItem>
              <MenuItem value="txt">Text (.txt)</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch checked={askEachTime} onChange={handleAskEachTimeChange} />
            }
            label="Always ask format before downloading single message"
          />
        </Stack>
      </Box>

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
