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
  DialogActions
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
  GetApp as GetAppIcon,
  Close as CloseIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchConversations, fetchConversationMessages } from '../store/slices/conversationsSlice';
import { fetchContexts, addConversationToContext, createContext } from '../store/slices/contextsSlice';
import type { Conversation, ConversationsState } from '../types';
import ConversationViewer from '../components/conversations/ConversationViewer';
import { getPlatformColor, formatDate } from '../utils/conversationUtils';

const ConversationsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items: conversations = [], loading, error } = useAppSelector((state) => state.conversations as ConversationsState);
  const { items: contexts } = useAppSelector((state) => state.contexts);
  const { isAuthenticated, currentProfile } = useAppSelector((state) => state.auth);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
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

  // Conversation Selection State
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    dispatch(fetchConversations({ 
      filters: {
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      },
      page: 1,
      limit: 20
    }));

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
    
    // Archived filter
    if (!showArchived && conversation.isArchived) {
      return false;
    }
    
    return true;
  });

  // Sort conversations
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const aVal = a[sortBy as keyof Conversation];
    const bVal = b[sortBy as keyof Conversation];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    }
    
    return 0;
  });

  // Get unique platforms for filters
  const allPlatforms = [...new Set(conversations.map((c: Conversation) => c.platform))];

  // Build context preview
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
          maxWidth: '100%',
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
              maxWidth: '70%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {conversation.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {conversation.isFavorite && (
                <FavoriteIcon color="primary" fontSize="small" />
              )}
              {conversation.isArchived && (
                <ArchiveIcon color="action" fontSize="small" />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip
              label={conversation.platform}
              size="small"
              variant="outlined"
              icon={<ChatIcon fontSize="small" />}
              sx={{ 
                borderColor: getPlatformColor(conversation.platform),
                color: getPlatformColor(conversation.platform)
              }}
            />
            <Chip
              label={`${conversation.messageCount} messages`}
              size="small"
              variant="outlined"
              icon={<ChatIcon fontSize="small" />}
            />
          </Box>

          {conversation.lastMessage && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 2,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontStyle: 'italic',
                backgroundColor: 'rgba(0,0,0,0.04)',
                p: 1,
                borderRadius: 1
              }}
            >
              {conversation.lastMessage}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {formatDate(new Date(conversation.updatedAt))}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {conversation.tags.slice(0, 3).map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {conversation.tags.length > 3 && (
                <Chip
                  label={`+${conversation.tags.length - 3}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading conversations: {error}
        </Alert>
        <Button onClick={handleRefresh} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexShrink: 0 }}>
        <Typography variant="h4" component="h1">
          Conversations
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={buildContextPreview}
            disabled={selectedForContext.length === 0}
            startIcon={<AddIcon />}
          >
            Build Context ({selectedForContext.length})
          </Button>
          <Button
            variant="contained"
            onClick={handleRefresh}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
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
                  <MenuItem>{platform}</MenuItem>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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

          <FormControlLabel
            control={
              <Checkbox
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
            }
            label="Show Archived"
          />

          <Button
            variant="outlined"
            onClick={() => setShowFilters(!showFilters)}
            startIcon={<FilterIcon />}
            size="small"
          >
            <Badge badgeContent={selectedPlatforms.length} color="primary">
              Filters
            </Badge>
          </Button>
        </Box>
      </Paper>

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
        flex: 1,
        minHeight: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        flexDirection: { xs: 'column', md: 'row' }
      }}>
        {/* Left Panel - Conversations List */}
        <Paper sx={{ 
          flex: selectedConversation ? '0 0 min(400px, 40%)' : '1 1 auto', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: selectedConversation ? '300px' : 'auto',
          maxWidth: selectedConversation ? '500px' : '600px',
          height: { xs: selectedConversation ? '40%' : '100%', md: 'auto' },
          minHeight: 0,
          maxHeight: '100%'
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
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredConversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ChatIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {searchQuery || selectedPlatforms.length > 0
                    ? 'No conversations match your filters' 
                    : 'No conversations found'
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {searchQuery || selectedPlatforms.length > 0
                    ? 'Try adjusting your search terms or filters'
                    : 'Your AI conversations will appear here once you have some data.'
                  }
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  {(searchQuery || selectedPlatforms.length > 0) && (
                    <Button 
                      variant="outlined" 
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedPlatforms([]);
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
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 2 
              }}>
                {sortedConversations.map((conversation: Conversation) => (
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
            minWidth: 0,
            height: { xs: '60%', md: 'auto' }
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
            minWidth: 0
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
            rows={4}
            fullWidth
            label="Context Preview"
            value={contextPreview}
            onChange={(e) => setContextPreview(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowContextBuilder(false)}>Cancel</Button>
          <Button onClick={() => exportContext('clipboard')} startIcon={<CopyIcon />}>
            Copy to Clipboard
          </Button>
          <Button onClick={() => exportContext('json')} startIcon={<GetAppIcon />}>
            Export JSON
          </Button>
          <Button onClick={() => exportContext('markdown')} startIcon={<GetAppIcon />}>
            Export Markdown
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add to Context Dialog */}
      <Dialog 
        open={showAddToContextDialog} 
        onClose={() => setShowAddToContextDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add to Context</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Context Title"
            value={newContextTitle}
            onChange={(e) => setNewContextTitle(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Select Context</InputLabel>
            <Select
              value={selectedContextId}
              onChange={(e) => setSelectedContextId(e.target.value)}
              label="Select Context"
            >
              <MenuItem value="">
                <em>Create new context</em>
              </MenuItem>
              {contexts?.map((context) => (
                <MenuItem key={context.id} value={context.id}>
                  {context.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddToContextDialog(false)}>Cancel</Button>
                      <Button 
              onClick={handleAddToContextSubmit} 
              variant="contained"
              disabled={isAddingToContext || (!selectedContextId && !newContextTitle.trim())}
            >
              {isAddingToContext ? 'Adding...' : 'Add to Context'}
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConversationsPage;

 