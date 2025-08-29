import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
} from '@mui/material';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  editedTags: string[];
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  onSave: () => void;
}

const TagManager: React.FC<TagManagerProps> = React.memo(({
  open,
  onClose,
  editedTags,
  allTags,
  onTagsChange,
  onSave,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Manage Tags
      </DialogTitle>
      <DialogContent>
        <Autocomplete
          multiple
          value={editedTags}
          onChange={(_, newValue) => {
            onTagsChange(newValue);
          }}
          options={allTags}
          getOptionLabel={(option) => option}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Tags"
              placeholder="Add tags"
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
});

TagManager.displayName = 'TagManager';

export default TagManager;
