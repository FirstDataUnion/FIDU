import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import type { Context } from '../../types';
import { RESOURCE_TITLE_MAX_LENGTH } from '../../constants/resourceLimits';
import { truncateTitle } from '../../utils/stringUtils';

interface AddToContextDialogProps {
  open: boolean;
  onClose: () => void;
  /** Shown under the dialog title (e.g. conversation title or prompt-lab source label). */
  sourceSubtitle: string;
  dialogTitle?: string;
  introText?: string;
  selectedContextId: string;
  newContextTitle: string;
  contexts: Context[];
  isAdding: boolean;
  onContextIdChange: (contextId: string) => void;
  onNewContextTitleChange: (title: string) => void;
  onSubmit: () => void;
}

const AddToContextDialog: React.FC<AddToContextDialogProps> = React.memo(
  ({
    open,
    onClose,
    sourceSubtitle,
    dialogTitle = 'Add Conversation to Context',
    introText = 'Select a context to add this conversation to, or create a new one:',
    selectedContextId,
    newContextTitle,
    contexts,
    isAdding,
    onContextIdChange,
    onNewContextTitleChange,
    onSubmit,
  }) => {
    newContextTitle = truncateTitle(newContextTitle, RESOURCE_TITLE_MAX_LENGTH);

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogTitle}
          <Typography variant="body2" color="text.secondary">
            {sourceSubtitle}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {introText}
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="add-to-context-select-label">Context</InputLabel>
              <Select
                labelId="add-to-context-select-label"
                value={selectedContextId}
                label="Context"
                displayEmpty
                renderValue={selected => {
                  if (!selected) {
                    return 'Create New Context';
                  }
                  const ctx = contexts.find(c => c.id === selected);
                  return ctx
                    ? truncateTitle(ctx.title, RESOURCE_TITLE_MAX_LENGTH)
                    : selected;
                }}
                onChange={e => onContextIdChange(e.target.value)}
              >
                <MenuItem value="">
                  <em>Create New Context</em>
                </MenuItem>
                {contexts.map(context => (
                  <MenuItem key={context.id} value={context.id}>
                    {truncateTitle(context.title, RESOURCE_TITLE_MAX_LENGTH)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedContextId && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Selected Context:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {contexts.find(c => c.id === selectedContextId)?.body
                    || 'No description available'}
                </Typography>
              </Box>
            )}

            {!selectedContextId && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  New Context:
                </Typography>
                <TextField
                  fullWidth
                  label="Context Title"
                  value={newContextTitle}
                  onChange={e => onNewContextTitleChange(e.target.value)}
                  placeholder="Enter context title"
                  slotProps={{
                    htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH },
                  }}
                  helperText={`${newContextTitle.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  A new context will be created with the title above
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            Cancel
          </Button>
          <Button variant="contained" onClick={onSubmit} disabled={isAdding}>
            {isAdding ? 'Adding...' : 'Add to Context'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
);

AddToContextDialog.displayName = 'AddToContextDialog';

export default AddToContextDialog;
