import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button
} from '@mui/material';

import type { Context } from '../../types/contexts';

interface ContextCardProps {
  context: Context;
  onViewEdit: (context: Context) => void;
}

export const ContextCard = React.memo<ContextCardProps>(({ context, onViewEdit }) => {
  const isBuiltIn = context.isBuiltIn || false;
  
  const handleViewEdit = React.useCallback(() => {
    onViewEdit(context);
  }, [context, onViewEdit]);
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* Built-in indicator */}
      {isBuiltIn && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 2
          }}
        >
          Built-in
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1, pt: isBuiltIn ? 4 : 2 }}>
        {/* Title and body */}
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1, 
            fontWeight: 600, 
            lineHeight: 1.2,
            pr: 8, // Add right padding to prevent overlap with buttons
            wordBreak: 'break-word', // Allow long words to break
            overflowWrap: 'break-word' // Modern CSS for better word breaking
          }}
        >
          {context.title}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {context.body}
        </Typography>

        {/* Tags */}
        <Box sx={{ mb: 2 }}>
          {context.tags.map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ 
                mr: 0.5, 
                mb: 0.5, 
                fontSize: '0.7rem',
                backgroundColor: 'secondary.main',
                color: 'white'
              }}
            />
          ))}
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
          <Box>
            {context.tokenCount.toLocaleString()} tokens
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {!isBuiltIn && `Updated ${new Date(context.updatedAt).toLocaleDateString()}`}
        </Typography>
        <Box>
          <Button 
            size="small" 
            variant="outlined"
            onClick={handleViewEdit}
            sx={{ color: 'primary.dark', borderColor: 'primary.dark' }}
          >
            {isBuiltIn ? 'View' : 'View/Edit'}
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
});

ContextCard.displayName = 'ContextCard';
