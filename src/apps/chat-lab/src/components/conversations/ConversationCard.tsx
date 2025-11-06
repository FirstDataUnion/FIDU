import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Favorite as FavoriteIcon,
  Archive as ArchiveIcon,
  Check as CheckIcon,
  Tag as TagIcon,
  FileUpload as ExportIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import type { Conversation } from '../../types';
import { getPlatformColor, formatDate, getTagColor, getModelDisplayName, calculatePrimaryModelsDisplay } from '../../utils/conversationUtils';

interface ConversationCardProps {
  conversation: Conversation;
  isSelectedForContext: boolean;
  isCurrentlyViewing: boolean;
  onSelect: (conversation: Conversation) => void;
  onTagManagement: (conversation: Conversation, event: React.MouseEvent) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}

const ConversationCard: React.FC<ConversationCardProps> = React.memo(({
  conversation,
  isSelectedForContext,
  isCurrentlyViewing,
  onSelect,
  onTagManagement,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onEnterSelectionMode,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(conversation.id);
    } else {
      onSelect(conversation);
    }
  };
  
  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTagManagement(conversation, e);
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterSelectionMode) {
      onEnterSelectionMode();
      if (onToggleSelection) {
        onToggleSelection(conversation.id);
      }
    }
  };

  // Use modelsUsed if available, fall back to platform for backward compatibility
  const modelDisplay = conversation.modelsUsed && conversation.modelsUsed.length > 0
    ? calculatePrimaryModelsDisplay(conversation.modelsUsed)
    : getModelDisplayName(conversation.platform);

  if (isMobile) {
    // Mobile-optimized compact layout
    return (
      <Card 
        sx={{ 
          cursor: isSelectionMode ? 'pointer' : 'pointer',
          border: isSelected ? 2 : (isCurrentlyViewing ? 2 : (isSelectedForContext ? 2 : 1)),
          borderColor: isSelected ? 'primary.main' : (isCurrentlyViewing ? 'secondary.main' : (isSelectedForContext ? 'primary.main' : 'divider')),
          backgroundColor: isSelected ? 'action.selected' : (isCurrentlyViewing ? 'action.selected' : 'background.paper'),
          maxWidth: '100%',
          position: 'relative',
          '&:hover': { 
            boxShadow: 2,
            transform: 'translateY(-1px)',
            transition: 'all 0.2s ease-in-out'
          }
        }}
        onClick={handleClick}
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
                onToggleSelection?.(conversation.id);
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
            aria-label="Export this conversation"
          >
            <ExportIcon fontSize="small" />
          </IconButton>
        )}

        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1.5 }}>
            <Typography variant="subtitle1" component="h3" sx={{ 
              flex: 1, 
              mr: 1,
              fontSize: '1rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              pl: isSelectionMode ? 5 : 0,
            }}>
              {conversation.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
              {isSelectedForContext && <CheckIcon color="primary" fontSize="small" />}
              {conversation.isFavorite && <FavoriteIcon color="error" fontSize="small" />}
              {conversation.isArchived && <ArchiveIcon color="action" fontSize="small" />}
            </Box>
          </Box>

          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={modelDisplay}
              size="small"
              sx={{ 
                backgroundColor: getPlatformColor(conversation.platform),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: '20px'
              }}
            />
            <Chip
              label={`${conversation.messageCount} msgs`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          </Box>

          {conversation.lastMessage && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                fontSize: '0.85rem',
                lineHeight: 1.3
              }}
            >
              {conversation.lastMessage}
            </Typography>
          )}

          <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            {conversation.tags.length > 0 ? (
              <>
              {conversation.tags.slice(0, 3).map((tag: string) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{ 
                    backgroundColor: getTagColor(tag),
                    color: 'white',
                    fontSize: '0.7rem',
                    height: '18px'
                  }}
                />
              ))}
              {conversation.tags.length > 3 && (
                <Chip
                  label={`+${conversation.tags.length - 3}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: '18px' }}
                />
                )}
              </>
            ) : null}
            {!isSelectionMode && (
              <IconButton 
                size="small" 
                onClick={handleTagClick}
                title="Manage Tags"
                sx={{ 
                  width: 24,
                  height: 24,
                  p: 0.5,
                  ml: conversation.tags.length > 0 ? 0.5 : 0,
                }}
              >
                <TagIcon fontSize="small" />
              </IconButton>
              )}
            </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {formatDate(new Date(conversation.updatedAt))}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Desktop layout (original)
  return (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: isSelectionMode ? 'pointer' : 'pointer',
        border: isSelected ? 2 : (isCurrentlyViewing ? 2 : (isSelectedForContext ? 2 : 1)),
        borderColor: isSelected ? 'primary.main' : (isCurrentlyViewing ? 'secondary.main' : (isSelectedForContext ? 'primary.main' : 'divider')),
        backgroundColor: isSelected ? 'action.selected' : (isCurrentlyViewing ? 'action.selected' : 'background.paper'),
        maxWidth: '100%',
        position: 'relative',
        '&:hover': { 
          boxShadow: 3,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
      onClick={handleClick}
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
              onToggleSelection?.(conversation.id);
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
          aria-label="Export this conversation"
        >
          <ExportIcon fontSize="small" />
        </IconButton>
      )}

      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ 
            flex: 1, 
            mr: 1,
            maxWidth: '70%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pl: isSelectionMode ? 5 : 0,
          }}>
            {conversation.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
            {isSelectedForContext && <CheckIcon color="primary" fontSize="small" />}
            {conversation.isFavorite && <FavoriteIcon color="error" fontSize="small" />}
            {conversation.isArchived && <ArchiveIcon color="action" fontSize="small" />}
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Chip
            label={modelDisplay}
            size="small"
            sx={{ 
              backgroundColor: getPlatformColor(conversation.platform),
              color: 'white',
              fontWeight: 'bold',
              mr: 1
            }}
          />
          <Chip
            label={`${conversation.messageCount} messages`}
            size="small"
            variant="outlined"
          />
        </Box>

        {conversation.lastMessage && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {conversation.lastMessage}
          </Typography>
        )}

        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {conversation.tags.map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ 
                backgroundColor: getTagColor(tag),
                color: 'white'
              }}
            />
          ))}
          {!isSelectionMode && (
            <IconButton 
              size="small" 
              onClick={handleTagClick}
              title="Manage Tags"
              sx={{
                width: 24,
                height: 24,
                p: 0.5,
                ml: conversation.tags.length > 0 ? 0.5 : 0,
              }}
            >
              <TagIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Updated: {formatDate(new Date(conversation.updatedAt))}
        </Typography>
      </CardContent>
    </Card>
  );
});

ConversationCard.displayName = 'ConversationCard';

export default ConversationCard;
