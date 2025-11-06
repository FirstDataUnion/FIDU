import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  FileUpload as ExportIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';

import type { Context } from '../../types/contexts';

interface ContextCardProps {
  context: Context;
  onViewEdit: (context: Context) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}

export const ContextCard = React.memo<ContextCardProps>(({ 
  context, 
  onViewEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onEnterSelectionMode,
}) => {
  const isBuiltIn = context.isBuiltIn || false;
  
  const handleViewEdit = React.useCallback(() => {
    if (!isSelectionMode) {
      onViewEdit(context);
    }
  }, [context, onViewEdit, isSelectionMode]);

  const handleCardClick = React.useCallback(() => {
    if (isSelectionMode && onToggleSelection && !isBuiltIn) {
      onToggleSelection(context.id);
    }
  }, [isSelectionMode, onToggleSelection, context.id, isBuiltIn]);

  const handleExportClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterSelectionMode) {
      onEnterSelectionMode();
      if (onToggleSelection && !isBuiltIn) {
        onToggleSelection(context.id);
      }
    }
  }, [onEnterSelectionMode, onToggleSelection, context.id, isBuiltIn]);
  
  return (
    <Card 
      onClick={handleCardClick}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isSelectionMode && !isBuiltIn ? 'pointer' : 'default',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected ? 'action.selected' : 'background.paper',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && !isBuiltIn && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 3,
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection?.(context.id);
            }}
            sx={{
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {isSelected ? (
              <CheckCircleIcon color="primary" />
            ) : (
              <RadioButtonUncheckedIcon />
            )}
          </IconButton>
        </Box>
      )}

      {/* Export button */}
      {!isSelectionMode && !isBuiltIn && (
        <IconButton
          size="small"
          onClick={handleExportClick}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 3,
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            width: 28,
            height: 28,
          }}
          aria-label="Export this context"
        >
          <ExportIcon fontSize="small" />
        </IconButton>
      )}

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
            pr: isSelectionMode && !isBuiltIn ? 5 : (!isSelectionMode && !isBuiltIn ? 8 : 0),
            pl: isSelectionMode && !isBuiltIn ? 5 : 0,
            wordBreak: 'break-word', // Allow long words to break
            overflowWrap: 'break-word' // Modern CSS for better word breaking
          }}
        >
          {context.title || 'Untitled Context'}
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
          {context.body || 'No content available'}
        </Typography>

        {/* Tags */}
        <Box sx={{ mb: 2 }}>
          {(context.tags || []).map((tag: string) => (
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
            {(context.tokenCount || 0).toLocaleString()} tokens
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {!isBuiltIn && context.updatedAt && `Updated ${new Date(context.updatedAt).toLocaleDateString()}`}
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
