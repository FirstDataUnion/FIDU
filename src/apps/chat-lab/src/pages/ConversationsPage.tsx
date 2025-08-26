import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Chip, 
  CircularProgress, 
  Alert,
  Button,
  Stack,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Paper,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,

} from '@mui/material';
import { 
  Chat as ChatIcon,
  Favorite as FavoriteIcon,
  Archive as ArchiveIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  GetApp as ExportIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Tag as TagIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchConversations, fetchConversationMessages } from '../store/slices/conversationsSlice';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchContexts, addConversationToContext, createContext } from '../store/slices/contextsSlice';
import type { Conversation, ConversationsState, Tag } from '../types';
import ConversationViewer from '../components/conversations/ConversationViewer';
import { getPlatformColor, formatDate } from '../utils/conversationUtils';

const ConversationsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items: conversations = [], loading, error } = useAppSelector((state) => state.conversations as ConversationsState);
  const { items: tags = [] } = useAppSelector((state) => state.tags as any);
  const { items: contexts } = useAppSelector((state) => state.contexts);

  const { isAuthenticated, currentProfile } = useAppSelector((state) => state.auth);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showArchived, setShowArchived] = useState(false);
  
  // Context Selection State
  const [selectedForContext, setSelectedForContext] = useState<string[]>([]);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [contextPreview, setContextPreview] = useState('');
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  
  // Add to Context Dialog State
  const [showAddToContextDialog, setShowAddToContextDialog] = useState(false);
  const [selectedConversationForContext, setSelectedConversationForContext] = useState<Conversation | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string>('');
  const [newContextTitle, setNewContextTitle] = useState<string>('');
  const [isAddingToContext, setIsAddingToContext] = useState(false);

  // Tag Management State
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);

  useEffect(() => {
    dispatch(fetchConversations({ 
      filters: {
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      },
      page: 1,
      limit: 20
    }));
    dispatch(fetchTags());
    if (currentProfile?.id) {
      dispatch(fetchContexts(currentProfile.id));
    }
  }, [dispatch, isAuthenticated, currentProfile]);

  const handleRefresh = () => {
    dispatch(fetchConversations({ 
      filters: {
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      },
      page: 1,
      limit: 20
    }));
  };

  // Handle conversation selection for viewing
  const handleConversationSelect = (conversation: Conversation) => {
    console.log('Selecting conversation:', conversation.id);
    dispatch(fetchConversationMessages(conversation.id));
    setSelectedConversation(conversation);
  };

  // Filter conversations based on search and filters
  const filteredConversations = conversations.filter((conversation: Conversation) => {
    // Search query filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesTitle = conversation.title.toLowerCase().includes(searchLower);
      const matchesContent = conversation.lastMessage?.toLowerCase().includes(searchLower);
      const matchesTags = conversation.tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
      if (!matchesTitle && !matchesContent && !matchesTags) return false;
    }
    
    // Platform filter
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(conversation.platform)) {
      return false;
    }
    
    // Tags filter
    if (selectedTags.length > 0 && !selectedTags.some((tag: string) => conversation.tags.includes(tag))) {
      return false;
    }
    
    // Archived filter
    if (!showArchived && conversation.isArchived) {
      return false;
    }
    
    return true;
  }).sort((a: Conversation, b: Conversation) => {
    const aVal = a[sortBy as keyof Conversation] as any;
    const bVal = b[sortBy as keyof Conversation] as any;
    const multiplier = sortOrder === 'desc' ? -1 : 1;
    
    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });



  const buildContextPreview = () => {
    const selectedConversations = conversations.filter((c: Conversation) => selectedForContext.includes(c.id));
    const context = selectedConversations.map((c: Conversation) => 
      `## ${c.title} (${c.platform})\n${c.lastMessage || 'No content preview available'}\n`
    ).join('\n');
    
    setContextPreview(context);
    setEstimatedTokens(Math.ceil(context.length / 4)); // Rough token estimation
    setShowContextBuilder(true);
  };

  const handleAddToContext = async (conversation: Conversation) => {
    setSelectedConversationForContext(conversation);
    setSelectedContextId('');
    setNewContextTitle(`${conversation.title} Context`);
    setShowAddToContextDialog(true);
  };

  const handleAddToContextSubmit = async () => {
    if (!selectedConversationForContext || !currentProfile?.id) return;
    
    setIsAddingToContext(true);
    try {
      // Fetch conversation messages to get the full content
      const messages = await dispatch(fetchConversationMessages(selectedConversationForContext.id)).unwrap();
      
      // Prepare conversation data
      const conversationData = {
        title: selectedConversationForContext.title,
        messages: messages || [],
        platform: selectedConversationForContext.platform
      };
      
      let targetContextId = selectedContextId;
      
      // If no context selected, create a new one
      if (!selectedContextId) {
        const newContext = await dispatch(createContext({
          contextData: {
            title: newContextTitle,
            body: ``,
            tags: ['conversation-context'],
            conversationIds: [],
            conversationMetadata: {
              totalMessages: 0,
              lastAddedAt: new Date().toISOString(),
              platforms: []
            }
          },
          profileId: currentProfile.id
        })).unwrap();
        targetContextId = newContext.id;
      }
      
      // Add to context
      await dispatch(addConversationToContext({
        contextId: targetContextId,
        conversationId: selectedConversationForContext.id,
        conversationData,
        profileId: currentProfile.id
      })).unwrap();
      
      setShowAddToContextDialog(false);
      setSelectedConversationForContext(null);
      setSelectedContextId('');
      setNewContextTitle('');
      
      // Show success message or refresh contexts
      // You could add a snackbar here
      
    } catch (error) {
      console.error('Error adding conversation to context:', error);
    } finally {
      setIsAddingToContext(false);
    }
  };

  const exportContext = (format: 'clipboard' | 'json' | 'markdown') => {
    const selectedConversations = conversations.filter((c: Conversation) => selectedForContext.includes(c.id));
    
    switch (format) {
      case 'clipboard':
        navigator.clipboard.writeText(contextPreview);
        break;
      case 'json': {
        const jsonData = JSON.stringify(selectedConversations, null, 2);
        const jsonBlob = new Blob([jsonData], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = 'chat-lab-context.json';
        jsonLink.click();
        break;
      }
      case 'markdown': {
        const mdBlob = new Blob([contextPreview], { type: 'text/markdown' });
        const mdUrl = URL.createObjectURL(mdBlob);
        const mdLink = document.createElement('a');
        mdLink.href = mdUrl;
        mdLink.download = 'chat-lab-context.md';
        mdLink.click();
        break;
      }
    }
  };

  // Get unique tags and platforms for filters
  const allTags = [...new Set(conversations.flatMap((c: Conversation) => c.tags))];
  const allPlatforms = [...new Set(conversations.map((c: Conversation) => c.platform))];

  const ConversationCard: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
    const isSelectedForContext = selectedForContext.includes(conversation.id);
    const isCurrentlyViewing = selectedConversation?.id === conversation.id;
    
    return (
      <Card 
        sx={{ 
          height: '100%', 
          cursor: 'pointer',
          border: isCurrentlyViewing ? 2 : (isSelectedForContext ? 2 : 1),
          borderColor: isCurrentlyViewing ? 'secondary.main' : (isSelectedForContext ? 'primary.main' : 'divider'),
          backgroundColor: isCurrentlyViewing ? 'action.selected' : 'background.paper',
          maxWidth: '100%', // Ensure card doesn't exceed container width
          '&:hover': { 
            boxShadow: 3,
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out'
          }
        }}
        onClick={() => handleConversationSelect(conversation)}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
            <Typography variant="h6" component="h3" sx={{ 
              flex: 1, 
              mr: 1,
              maxWidth: '70%', // Limit title width
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
                onClick={(e) => handleTagManagement(conversation, e)}
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
  };

  // Open tag management dialog
  const handleTagManagement = (conversation: Conversation, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedConversation(conversation);
    setEditedTags([...conversation.tags]);
    setShowTagDialog(true);
  };

  // Save tag changes
  const handleSaveTags = () => {
    if (selectedConversation) {
      // Here you would dispatch an action to update the conversation tags
      console.log('Updating conversation tags:', {
        conversationId: selectedConversation.id,
        newTags: editedTags
      });
      // For now, we'll just update locally
      // dispatch(updateConversationTags({ id: selectedConversation.id, tags: editedTags }));
    }
    setShowTagDialog(false);
    setSelectedConversation(null);
    setEditedTags([]);
  };

  // Get tag color
  const getTagColor = (tagName: string) => {
    const tag = (tags as Tag[]).find((t: Tag) => t.name === tagName);
    return tag?.color || 'secondary.main';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading conversations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Error loading conversations:</strong> {error}
        </Alert>
        <Button variant="outlined" onClick={handleRefresh} startIcon={<RefreshIcon />}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
      height: '100%', // Use full height of parent container
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with Search and Actions */}
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2,
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            flex: 1,
            minWidth: 0
          }}>
            {/* Search Bar - Moved inline */}
            <TextField
              placeholder="Search conversations, content, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 300, flex: 1, maxWidth: 600 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowFilters(!showFilters)}>
                      <Badge badgeContent={selectedPlatforms.length + selectedTags.length} color="primary">
                        <FilterIcon />
                      </Badge>
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>
          
          <Stack 
            direction="row" 
            spacing={2} 
            alignItems="center"
            sx={{ 
              flexShrink: 0,
              minWidth: 0,
              flexWrap: 'wrap'
            }}
          >
            <Button
              variant="outlined"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
              sx={{ 
                flexShrink: 0,
                color: 'primary.dark',
                borderColor: 'primary.dark',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                  color: 'primary.contrastText',
                  borderColor: 'primary.dark'
                }
              }}
            >
              Refresh
            </Button>
            {selectedForContext.length > 0 && (
              <Button
                variant="contained"
                onClick={buildContextPreview}
                startIcon={<AddIcon />}
                sx={{ flexShrink: 0 }}
              >
                Build Context ({selectedForContext.length})
              </Button>
            )}
          </Stack>
        </Box>

        {/* Filters Panel */}
        {showFilters && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                md: 'repeat(5, 1fr)' 
              }, 
              gap: 2 
            }}>
              <FormControl fullWidth size="small">
                <InputLabel>Platforms</InputLabel>
                <Select
                  multiple
                  value={selectedPlatforms}
                  onChange={(e) => setSelectedPlatforms(e.target.value as string[])}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {allPlatforms.map((platform) => (
                    <MenuItem key={platform} value={platform}>
                      <Checkbox checked={selectedPlatforms.includes(platform)} />
                      {platform.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Tags</InputLabel>
                <Select
                  multiple
                  value={selectedTags}
                  onChange={(e) => setSelectedTags(e.target.value as string[])}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {allTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      <Checkbox checked={selectedTags.includes(tag)} />
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="updatedAt">Last Updated</MenuItem>
                  <MenuItem value="createdAt">Created Date</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="messageCount">Message Count</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <MenuItem value="desc">Descending</MenuItem>
                  <MenuItem value="asc">Ascending</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControl>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                      />
                    }
                    label="Show Archived"
                  />
                </FormControl>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Context Selection Info */}
      {selectedForContext.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50', flexShrink: 0 }}>
          <Typography variant="body2" color="primary">
            <strong>{selectedForContext.length} conversations selected for context building</strong>
            <Button 
              size="small" 
              onClick={() => setSelectedForContext([])}
              startIcon={<CloseIcon />}
              sx={{ ml: 2 }}
            >
              Clear Selection
            </Button>
          </Typography>
        </Paper>
      )}

      {/* Main Content Area - Two Panel Layout */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flex: 1, // Take remaining space in flex container
        minHeight: 0, // Allow flex child to shrink below content size
        maxWidth: '100%', // Ensure we don't exceed viewport width
        overflow: 'hidden', // Prevent horizontal scrolling
        flexDirection: { xs: 'column', md: 'row' } // Stack vertically on small screens
      }}>
        {/* Left Panel - Conversations List */}
        <Paper sx={{ 
          flex: selectedConversation ? '0 0 min(400px, 40%)' : '1 1 auto', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: selectedConversation ? '300px' : 'auto', // Minimum width for readability
          maxWidth: selectedConversation ? '500px' : '600px', // Maximum width to prevent expansion
          height: { xs: selectedConversation ? '40%' : '100%', md: 'auto' }, // Responsive height
          minHeight: 0, // Ensure flex child can shrink properly
          maxHeight: '100%' // Prevent exceeding parent height
        }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              Conversations
            </Typography>
          </Box>
          
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto',
            p: 2,
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: (theme) => theme.palette.mode === 'dark' ? '#424242' : '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          }}>
            {filteredConversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ChatIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {searchQuery || selectedPlatforms.length > 0 || selectedTags.length > 0 
                    ? 'No conversations match your filters' 
                    : 'No conversations found'
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {searchQuery || selectedPlatforms.length > 0 || selectedTags.length > 0
                    ? 'Try adjusting your search terms or filters'
                    : 'Your AI conversations will appear here once you have some data.'
                  }
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  {(searchQuery || selectedPlatforms.length > 0 || selectedTags.length > 0) && (
                    <Button 
                      variant="outlined" 
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedPlatforms([]);
                        setSelectedTags([]);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Button variant="outlined" href="/settings">
                    Load Sample Data
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 2 
              }}>
                {filteredConversations.map((conversation: Conversation) => (
                  <ConversationCard key={conversation.id} conversation={conversation} />
                ))}
              </Box>
            )}
          </Box>
        </Paper>

        {/* Right Panel - Conversation Viewer */}
        {selectedConversation && (
          <Paper sx={{ 
            flex: '1 1 auto', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0, // Allow flex item to shrink below content size
            height: { xs: '60%', md: 'auto' } // Responsive height
          }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Conversation Details
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddToContext(selectedConversation)}
                  startIcon={<AddIcon />}
                  sx={{ 
                    backgroundColor: 'background.paper',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white'
                    }
                  }}
                >
                  Add to Context
                </Button>
                <IconButton 
                  onClick={() => setSelectedConversation(null)}
                  title="Close conversation view"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'hidden', p: 2, minWidth: 0 }}>
              <ConversationViewer conversation={selectedConversation} />
            </Box>
          </Paper>
        )}

        {/* Placeholder when no conversation is selected */}
        {!selectedConversation && (
          <Paper sx={{ 
            flex: '1 1 auto', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50',
            minWidth: 0 // Allow flex item to shrink below content size
          }}>
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <ChatIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" gutterBottom color="text.secondary">
                Select a conversation to view
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Click on any conversation from the list to see its messages
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Context Builder Dialog */}
      <Dialog 
        open={showContextBuilder} 
        onClose={() => setShowContextBuilder(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Context Builder
          <Typography variant="body2" color="text.secondary">
            {selectedForContext.length} conversations • ~{estimatedTokens} tokens
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            multiline
            fullWidth
            rows={12}
            value={contextPreview}
            onChange={(e) => setContextPreview(e.target.value)}
            variant="outlined"
            placeholder="Your context will appear here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContextBuilder(false)} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button 
            onClick={() => exportContext('clipboard')}
            startIcon={<CopyIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button 
            onClick={() => exportContext('markdown')}
            startIcon={<ExportIcon />}
          >
            Export Markdown
          </Button>
          <Button 
            onClick={() => exportContext('json')}
            startIcon={<ExportIcon />}
          >
            Export JSON
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Context Dialog */}
      <Dialog
        open={showAddToContextDialog}
        onClose={() => setShowAddToContextDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Add Conversation to Context
          <Typography variant="body2" color="text.secondary">
            {selectedConversationForContext?.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Select a context to add this conversation to, or create a new one:
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Context</InputLabel>
              <Select
                value={selectedContextId}
                label="Select Context"
                onChange={(e) => setSelectedContextId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Create New Context</em>
                </MenuItem>
                {contexts.map((context) => (
                  <MenuItem key={context.id} value={context.id}>
                    {context.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {selectedContextId && (
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Selected Context:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {contexts.find(c => c.id === selectedContextId)?.body || 'No description available'}
                </Typography>
              </Box>
            )}
            
            {!selectedContextId && (
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  New Context:
                </Typography>
                <TextField
                  fullWidth
                  label="Context Title"
                  value={newContextTitle}
                  onChange={(e) => setNewContextTitle(e.target.value)}
                  placeholder="Enter context title"
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  A new context will be created with the title above
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddToContextDialog(false);
            setSelectedConversationForContext(null);
            setSelectedContextId('');
            setNewContextTitle('');
          }} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddToContextSubmit}
            disabled={isAddingToContext}
          >
            {isAddingToContext ? 'Adding...' : 'Add to Context'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog
        open={showTagDialog}
        onClose={() => setShowTagDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Manage Tags
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            value={editedTags}
            onChange={(_, newValue) => {
              setEditedTags(newValue);
            }}
            options={allTags}
            getOptionLabel={(option) => option}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tags"
                placeholder="Add tags"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTagDialog(false)} sx={{ color: 'primary.dark' }}>
            Cancel
          </Button>
          <Button onClick={handleSaveTags}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConversationsPage; 