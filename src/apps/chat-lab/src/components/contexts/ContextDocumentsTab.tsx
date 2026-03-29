import {
  Box,
  Button,
  ListItem,
  List,
  Paper,
  ListItemText,
  Stack,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { deleteContext, fetchContexts, updateContext } from '../../store/slices/contextsSlice';
import type { Context, ContextSource } from '../../types';
import type { ViewEditFormData } from '../../types/contexts';
import ViewEditContextDialog from './ViewEditContextDialog';
import NewContextDocumentDialog from './NewContextDocumentDialog';

function SourceChip({ source }: { source: ContextSource }) {
  if (source.type === 'url') {
    console.warn("Trying to display URL source as Document", {source});
    return null;
  }
  const label = {
    fidu: 'FIDU',
    google_drive: 'Google Drive',
  }[source.type];
  const title = {
    fidu: 'Stored in your FIDU Vault - managed within ChatLab',
    google_drive: 'Stored in your Google Drive',
  }[source.type];
  // TODO: Add onClick depending on source - edit locally or open externally
  return (
    <Tooltip title={title}>
      <Chip size="small" label={label} color="primary" />
    </Tooltip>
  );
}

function MimeTypeChip({ mimeType }: { mimeType: string }) {
  const niceNames: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/markdown': 'Markdown',
  };
  if (niceNames[mimeType]) {
    return (
      <Tooltip title={mimeType}>
        <Chip size="small" label={niceNames[mimeType]} color="secondary" />
      </Tooltip>
    );
  }
  return <Chip size="small" label={mimeType} />;
}

function ViewEditButton({
  context,
  handleOpenViewEditDialog,
}: {
  context: Context;
  handleOpenViewEditDialog: (context: Context) => void;
}) {
  if (context.source.type === 'fidu') {
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={() => handleOpenViewEditDialog(context)}
      >
        View/Edit
      </Button>
    );
  }
  if (context.source.type === 'google_drive') {
    const externalUrl = `https://drive.google.com/file/d/${context.source.fileId}/view`;
    return (
      <IconButton
        onClick={() => window.open(externalUrl, '_blank', 'noopener')}
        aria-label="Open in Google Drive"
      >
        <OpenInNewIcon />
      </IconButton>
    );
  }
  return null;
}

export default function ContextDocumentsTab({
  contexts,
}: {
  contexts: Context[];
}) {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector(state => state.auth);
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [viewEditForm, setViewEditForm] = useState<ViewEditFormData>({
    title: '',
    body: '',
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [newContextDocumentDialogOpen, setNewContextDocumentDialogOpen] = useState(false);

  const handleOpenViewEditDialog = useCallback((context: Context) => {
    setSelectedContext(context);
    setViewEditForm({
      title: context.title || '',
      body: context.body || '',
    });
    setViewEditDialogOpen(true);
  }, []);

  const handleCloseViewEditDialog = useCallback(() => {
    setViewEditDialogOpen(false);
    setSelectedContext(null);
  }, []);

  const handleViewEditSubmit = useCallback(async () => {
    if (
      !selectedContext
      || !currentProfile?.id
      || !viewEditForm.title
      || !viewEditForm.body
    ) {
      return;
    }

    setIsEditSaving(true);
    try {
      await dispatch(
        updateContext({
          context: {
            id: selectedContext.id,
            title: viewEditForm.title.trim(),
            body: viewEditForm.body.trim(),
          },
          profileId: currentProfile.id,
        })
      ).unwrap();

      setViewEditDialogOpen(false);
      setSelectedContext(null);
      setViewEditForm({ title: '', body: '' });
    } catch (submitError) {
      console.error('Error updating context:', submitError);
    } finally {
      setIsEditSaving(false);
    }
  }, [dispatch, currentProfile?.id, selectedContext, viewEditForm]);

  const handleDeleteContextFromEdit = useCallback(async () => {
    if (!selectedContext) return;

    try {
      await dispatch(deleteContext(selectedContext.id)).unwrap();
      setViewEditDialogOpen(false);
      setSelectedContext(null);
      setViewEditForm({ title: '', body: '' });
      await dispatch(fetchContexts(currentProfile?.id));
    } catch (deleteError) {
      console.error('Error deleting context:', deleteError);
    }
  }, [currentProfile?.id, dispatch, selectedContext]);

  const handleDeleteContextFromList = useCallback(async (context: Context) => {
    if (!context) return;
    try {
      await dispatch(deleteContext(context.id)).unwrap();
      await dispatch(fetchContexts(currentProfile?.id));
    } catch (deleteError) {
      console.error('Error deleting context:', deleteError);
    }
  }, [currentProfile?.id, dispatch]);

  const handleAddNewContext = useCallback(() => {
    setNewContextDocumentDialogOpen(true);
  }, []);

  const handleCloseNewContextDocumentDialog = useCallback(() => {
    setNewContextDocumentDialogOpen(false);
  }, []);

  return (
    <Box>

      <Button variant="outlined" color="primary" onClick={() => {
        handleAddNewContext();
      }}>
        Add New
      </Button>

      {contexts.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
          <List disablePadding>
            {contexts.map(context => (
              <ListItem
                key={context.id}
                secondaryAction={
                  <>
                  <ViewEditButton
                    context={context}
                    handleOpenViewEditDialog={handleOpenViewEditDialog}
                  />
                  <IconButton
                    onClick={() => handleDeleteContextFromList(context)}
                    aria-label="Delete context"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                  </>
                }
              >
                <ListItemText
                  primary={context.title}
                  secondary={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mt: 0.5, flexWrap: 'wrap' }}
                    >
                      <SourceChip source={context.source} />
                      {context.source?.mimeType && (
                        <MimeTypeChip mimeType={context.source.mimeType} />
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <ViewEditContextDialog
        open={viewEditDialogOpen}
        selectedContext={selectedContext}
        form={viewEditForm}
        isSaving={isEditSaving}
        onClose={handleCloseViewEditDialog}
        onFormChange={setViewEditForm}
        onSave={handleViewEditSubmit}
        onDelete={handleDeleteContextFromEdit}
      />

      <NewContextDocumentDialog
        open={newContextDocumentDialogOpen}
        onClose={handleCloseNewContextDocumentDialog}
      />
    </Box>
  );
}
