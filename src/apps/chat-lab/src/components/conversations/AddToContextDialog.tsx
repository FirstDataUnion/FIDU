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
import type { Conversation, Context } from '../../types';
import { RESOURCE_TITLE_MAX_LENGTH } from '../../constants/resourceLimits';
import { truncateTitle } from '../../utils/stringUtils';

interface AddToContextDialogProps {
  open: boolean;
  onClose: () => void;
  selectedConversation: Conversation | null;
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
    selectedConversation,
    selectedContextId,
    newContextTitle,
    contexts,
    isAdding,
    onContextIdChange,
    onNewContextTitleChange,
    onSubmit,
  }) => {
    if (!selectedConversation) return null;
    newContextTitle = truncateTitle(newContextTitle, RESOURCE_TITLE_MAX_LENGTH);

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Add Conversation to Context
          <Typography variant="body2" color="text.secondary">
            {selectedConversation.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Select a context to add this conversation to, or create a new one:
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Context</InputLabel>
              <Select
                value={selectedContextId}
                label="Select Context"
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
          <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
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
