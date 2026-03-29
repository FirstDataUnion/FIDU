import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import type { Context } from '../../types';
import { RESOURCE_TITLE_MAX_LENGTH } from '../../constants/resourceLimits';
import type { ViewEditFormData } from '../../types/contexts';

interface ViewEditContextDialogProps {
  open: boolean;
  selectedContext: Context | null;
  form: ViewEditFormData;
  isSaving: boolean;
  onClose: () => void;
  onFormChange: (form: ViewEditFormData) => void;
  onSave: () => void;
  onDelete: () => void;
  onAddConversation?: () => void;
}

export default function ViewEditContextDialog({
  open,
  selectedContext,
  form,
  isSaving,
  onClose,
  onFormChange,
  onSave,
  onDelete,
  onAddConversation,
}: ViewEditContextDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDeleteDialogOpen(false);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedContext?.isBuiltIn ? 'View Context' : 'View/Edit Context'}
          <Typography variant="body2" color="text.secondary">
            {selectedContext?.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={form.title}
              onChange={e => onFormChange({ ...form, title: e.target.value })}
              slotProps={{
                htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH },
              }}
              helperText={`${form.title.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
              disabled={selectedContext?.isBuiltIn}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Content"
              multiline
              rows={12}
              value={form.body}
              onChange={e => onFormChange({ ...form, body: e.target.value })}
              disabled={selectedContext?.isBuiltIn}
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
            {!selectedContext?.isBuiltIn && (
              <>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  color="error"
                  variant="outlined"
                  size="small"
                >
                  Delete
                </Button>
                {onAddConversation && (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={onAddConversation}
                    sx={{
                      borderColor: 'primary.dark',
                      color: 'primary.dark',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white',
                        borderColor: 'primary.dark',
                      },
                    }}
                  >
                    Add Existing Conversation to Context
                  </Button>
                )}
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
              Close
            </Button>
            {!selectedContext?.isBuiltIn && (
              <Button
                variant="contained"
                onClick={onSave}
                disabled={isSaving || !form.title.trim() || !form.body.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the context "{selectedContext?.title}"?
            {' '}This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
