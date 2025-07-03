import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip
} from '@mui/material';

interface RecentPrompt {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
}

interface RecentPromptsProps {
  prompts: RecentPrompt[];
  onUsePrompt: (prompt: RecentPrompt) => void;
  calculateTokenCount: (text: string) => number;
}

export const RecentPrompts = React.memo<RecentPromptsProps>(({ 
  prompts, 
  onUsePrompt, 
  calculateTokenCount 
}) => {
  const handlePromptClick = useCallback((prompt: RecentPrompt) => {
    onUsePrompt(prompt);
  }, [onUsePrompt]);

  if (prompts.length === 0) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Recent Prompts
        </Typography>
        <Box sx={{ 
          p: 3, 
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', 
          borderRadius: 1, 
          textAlign: 'center',
          border: '2px dashed',
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'grey.300'
        }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            No recent prompts to show
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute a prompt to see it here
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Recent Prompts
      </Typography>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
        gap: 2 
      }}>
        {prompts.slice(0, 2).map((prompt) => (
          <Card 
            key={prompt.id}
            variant="outlined"
            sx={{ 
              cursor: 'pointer',
              '&:hover': {
                boxShadow: 2,
                borderColor: 'primary.main'
              }
            }}
            onClick={() => handlePromptClick(prompt)}
          >
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {prompt.title}
                </Typography>
                <Chip 
                  label={`${calculateTokenCount(prompt.prompt)} tokens`} 
                  size="small" 
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {prompt.prompt.length > 100 
                  ? `${prompt.prompt.substring(0, 100)}...` 
                  : prompt.prompt
                }
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Executed: {new Date(prompt.createdAt).toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
});

RecentPrompts.displayName = 'RecentPrompts'; 