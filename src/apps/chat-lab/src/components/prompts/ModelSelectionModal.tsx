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
  InputAdornment
} from '@mui/material';
import {
  SmartToy as SmartToyIcon,
  Search as SearchIcon,
  Check as CheckIcon
} from '@mui/icons-material';

interface Model {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  description?: string;
}

interface ModelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

const availableModels: Model[] = [
  // Gemini Models
  {
    id: 'gemini-flash',
    name: 'Gemini Flash',
    provider: 'Google',
    maxTokens: 32768,
    description: 'Fast and efficient Gemini model for quick responses'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    maxTokens: 32768,
    description: 'Google\'s most capable AI model for complex tasks'
  },
  // Claude Models
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    provider: 'Anthropic',
    maxTokens: 200000,
    description: 'Fastest Claude model for quick responses'
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'Anthropic',
    maxTokens: 200000,
    description: 'Balanced Claude model for general use'
  },
  // ChatGPT Models
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    maxTokens: 16385,
    description: 'Fast and cost-effective model for simple tasks'
  },
  {
    id: 'gpt-4.0',
    name: 'GPT-4.0',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Standard GPT-4 model with strong reasoning capabilities'
  },
  {
    id: 'gpt-4.0-turbo',
    name: 'GPT-4.0 Turbo',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Fast and efficient GPT-4 model for most use cases'
  },
  {
    id: 'gpt-4.0-mini',
    name: 'GPT-4.0 Mini',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Compact GPT-4 model for cost-effective usage'
  },
  {
    id: 'gpt-5.0',
    name: 'GPT-5.0',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Latest GPT-5 model with advanced capabilities'
  },
  {
    id: 'gpt-5.0-mini',
    name: 'GPT-5.0 Mini',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Compact GPT-5 model for efficient processing'
  },
  {
    id: 'gpt-5.0-nano',
    name: 'GPT-5.0 Nano',
    provider: 'OpenAI',
    maxTokens: 128000,
    description: 'Ultra-compact GPT-5 model for minimal resource usage'
  }
];

export default function ModelSelectionModal({
  open,
  onClose,
  selectedModel,
  onSelectModel
}: ModelSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleModelSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'primary';
      case 'anthropic':
        return 'secondary';
      case 'google':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Select AI Model
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose the AI model for your conversation
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Search */}
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            placeholder="Search models..."
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

        {/* Models List */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredModels.map((model, index) => (
            <React.Fragment key={model.id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleModelSelect(model.id)}
                  selected={selectedModel === model.id}
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
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <SmartToyIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {model.name}
                        </Typography>
                        {selectedModel === model.id && (
                          <CheckIcon color="primary" fontSize="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {model.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={model.provider}
                            size="small"
                            color={getProviderColor(model.provider) as any}
                            variant="outlined"
                          />
                          <Chip
                            label={`${model.maxTokens.toLocaleString()} tokens`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < filteredModels.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {filteredModels.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No models match your search
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
