import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Stack,
  Collapse,
  Divider,
  DialogContentText
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandLess,
  ExpandMore,
  Settings as SettingsIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { 
  fetchSystemPrompts, 
  createSystemPrompt, 
  updateSystemPrompt, 
  deleteSystemPrompt
} from '../store/slices/systemPromptsSlice';

// Extracted SystemPromptCard component for better performance
const SystemPromptCard = React.memo<{ 
  systemPrompt: any; 
  onViewEdit: (systemPrompt: any) => void;
}>(({ systemPrompt, onViewEdit }) => {
  const handleViewEdit = useCallback(() => {
    onViewEdit(systemPrompt);
  }, [systemPrompt, onViewEdit]);

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
      {systemPrompt.isBuiltIn && (
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

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Default indicator */}
        {systemPrompt.isDefault && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Chip 
              label="Default" 
              size="small" 
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
        )}

        {/* Name */}
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, lineHeight: 1.2 }}>
          {systemPrompt.name}
        </Typography>

        {/* Content preview */}
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
          {systemPrompt.content}
        </Typography>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
          <Box>
            {systemPrompt.tokenCount?.toLocaleString() || 'Unknown'} tokens
          </Box>
          {systemPrompt.category && (
            <Box>
              {systemPrompt.category}
            </Box>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {!systemPrompt.isBuiltIn && `Updated ${new Date(systemPrompt.updatedAt).toLocaleDateString()}`}
        </Typography>
        <Box>
          <Button 
            size="small" 
            variant="outlined"
            onClick={handleViewEdit}
            sx={{ color: 'primary.dark', borderColor: 'primary.dark' }}
          >
            {systemPrompt.isBuiltIn ? 'View' : 'View/Edit'}
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
});

SystemPromptCard.displayName = 'SystemPromptCard';

const SystemPromptsPage = React.memo(() => {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: systemPrompts, loading } = useAppSelector((state) => state.systemPrompts);

  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserPrompts, setShowUserPrompts] = useState(true);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<any>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  
  // View/Edit form state
  const [viewEditForm, setViewEditForm] = useState({
    name: '',
    content: '',
    category: ''
  });
  
  // Form states
  const [systemPromptForm, setSystemPromptForm] = useState({
    name: '',
    content: '',
    category: ''
  });
  
  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (currentProfile?.id) {
      dispatch(fetchSystemPrompts(currentProfile.id));
    }
  }, [dispatch, currentProfile?.id]);

  // Memoize expensive calculations to prevent recalculation on every render
  const { builtInPrompts, userPrompts } = useMemo(() => {
    const builtIn = systemPrompts.filter(sp => sp.isBuiltIn);
    const user = systemPrompts.filter(sp => !sp.isBuiltIn);
    return { builtInPrompts: builtIn, userPrompts: user };
  }, [systemPrompts]);

  // Memoize filtered prompts based on search query
  const filteredUserPrompts = useMemo(() => {
    if (!searchQuery) return userPrompts;
    
    const query = searchQuery.toLowerCase();
    return userPrompts.filter(prompt => 
      prompt.name.toLowerCase().includes(query) ||
      prompt.content.toLowerCase().includes(query) ||
      (prompt.category && prompt.category.toLowerCase().includes(query))
    );
  }, [userPrompts, searchQuery]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setSelectedSystemPrompt(null);
  }, []);

  const handleCreateSystemPrompt = useCallback(() => {
    setSystemPromptForm({
      name: '',
      content: '',
      category: ''
    });
    setCreateDialogOpen(true);
  }, []);

  const handleEditSystemPrompt = useCallback(() => {
    if (selectedSystemPrompt) {
      setSystemPromptForm({
        name: selectedSystemPrompt.name,
        content: selectedSystemPrompt.content,
        category: selectedSystemPrompt.category || ''
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  }, [selectedSystemPrompt, handleContextMenuClose]);

  const handleCreateSystemPromptSubmit = useCallback(async () => {
    if (!currentProfile?.id || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsCreating(true);
    try {
      await dispatch(createSystemPrompt({ 
        systemPromptData: {
          name: systemPromptForm.name.trim(),
          content: systemPromptForm.content.trim(),
          category: systemPromptForm.category.trim() || undefined,
          isBuiltIn: false,
          isDefault: false,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateDialogOpen(false);
      setSystemPromptForm({ name: '', content: '', category: '' });
    } catch (error) {
      console.error('Error creating system prompt:', error);
    } finally {
      setIsCreating(false);
    }
  }, [dispatch, currentProfile?.id, systemPromptForm, isCreating]);

  const handleUpdateSystemPromptSubmit = useCallback(async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsUpdating(true);
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: systemPromptForm.name.trim(),
          content: systemPromptForm.content.trim(),
          category: systemPromptForm.category.trim() || undefined,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setSystemPromptForm({ name: '', content: '', category: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [dispatch, currentProfile?.id, selectedSystemPrompt, systemPromptForm, isUpdating]);

  const handleDeleteSystemPrompt = useCallback(async () => {
    if (!selectedSystemPrompt) return;
    
    try {
      await dispatch(deleteSystemPrompt(selectedSystemPrompt.id)).unwrap();
      setDeleteDialogOpen(false);
      setViewEditDialogOpen(false);
      setSelectedSystemPrompt(null);
    } catch (error) {
      console.error('Error deleting system prompt:', error);
    }
  }, [dispatch, selectedSystemPrompt]);

  const handleViewEditSystemPrompt = useCallback((systemPrompt: any) => {
    setSelectedSystemPrompt(systemPrompt);
    setViewEditForm({
      name: systemPrompt.name,
      content: systemPrompt.content,
      category: systemPrompt.category || ''
    });
    setViewEditDialogOpen(true);
  }, []);

  const handleViewEditSubmit = useCallback(async () => {
    if (!selectedSystemPrompt || !currentProfile?.id) return;
    
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: viewEditForm.name.trim(),
          content: viewEditForm.content.trim(),
          category: viewEditForm.category.trim() || undefined
        },
        profileId: currentProfile.id
      })).unwrap();
      
      setViewEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setViewEditForm({ name: '', content: '', category: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
    }
  }, [dispatch, selectedSystemPrompt, currentProfile?.id, viewEditForm]);

  // Memoize search query change handler
  const handleSearchQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Memoize toggle handlers
  const handleToggleUserPrompts = useCallback(() => {
    setShowUserPrompts(prev => !prev);
  }, []);

  // Memoize dialog close handlers
  const handleCloseCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditDialogOpen(false);
  }, []);

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
            System Prompts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage system prompts that define AI behavior and personality for your conversations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateSystemPrompt}
          sx={{ borderRadius: 2 }}
        >
          Add System Prompt
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
                placeholder="Search system prompts..."
                value={searchQuery}
                onChange={handleSearchQueryChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* Layout changing buttons removed - functionality not implemented */}
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* Built-in System Prompts Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Built-in System Prompts
          </Typography>
          <Chip 
            label={`${builtInPrompts.length} available`} 
            size="small" 
            sx={{ ml: 2 }}
          />
        </Box>
        
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            lg: 'repeat(3, 1fr)' 
          }, 
          gap: 3 
        }}>
                      {builtInPrompts.map((systemPrompt) => (
              <SystemPromptCard 
                key={systemPrompt.id} 
                systemPrompt={systemPrompt} 
                onViewEdit={handleViewEditSystemPrompt}
              />
            ))}
        </Box>
      </Box>

      {/* User-Created System Prompts Section */}
      {userPrompts.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CodeIcon sx={{ mr: 1, color: 'secondary.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Your Custom System Prompts
            </Typography>
            <Chip 
              label={`${userPrompts.length} created`} 
              size="small" 
              sx={{ ml: 2 }}
            />
            <Button
              size="small"
                              onClick={handleToggleUserPrompts}
              startIcon={showUserPrompts ? <ExpandLess /> : <ExpandMore />}
              sx={{ ml: 'auto' }}
            >
              {showUserPrompts ? 'Hide' : 'Show'}
            </Button>
          </Box>
          
          <Collapse in={showUserPrompts}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(2, 1fr)', 
                lg: 'repeat(3, 1fr)' 
              }, 
              gap: 3 
            }}>
                             {filteredUserPrompts.map((systemPrompt) => (
                 <SystemPromptCard 
                   key={systemPrompt.id} 
                   systemPrompt={systemPrompt} 
                   onViewEdit={handleViewEditSystemPrompt}
                 />
               ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Empty State for User Prompts */}
      {userPrompts.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CodeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No custom system prompts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first custom system prompt to define specific AI behaviors
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateSystemPrompt}>
            Create System Prompt
          </Button>
        </Box>
      )}
      </Box>



      {/* Context Menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
      >
        <MenuItem onClick={handleEditSystemPrompt}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteSystemPrompt} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create System Prompt Dialog */}
              <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth="md" fullWidth>
        <DialogTitle>Create New System Prompt</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={systemPromptForm.name}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Category (optional)"
              value={systemPromptForm.category}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, category: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={6}
              value={systemPromptForm.content}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="You are an expert... (define the AI's role and behavior)"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSystemPromptSubmit}
            disabled={isCreating || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()}
          >
            {isCreating ? 'Creating...' : 'Create System Prompt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit System Prompt Dialog */}
              <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="md" fullWidth>
        <DialogTitle>Edit System Prompt</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={systemPromptForm.name}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Category (optional)"
              value={systemPromptForm.category}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, category: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={6}
              value={systemPromptForm.content}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, content: e.target.value }))}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateSystemPromptSubmit}
            disabled={isUpdating || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View/Edit System Prompt Dialog */}
      <Dialog open={viewEditDialogOpen} onClose={() => setViewEditDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedSystemPrompt?.isBuiltIn ? 'View System Prompt' : 'View/Edit System Prompt'}
          <Typography variant="body2" color="text.secondary">
            {selectedSystemPrompt?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={viewEditForm.name}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, name: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Category (optional)"
              value={viewEditForm.category}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, category: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={12}
              value={viewEditForm.content}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, content: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Box>
            {!selectedSystemPrompt?.isBuiltIn && (
              <Button 
                onClick={() => setDeleteDialogOpen(true)}
                color="error"
                variant="outlined"
                size="small"
              >
                Delete
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setViewEditDialogOpen(false)} sx={{ color: 'primary.dark' }}>
              {selectedSystemPrompt?.isBuiltIn ? 'Close' : 'Cancel'}
            </Button>
            {!selectedSystemPrompt?.isBuiltIn && (
              <Button 
                variant="contained" 
                onClick={handleViewEditSubmit}
                disabled={!viewEditForm.name.trim() || !viewEditForm.content.trim()}
              >
                Save Changes
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete System Prompt</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{selectedSystemPrompt?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteSystemPrompt} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

SystemPromptsPage.displayName = 'SystemPromptsPage';

export default SystemPromptsPage;
