import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon
} from '@mui/icons-material';
import { usePromptText } from '../../hooks/usePromptText';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export const PromptInput = React.memo<PromptInputProps>(({ 
  value, 
  onChange, 
  onSave
}) => {
  const {
    value: localValue,
    onChange: handleLocalChange,
    onBlur: handleLocalBlur
  } = usePromptText({
    initialValue: value,
    debounceMs: 200, // Even faster debounce for better responsiveness
    onDebouncedChange: onChange
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleLocalChange(e.target.value);
  }, [handleLocalChange]);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Your Prompt
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={8}
        placeholder="Enter your prompt here..."
        value={localValue}
        onChange={handleChange}
        variant="outlined"
        sx={{ 
          '& .MuiOutlinedInput-root': {
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }
        }}
        onBlur={handleLocalBlur}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={onSave}>
            Save Prompt
          </Button>
        </Stack>
      </Box>
    </Box>
  );
});

PromptInput.displayName = 'PromptInput'; 