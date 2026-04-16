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
} from '@mui/material';
import type { Corpus } from '../types/local';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
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
  useEffect(() => {
    const profileId = currentProfile?.id;
    if (!profileId) {
      return;
    }
    const storageService = getStorageService();
    storageService.getAdapter().getCorpora(profileId).then(setCorpora);
  }, [currentProfile?.id]);

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

    const storageService = getStorageService();
    const corpus = await storageService.getAdapter().createCorpus(
      {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description,
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        databaseLocation: location,
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
              <ListItem key={corpus.id}>
                <ListItemButton
                  component={RouterLink}
                  to={`corpora/${corpus.id}`}
                >
                  <Paper sx={{ p: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-evenly"
                      spacing={2}
                    >
                      <ListItemText
                        primary={corpus.name}
                        secondary={corpus.description}
                      />
                      <ListItemText
                        primary={formatDateTime(corpus.createdAt)}
                        secondary="Created at"
                      />
                      <ListItemText
                        primary={formatDateTime(corpus.lastOpenedAt)}
                        secondary="Last opened at"
                      />
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
