import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Favorite as FavoriteIcon,
  Archive as ArchiveIcon,
  Check as CheckIcon,
  Tag as TagIcon
} from '@mui/icons-material';
import type { Conversation } from '../../types';
import { getPlatformColor, formatDate, getTagColor } from '../../utils/conversationUtils';

interface ConversationCardProps {
  conversation: Conversation;
  isSelectedForContext: boolean;
  isCurrentlyViewing: boolean;
  onSelect: (conversation: Conversation) => void;
  onTagManagement: (conversation: Conversation, event: React.MouseEvent) => void;
}

const ConversationCard: React.FC<ConversationCardProps> = React.memo(({
  conversation,
  isSelectedForContext,
  isCurrentlyViewing,
  onSelect,
  onTagManagement
}) => {
  const handleClick = () => onSelect(conversation);
  
  const handleTagClick = (e: React.MouseEvent) => onTagManagement(conversation, e);

  return (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: 'pointer',
        border: isCurrentlyViewing ? 2 : (isSelectedForContext ? 2 : 1),
        borderColor: isCurrentlyViewing ? 'secondary.main' : (isSelectedForContext ? 'primary.main' : 'divider'),
        backgroundColor: isCurrentlyViewing ? 'action.selected' : 'background.paper',
        maxWidth: '100%',
        '&:hover': { 
          boxShadow: 3,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
      onClick={handleClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ 
            flex: 1, 
            mr: 1,
            maxWidth: '70%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {conversation.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
            {isCurrentlyViewing && <ChatIcon color="secondary" fontSize="small" />}
            {isSelectedForContext && <CheckIcon color="primary" fontSize="small" />}
            {conversation.isFavorite && <FavoriteIcon color="error" fontSize="small" />}
            {conversation.isArchived && <ArchiveIcon color="action" fontSize="small" />}
            <IconButton 
              size="small" 
              onClick={handleTagClick}
              title="Manage Tags"
            >
              <TagIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Chip
            label={conversation.platform.toUpperCase()}
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

        <Box sx={{ mb: 2 }}>
          {conversation.tags.map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ 
                mr: 0.5, 
                mb: 0.5,
                backgroundColor: getTagColor(tag),
                color: 'white'
              }}
            />
          ))}
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
