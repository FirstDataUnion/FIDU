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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  FileDownload as ImportIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import {
  fetchConversations,
  fetchConversationMessages,
  setFilters,
  clearFilters,
  updateConversationTags,
} from '../store/slices/conversationsSlice';
import {
  fetchContexts,
  addConversationToContext,
  createContext,
} from '../store/slices/contextsSlice';
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
import { useMultiSelect } from '../hooks/useMultiSelect';
import { FloatingExportActions } from '../components/resourceExport/FloatingExportActions';
import { getResourceExportService } from '../services/resourceExport/resourceExportService';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';
import type { ExportSelection } from '../services/resourceExport/types';
import {
  selectConversationsLoading,
  selectConversationsError,
  selectAllTags,
  selectSortedConversations,
} from '../store/selectors/conversationsSelectors';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

const ConversationsPage: React.FC = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const dispatch = useAppDispatch();

  // Use memoized selectors for better performance
  const loading = useAppSelector(state => selectConversationsLoading(state));
  const error = useAppSelector(state => selectConversationsError(state));
  const { items: contexts } = useAppSelector(state => state.contexts);
  const { isAuthenticated, currentProfile, currentWorkspace, user } =
    useAppSelector(state => state.auth);
  const unifiedStorage = useUnifiedStorage();

  // Search and Filter State
  const [showFilters, setShowFilters] = useState(false);
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
  const [selectedConversationForContext, setSelectedConversationForContext] =
    useState<Conversation | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string>('');
  const [newContextTitle, setNewContextTitle] = useState<string>('');
  const [isAddingToContext, setIsAddingToContext] = useState(false);

  // Tag Management State
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);

  // Mobile View State
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Multi-select for export
  const multiSelect = useMultiSelect();
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Memoized search handler to prevent infinite loops
  const handleSearch = useCallback(
    (query: string) => {
      dispatch(setFilters({ searchQuery: query } as any));
    },
    [dispatch]
  );

  // Use debounced search for better performance
  const { searchQuery, updateSearchQuery, clearSearch } = useDebouncedSearch({
    delay: 300,
    minLength: 2,
    onSearch: handleSearch,
  });

  // Use memoized selectors for better performance
  const allTags = useAppSelector(state => selectAllTags(state));
  const sortedConversations = useAppSelector(state =>
    selectSortedConversations(state)
  );
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  useEffect(() => {
    if (selectedConversationId) {
      setSelectedConversation(
        sortedConversations.find(c => c.id === selectedConversationId) || null
      );
    } else {
      setSelectedConversation(null);
    }
  }, [selectedConversationId, sortedConversations]);

  // Use lazy loading for better performance with large lists
  const { paginatedItems: _visibleConversations, loadingRef: _loadingRef } =
    useLazyLoad({
      items: sortedConversations,
      pageSize: 20,
      threshold: 100,
      enabled: sortedConversations.length > 20,
    });

  // Handler functions to update both local state and Redux store
  const handleTagsChange = useCallback(
    (tags: string[]) => {
      setSelectedTags(tags);
      dispatch(setFilters({ tags } as any));
    },
    [dispatch]
  );

  const handleSortByChange = useCallback(
    (sortBy: string) => {
      setSortBy(sortBy);
      dispatch(setFilters({ sortBy } as any));
    },
    [dispatch]
  );

  const handleSortOrderChange = useCallback(
    (sortOrder: 'asc' | 'desc') => {
      setSortOrder(sortOrder);
      dispatch(setFilters({ sortOrder } as any));
    },
    [dispatch]
  );

  const isContextsEnabled = useFeatureFlag('context');

  useEffect(() => {
    // Don't fetch while workspace is switching - wait for it to complete
    if (unifiedStorage.isSwitchingWorkspace) {
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      if (isMounted) {
        try {
          await dispatch(
            fetchConversations({
              filters: {
                sortBy: 'updatedAt',
                sortOrder: 'desc',
              },
              page: 1,
              limit: 20,
            })
          );

          if (currentProfile?.id && isMounted) {
            await dispatch(fetchContexts(currentProfile.id));
          }
        } catch {
          // If fetch fails due to auth not ready, the error will be handled by the slice
          console.log('Initial fetch failed, will retry when auth completes');
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [
    dispatch,
    isAuthenticated,
    currentProfile,
    currentWorkspace?.id, // Also depend on currentWorkspace from auth slice
    unifiedStorage.googleDrive.isAuthenticated,
    unifiedStorage.activeWorkspace?.id,
    unifiedStorage.isSwitchingWorkspace, // Wait for switch to complete
  ]);

  // Memoized event handlers
  const handleRefresh = useCallback(() => {
    try {
      dispatch(
        fetchConversations({
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          },
          page: 1,
          limit: 20,
        })
      );
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      // Add user-friendly error handling here
    }
  }, [dispatch]);

  // Handle conversation selection for viewing
  const handleConversationSelect = useCallback(
    (conversation: Conversation) => {
      try {
        dispatch(fetchConversationMessages(conversation.id));
        setSelectedConversationId(conversation.id);
        if (isMobile) {
          setMobileView('detail');
        }
      } catch (error) {
        console.error('Error selecting conversation:', error);
        // Add user-friendly error handling here
      }
    },
    [dispatch, isMobile]
  );

  // Handle back navigation on mobile
  const handleMobileBack = useCallback(() => {
    setMobileView('list');
    setSelectedConversationId(null);
  }, []);

  const buildContextPreview = useCallback(() => {
    try {
      const selectedConversations = sortedConversations.filter(
        (c: Conversation) => selectedForContext.includes(c.id)
      );
      const context = selectedConversations
        .map(
          (c: Conversation) =>
            `## ${c.title} (${c.platform})\n${c.lastMessage || 'No content preview available'}\n`
        )
        .join('\n');

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
      const messages = await dispatch(
        fetchConversationMessages(selectedConversationForContext.id)
      ).unwrap();

      // Prepare conversation data
      const conversationData = {
        title: selectedConversationForContext.title,
        messages: messages || [],
        platform: selectedConversationForContext.platform,
      };

      let targetContextId = selectedContextId;

      // If no context selected, create a new one
      if (!selectedContextId) {
        const newContext = await dispatch(
          createContext({
            contextData: {
              title: newContextTitle,
              body: ``,
              tags: ['conversation-context'],
              conversationIds: [],
              conversationMetadata: {
                totalMessages: 0,
                lastAddedAt: new Date().toISOString(),
                platforms: [],
              },
            },
            profileId: currentProfile.id,
          })
        ).unwrap();
        targetContextId = newContext.id;
      }

      // Add to context
      await dispatch(
        addConversationToContext({
          contextId: targetContextId,
          conversationId: selectedConversationForContext.id,
          conversationData,
          profileId: currentProfile.id,
        })
      ).unwrap();

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
  }, [
    selectedConversationForContext,
    selectedContextId,
    newContextTitle,
    currentProfile?.id,
    dispatch,
  ]);

  const exportContext = useCallback(
    (format: 'clipboard' | 'json' | 'markdown') => {
      const selectedConversations = sortedConversations.filter(
        (c: Conversation) => selectedForContext.includes(c.id)
      );

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
            const mdBlob = new Blob([contextPreview], {
              type: 'text/markdown',
            });
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
    },
    [sortedConversations, selectedForContext, contextPreview]
  );

  // Open tag management dialog
  const handleTagManagement = useCallback(
    (conversation: Conversation, event: React.MouseEvent) => {
      event.stopPropagation();
      setSelectedConversationId(conversation.id);
      setEditedTags([...conversation.tags]);
      setShowTagDialog(true);

      // Focus management - focus the first input in the dialog when it opens
      setTimeout(() => {
        const firstInput = document.querySelector('[role="dialog"] input');
        if (firstInput instanceof HTMLElement) {
          firstInput.focus();
        }
      }, 100);
    },
    []
  );

  // Export handlers
  const handleExportSelected = useCallback(async () => {
    if (!currentProfile?.id || multiSelect.selectionCount === 0) return;

    setIsExporting(true);
    try {
      const exportService = getResourceExportService();
      const selection: ExportSelection = {
        conversationIds: Array.from(multiSelect.selectedIds),
      };

      const exportData = await exportService.exportResources(
        selection,
        currentProfile.id,
        user?.email
      );

      exportService.downloadExport(exportData);
      multiSelect.exitSelectionMode();
    } catch (error) {
      console.error('Export failed:', error);
      // Could add error snackbar here
    } finally {
      setIsExporting(false);
    }
  }, [currentProfile?.id, multiSelect, user?.email]);

  const handleCancelExport = useCallback(() => {
    multiSelect.exitSelectionMode();
  }, [multiSelect]);

  // Save tag changes
  const handleSaveTags = useCallback(() => {
    if (selectedConversationId) {
      try {
        // Dispatch action to update conversation tags
        dispatch(
          updateConversationTags({
            id: selectedConversationId,
            tags: editedTags,
          })
        );

        // Add success handling here
        // You could dispatch a success action or show a snackbar
      } catch (error) {
        console.error('Error updating tags:', error);
        // Add error handling here
        // You could dispatch an error action or show a snackbar
      }
    }
    setShowTagDialog(false);
    setSelectedConversationId(null);
    setEditedTags([]);
  }, [selectedConversationId, editedTags, dispatch]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading conversations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    // Check if this is a Google Drive authentication error or storage not configured
    const isGoogleDriveAuthError =
      error.includes('User must authenticate with Google Drive first')
      || error.includes('Please connect your Google Drive account');
    const isStorageNotConfigured = unifiedStorage.status !== 'configured';

    if (isGoogleDriveAuthError || isStorageNotConfigured) {
      // Show the page with our banner instead of the raw error
      return (
        <Box
          sx={{
            overflow: 'hidden',
            width: '100%',
            boxSizing: 'border-box',
            height: '100%', // Use full height of parent container
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Empty state with message */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
              textAlign: 'center',
            }}
          >
            <ChatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
              {isStorageNotConfigured
                ? 'No storage option selected.'
                : 'No Conversations Available'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.5 }}>
              {isStorageNotConfigured ? (
                'No Conversations Available. Please configure storage to use this feature'
              ) : (
                <>
                  There was an error connecting to Google Drive. Please&nbsp;
                  <a
                    href="https://github.com/FirstDataUnion/FIDU/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline' }}
                  >
                    report this
                  </a>
                  . In the meantime, disconnecting and reconnecting Google Drive
                  (click cloud icon above) may fix the issue.
                </>
              )}
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
        <Button
          variant="outlined"
          onClick={handleRefresh}
          startIcon={<RefreshIcon />}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <Box
        sx={{
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {mobileView === 'list' ? (
          // Mobile Conversations List View
          <>
            {/* Header with Search */}
            <Box sx={{ p: 2, flexShrink: 0 }} component="header">
              <Typography
                variant="h5"
                component="h1"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                Conversations
              </Typography>

              <TextField
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => {
                  const value = e.target.value;
                  try {
                    const sanitizedValue = validateSearchQuery(value);
                    updateSearchQuery(sanitizedValue);
                  } catch (error) {
                    console.error('Search validation failed:', error);
                    const fallbackValue = value.replace(/[<>'"]/g, '');
                    updateSearchQuery(fallbackValue);
                  }
                }}
                fullWidth
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
                        <Badge
                          badgeContent={selectedTags.length}
                          color="primary"
                        >
                          <FilterIcon />
                        </Badge>
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Filters Panel */}
              <ConversationFilters
                showFilters={showFilters}
                selectedTags={selectedTags}
                sortBy={sortBy}
                sortOrder={sortOrder}
                allTags={allTags}
                onTagsChange={handleTagsChange}
                onSortByChange={handleSortByChange}
                onSortOrderChange={handleSortOrderChange}
              />
            </Box>

            {/* Conversations List */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
              {sortedConversations.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ChatIcon
                    sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    {searchQuery || selectedTags.length > 0
                      ? 'No conversations match your filters'
                      : 'No conversations found'}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {searchQuery || selectedTags.length > 0
                      ? 'Try adjusting your search terms or filters'
                      : 'Your AI conversations will appear here once you have some data.'}
                  </Typography>
                  {(searchQuery || selectedTags.length > 0) && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        clearSearch();
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
                </Box>
              ) : (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
                >
                  {sortedConversations.map((conversation: Conversation) => (
                    <ConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      isSelectedForContext={selectedForContext.includes(
                        conversation.id
                      )}
                      isCurrentlyViewing={
                        selectedConversationId === conversation.id
                      }
                      onSelect={handleConversationSelect}
                      onTagManagement={handleTagManagement}
                      isSelectionMode={multiSelect.isSelectionMode}
                      isSelected={multiSelect.isSelected(conversation.id)}
                      onToggleSelection={multiSelect.toggleSelection}
                      onEnterSelectionMode={multiSelect.enterSelectionMode}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </>
        ) : (
          // Mobile Conversation Detail View
          <>
            {/* Header with Back Button and Add to Context */}
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <IconButton
                onClick={handleMobileBack}
                aria-label="Back to conversations"
              >
                <ArrowBackIcon />
              </IconButton>
              {selectedConversation && isContextsEnabled && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddToContext(selectedConversation)}
                  startIcon={<AddIcon />}
                  aria-label="Add this conversation to a context"
                >
                  Add to Context
                </Button>
              )}
            </Box>

            {/* Conversation Content */}
            {selectedConversation && (
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ConversationViewer conversation={selectedConversation} />
              </Box>
            )}
          </>
        )}

        {/* Dialogs */}
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

        <TagManager
          open={showTagDialog}
          onClose={() => {
            setShowTagDialog(false);
            setSelectedConversationId(null);
            setEditedTags([]);
          }}
          editedTags={editedTags}
          allTags={allTags}
          onTagsChange={setEditedTags}
          onSave={handleSaveTags}
        />

        {/* Floating Export Actions */}
        {multiSelect.isSelectionMode && (
          <FloatingExportActions
            selectionCount={multiSelect.selectionCount}
            onExport={handleExportSelected}
            onCancel={handleCancelExport}
            disabled={isExporting}
          />
        )}

        {/* Resource Import Dialog */}
        <ResourceImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImportComplete={() => {
            // Refresh conversations after import
            if (currentProfile?.id) {
              dispatch(fetchConversations({}));
            }
          }}
        />
      </Box>
    );
  }

  // Desktop Layout (original)
  return (
    <Box
      sx={{
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with Search and Actions */}
      <Box sx={{ mb: 3, flexShrink: 0 }} component="header">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Search Bar */}
            <TextField
              placeholder="Search conversations, content, or tags..."
              value={searchQuery}
              onChange={e => {
                const value = e.target.value;
                try {
                  const sanitizedValue = validateSearchQuery(value);
                  updateSearchQuery(sanitizedValue);
                } catch (error) {
                  console.error('Search validation failed:', error);
                  const fallbackValue = value.replace(/[<>'"]/g, '');
                  updateSearchQuery(fallbackValue);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
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
                      <Badge badgeContent={selectedTags.length} color="primary">
                        <FilterIcon />
                      </Badge>
                    </IconButton>
                  </InputAdornment>
                ),
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
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="outlined"
              startIcon={<ImportIcon />}
              onClick={() => setShowImportDialog(true)}
              aria-label="Import resources"
              sx={{
                flexShrink: 0,
                color: 'primary.dark',
                borderColor: 'primary.dark',
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'primary.light',
                  borderColor: 'primary.main',
                },
              }}
            >
              Import
            </Button>
            <Button
              variant="outlined"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
              aria-label="Refresh conversations"
              sx={{
                flexShrink: 0,
                color: 'primary.dark',
                borderColor: 'primary.dark',
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'primary.light',
                  borderColor: 'primary.main',
                },
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
          selectedTags={selectedTags}
          sortBy={sortBy}
          sortOrder={sortOrder}
          allTags={allTags}
          onTagsChange={handleTagsChange}
          onSortByChange={handleSortByChange}
          onSortOrderChange={handleSortOrderChange}
        />
      </Box>

      {/* Context Selection Info */}
      {selectedForContext.length > 0 && (
        <Paper
          sx={{ p: 2, mb: 2, bgcolor: 'primary.50', flexShrink: 0 }}
          component="section"
          aria-label="Context selection status"
        >
          <Typography variant="body2" color="primary">
            <strong>
              {selectedForContext.length} conversations selected for context
              building
            </strong>
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
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          minHeight: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          flexDirection: { xs: 'column', md: 'row' },
        }}
        component="main"
      >
        {/* Left Panel - Conversations List */}
        <Paper
          sx={{
            flex: selectedConversationId ? '0 0 min(400px, 40%)' : '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: selectedConversationId ? '300px' : 'auto',
            maxWidth: selectedConversationId ? '500px' : '600px',
            height: { xs: selectedConversationId ? '40%' : '100%', md: 'auto' },
            minHeight: 0,
            maxHeight: '100%',
          }}
          component="section"
          aria-label="Conversations list"
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="h2">
              Conversations
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: theme =>
                  theme.palette.mode === 'dark' ? '#424242' : '#f1f1f1',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#555',
              },
            }}
          >
            {sortedConversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ChatIcon
                  sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  {searchQuery || selectedTags.length > 0
                    ? 'No conversations match your filters'
                    : 'No conversations found'}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search terms or filters'
                    : 'Your AI conversations will appear here once you have some data.'}
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  {(searchQuery || selectedTags.length > 0) && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        clearSearch();
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
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {sortedConversations.length > 50 ? (
                  <VirtualList
                    items={sortedConversations}
                    height={600}
                    itemHeight={200}
                    renderItem={(
                      conversation: Conversation,
                      _index: number
                    ) => (
                      <ConversationCard
                        key={conversation.id}
                        conversation={conversation}
                        isSelectedForContext={selectedForContext.includes(
                          conversation.id
                        )}
                        isCurrentlyViewing={
                          selectedConversationId === conversation.id
                        }
                        onSelect={handleConversationSelect}
                        onTagManagement={handleTagManagement}
                      />
                    )}
                    overscan={3}
                  />
                ) : (
                  sortedConversations.map((conversation: Conversation) => (
                    <ConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      isSelectedForContext={selectedForContext.includes(
                        conversation.id
                      )}
                      isCurrentlyViewing={
                        selectedConversationId === conversation.id
                      }
                      onSelect={handleConversationSelect}
                      onTagManagement={handleTagManagement}
                      isSelectionMode={multiSelect.isSelectionMode}
                      isSelected={multiSelect.isSelected(conversation.id)}
                      onToggleSelection={multiSelect.toggleSelection}
                      onEnterSelectionMode={multiSelect.enterSelectionMode}
                    />
                  ))
                )}
              </Box>
            )}
          </Box>
        </Paper>

        {/* Right Panel - Conversation Viewer */}
        {selectedConversation && (
          <Paper
            sx={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
              height: { xs: '60%', md: 'auto' },
            }}
            component="section"
            aria-label="Conversation viewer"
          >
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" component="h3">
                Conversation Details
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {isContextsEnabled && (
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
                        color: 'white',
                      },
                    }}
                  >
                    Add to Context
                  </Button>
                )}
                <IconButton
                  onClick={() => {
                    setSelectedConversationId(null);
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
          <Paper
            sx={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'grey.50',
              minWidth: 0,
            }}
            component="section"
            aria-label="No conversation selected"
          >
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

      {/* Dialogs */}
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

      <TagManager
        open={showTagDialog}
        onClose={() => {
          setShowTagDialog(false);
          setSelectedConversationId(null);
          setEditedTags([]);
        }}
        editedTags={editedTags}
        allTags={allTags}
        onTagsChange={setEditedTags}
        onSave={handleSaveTags}
      />

      {/* Floating Export Actions */}
      {multiSelect.isSelectionMode && (
        <FloatingExportActions
          selectionCount={multiSelect.selectionCount}
          onExport={handleExportSelected}
          onCancel={handleCancelExport}
          disabled={isExporting}
        />
      )}

      {/* Resource Import Dialog */}
      <ResourceImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          // Refresh conversations after import
          if (currentProfile?.id) {
            dispatch(fetchConversations({}));
          }
        }}
      />
    </Box>
  );
});

export default ConversationsPage;
