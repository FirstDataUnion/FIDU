import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Close as CloseIcon, Folder as FolderIcon } from '@mui/icons-material';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DrivePicker,
  type PickedDriveDocument,
} from '../../services/drive/DrivePicker';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import { createRagApiClient } from '../services/apiClientRag';
import type { CorpusLocation } from '../types/ragApi';

function RadioButtonSelector({
  values,
  initialValue,
  onSubmit,
}: {
  values: { label: string; value: string }[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}) {
  const [selectedValue, setSelectedValue] = useState<string | undefined>(
    initialValue
  );
  return (
    <>
      <List>
        {values.map(({ label, value }) => (
          <ListItem key={value}>
            <Paper
              sx={{
                width: '100%',
                backgroundColor:
                  selectedValue === value
                    ? theme => alpha(theme.palette.primary.light, 0.15)
                    : 'background.paper',
              }}
            >
              <ListItemButton
                onClick={() => setSelectedValue(value)}
                selected={selectedValue === value}
              >
                <ListItemText primary={label} />
              </ListItemButton>
            </Paper>
          </ListItem>
        ))}
      </List>
      <Stack direction="row" justifyContent="flex-end" sx={{ m: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => selectedValue !== undefined && onSubmit(selectedValue)}
          disabled={!selectedValue}
        >
          Continue
        </Button>
      </Stack>
    </>
  );
}

type Step =
  | 'source_type'
  | 'google_drive_scope'
  | 'google_drive_file_selection'
  | 'url_input'
  | 'complete';

export default function AddSourcePanel() {
  const navigate = useNavigate();
  const { corpusId } = useParams();
  const { corpus, ingestQueueInfo } = useCorpusSessionContext();
  const [step, setStep] = useState<Step>('source_type');
  const [googleDriveScope, setGoogleDriveScope] = useState<string | undefined>(
    undefined
  );

  const cancel = useCallback(() => {
    navigate(`/research-lab/corpora/${corpusId}`);
  }, [navigate, corpusId]);

  const handleSourceTypeSubmit = useCallback(
    (value: string) => {
      switch (value) {
        case 'google_drive': {
          const loc = corpus?.databaseLocation;
          if (
            loc?.provider === 'google_drive'
            && loc.parentFolderId !== 'root'
          ) {
            setStep('google_drive_scope');
          } else {
            setGoogleDriveScope('root');
            setStep('google_drive_file_selection');
          }
          break;
        }
        case 'url':
          setStep('url_input');
          break;
        default:
          console.error(`Invalid source type: ${value}`);
          cancel();
          break;
      }
    },
    [cancel, corpus?.databaseLocation]
  );

  const handleGoogleDriveScopeSubmit = useCallback((value: string) => {
    setGoogleDriveScope(value);
    setStep('google_drive_file_selection');
  }, []);

  const handleGoogleDriveFilesPicked = useCallback(
    async (files: PickedDriveDocument[]) => {
      if (corpus === undefined) {
        console.error('Corpus is undefined');
        return;
      }
      const corpusLocation: CorpusLocation = {
        provider: 'fidu_rag',
        engine: 'cortexdb',
        database_file_location: {
          provider: 'google_drive',
          file_id: corpus.databaseLocation.fileId,
        },
      };
      const ragApiClient = createRagApiClient();
      await ragApiClient.ingestFiles(
        corpusLocation,
        files.map(file => ({
          provider: 'google_drive',
          file_id: file.id,
        }))
      );
      ingestQueueInfo?.pollIngestQueueStatus();
      setStep('complete');
    },
    [corpus, ingestQueueInfo]
  );

  const handleGoogleDriveSelectFilesClick = useCallback(async () => {
    const drivePicker = new DrivePicker({
      authService: await getGoogleDriveAuthService(),
    });
    await drivePicker.pickFilesFromFolder({
      folderId: googleDriveScope === 'root' ? undefined : googleDriveScope,
      title: 'Select files',
      onFilesPicked: handleGoogleDriveFilesPicked,
      onCancelled: async () => {
        cancel();
      },
      metricsName: 'research_lab_add_source',
    });
  }, [cancel, googleDriveScope, handleGoogleDriveFilesPicked]);

  return (
    <Paper>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', m: 1 }}
      >
        <Typography variant="h6">Add Source</Typography>
        <IconButton onClick={cancel}>
          <CloseIcon />
        </IconButton>
      </Stack>

      {corpus === undefined ? (
        <div>Loading corpus...</div>
      ) : (
        <>
          {step === 'source_type' && (
            <Box sx={{ p: 2 }}>
              <Typography>Where do you want to add a source from?</Typography>
              <RadioButtonSelector
                values={[
                  { label: 'Google Drive', value: 'google_drive' },
                  { label: 'The web', value: 'url' },
                ]}
                onSubmit={handleSourceTypeSubmit}
              />
            </Box>
          )}
          {step === 'google_drive_scope' && (
            <Box sx={{ p: 2 }}>
              <Typography>
                Is your file in the same folder as the corpus?
              </Typography>
              <RadioButtonSelector
                values={[
                  {
                    label: 'Yes',
                    value: corpus.databaseLocation.parentFolderId,
                  },
                  { label: 'No', value: 'root' },
                ]}
                onSubmit={handleGoogleDriveScopeSubmit}
                initialValue={corpus.databaseLocation.parentFolderId}
              />
            </Box>
          )}
          {step === 'google_drive_file_selection' && (
            <Stack direction="row" justifyContent="center" sx={{ p: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleGoogleDriveSelectFilesClick}
                size="large"
                startIcon={<FolderIcon />}
              >
                Select Files
              </Button>
            </Stack>
          )}
          {step === 'url_input' && (
            <Box sx={{ p: 2 }}>
              <Typography>Enter a URL</Typography>
            </Box>
          )}
          {step === 'complete' && (
            <Box sx={{ p: 2 }}>
              <Typography>Source added successfully!</Typography>
              <Typography color="text.secondary">
                Watch for the ingestion progress in the Sources panel
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
