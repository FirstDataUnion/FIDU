import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOutlined as FolderIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchContexts, createContext, updateContext, deleteContext } from '../store/slices/contextsSlice';
import { fetchConversations, fetchConversationMessages } from '../store/slices/conversationsSlice';

export default function ContextsPage() {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: contexts, loading, error } = useAppSelector((state) => state.contexts);
  const { items: tags } = useAppSelector((state) => state.tags as any);
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<any>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [conversationSelectionDialogOpen, setConversationSelectionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  

  
  // Form states
  const [contextForm, setContextForm] = useState({
    title: '',
    body: '',
    tags: [] as string[]
  });
  
  // View/Edit form state
  const [viewEditForm, setViewEditForm] = useState({
    title: '',
    body: ''
  });
  
  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isViewEditing, setIsViewEditing] = useState(false);

  useEffect(() => {
    dispatch(fetchTags());
    if (currentProfile?.id) {
      dispatch(fetchContexts(currentProfile.id));
    }
  }, [dispatch, currentProfile?.id]);

  const filteredContexts = (contexts || []).filter(context => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        context.title.toLowerCase().includes(query) ||
        context.body.toLowerCase().includes(query) ||
        context.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleContextMenuClose = () => {
    setContextMenuPosition(null);
    setSelectedContext(null);
  };

  const handleCreateContext = () => {
    setContextForm({
      title: '',
      body: '',
      tags: []
    });
    setCreateDialogOpen(true);
  };

  const handleEditContext = () => {
    if (selectedContext) {
      setContextForm({
        title: selectedContext.title,
        body: selectedContext.body,
        tags: selectedContext.tags
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  };

  const handleCreateContextSubmit = async () => {
    if (!currentProfile?.id || !contextForm.title.trim()) return;
    
    setIsCreating(true);
    try {
      await dispatch(createContext({ 
        contextData: {
          title: contextForm.title.trim(),
          body: contextForm.body.trim(),
          tags: contextForm.tags
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateDialogOpen(false);
      setContextForm({ title: '', body: '', tags: [] });
    } catch (error) {
      console.error('Error creating context:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateContextSubmit = async () => {
    if (!currentProfile?.id || !selectedContext || !contextForm.title.trim()) return;
    
    setIsUpdating(true);
    try {
      await dispatch(updateContext({ 
        context: {
          id: selectedContext.id,
          title: contextForm.title.trim(),
          body: contextForm.body.trim(),
          tags: contextForm.tags
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setEditDialogOpen(false);
      setSelectedContext(null);
      setContextForm({ title: '', body: '', tags: [] });
    } catch (error) {
      console.error('Error updating context:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteContext = async () => {
    if (!selectedContext) return;
    
    try {
      await dispatch(deleteContext(selectedContext.id)).unwrap();
      setDeleteDialogOpen(false);
      setViewEditDialogOpen(false);
      setSelectedContext(null);
    } catch (error) {
      console.error('Error deleting context:', error);
    }
  };

  const handleViewEditContext = (context: any) => {
    setSelectedContext(context);
    setViewEditForm({
      title: context.title,
      body: context.body
    });
    setViewEditDialogOpen(true);
  };

  const handleViewEditSubmit = async () => {
    if (!selectedContext || !currentProfile?.id) return;
    
    setIsViewEditing(true);
    try {
      await dispatch(updateContext({ 
        context: {
          id: selectedContext.id,
          title: viewEditForm.title.trim(),
          body: viewEditForm.body.trim()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setViewEditDialogOpen(false);
      setSelectedContext(null);
      setViewEditForm({ title: '', body: '' });
    } catch (error) {
      console.error('Error updating context:', error);
    } finally {
      setIsViewEditing(false);
    }
  };

  const handleAddConversationToContext = async (conversation: any) => {
    if (!selectedContext || !currentProfile?.id) return;
    
    try {
      console.log('Adding conversation to context:', conversation.id);
      
      // Fetch the full conversation messages
      const messagesResult = await dispatch(fetchConversationMessages(conversation.id)).unwrap();
      console.log('Fetched messages:', messagesResult);
      
      if (!messagesResult || messagesResult.length === 0) {
        console.log('No messages found for conversation');
        return;
      }
      
      // Format the conversation content with role and message
      const conversationContent = messagesResult.map((msg: any) => 
        `${msg.role}: ${msg.content}`
      ).join('\n\n');
      
      // Append conversation content to current form content (not saved context)
      const updatedBody = viewEditForm.body + '\n\nPast conversation context:\n\n' + conversationContent;
      
      console.log('Updated context body:', updatedBody);
      
      // Update the context with the new content
      await dispatch(updateContext({ 
        context: {
          id: selectedContext.id,
          title: selectedContext.title,
          body: updatedBody
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      // Update the local form state
      setViewEditForm(prev => ({
        ...prev,
        body: updatedBody
      }));
      
      // Close the conversation selection dialog
      setConversationSelectionDialogOpen(false);
      
      // Show success message (you could add a toast notification here)
      console.log('Conversation added to context successfully');
    } catch (error) {
      console.error('Error adding conversation to context:', error);
    }
  };



  // Conversation Selection List Component
  const ConversationSelectionList = ({ onConversationSelect }: { 
    onConversationSelect: (conversation: any) => void; 
  }) => {
    const { items: conversations = [], loading: conversationsLoading } = useAppSelector((state) => state.conversations);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Fetch conversations when component mounts
    useEffect(() => {
      if (currentProfile?.id) {
        dispatch(fetchConversations({ 
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc'
          },
          page: 1,
          limit: 100
        }));
      }
    }, [dispatch, currentProfile?.id]);
    
    const filteredConversations = conversations.filter(conversation => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          conversation.title.toLowerCase().includes(query) ||
          conversation.lastMessage?.toLowerCase().includes(query) ||
          conversation.tags.some((tag: string) => tag.toLowerCase().includes(query))
        );
      }
      return true;
    });
    
    return (
      <Box sx={{ pt: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => onConversationSelect(conversation)}
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
  };

  const ContextCard = ({ context }: { context: any }) => {
    const isBuiltIn = context.isBuiltIn || false;
    
    return (
      <Card 
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          '&:hover': { 
            boxShadow: 4,
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out'
          }
        }}
      >
        {/* Built-in indicator */}
        {isBuiltIn && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              fontWeight: 500,
              zIndex: 2
            }}
          >
            Built-in
          </Box>
        )}

        {/* Header with menu */}
        {/* Removed three-dot menu - functionality moved to edit modal */}

        <CardContent sx={{ flexGrow: 1, pb: 1, pt: isBuiltIn ? 4 : 2 }}>
          {/* Title and body */}
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 1, 
              fontWeight: 600, 
              lineHeight: 1.2,
              pr: 8, // Add right padding to prevent overlap with buttons
              wordBreak: 'break-word', // Allow long words to break
              overflowWrap: 'break-word' // Modern CSS for better word breaking
            }}
          >
            {context.title}
          </Typography>
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
            {context.body}
          </Typography>

          {/* Tags */}
          <Box sx={{ mb: 2 }}>
            {context.tags.map((tag: string) => (
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

          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2, mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
            <Box>
              {context.tokenCount.toLocaleString()} tokens
            </Box>
          </Box>
        </CardContent>

        <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {!isBuiltIn && `Updated ${new Date(context.updatedAt).toLocaleDateString()}`}
          </Typography>
          <Box>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleViewEditContext(context)}
              sx={{ color: 'primary.dark', borderColor: 'primary.dark' }}
            >
              {isBuiltIn ? 'View' : 'View/Edit'}
            </Button>
          </Box>
        </CardActions>
      </Card>
    );
  };



  // Get tag color
  const getTagColor = (tagName: string) => {
    const tag = (tags || []).find((t: any) => t.name === tagName);
    return tag?.color || 'secondary.main';
  };



  return (
    <Box sx={{ 
      height: '100%', // Use full height of parent container
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden' // Prevent outer page scrolling
    }}>
      {/* Scrollable Content Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', // Enable scrolling for content
        p: 3,
        minHeight: 0 // Ensure flex child can shrink properly
      }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            Contexts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your conversation contexts, references, and knowledge bases
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateContext}
          sx={{ borderRadius: 2 }}
        >
          Add Context
        </Button>
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flexGrow: 1, width: { xs: '100%', md: 'auto' } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search contexts..."
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

          </Stack>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* Layout changing buttons removed - functionality not implemented */}
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* Context Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            lg: 'repeat(3, 1fr)' 
          }, 
          gap: 3 
        }}>
          {filteredContexts.map((context) => (
            <ContextCard key={context.id} context={context} />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {filteredContexts.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No contexts found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery ? 'Try adjusting your search' : 'Create your first context to get started'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateContext}>
            Create Context
          </Button>
        </Box>
      )}
      </Box>



      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenuPosition)}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuPosition
            ? { top: contextMenuPosition.y, left: contextMenuPosition.x }
            : undefined
        }
      >
        <MenuItem onClick={handleEditContext}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDeleteContext} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Context Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Context</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={contextForm.title}
              onChange={(e) => setContextForm(prev => ({ ...prev, title: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Body"
              multiline
              rows={4}
              value={contextForm.body}
              onChange={(e) => setContextForm(prev => ({ ...prev, body: e.target.value }))}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateContextSubmit}
            disabled={isCreating || !contextForm.title.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Context'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Context Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Context</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={contextForm.title}
              onChange={(e) => setContextForm(prev => ({ ...prev, title: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Body"
              multiline
              rows={4}
              value={contextForm.body}
              onChange={(e) => setContextForm(prev => ({ ...prev, body: e.target.value }))}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateContextSubmit}
            disabled={isUpdating || !contextForm.title.trim()}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View/Edit Context Dialog */}
      <Dialog open={viewEditDialogOpen} onClose={() => setViewEditDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedContext?.isBuiltIn ? 'View Context' : 'View/Edit Context'}
          <Typography variant="body2" color="text.secondary">
            {selectedContext?.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={viewEditForm.title}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, title: e.target.value }))}
              disabled={selectedContext?.isBuiltIn}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Content"
              multiline
              rows={12}
              value={viewEditForm.body}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, body: e.target.value }))}
              disabled={selectedContext?.isBuiltIn}
              sx={{ fontFamily: 'monospace' }}
            />
            

          </Box>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
            {!selectedContext?.isBuiltIn && (
              <>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  color="error"
                  variant="outlined"
                  size="small"
                >
                  Delete
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setConversationSelectionDialogOpen(true)}
                  sx={{
                    borderColor: 'primary.dark',
                    color: 'primary.dark',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      borderColor: 'primary.dark',
                    }
                  }}
                >
                  Add Existing Conversation to Context
                </Button>
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setViewEditDialogOpen(false)} sx={{ color: 'primary.dark' }}>Close</Button>
            {!selectedContext?.isBuiltIn && (
          <Button 
            variant="contained" 
            onClick={handleViewEditSubmit}
            disabled={isViewEditing || !viewEditForm.title.trim() || !viewEditForm.body.trim()}
          >
            {isViewEditing ? 'Saving...' : 'Save Changes'}
          </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Context Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the context "{selectedContext?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button onClick={handleDeleteContext} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>


      {/* Conversation Selection Dialog */}
      <Dialog open={conversationSelectionDialogOpen} onClose={() => setConversationSelectionDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Add Conversation to Context
          <Typography variant="body2" color="text.secondary">
            Select a conversation to append to "{selectedContext?.title}"
          </Typography>
        </DialogTitle>
        <DialogContent>
          <ConversationSelectionList 
            onConversationSelect={handleAddConversationToContext}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
} 