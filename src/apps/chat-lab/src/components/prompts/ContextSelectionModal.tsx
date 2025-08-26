import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  Box,
  Divider,
  TextField,
  InputAdornment,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface Context {
  id: string;
  title: string;
  description: string;
  type: 'reference' | 'knowledge' | 'custom';
  tokenCount: number;
  tags?: string[];
}

interface ContextSelectionModalProps {
  open: boolean;
  onClose: () => void;
  selectedContext: Context | null;
  onSelectContext: (context: Context | null) => void;
}

// Mock contexts - in a real app, these would come from the backend
const availableContexts: Context[] = [
  {
    id: 'ctx-react-best-practices',
    title: 'React Best Practices',
    description: 'Component patterns, hooks usage, and performance optimization guidelines for React development',
    type: 'reference',
    tokenCount: 1200,
    tags: ['react', 'frontend', 'best-practices']
  },
  {
    id: 'ctx-typescript-advanced',
    title: 'TypeScript Advanced Patterns',
    description: 'Advanced type definitions, generics, and compiler configurations for TypeScript',
    type: 'knowledge',
    tokenCount: 800,
    tags: ['typescript', 'types', 'advanced']
  },
  {
    id: 'ctx-python-data-science',
    title: 'Python Data Science',
    description: 'Pandas, NumPy, and scikit-learn workflows for data analysis and machine learning',
    type: 'reference',
    tokenCount: 1500,
    tags: ['python', 'data-science', 'ml']
  },
  {
    id: 'ctx-system-design',
    title: 'System Design Principles',
    description: 'Scalable architecture patterns, microservices, and distributed systems design',
    type: 'knowledge',
    tokenCount: 2000,
    tags: ['architecture', 'system-design', 'scalability']
  },
  {
    id: 'ctx-ai-ethics',
    title: 'AI Ethics Guidelines',
    description: 'Responsible AI development, bias detection, and ethical considerations in machine learning',
    type: 'reference',
    tokenCount: 900,
    tags: ['ai', 'ethics', 'responsible-ai']
  }
];

export default function ContextSelectionModal({
  open,
  onClose,
  selectedContext,
  onSelectContext
}: ContextSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContexts = availableContexts.filter(context =>
    context.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    context.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    context.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleContextSelect = (context: Context | null) => {
    onSelectContext(context);
    onClose();
  };

  const handleRemoveContext = () => {
    onSelectContext(null);
    onClose();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reference':
        return 'primary';
      case 'knowledge':
        return 'secondary';
      case 'custom':
        return 'success';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reference':
        return '📚';
      case 'knowledge':
        return '🧠';
      case 'custom':
        return '⚙️';
      default:
        return '📋';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Select Context
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose context to enhance your AI conversation with relevant information
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Search */}
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            placeholder="Search contexts by title, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            size="small"
          />
        </Box>

        <Divider />

        {/* Current Selection */}
        {selectedContext && (
          <Box sx={{ p: 2, backgroundColor: 'primary.light', m: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Currently Selected:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={selectedContext.title}
                color="primary"
                variant="filled"
                size="small"
              />
              <Chip
                label={`${selectedContext.tokenCount} tokens`}
                size="small"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedContext.description}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={handleRemoveContext}
              startIcon={<CheckIcon />}
            >
              Remove Context
            </Button>
          </Box>
        )}

        <Divider />

        {/* Contexts List */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredContexts.map((context, index) => (
            <React.Fragment key={context.id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleContextSelect(context)}
                  selected={selectedContext?.id === context.id}
                  sx={{
                    py: 2,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      }
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'background.paper', fontSize: '1.2rem' }}>
                      {getTypeIcon(context.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {context.title}
                        </Typography>
                        {selectedContext?.id === context.id && (
                          <CheckIcon color="primary" fontSize="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {context.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Chip
                            label={context.type}
                            size="small"
                            color={getTypeColor(context.type) as any}
                            variant="outlined"
                          />
                          <Chip
                            label={`${context.tokenCount} tokens`}
                            size="small"
                            variant="outlined"
                          />
                          {context.tags && context.tags.map(tag => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < filteredContexts.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {filteredContexts.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No contexts match your search
            </Typography>
          </Box>
        )}

        {/* Placeholder for future context creation */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Alert severity="info" icon={<AddIcon />}>
            <Typography variant="body2">
              Context creation feature coming soon. You'll be able to create custom contexts from your documents and knowledge base.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
