import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import { formatDate, getTagColor } from '../../utils/conversationUtils';
import type { MarkdownDocument } from '../../types';

interface DocumentCardProps {
  document: MarkdownDocument;
  onViewEdit: (document: MarkdownDocument) => void;
}

export const DocumentCard = React.memo<DocumentCardProps>(({ 
  document, 
  onViewEdit,
}) => {
  const handleViewEdit = React.useCallback(() => {
    onViewEdit(document);
  }, [document, onViewEdit]);
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1, pt: 2 }}>
        {/* Title */}
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1, 
            fontWeight: 600, 
            lineHeight: 1.2,
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

