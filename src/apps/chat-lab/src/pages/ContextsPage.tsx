import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  InputAdornment,
  Fab,
  Alert,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Stack,
  Autocomplete
} from '@mui/material';

import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOutlined as FolderIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Tag as TagIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchContexts, createContext, updateContext, deleteContext } from '../store/slices/contextsSlice';

export default function ContextsPage() {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: contexts, loading, error } = useAppSelector((state) => state.contexts);
  const { items: tags } = useAppSelector((state) => state.tags as any);
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<any>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Tag Management State
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedContextForTags, setSelectedContextForTags] = useState<any>(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  
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

  const handleContextMenuOpen = (event: React.MouseEvent<HTMLElement>, context: any) => {
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setSelectedContext(context);
  };

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
      handleContextMenuClose();
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



  const ContextCard = ({ context }: { context: any }) => {
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
        {/* Header with menu */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => handleTagManagement(context, e)}
              sx={{ 
                backgroundColor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
              title="Manage Tags"
            >
              <TagIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => handleContextMenuOpen(e, context)}
              sx={{ 
                backgroundColor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
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
            Updated {new Date(context.updatedAt).toLocaleDateString()}
          </Typography>
          <Box>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleViewEditContext(context)}
            >
              View/Edit
            </Button>
          </Box>
        </CardActions>
      </Card>
    );
  };

  // Open tag management dialog
  const handleTagManagement = (context: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedContextForTags(context);
    setEditedTags([...context.tags]);
    setShowTagDialog(true);
  };

  // Save tag changes
  const handleSaveTags = () => {
    if (selectedContextForTags) {
      // Here you would dispatch an action to update the context tags
      console.log('Updating context tags:', {
        contextId: selectedContextForTags.id,
        newTags: editedTags
      });
      // For now, we'll just update locally
      // dispatch(updateContextTags({ id: selectedContextForTags.id, tags: editedTags }));
    }
    setShowTagDialog(false);
    setSelectedContextForTags(null);
    setEditedTags([]);
  };

  // Get tag color
  const getTagColor = (tagName: string) => {
    const tag = (tags || []).find((t: any) => t.name === tagName);
    return tag?.color || '#2196F3';
  };

  // Get unique tags for autocomplete
  const allTags = [...new Set((contexts || []).flatMap(c => c.tags))];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Contexts
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your conversation contexts, references, and knowledge bases
        </Typography>
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
              <IconButton
                size="small"
                onClick={() => setViewMode('grid')}
                color={viewMode === 'grid' ? 'primary' : 'default'}
              >
                <GridViewIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setViewMode('list')}
                color={viewMode === 'list' ? 'primary' : 'default'}
              >
                <ListViewIcon />
              </IconButton>
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

      {/* FAB */}
      <Fab
        color="primary"
        aria-label="add context"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleCreateContext}
      >
        <AddIcon />
      </Fab>

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
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
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
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
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
          View/Edit Context
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
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Content"
              multiline
              rows={18}
              value={viewEditForm.body}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, body: e.target.value }))}
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleViewEditSubmit}
            disabled={isViewEditing || !viewEditForm.title.trim() || !viewEditForm.body.trim()}
          >
            {isViewEditing ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={showTagDialog} onClose={() => setShowTagDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Manage Tags</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTagDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTags}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 