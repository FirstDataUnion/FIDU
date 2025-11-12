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
import { formatDate, getTagColor } from '../../utils/conversationUtils';
import type { MarkdownDocument } from '../../types';

interface DocumentCardProps {
  document: MarkdownDocument;
  onViewEdit: (document: MarkdownDocument) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}

export const DocumentCard = React.memo<DocumentCardProps>(({ 
  document, 
  onViewEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onEnterSelectionMode,
}) => {
  const handleViewEdit = React.useCallback(() => {
    if (!isSelectionMode) {
      onViewEdit(document);
    }
  }, [document, onViewEdit, isSelectionMode]);

  const handleCardClick = React.useCallback(() => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(document.id);
    }
  }, [isSelectionMode, onToggleSelection, document.id]);

  const handleExportClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterSelectionMode) {
      onEnterSelectionMode();
      if (onToggleSelection) {
        onToggleSelection(document.id);
      }
    }
  }, [onEnterSelectionMode, onToggleSelection, document.id]);
  
  return (
    <Card 
      onClick={handleCardClick}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isSelectionMode ? 'pointer' : 'default',
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
      {isSelectionMode && (
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
              onToggleSelection?.(document.id);
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
      {!isSelectionMode && (
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
          aria-label="Export this document"
        >
          <ExportIcon fontSize="small" />
        </IconButton>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1, pt: 2 }}>
        {/* Title */}
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1, 
            fontWeight: 600, 
            lineHeight: 1.2,
            pr: isSelectionMode ? 5 : 8,
            pl: isSelectionMode ? 5 : 0,
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          {document.title || 'Untitled Document'}
        </Typography>
        
        {/* Content preview */}
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
          {document.content || 'No content available'}
        </Typography>

        {/* Tags */}
        <Box sx={{ mb: 2 }}>
          {(document.tags || []).map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ 
                mr: 0.5, 
                mb: 0.5, 
                fontSize: '0.7rem',
                backgroundColor: getTagColor(tag),
                color: 'white'
              }}
            />
          ))}
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {document.updatedAt && `Updated ${formatDate(new Date(document.updatedAt))}`}
        </Typography>
        <Box>
          <Button 
            size="small" 
            variant="outlined"
            onClick={handleViewEdit}
            sx={{ color: 'primary.dark', borderColor: 'primary.dark' }}
          >
            View/Edit
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
});

DocumentCard.displayName = 'DocumentCard';

