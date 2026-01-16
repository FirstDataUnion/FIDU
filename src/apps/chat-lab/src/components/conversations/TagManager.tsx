import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import {
  isProtectedTag,
  getManageableTags,
  ensureProtectedTags,
} from '../../constants/protectedTags';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  editedTags: string[];
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  onSave: () => void;
}

const TagManager: React.FC<TagManagerProps> = React.memo(
  ({ open, onClose, editedTags, allTags, onTagsChange, onSave }) => {
    // Separate protected tags from manageable tags
    const protectedTags = editedTags.filter(isProtectedTag);
    const manageableTags = getManageableTags(editedTags);
    const manageableAllTags = getManageableTags(allTags);

    const handleTagsChange = (newManageableTags: string[]) => {
      // Always include protected tags when updating
      const newTags = ensureProtectedTags(newManageableTags);
      onTagsChange(newTags);
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Manage Tags</DialogTitle>
        <DialogContent>
          {/* Show protected tags as read-only chips */}
          {protectedTags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, color: 'text.secondary' }}
              >
                Protected Tags (cannot be removed):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {protectedTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{
                      opacity: 0.8,
                      '& .MuiChip-label': {
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Editable tags section */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Manageable Tags:
          </Typography>
          <Autocomplete
            multiple
            value={manageableTags}
            onChange={(_, newValue) => {
              handleTagsChange(newValue);
            }}
            options={manageableAllTags}
            getOptionLabel={option => option}
            renderInput={params => (
              <TextField {...params} label="Tags" placeholder="Add tags" />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </DialogActions>
      </Dialog>
    );
  }
);

TagManager.displayName = 'TagManager';

export default TagManager;
