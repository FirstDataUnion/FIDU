import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchConversations } from '../../store/slices/conversationsSlice';

import type { Conversation } from '../../types/contexts';

interface ConversationSelectionListProps {
  onConversationSelect: (conversation: Conversation) => void;
  currentProfileId?: string;
}

export const ConversationSelectionList = React.memo<ConversationSelectionListProps>(({ 
  onConversationSelect, 
  currentProfileId 
}) => {
  const dispatch = useAppDispatch();
  const { items: conversations = [], loading: conversationsLoading } = useAppSelector((state) => state.conversations);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch conversations when component mounts
  useEffect(() => {
    if (currentProfileId) {
      dispatch(fetchConversations({ 
        filters: {
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        },
        page: 1,
        limit: 100
      }));
    }
  }, [dispatch, currentProfileId]);
  
  // Memoize filtered conversations to prevent recalculation on every render
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conversation => {
      return (
        conversation.title.toLowerCase().includes(query) ||
        conversation.lastMessage?.toLowerCase().includes(query) ||
        conversation.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    });
  }, [conversations, searchQuery]);
  
  const handleConversationSelect = useCallback((conversation: Conversation) => {
    onConversationSelect(conversation);
  }, [onConversationSelect]);
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);
  
  return (
    <Box sx={{ pt: 1 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search conversations..."
        value={searchQuery}
        onChange={handleSearchChange}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      {conversationsLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredConversations.map((conversation) => (
            <Card 
              key={conversation.id} 
              sx={{ 
                mb: 1, 
                cursor: 'pointer',
                '&:hover': { 
                  backgroundColor: 'action.hover',
                  boxShadow: 2
                }
              }}
              onClick={() => handleConversationSelect(conversation)}
            >
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                    {conversation.title}
                  </Typography>
                  <Chip
                    label={conversation.platform.toUpperCase()}
                    size="small"
                    sx={{ 
                      backgroundColor: 'primary.main',
                      color: 'white',
                      fontWeight: 'bold',
                      ml: 1
                    }}
                  />
                </Box>
                
                {conversation.lastMessage && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 1,
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
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {conversation.tags.slice(0, 3).map((tag: string) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ 
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300',
                          color: (theme) => theme.palette.mode === 'dark' ? 'white' : 'text.primary',
                          fontSize: '0.7rem'
                        }}
                      />
                    ))}
                    {conversation.tags.length > 3 && (
                      <Chip
                        label={`+${conversation.tags.length - 3}`}
                        size="small"
                        sx={{ 
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.600' : 'grey.200',
                          color: (theme) => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary',
                          fontSize: '0.7rem'
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {conversation.messageCount} messages
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
});

ConversationSelectionList.displayName = 'ConversationSelectionList';
