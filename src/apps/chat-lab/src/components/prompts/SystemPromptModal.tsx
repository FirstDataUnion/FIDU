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
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Star as StarIcon,
  Favorite as FavoriteIcon
} from '@mui/icons-material';

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  category: 'default' | 'professional' | 'creative' | 'educational' | 'custom';
  description: string;
  isFavorite?: boolean;
}

interface SystemPromptModalProps {
  open: boolean;
  onClose: () => void;
  selectedPrompt: string;
  onSelectPrompt: (promptName: string) => void;
}

// Mock system prompts - in a real app, these would come from the backend
const availableSystemPrompts: SystemPrompt[] = [
  {
    id: 'default',
    name: 'Default',
    content: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
    category: 'default',
    description: 'Standard helpful assistant behavior'
  },
  {
    id: 'sassy',
    name: 'Sassy',
    content: 'You are a witty, slightly sarcastic AI assistant. Be helpful but add some personality and humor to your responses.',
    category: 'creative',
    description: 'Witty and humorous responses with personality'
  },
  {
    id: 'professional',
    name: 'Professional',
    content: 'You are a professional AI consultant. Provide formal, well-structured responses suitable for business contexts.',
    category: 'professional',
    description: 'Formal and business-appropriate responses'
  },
  {
    id: 'teacher',
    name: 'Teacher',
    content: 'You are a patient and encouraging teacher. Explain concepts clearly, provide examples, and ask follow-up questions to ensure understanding.',
    category: 'educational',
    description: 'Educational approach with examples and follow-ups'
  },
  {
    id: 'creative',
    name: 'Creative',
    content: 'You are a creative AI assistant. Think outside the box, suggest innovative solutions, and encourage creative thinking.',
    category: 'creative',
    description: 'Innovative and creative problem-solving approach'
  },
  {
    id: 'analytical',
    name: 'Analytical',
    content: 'You are an analytical AI assistant. Break down complex problems, provide detailed analysis, and consider multiple perspectives.',
    category: 'professional',
    description: 'Detailed analysis and systematic problem-solving'
  },
  {
    id: 'friendly',
    name: 'Friendly',
    content: 'You are a warm and friendly AI assistant. Be approachable, supportive, and conversational in your responses.',
    category: 'default',
    description: 'Warm and approachable communication style'
  },
  {
    id: 'concise',
    name: 'Concise',
    content: 'You are a concise AI assistant. Provide brief, to-the-point responses without unnecessary elaboration.',
    category: 'professional',
    description: 'Brief and direct responses'
  }
];



export default function SystemPromptModal({
  open,
  onClose,
  selectedPrompt,
  onSelectPrompt
}: SystemPromptModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const categories = [
    { key: 0, label: 'All', value: 'all' },
    { key: 1, label: 'Default', value: 'default' },
    { key: 2, label: 'Professional', value: 'professional' },
    { key: 3, label: 'Creative', value: 'creative' },
    { key: 4, label: 'Educational', value: 'educational' }
  ];

  const filteredPrompts = availableSystemPrompts.filter(prompt => {
    const matchesSearch = prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prompt.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 0) return matchesSearch; // All tab
    return matchesSearch && prompt.category === categories[activeTab].value;
  });

  const handlePromptSelect = (promptName: string) => {
    onSelectPrompt(promptName);
    onClose();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'default':
        return '🤖';
      case 'professional':
        return '💼';
      case 'creative':
        return '🎨';
      case 'educational':
        return '📚';
      case 'custom':
        return '⚙️';
      default:
        return '📋';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'default':
        return 'primary';
      case 'professional':
        return 'success';
      case 'creative':
        return 'secondary';
      case 'educational':
        return 'info';
      case 'custom':
        return 'warning';
      default:
        return 'default';
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
          Select System Prompt
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose how the AI should behave and respond to your messages
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Search */}
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            placeholder="Search system prompts..."
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

        {/* Category Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {categories.map((category) => (
              <Tab 
                key={category.key}
                label={category.label}
                sx={{ minWidth: 'auto', px: 2 }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Current Selection */}
        {selectedPrompt && (
          <Box sx={{ p: 2, backgroundColor: 'primary.light', m: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Currently Selected:
            </Typography>
            <Chip
              label={selectedPrompt}
              color="primary"
              variant="filled"
              size="small"
            />
          </Box>
        )}

        <Divider />

        {/* Prompts List */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredPrompts.map((prompt, index) => (
            <React.Fragment key={prompt.id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handlePromptSelect(prompt.name)}
                  selected={selectedPrompt === prompt.name}
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
                      {getCategoryIcon(prompt.category)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {prompt.name}
                        </Typography>
                        {prompt.isFavorite && (
                          <FavoriteIcon color="error" fontSize="small" />
                        )}
                        {selectedPrompt === prompt.name && (
                          <CheckIcon color="primary" fontSize="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {prompt.description}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            backgroundColor: 'action.hover',
                            p: 1,
                            borderRadius: 1,
                            fontSize: '0.8rem',
                            color: 'text.secondary'
                          }}
                        >
                          {prompt.content}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={prompt.category}
                            size="small"
                            color={getCategoryColor(prompt.category) as any}
                            variant="outlined"
                          />
                          {prompt.isFavorite && (
                            <Chip
                              label="Favorite"
                              size="small"
                              color="error"
                              variant="outlined"
                              icon={<StarIcon />}
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < filteredPrompts.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {filteredPrompts.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No system prompts match your search
            </Typography>
          </Box>
        )}

        {/* Placeholder for future custom prompt creation */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Alert severity="info" icon={<AddIcon />}>
            <Typography variant="body2">
              Custom system prompt creation feature coming soon. You'll be able to create and save your own system prompts.
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
