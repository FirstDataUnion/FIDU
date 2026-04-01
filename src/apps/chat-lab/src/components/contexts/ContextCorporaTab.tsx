import {
  Box,
  Button,
  Typography,
  Paper,
  ListItemText,
  ListItem,
  List,
  ListItemButton,
  Stack,
  DialogContent,
  Dialog,
  DialogTitle,
  DialogActions,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useCallback, useEffect, useState } from 'react';
import NewContextCorpusDialog from './NewContextCorpusDialog';
import type { Context, ContextCorpus } from '../../types';
import { createRagApiClient } from '../../services/api/apiClientRag';
import { deleteContextCorpus } from '../../store/slices/contextsSlice';
import { useAppDispatch } from '../../store';

export default function ContextCorporaTab({
  corpora,
  contexts,
}: {
  corpora: ContextCorpus[];
  contexts: Context[];
}) {
  const dispatch = useAppDispatch();
  const [newContextCorpusDialogOpen, setNewContextCorpusDialogOpen] =
    useState(false);

  const [selectedCorpus, setSelectedCorpus] = useState<ContextCorpus | null>(
    null
  );
  const [corpusToDelete, setCorpusToDelete] = useState<ContextCorpus | null>(
    null
  );
  const [documents, setDocuments] = useState<{
    [contextId: string]: Context;
  }>({});
  const [urls, setUrls] = useState<{ [contextId: string]: Context }>({});

  useEffect(() => {
    setDocuments(
      Object.fromEntries(
        contexts
          .filter(context => context.source.type !== 'url')
          .map(context => [context.id, context])
      )
    );
    setUrls(
      Object.fromEntries(
        contexts
          .filter(context => context.source.type === 'url')
          .map(context => [context.id, context])
      )
    );
    setUrls(
      Object.fromEntries(
        contexts
          .filter(context => context.source.type === 'url')
          .map(context => [context.id, context])
      )
    );
    setUrls(
      Object.fromEntries(
        contexts
          .filter(context => context.source.type === 'url')
          .map(context => [context.id, context])
      )
    );
  }, [contexts]);

  const handleOpenNewCorpusDialog = useCallback(() => {
    setNewContextCorpusDialogOpen(true);
  }, []);

  const handleAskDeleteCorpus = useCallback((corpus: ContextCorpus) => {
    setCorpusToDelete(corpus);
  }, []);

  const handleDeleteCorpus = useCallback(
    async (corpus: ContextCorpus) => {
      if (!corpus) return;
      if (corpus.database.location.type !== 'google_drive') {
        throw new Error(
          'Deletion only implemented for Google-Drive-stored corpora'
        );
      }
      const ragApiClient = createRagApiClient();
      await ragApiClient.deleteCorpus({
        provider: 'fidu_rag',
        engine: corpus.database.type,
        location: {
          provider: 'google_drive',
          fileId: corpus.database.location.fileId,
        },
      });

      try {
        await dispatch(deleteContextCorpus(corpus.id)).unwrap();
      } catch (error) {
        console.error('Error deleting corpus:', error);
        throw error;
      }

      setCorpusToDelete(null);
      if (selectedCorpus?.id === corpus.id) {
        setSelectedCorpus(null);
      }
    },
    [dispatch, selectedCorpus?.id]
  );

  return (
    <Box>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => {
          handleOpenNewCorpusDialog();
        }}
      >
        Add New
      </Button>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px 1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Corpora
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a corpus to expand contained documents and URLs.
          </Typography>
          <List disablePadding>
            {corpora.map(corpus => (
              <ListItem key={corpus.id} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={selectedCorpus?.id === corpus.id}
                  onClick={() => setSelectedCorpus(corpus)}
                  sx={{
                    borderRadius: 1,
                    border: theme => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <ListItemText
                    primary={corpus.name}
                    secondary={
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {`${corpus.documents.length} docs • ${corpus.urls.length} urls`}
                        </Typography>
                      </Stack>
                    }
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleAskDeleteCorpus(corpus)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          {selectedCorpus ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {selectedCorpus.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedCorpus.description}
              </Typography>

              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Documents
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {selectedCorpus.documents.map(({ id, addedAt }) => {
                  const document = documents[id];
                  return (
                    <Paper key={document.id} variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {document.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Added {new Date(addedAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  );
                })}
              </Stack>

              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                URLs
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {selectedCorpus.urls.map(({ id, addedAt }) => {
                  const url = urls[id];
                  return (
                    <Paper key={url.id} variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {url.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Added {new Date(addedAt).toLocaleString()}
                      </Typography>
                    </Paper>
                  );
                })}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a corpus to expand contained documents and URLs.
            </Typography>
          )}
        </Paper>
      </Box>

      <NewContextCorpusDialog
        open={newContextCorpusDialogOpen}
        onClose={() => setNewContextCorpusDialogOpen(false)}
      />
      {corpusToDelete && (
        <Dialog open={true} onClose={() => setCorpusToDelete(null)}>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the corpus "{corpusToDelete?.name}
              "?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCorpusToDelete(null)}>Cancel</Button>
            <Button
              onClick={() => handleDeleteCorpus(corpusToDelete)}
              color="error"
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
