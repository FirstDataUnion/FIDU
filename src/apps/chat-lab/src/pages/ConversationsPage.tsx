import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  MenuItem,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  MoreVert as MoreVertIcon,
  Chat as ChatIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchConversations, fetchConversationMessages, saveConversation, deleteConversation } from '../store/slices/conversationsSlice';
import type { Conversation } from '../types';
import { formatDate } from '../utils/conversationUtils';


const ConversationsPage = React.memo(() => {
  const dispatch = useAppDispatch();
  const { items: conversations, loading } = useAppSelector((state) => state.conversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'title' | 'messageCount'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [_selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('success');

  useEffect(() => {
    dispatch(fetchConversations({}));
  }, [dispatch]);

  // Memoize expensive calculations to prevent recalculation on every render
  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation: Conversation) => {
      const searchLower = searchQuery.toLowerCase();
      
      // Search in title and content
      const matchesTitle = conversation.title.toLowerCase().includes(searchLower);
      const matchesContent = conversation.lastMessage?.toLowerCase().includes(searchLower) || false;
      const matchesTags = conversation.tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
      if (!matchesTitle && !matchesContent && !matchesTags) return false;

      // Platform filter
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(conversation.platform)) {
        return false;
      }

      return true;
    });
  }, [conversations, searchQuery, selectedPlatforms]);

  // Memoize sorted conversations
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a: Conversation, b: Conversation) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const order = sortOrder === 'desc' ? -1 : 1;
      
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });
  }, [filteredConversations, sortBy, sortOrder]);

  // Memoize all platforms from conversations
  const allPlatforms = useMemo(() => {
    const platforms = new Set<string>();
    conversations.forEach(conversation => {
      platforms.add(conversation.platform);
    });
    return Array.from(platforms).sort();
  }, [conversations]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleConversationClick = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Fetch messages for this conversation
    try {
      await dispatch(fetchConversationMessages(conversation.id));
    } catch (_error) {
      console.error('Failed to fetch messages:', _error);
    }
  }, [dispatch]);

  const handleDeleteConversation = useCallback((conversation: Conversation) => {
    setConversationToDelete(conversation);
    setShowDeleteDialog(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (conversationToDelete) {
      try {
        await dispatch(deleteConversation(conversationToDelete.id));
        setSnackbarMessage('Conversation deleted successfully');
        setSnackbarSeverity('success');
        setShowSnackbar(true);
      } catch {
        setSnackbarMessage('Failed to delete conversation');
        setSnackbarSeverity('error');
        setShowSnackbar(true);
      }
    }
    setShowDeleteDialog(false);
    setConversationToDelete(null);
  }, [conversationToDelete, dispatch]);

  const handleToggleFavorite = useCallback(async (conversation: Conversation) => {
    const updatedConversation = {
      ...conversation,
      isFavorite: !conversation.isFavorite
    };
    
    try {
      await dispatch(saveConversation(updatedConversation));
      setSnackbarMessage(updatedConversation.isFavorite ? 'Added to favorites' : 'Removed from favorites');
      setSnackbarSeverity('success');
      setShowSnackbar(true);
    } catch {
      setSnackbarMessage('Failed to update conversation');
      setSnackbarSeverity('error');
      setShowSnackbar(true);
    }
  }, [dispatch]);

  const handleToggleArchive = useCallback(async (conversation: Conversation) => {
    const updatedConversation = {
      ...conversation,
      isArchived: !conversation.isArchived
    };
    
    try {
      await dispatch(saveConversation(updatedConversation));
      setSnackbarMessage(updatedConversation.isArchived ? 'Conversation archived' : 'Conversation unarchived');
      setSnackbarSeverity('success');
      setShowSnackbar(true);
    } catch {
      setSnackbarMessage('Failed to update conversation');
      setSnackbarSeverity('error');
      setShowSnackbar(true);
    }
  }, [dispatch]);

  // Memoize tag color function to prevent recreation on every render
  const getTagColor = useCallback((tagName: string) => {
    // Generate a consistent color based on tag name
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
      '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
      '#ff5722', '#795548', '#9e9e9e', '#607d8b'
    ];
    
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      const char = tagName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Loading conversations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Conversations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            // TODO: Implement new conversation creation
            setSnackbarMessage('New conversation feature coming soon');
            setSnackbarSeverity('info');
            setShowSnackbar(true);
          }}
        >
          New Conversation
        </Button>
      </Box>

        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'center' }}>
            <Box>
              <TextField
                fullWidth
                placeholder="Search conversations, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            
            <Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Platform</InputLabel>
                  <Select
                    multiple
                    value={selectedPlatforms}
                    onChange={(e) => setSelectedPlatforms(e.target.value as string[])}
                    label="Platform"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {allPlatforms.map((platform) => (
                      <MenuItem key={platform} value={platform}>
                        <Checkbox checked={selectedPlatforms.includes(platform)} />
                        <ListItemText primary={platform} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    label="Sort By"
                  >
                    <MenuItem value="createdAt">Created</MenuItem>
                    <MenuItem value="updatedAt">Updated</MenuItem>
                    <MenuItem value="title">Title</MenuItem>
                    <MenuItem value="messageCount">Messages</MenuItem>
                  </Select>
                </FormControl>

                <IconButton
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  size="small"
                >
                  <SortIcon sx={{ transform: sortOrder === 'asc' ? 'scaleY(-1)' : 'none' }} />
                </IconButton>

                <Button
                  variant="outlined"
                  startIcon={<FilterIcon />}
                  onClick={() => {/* TODO: Implement filters */}}
                  size="small"
                >
                  Filters
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Active Filters Display */}
          {(searchQuery || selectedPlatforms.length > 0) && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                Active filters:
              </Typography>
              
              {searchQuery && (
                <Chip
                  label={`Search: "${searchQuery}"`}
                  onDelete={() => setSearchQuery('')}
                  size="small"
                  color="primary"
                />
              )}
              
              {selectedPlatforms.map((platform) => (
                <Chip
                  key={platform}
                  label={`Platform: ${platform}`}
                  onDelete={() => setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform))}
                  size="small"
                  color="secondary"
                />
              ))}
              
              <Button
                size="small"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPlatforms([]);
                }}
              >
                Clear All
              </Button>
            </Box>
          )}
        </Box>

        {/* Conversations Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
          {sortedConversations.map((conversation: Conversation) => (
            <Box key={conversation.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
                onClick={() => handleConversationClick(conversation)}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="h3" noWrap sx={{ maxWidth: '70%' }}>
                      {conversation.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {conversation.isFavorite && (
                        <FavoriteIcon color="primary" fontSize="small" />
                      )}
                      {conversation.isArchived && (
                        <ArchiveIcon color="action" fontSize="small" />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={conversation.platform}
                      size="small"
                      variant="outlined"
                      icon={<ChatIcon fontSize="small" />}
                    />
                    <Chip
                      label={`${conversation.messageCount} messages`}
                      size="small"
                      variant="outlined"
                      icon={<ScheduleIcon fontSize="small" />}
                    />
                  </Box>

                  {conversation.lastMessage && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4
                      }}
                    >
                      {conversation.lastMessage}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {conversation.participants.join(', ')}
                    </Typography>
                  </Box>

                  {conversation.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {conversation.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            backgroundColor: getTagColor(tag),
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  <Typography variant="caption" color="text.secondary">
                    {formatDate(new Date(conversation.updatedAt))}
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', p: 2, pt: 0 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={conversation.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(conversation);
                        }}
                      >
                        {conversation.isFavorite ? <FavoriteIcon color="primary" /> : <FavoriteBorderIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={conversation.isArchived ? 'Unarchive' : 'Archive'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleArchive(conversation);
                        }}
                      >
                        {conversation.isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Delete conversation">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="More options">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement more options menu
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Box>
          ))}
        </Box>

        {/* Empty State */}
        {sortedConversations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No conversations found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || selectedPlatforms.length > 0
                ? 'Try adjusting your search or filters'
                : 'Start a new conversation to get started'
              }
            </Typography>
          </Box>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
        >
          <DialogTitle>Delete Conversation</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{conversationToDelete?.title}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error">Delete</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={showSnackbar}
          autoHideDuration={6000}
          onClose={() => setShowSnackbar(false)}
        >
          <Alert
            onClose={() => setShowSnackbar(false)}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
    </Box>
  );
});

ConversationsPage.displayName = 'ConversationsPage';

export default ConversationsPage; 