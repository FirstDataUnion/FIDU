import {
  Box,
  ListItemText,
  ListItem,
  List,
  Paper,
  Typography,
  Stack,
  ListItemButton,
  Button,
  IconButton,
} from '@mui/material';
import type { Corpus } from '../types/local';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  CreateCorpusPanel,
  type CreateCorpusFormState,
} from '../components/CreateCorpusPanel';
import { createRagApiClient } from '../services/apiClientRag';
import type { FileLocation } from '../types/ragApi';
import { getStorageService } from '../../services/storage/StorageService';
import { useAppSelector } from '../../store';
import { GoogleDriveService } from '../../services/storage/drive/GoogleDriveService';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';

function formatDateTime(dateTime: string) {
  return new Date(dateTime).toLocaleString();
}

function withParentFolderId(
  location: { provider: 'google_drive'; fileId: string },
  parentFolderId: string
): { provider: 'google_drive'; fileId: string; parentFolderId: string };
function withParentFolderId<L extends { provider: string }>(
  location: L,
  _parentFolderId: string
): L;
function withParentFolderId<L extends { provider: string }>(
  location: L,
  parentFolderId: string
) {
  if (location.provider === 'google_drive') {
    return { ...location, parentFolderId };
  }
  return location;
}

async function createNewFolder(name: string, parentFolderId?: string) {
  const googleDriveAuthService = await getGoogleDriveAuthService();
  const googleDriveService = new GoogleDriveService(googleDriveAuthService);
  const newFolderId = await googleDriveService.createFolder(
    name,
    parentFolderId
  );
  return newFolderId;
}

export default function ResearchLabPage() {
  const { currentProfile } = useAppSelector(state => state.auth);
  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [createCorpusDialogOpen, setCreateCorpusDialogOpen] = useState(false);
  const [creatingCorpus, setCreatingCorpus] = useState(false);
  const [corpusCreationError, setCorpusCreationError] = useState<string | null>(
    null
  );
  const reloadCorpora = useCallback(async () => {
    const profileId = currentProfile?.id;
    if (!profileId) {
      return;
    }
    const list = await getStorageService().getAdapter().getCorpora(profileId);
    setCorpora(list);
  }, [currentProfile?.id]);

  useEffect(() => {
    void reloadCorpora();
  }, [reloadCorpora]);

  const handleDeleteCorpus = useCallback(
    async (corpus: Corpus) => {
      const ragApiClient = createRagApiClient();
      await ragApiClient.deleteCorpus({
        provider: 'fidu_rag',
        engine: 'cortexdb',
        database_file_location: {
          provider: 'google_drive',
          file_id: corpus.databaseLocation.fileId,
        },
      });
      try {
        await getStorageService().getAdapter().deleteCorpus(corpus.id);
        await reloadCorpora();
      } catch (error) {
        console.error('Error deleting corpus:', error);
      }
    },
    [reloadCorpora]
  );

  async function createCorpus(form: CreateCorpusFormState) {
    if (!currentProfile?.id) {
      throw new Error(
        'No profile selected. Please select a profile to continue.'
      );
    }
    let parent: FileLocation;
    switch (form.folderOption) {
      case 'root':
        parent = {
          provider: 'google_drive',
          file_id: 'root',
        };
        break;
      case 'existing':
        if (!form.pickerFolder?.id) {
          throw new Error(
            'Picker folder ID is required for "existing" folder option'
          );
        }
        parent = {
          provider: 'google_drive',
          file_id: form.pickerFolder?.id,
        };
        break;
      case 'new':
        if (!form.newFolderName) {
          throw new Error(
            'New folder name is required for "new" folder option'
          );
        }
        parent = {
          provider: 'google_drive',
          file_id: await createNewFolder(
            form.newFolderName,
            form.pickerFolder?.id
          ),
        };
        break;
      default:
        throw new Error(`Invalid folder option: ${form.folderOption}`);
    }

    const location = await createRagApiClient().initialiseCorpus({
      provider: 'fidu_rag',
      engine: 'cortexdb',
      name: form.fileName,
      parent,
    });

    const databaseLocation = withParentFolderId(location, parent.file_id);

    const storageService = getStorageService();
    const corpus = await storageService.getAdapter().createCorpus(
      {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description,
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        databaseLocation,
        urlCollections: [],
        tags: [],
      },
      currentProfile.id
    );
    return corpus;
  }

  async function handleCreateCorpus(form: CreateCorpusFormState) {
    try {
      setCreatingCorpus(true);
      const newCorpus = await createCorpus(form);
      setCorpora(prev => [...prev, newCorpus]);
      setCreateCorpusDialogOpen(false);
    } catch (error) {
      console.error('Error creating corpus:', error);
      setCorpusCreationError(
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    } finally {
      setCreatingCorpus(false);
    }
  }

  return (
    <>
      <Box>
        <Typography variant="h4">Research Lab</Typography>
        <Typography variant="body1">
          Welcome to the Research Lab! This is the place to go when you want to
          work with many or large documents. Please choose a corpus below or
          create a new one to get started.
        </Typography>
      </Box>
      {!createCorpusDialogOpen && (
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Typography variant="h5">Corpora</Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setCreateCorpusDialogOpen(true)}
            >
              Create Corpus
            </Button>
          </Stack>
          <List>
            {corpora.map(corpus => (
              <ListItem
                key={corpus.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="Delete corpus"
                    color="error"
                    onClick={() => {
                      void handleDeleteCorpus(corpus);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemButton
                  component={RouterLink}
                  to={`corpora/${corpus.id}`}
                >
                  <Paper sx={{ p: 2, width: '100%' }}>
                    <Stack
                      direction="row"
                      justifyContent="space-evenly"
                      spacing={2}
                    >
                      <ListItemText
                        primary={corpus.name}
                        secondary={corpus.description}
                      />
                      <Stack direction="row" spacing={2}>
                        <ListItemText
                          primary={formatDateTime(corpus.createdAt)}
                          secondary="Created at"
                        />
                        <ListItemText
                          primary={formatDateTime(corpus.lastOpenedAt)}
                          secondary="Last opened at"
                        />
                      </Stack>
                    </Stack>
                  </Paper>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {createCorpusDialogOpen && (
        <CreateCorpusPanel
          creating={creatingCorpus}
          error={corpusCreationError}
          onCancel={() => setCreateCorpusDialogOpen(false)}
          onSubmitClean={handleCreateCorpus}
        />
      )}
    </>
  );
}
