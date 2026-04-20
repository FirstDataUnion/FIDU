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
import { corpusToLocation, createRagApiClient } from '../services/apiClientRag';
import { useAppSelector } from '../../store';

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
  | 'fidu_context_selection'
  | 'complete';

export default function AddSourcePanel() {
  const navigate = useNavigate();
  const { corpusId } = useParams();
  const { corpus, ingestQueueInfo } = useCorpusSessionContext();
  const { items: contexts, loading: contextsLoading } = useAppSelector(
    state => state.contexts
  );
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
        case 'fidu_context':
          setStep('fidu_context_selection');
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
      const corpusLocation = corpusToLocation(corpus);
      if (corpusLocation === undefined) {
        console.error('Corpus location is undefined');
        return;
      }
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

  const handleFiduContextSelectionSubmit = useCallback(
    async (value: string) => {
      const corpusLocation = corpusToLocation(corpus);
      if (corpusLocation === undefined) {
        console.error('Corpus location is undefined');
        return;
      }
      const context = contexts.find(context => context.id === value);
      if (context === undefined) {
        console.error(`Context not found: ${value}`);
        return;
      }
      const ragApiClient = createRagApiClient();
      await ragApiClient.ingestFiles(corpusLocation, [
        {
          provider: 'fidu_context',
          provider_id: context.id,
          title: context.title,
          body: context.body,
        },
      ]);
      ingestQueueInfo?.pollIngestQueueStatus();
      setStep('complete');
    },
    [contexts, corpus, ingestQueueInfo]
  );

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
                  { label: 'FIDU Context', value: 'fidu_context' },
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
          {step === 'fidu_context_selection' && (
            <Box sx={{ p: 2 }}>
              <Typography>Select a FIDU Context</Typography>
              {contextsLoading ? (
                <Typography>Loading contexts...</Typography>
              ) : (
                <RadioButtonSelector
                  values={contexts.map(context => ({
                    label: context.title,
                    value: context.id,
                  }))}
                  onSubmit={handleFiduContextSelectionSubmit}
                />
              )}
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
