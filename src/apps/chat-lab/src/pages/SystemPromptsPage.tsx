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
  ListItemIcon,
  ListItemText,
  Stack,
  Collapse,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandLess,
  ExpandMore,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Tag as TagIcon,
  Settings as SettingsIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchTags } from '../store/slices/tagsSlice';
import { 
  fetchSystemPrompts, 
  createSystemPrompt, 
  updateSystemPrompt, 
  deleteSystemPrompt
} from '../store/slices/systemPromptsSlice';

export default function SystemPromptsPage() {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: systemPrompts, loading } = useAppSelector((state) => state.systemPrompts);
  const { items: tags } = useAppSelector((state) => state.tags as any);
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUserPrompts, setShowUserPrompts] = useState(true);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<any>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Tag Management State
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedSystemPromptForTags, setSelectedSystemPromptForTags] = useState<any>(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  
  // Form states
  const [systemPromptForm, setSystemPromptForm] = useState({
    name: '',
    content: '',
    description: '',
    category: '',
    tags: [] as string[]
  });
  
  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    dispatch(fetchTags());
    if (currentProfile?.id) {
      dispatch(fetchSystemPrompts(currentProfile.id));
    }
  }, [dispatch, currentProfile?.id]);

  // Separate built-in and user-created system prompts
  const builtInPrompts = systemPrompts.filter(sp => sp.isSystem);
  const userPrompts = systemPrompts.filter(sp => !sp.isSystem);



  const handleContextMenuOpen = (event: React.MouseEvent<HTMLElement>, systemPrompt: any) => {
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setSelectedSystemPrompt(systemPrompt);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
    setSelectedSystemPrompt(null);
  };

  const handleCreateSystemPrompt = () => {
    setSystemPromptForm({
      name: '',
      content: '',
      description: '',
      category: '',
      tags: []
    });
    setCreateDialogOpen(true);
  };

  const handleEditSystemPrompt = () => {
    if (selectedSystemPrompt) {
      setSystemPromptForm({
        name: selectedSystemPrompt.name,
        content: selectedSystemPrompt.content,
        description: selectedSystemPrompt.description,
        category: selectedSystemPrompt.category || '',
        tags: selectedSystemPrompt.tags
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  };

  const handleCreateSystemPromptSubmit = async () => {
    if (!currentProfile?.id || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsCreating(true);
    try {
      await dispatch(createSystemPrompt({ 
        systemPromptData: {
          name: systemPromptForm.name.trim(),
          content: systemPromptForm.content.trim(),
          description: systemPromptForm.description.trim(),
          category: systemPromptForm.category.trim() || undefined,
          tags: systemPromptForm.tags,
          isSystem: false,
          isDefault: false,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateDialogOpen(false);
      setSystemPromptForm({ name: '', content: '', description: '', category: '', tags: [] });
    } catch (error) {
      console.error('Error creating system prompt:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSystemPromptSubmit = async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsUpdating(true);
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: systemPromptForm.name.trim(),
          content: systemPromptForm.content.trim(),
          description: systemPromptForm.description.trim(),
          category: systemPromptForm.category.trim() || undefined,
          tags: systemPromptForm.tags,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setSystemPromptForm({ name: '', content: '', description: '', category: '', tags: [] });
    } catch (error) {
      console.error('Error updating system prompt:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSystemPrompt = async () => {
    if (!selectedSystemPrompt) return;
    
    try {
      await dispatch(deleteSystemPrompt(selectedSystemPrompt.id)).unwrap();
      handleContextMenuClose();
    } catch (error) {
      console.error('Error deleting system prompt:', error);
    }
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const SystemPromptCard = ({ systemPrompt }: { systemPrompt: any }) => {
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
        {/* Header with menu - only show for user-created prompts */}
        {!systemPrompt.isSystem && (
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={(e) => handleTagManagement(systemPrompt, e)}
                sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                title="Manage Tags"
              >
                <TagIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => handleContextMenuOpen(e, systemPrompt)}
                sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}

        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          {/* System indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 4,
                height: 20,
                backgroundColor: systemPrompt.isSystem ? '#1976d2' : '#4caf50',
                borderRadius: 2,
                mr: 1
              }}
            />
            <Chip 
              label={systemPrompt.isSystem ? 'System' : 'Custom'} 
              size="small" 
              sx={{ 
                backgroundColor: systemPrompt.isSystem ? '#1976d2' : '#4caf50',
                color: 'white',
                fontSize: '0.7rem'
              }} 
            />
            {systemPrompt.isDefault && (
              <Chip 
                label="Default" 
                size="small" 
                variant="outlined"
                sx={{ ml: 1, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Name and description */}
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, lineHeight: 1.2 }}>
            {systemPrompt.name}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {systemPrompt.description}
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

          {/* Tags */}
          <Box sx={{ mb: 2 }}>
            {systemPrompt.tags.map((tag: string) => (
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
              {systemPrompt.tokenCount.toLocaleString()} tokens
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
            {systemPrompt.isSystem ? 'Built-in' : `Updated ${new Date(systemPrompt.updatedAt).toLocaleDateString()}`}
          </Typography>
          <Box>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => handleCopyToClipboard(systemPrompt.content)}
              startIcon={<CopyIcon />}
            >
              Copy
            </Button>
          </Box>
        </CardActions>
      </Card>
    );
  };

  // Open tag management dialog
  const handleTagManagement = (systemPrompt: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedSystemPromptForTags(systemPrompt);
    setEditedTags([...systemPrompt.tags]);
    setShowTagDialog(true);
  };

  // Save tag changes
  const handleSaveTags = () => {
    if (selectedSystemPromptForTags) {
      // Here you would dispatch an action to update the system prompt tags
      console.log('Updating system prompt tags:', {
        systemPromptId: selectedSystemPromptForTags.id,
        newTags: editedTags
      });
      // For now, we'll just update locally
      // dispatch(updateSystemPromptTags({ id: selectedSystemPromptForTags.id, tags: editedTags }));
    }
    setShowTagDialog(false);
    setSelectedSystemPromptForTags(null);
    setEditedTags([]);
  };

  // Get tag color
  const getTagColor = (tagName: string) => {
    const tag = (tags || []).find((t: any) => t.name === tagName);
    return tag?.color || '#2196F3';
  };

  // Get unique tags for autocomplete
  const allTags = [...new Set(systemPrompts.flatMap(sp => sp.tags))];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          System Prompts
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage system prompts that define AI behavior and personality for your conversations
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
                placeholder="Search system prompts..."
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
            <SystemPromptCard key={systemPrompt.id} systemPrompt={systemPrompt} />
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
              onClick={() => setShowUserPrompts(!showUserPrompts)}
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
              {userPrompts.map((systemPrompt) => (
                <SystemPromptCard key={systemPrompt.id} systemPrompt={systemPrompt} />
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

      {/* FAB */}
      <Fab
        color="primary"
        aria-label="add system prompt"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleCreateSystemPrompt}
      >
        <AddIcon />
      </Fab>

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
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
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
              label="Description"
              multiline
              rows={2}
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
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
            <Autocomplete
              multiple
              value={systemPromptForm.tags}
              onChange={(_, newValue) => {
                setSystemPromptForm(prev => ({ ...prev, tags: newValue }));
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
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
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
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
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
              label="Description"
              multiline
              rows={2}
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
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
            <Autocomplete
              multiple
              value={systemPromptForm.tags}
              onChange={(_, newValue) => {
                setSystemPromptForm(prev => ({ ...prev, tags: newValue }));
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
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateSystemPromptSubmit}
            disabled={isUpdating || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
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
