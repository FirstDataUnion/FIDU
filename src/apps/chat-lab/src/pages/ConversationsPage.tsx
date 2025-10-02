import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Paper,
  IconButton,
  Badge,
} from '@mui/material';
import { 
  Chat as ChatIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchConversations, fetchConversationMessages, setFilters, clearFilters } from '../store/slices/conversationsSlice';
import { fetchContexts, addConversationToContext, createContext } from '../store/slices/contextsSlice';
import type { Conversation } from '../types';
import ConversationViewer from '../components/conversations/ConversationViewer';
import ConversationCard from '../components/conversations/ConversationCard';
import ConversationFilters from '../components/conversations/ConversationFilters';
import ContextBuilder from '../components/conversations/ContextBuilder';
import TagManager from '../components/conversations/TagManager';
import AddToContextDialog from '../components/conversations/AddToContextDialog';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useLazyLoad } from '../hooks/useLazyLoad';
import VirtualList from '../components/common/VirtualList';
import { validateSearchQuery } from '../utils/validation';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import {
  selectConversationsLoading,
  selectConversationsError,
  selectAllTags,
  selectAllPlatforms,
  selectSortedConversations
} from '../store/selectors/conversationsSelectors';

const ConversationsPage: React.FC = React.memo(() => {

  const dispatch = useAppDispatch();
  
  // Use memoized selectors for better performance
  const loading = useAppSelector((state) => selectConversationsLoading(state));
  const error = useAppSelector((state) => selectConversationsError(state));
  const { items: contexts } = useAppSelector((state) => state.contexts);
  const { isAuthenticated, currentProfile } = useAppSelector((state) => state.auth);
  
  // Search and Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  
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

  // Memoized search handler to prevent infinite loops
  const handleSearch = useCallback((query: string) => {
    dispatch(setFilters({ searchQuery: query } as any));
  }, [dispatch]);

  // Use debounced search for better performance
  const {
    searchQuery,
    updateSearchQuery,
    clearSearch
  } = useDebouncedSearch({
    delay: 300,
    minLength: 2,
    onSearch: handleSearch
  });

  // Use memoized selectors for better performance
  const allTags = useAppSelector((state) => selectAllTags(state));
  const allPlatforms = useAppSelector((state) => selectAllPlatforms(state));
  const sortedConversations = useAppSelector((state) => selectSortedConversations(state));

  // Use lazy loading for better performance with large lists
  const {
    paginatedItems: _visibleConversations,
    loadingRef: _loadingRef
  } = useLazyLoad({
    items: sortedConversations,
    pageSize: 20,
    threshold: 100,
    enabled: sortedConversations.length > 20
  });

  // Handler functions to update both local state and Redux store
  const handlePlatformsChange = useCallback((platforms: string[]) => {
    setSelectedPlatforms(platforms);
    dispatch(setFilters({ platforms } as any));
  }, [dispatch]);

  const handleTagsChange = useCallback((tags: string[]) => {
    setSelectedTags(tags);
    dispatch(setFilters({ tags } as any));
  }, [dispatch]);

  const handleSortByChange = useCallback((sortBy: string) => {
    setSortBy(sortBy);
    dispatch(setFilters({ sortBy } as any));
  }, [dispatch]);

  const handleSortOrderChange = useCallback((sortOrder: 'asc' | 'desc') => {
    setSortOrder(sortOrder);
    dispatch(setFilters({ sortOrder } as any));
  }, [dispatch]);



  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted) {
        await dispatch(fetchConversations({ 
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc'
          },
          page: 1,
          limit: 20
        }));
        
        if (currentProfile?.id && isMounted) {
          await dispatch(fetchContexts(currentProfile.id));
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [dispatch, isAuthenticated, currentProfile]);

  // Memoized event handlers
  const handleRefresh = useCallback(() => {
    try {
      dispatch(fetchConversations({ 
        filters: {
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        },
        page: 1,
        limit: 20
      }));
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      // Add user-friendly error handling here
    }
  }, [dispatch]);

  // Handle conversation selection for viewing
  const handleConversationSelect = useCallback((conversation: Conversation) => {
    try {
      dispatch(fetchConversationMessages(conversation.id));
      setSelectedConversation(conversation);
    } catch (error) {
      console.error('Error selecting conversation:', error);
      // Add user-friendly error handling here
    }
  }, [dispatch]);

  const buildContextPreview = useCallback(() => {
    try {
      const selectedConversations = sortedConversations.filter((c: Conversation) => selectedForContext.includes(c.id));
      const context = selectedConversations.map((c: Conversation) => 
        `## ${c.title} (${c.platform})\n${c.lastMessage || 'No content preview available'}\n`
      ).join('\n');
      
      setContextPreview(context);
      setEstimatedTokens(Math.ceil(context.length / 4)); // Rough token estimation
      setShowContextBuilder(true);
    } catch (error) {
      console.error('Error building context preview:', error);
      // Add user-friendly error handling here
    }
  }, [sortedConversations, selectedForContext]);

  const handleAddToContext = useCallback(async (conversation: Conversation) => {
    try {
      setSelectedConversationForContext(conversation);
      setSelectedContextId('');
      setNewContextTitle(`${conversation.title} Context`);
      setShowAddToContextDialog(true);
    } catch (error) {
      console.error('Error opening add to context dialog:', error);
      // Add user-friendly error handling here
    }
  }, []);

  const handleAddToContextSubmit = useCallback(async () => {
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
      // Add user-friendly error handling here
      // You could dispatch an error action or show a snackbar
    } finally {
      setIsAddingToContext(false);
    }
  }, [selectedConversationForContext, selectedContextId, newContextTitle, currentProfile?.id, dispatch]);

  const exportContext = useCallback((format: 'clipboard' | 'json' | 'markdown') => {
    const selectedConversations = sortedConversations.filter((c: Conversation) => selectedForContext.includes(c.id));
    
    try {
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
          // Clean up the URL object to prevent memory leaks
          setTimeout(() => URL.revokeObjectURL(jsonUrl), 100);
          break;
        }
        case 'markdown': {
          const mdBlob = new Blob([contextPreview], { type: 'text/markdown' });
          const mdUrl = URL.createObjectURL(mdBlob);
          const mdLink = document.createElement('a');
          mdLink.href = mdUrl;
          mdLink.download = 'chat-lab-context.md';
          mdLink.click();
          // Clean up the URL object to prevent memory leaks
          setTimeout(() => URL.revokeObjectURL(mdUrl), 100);
          break;
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      // Add user-friendly error handling here
    }
  }, [sortedConversations, selectedForContext, contextPreview]);



  // Open tag management dialog
  const handleTagManagement = useCallback((conversation: Conversation, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedConversation(conversation);
    setEditedTags([...conversation.tags]);
    setShowTagDialog(true);
    
    // Focus management - focus the first input in the dialog when it opens
    setTimeout(() => {
      const firstInput = document.querySelector('[role="dialog"] input');
      if (firstInput instanceof HTMLElement) {
        firstInput.focus();
      }
    }, 100);
  }, []);

  // Save tag changes
  const handleSaveTags = useCallback(() => {
    if (selectedConversation) {
      try {
        // Here you would dispatch an action to update the conversation tags
        console.log('Updating conversation tags:', {
          conversationId: selectedConversation.id,
          newTags: editedTags
        });
        // For now, we'll just update locally
        // dispatch(updateConversationTags({ id: selectedConversation.id, tags: editedTags }));
        
        // Add success handling here
        // You could dispatch a success action or show a snackbar
      } catch (error) {
        console.error('Error updating tags:', error);
        // Add error handling here
        // You could dispatch an error action or show a snackbar
      }
    }
    setShowTagDialog(false);
    setSelectedConversation(null);
    setEditedTags([]);
  }, [selectedConversation, editedTags]);

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
    // Check if this is a directory access error for filesystem storage
    const isDirectoryAccessError = error.includes('No directory access') || error.includes('Please select a directory first');
    
    if (isDirectoryAccessError) {
      // Show the page with our banner instead of the raw error
      return (
        <Box sx={{ 
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          height: '100%', // Use full height of parent container
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Storage Directory Banner */}
          <StorageDirectoryBanner pageType="conversations" />
          
          {/* Empty state with message */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            p: 3,
            textAlign: 'center'
          }}>
            <ChatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
              No Conversations Available
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.5 }}>
              Select a directory in Settings to load your conversations
            </Typography>
          </Box>
        </Box>
      );
    }
    
    // For other errors, show the original error handling
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
      {/* Storage Directory Banner */}
      <StorageDirectoryBanner pageType="conversations" />
      
      {/* Header with Search and Actions */}
      <Box sx={{ mb: 3, flexShrink: 0 }} component="header">
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
              onChange={(e) => {
                const value = e.target.value;
                // Sanitize input to prevent XSS
                try {
                  const sanitizedValue = validateSearchQuery(value);
                  updateSearchQuery(sanitizedValue);
                } catch (error) {
                  console.error('Search validation failed:', error);
                  // Fallback to basic sanitization
                  const fallbackValue = value.replace(/[<>'"]/g, '');
                  updateSearchQuery(fallbackValue);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Trigger search or focus next element
                }
                if (e.key === 'Escape') {
                  clearSearch();
                }
              }}
              sx={{ minWidth: 300, flex: 1, maxWidth: 600 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      onClick={() => setShowFilters(!showFilters)}
                      aria-label="Toggle filters"
                    >
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
              aria-label="Refresh conversations"
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
                aria-label={`Build context with ${selectedForContext.length} selected conversations`}
              >
                Build Context ({selectedForContext.length})
            </Button>
            )}
          </Stack>
        </Box>

        {/* Filters Panel */}
        <ConversationFilters
          showFilters={showFilters}
          selectedPlatforms={selectedPlatforms}
          selectedTags={selectedTags}
          sortBy={sortBy}
          sortOrder={sortOrder}
          allPlatforms={allPlatforms}
          allTags={allTags}
          onPlatformsChange={handlePlatformsChange}
          onTagsChange={handleTagsChange}
          onSortByChange={handleSortByChange}
          onSortOrderChange={handleSortOrderChange}
        />
      </Box>

      {/* Context Selection Info */}
      {selectedForContext.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50', flexShrink: 0 }} component="section" aria-label="Context selection status">
          <Typography variant="body2" color="primary">
            <strong>{selectedForContext.length} conversations selected for context building</strong>
            <Button 
              size="small" 
              onClick={() => {
                setSelectedForContext([]);
                setContextPreview('');
                setEstimatedTokens(0);
              }}
              startIcon={<CloseIcon />}
              sx={{ ml: 2 }}
              aria-label="Clear selected conversations"
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
      }} component="main">
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
        }} component="section" aria-label="Conversations list">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="h2">
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
            {sortedConversations.length === 0 ? (
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
                        clearSearch();
                        handlePlatformsChange([]);
                        handleTagsChange([]);
                        handleSortByChange('updatedAt');
                        handleSortOrderChange('desc');
                        dispatch(clearFilters());
                      }}
                      aria-label="Clear all filters"
                    >
                      Clear Filters
                    </Button>
                  )}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 2 
              }}>
                {/* Use virtual scrolling for better performance with large lists */}
                {sortedConversations.length > 50 ? (
                  <VirtualList
                    items={sortedConversations}
                    height={600}
                    itemHeight={200}
                    renderItem={(conversation: Conversation, _index: number) => (
                      <ConversationCard 
                        key={conversation.id} 
                        conversation={conversation}
                        isSelectedForContext={selectedForContext.includes(conversation.id)}
                        isCurrentlyViewing={selectedConversation?.id === conversation.id}
                        onSelect={handleConversationSelect}
                        onTagManagement={handleTagManagement}
                      />
                    )}
                    overscan={3}
                  />
                ) : (
                  // Regular rendering for smaller lists
                  sortedConversations.map((conversation: Conversation) => (
                    <ConversationCard 
                      key={conversation.id} 
                      conversation={conversation}
                      isSelectedForContext={selectedForContext.includes(conversation.id)}
                      isCurrentlyViewing={selectedConversation?.id === conversation.id}
                      onSelect={handleConversationSelect}
                      onTagManagement={handleTagManagement}
                    />
                  ))
                )}
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
          }} component="section" aria-label="Conversation viewer">
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="h3">
                Conversation Details
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddToContext(selectedConversation)}
                  startIcon={<AddIcon />}
                  aria-label="Add this conversation to a context"
                  sx={{ 
                    backgroundColor: 'background.paper',
                    borderColor: 'primary.dark',
                    color: 'primary.dark',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      borderColor: 'primary.dark',
                      color: 'white'
                    }
                  }}
                >
                  Add to Context
                </Button>
                <IconButton 
                  onClick={() => {
                    setSelectedConversation(null);
                    // Clear any related state when closing conversation view
                  }}
                  title="Close conversation view"
                  aria-label="Close conversation view"
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
          }} component="section" aria-label="No conversation selected">
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
              <ContextBuilder
          open={showContextBuilder}
          onClose={() => {
            setShowContextBuilder(false);
            setContextPreview('');
            setEstimatedTokens(0);
          }}
          contextPreview={contextPreview}
          estimatedTokens={estimatedTokens}
          selectedCount={selectedForContext.length}
          onExport={exportContext}
          onContextPreviewChange={setContextPreview}
        />

      {/* Add to Context Dialog */}
      <AddToContextDialog
        open={showAddToContextDialog}
        onClose={() => {
          setShowAddToContextDialog(false);
          setSelectedConversationForContext(null);
          setSelectedContextId('');
          setNewContextTitle('');
          setIsAddingToContext(false);
        }}
        selectedConversation={selectedConversationForContext}
        selectedContextId={selectedContextId}
        newContextTitle={newContextTitle}
        contexts={contexts}
        isAdding={isAddingToContext}
        onContextIdChange={setSelectedContextId}
        onNewContextTitleChange={setNewContextTitle}
        onSubmit={handleAddToContextSubmit}
      />

      {/* Tag Management Dialog */}
      <TagManager
        open={showTagDialog}
        onClose={() => {
          setShowTagDialog(false);
          setSelectedConversation(null);
          setEditedTags([]);
        }}
        editedTags={editedTags}
        allTags={allTags}
        onTagsChange={setEditedTags}
        onSave={handleSaveTags}
      />


    </Box>
  );
});

export default ConversationsPage; 