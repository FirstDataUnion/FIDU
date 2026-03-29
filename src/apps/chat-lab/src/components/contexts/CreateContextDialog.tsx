import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

import { RESOURCE_TITLE_MAX_LENGTH } from '../../constants/resourceLimits';
import type { ContextFormData } from '../../types/contexts';

export interface CreateContextFormFieldsProps {
  form: ContextFormData;
  onFormChange: (form: ContextFormData) => void;
  /** Opens conversation picker to append messages into the body */
  onAddConversation?: () => void;
}

/**
 * Title + body fields and optional “add conversation” action.
 * Use inside a wizard or other container, or via {@link CreateContextDialog}.
 */
export function CreateContextFormFields({
  form,
  onFormChange,
  onAddConversation,
}: CreateContextFormFieldsProps) {
  return (
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
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Context Body"
        multiline
        rows={4}
        value={form.body}
        onChange={e => onFormChange({ ...form, body: e.target.value })}
        sx={{ mb: 2 }}
      />
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
    </Box>
  );
}

export interface CreateContextDialogProps {
  open: boolean;
  form: ContextFormData;
  isCreating: boolean;
  onClose: () => void;
  onFormChange: (form: ContextFormData) => void;
  onCreate: () => void;
  onAddConversation?: () => void;
}

export default function CreateContextDialog({
  open,
  form,
  isCreating,
  onClose,
  onFormChange,
  onCreate,
  onAddConversation,
}: CreateContextDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Context</DialogTitle>
      <DialogContent>
        <CreateContextFormFields
          form={form}
          onFormChange={onFormChange}
          onAddConversation={onAddConversation}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onCreate}
          disabled={isCreating || !form.title.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Context'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
