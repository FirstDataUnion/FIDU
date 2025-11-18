import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { RESOURCE_TITLE_MAX_LENGTH } from '../../constants/resourceLimits';

export interface DocumentEditDialogProps {
  open: boolean;
  onClose: (document?: { id: string; title: string; content: string }) => void;
  initialDocument?: { id?: string; title: string; content: string };
  onCreate: (document: { title: string; content: string }) => Promise<{ id: string; title: string; content: string }>;
  onUpdate: (documentId: string, document: { title: string; content: string }) => Promise<{ id: string; title: string; content: string }>;
  onDelete?: (documentId: string) => Promise<void>;
  closeOnSave?: boolean;
}

export default function DocumentEditDialog({
  open,
  onClose,
  initialDocument,
  onCreate,
  onUpdate,
  onDelete,
  closeOnSave = true,
}: DocumentEditDialogProps) {
  // Internal state for document ID (manages create-to-edit transition)
  const [documentId, setDocumentId] = useState<string | undefined>(initialDocument?.id);
  
  // Form state
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Initialize form when dialog opens or initialDocument changes
  useEffect(() => {
    if (open) {
      setDocumentId(initialDocument?.id);
      setTitle(initialDocument?.title || '');
      setContent(initialDocument?.content || '');
      setIsSaved(false);
    }
  }, [open, initialDocument]);

  useEffect(() => {
    setIsSaved(false);
  }, [title, content]);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setIsSaving(true);
    try {
      const documentData = { title: title.trim(), content: content.trim() };
      let savedDocument;
      
      if (documentId) {
        // Update existing document
        savedDocument = await onUpdate(documentId, documentData);
      } else {
        // Create new document
        savedDocument = await onCreate(documentData);
        // Update internal document ID after creation (transition to edit mode)
        setDocumentId(savedDocument.id);
      }
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setIsSaving(false);
      setIsSaved(true);
      if (closeOnSave) {
        onClose();
      }
    }
  };

  const handleDelete = async () => {
    if (!documentId || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(documentId);
      setDeleteDialogOpen(false);
      onClose(); // Close dialog after deletion
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    // If document was created/updated, pass it to onClose
    if (documentId) {
      onClose({ id: documentId, title, content });
    } else {
      onClose();
    }
  };

  const isEditMode = !!documentId;
  const dialogTitle = isEditMode ? 'View/Edit Document' : 'Create New Document';

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          {dialogTitle} {isSaved && (
              <Box component="span" sx={{ color: "warning.main" }}>- Saved!</Box>
          )}
          {isEditMode && (
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Document Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              slotProps={{ htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH } }}
              helperText={`${title.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Document Content"
              multiline
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
            {isEditMode && onDelete && (
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                color="error"
                variant="outlined"
                size="small"
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleClose} sx={{ color: 'primary.dark' }}>
              Close
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Document'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the document "{title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

