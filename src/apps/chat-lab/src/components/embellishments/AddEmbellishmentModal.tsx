import React, { useState } from 'react';
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
  Alert,
  InputAdornment
} from '@mui/material';
import type { Embellishment } from '../../types';

interface AddEmbellishmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (embellishment: Omit<Embellishment, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => void;
  loading?: boolean;
  error?: string | null;
}

const categoryOptions = [
  { value: 'style', label: 'Style' },
  { value: 'tone', label: 'Tone' },
  { value: 'format', label: 'Format' },
  { value: 'approach', label: 'Approach' }
];

const defaultColors = [
  '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#607D8B', '#795548',
  '#E91E63', '#00BCD4', '#8BC34A', '#FFC107', '#FF5722', '#3F51B5'
];

export default function AddEmbellishmentModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  error = null
}: AddEmbellishmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    instructions: '',
    category: 'style' as const,
    color: '#2196F3'
  });
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    instructions?: string;
  }>({});

  const validateForm = () => {
    const errors: { name?: string; instructions?: string } = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }
    
    if (!formData.instructions.trim()) {
      errors.instructions = 'Instructions are required';
    } else if (formData.instructions.trim().length < 10) {
      errors.instructions = 'Instructions must be at least 10 characters';
    } else if (formData.instructions.trim().length > 500) {
      errors.instructions = 'Instructions must be less than 500 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearValidationErrors = () => {
    setValidationErrors({});
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, name: e.target.value }));
    if (validationErrors.name) {
      clearValidationErrors();
    }
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, instructions: e.target.value }));
    if (validationErrors.instructions) {
      clearValidationErrors();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Sanitize the data before submitting
      const sanitizedData = {
        name: formData.name.trim(),
        instructions: formData.instructions.trim(),
        category: formData.category,
        color: formData.color
      };
      onSubmit(sanitizedData);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      instructions: '',
      category: 'style',
      color: '#2196F3'
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Add New Embellishment</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              fullWidth
              variant="outlined"
              value={formData.name}
              onChange={handleNameChange}
              required
              error={!!validationErrors.name}
              helperText={validationErrors.name}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Instructions"
              fullWidth
              variant="outlined"
              multiline
              rows={4}
              value={formData.instructions}
              onChange={handleInstructionsChange}
              required
              placeholder="Describe how this embellishment should modify prompts..."
              error={!!validationErrors.instructions}
              helperText={validationErrors.instructions}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              >
                {categoryOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {defaultColors.map(color => (
                  <Box
                    key={color}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    sx={{
                      width: 32,
                      height: 32,
                      backgroundColor: color,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: formData.color === color ? '3px solid #333' : '1px solid #ddd',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        transition: 'transform 0.2s'
                      }
                    }}
                  />
                ))}
              </Box>
              <TextField
                type="color"
                label="Custom Color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          backgroundColor: formData.color,
                          borderRadius: 0.5,
                          border: '1px solid #ddd'
                        }}
                      />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading || !formData.name.trim() || !formData.instructions.trim()}
          >
            {loading ? 'Creating...' : 'Create Embellishment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
