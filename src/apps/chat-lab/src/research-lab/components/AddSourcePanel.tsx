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
  TextField,
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
import { GoogleDriveService } from '../../services/storage/drive/GoogleDriveService';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import { corpusToLocation, createRagApiClient } from '../services/apiClientRag';
import { useAppSelector } from '../../store';
import type { UrlCollection } from '../types/local';

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
  | 'url_source_location'
  | 'url_selection'
  | 'url_google_sheet_selection'
  | 'url_collection_complete'
  | 'complete';

export default function AddSourcePanel() {
  const navigate = useNavigate();
  const { corpusId } = useParams();
  const { corpus, ingestQueueInfo, corpusInfo } = useCorpusSessionContext();
  const { items: contexts, loading: contextsLoading } = useAppSelector(
    state => state.contexts
  );
  const [step, setStep] = useState<Step>('source_type');
  const [googleDriveScope, setGoogleDriveScope] = useState<string | undefined>(
    undefined
  );
  const [url, setUrl] = useState<string>('');
  const [googleSheetName, setGoogleSheetName] =
    useState<string>('FIDU Source URLs');
  const [urlCollection, setUrlCollection] = useState<UrlCollection | undefined>(
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
        case 'url':
          setStep('url_source_location');
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
          location: {
            provider: 'google_drive',
            file_id: file.id,
          },
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
          location: {
            provider: 'fidu_context',
            provider_id: context.id,
            title: context.title,
            body: context.body,
          },
        },
      ]);
      ingestQueueInfo?.pollIngestQueueStatus();
      setStep('complete');
    },
    [contexts, corpus, ingestQueueInfo]
  );

  const handleUrlSourceLocationSubmit = useCallback(
    (value: string) => {
      switch (value) {
        case 'research_lab':
          setStep('url_selection');
          break;
        case 'google_sheet':
          setStep('url_google_sheet_selection');
          break;
        default:
          console.error(`Invalid URL source location: ${value}`);
          cancel();
          break;
      }
    },
    [cancel]
  );

  const handleUrlSelectionSubmit = useCallback(async () => {
    if (url.trim() === '') {
      return;
    }
    const corpusLocation = corpusToLocation(corpus);
    if (corpusLocation === undefined) {
      console.error('Corpus location is undefined');
      return;
    }
    const ragApiClient = createRagApiClient();
    await ragApiClient.ingestFiles(corpusLocation, [
      {
        location: {
          provider: 'url',
          url: url.trim(),
        },
      },
    ]);
    ingestQueueInfo?.pollIngestQueueStatus();
    setStep('complete');
  }, [url, corpus, ingestQueueInfo]);

  const handleUrlGoogleSheetSubmit = useCallback(async () => {
    if (!googleSheetName.trim() || !corpus || !corpusInfo) {
      return;
    }

    try {
      const authService = await getGoogleDriveAuthService();
      const driveService = new GoogleDriveService(authService);
      await driveService.initialize();

      const sheetFileId = await driveService.createGoogleSheet(
        googleSheetName.trim(),
        corpus.databaseLocation.parentFolderId
      );

      const urlCollection: UrlCollection = {
        provider: 'google_sheets',
        fileId: sheetFileId,
      };
      await corpusInfo.addUrlCollection(urlCollection);
      setUrlCollection(urlCollection);

      setStep('url_collection_complete');
    } catch (error) {
      console.error('Failed to create URL collection Google Sheet:', error);
    }
  }, [corpus, corpusInfo, googleSheetName, setUrlCollection]);

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
                  { label: 'URL', value: 'url' },
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
          {step === 'url_source_location' && (
            <Box sx={{ p: 2 }}>
              <Typography>Where would you like to manage your URLs?</Typography>
              <Typography variant="body2" color="text.secondary">
                You can mix and match if you want to. Choosing one type now will
                not prevent you from choosing the other type later.
              </Typography>
              <RadioButtonSelector
                values={[
                  { label: 'Research Lab', value: 'research_lab' },
                  { label: 'Google Sheet', value: 'google_sheet' },
                ]}
                onSubmit={handleUrlSourceLocationSubmit}
              />
            </Box>
          )}
          {step === 'url_selection' && (
            <Box sx={{ p: 2 }}>
              <Typography>
                Enter the URL of the source you want to add
              </Typography>
              <TextField
                fullWidth
                label="URL"
                value={url}
                onChange={e => setUrl(e.target.value)}
                sx={{ mt: 2 }}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUrlSelectionSubmit}
                  disabled={!url.trim()}
                >
                  Continue
                </Button>
              </Stack>
            </Box>
          )}
          {step === 'url_google_sheet_selection' && (
            <Box sx={{ p: 2 }}>
              <Typography>
                This will create a new Google Sheet in the Google Drive folder
                of the corpus.
              </Typography>
              <TextField
                fullWidth
                label="Google Sheet Name"
                value={googleSheetName}
                onChange={e => setGoogleSheetName(e.target.value)}
                sx={{ mt: 2 }}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUrlGoogleSheetSubmit}
                  disabled={!googleSheetName.trim()}
                >
                  Continue
                </Button>
              </Stack>
            </Box>
          )}
          {step === 'url_collection_complete' && (
            <Box sx={{ p: 2 }}>
              <Typography>URL collection created successfully!</Typography>
              <Typography color="text.secondary">
                Add URLs in the A column of your new Google Sheet and refresh it
                in the Sources panel to ingest them.
              </Typography>
              <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    window.open(
                      `https://docs.google.com/spreadsheets/d/${urlCollection?.fileId}/edit?gid=0#gid=0`,
                      '_blank'
                    );
                  }}
                >
                  Open Google Sheet
                </Button>
              </Stack>
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
