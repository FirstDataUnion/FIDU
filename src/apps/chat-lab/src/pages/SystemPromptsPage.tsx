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
  Divider,
  DialogContentText,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import CategoryFilter from '../components/common/CategoryFilter';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Extension as ExtensionIcon
} from '@mui/icons-material';

import { useAppSelector, useAppDispatch } from '../store';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { 
  fetchSystemPrompts, 
  createSystemPrompt, 
  updateSystemPrompt, 
  deleteSystemPrompt
} from '../store/slices/systemPromptsSlice';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import { useFilesystemDirectoryRequired } from '../hooks/useFilesystemDirectoryRequired';

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
      {/* Source indicator */}
      {systemPrompt.source && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: systemPrompt.source === 'fabric' ? 'rgba(25, 118, 210, 0.8)' : 
                           systemPrompt.source === 'built-in' ? 'rgba(0, 0, 0, 0.6)' : 
                           'rgba(156, 39, 176, 0.8)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 2
          }}
        >
          {systemPrompt.source === 'fabric' ? 'Fabric' : 
           systemPrompt.source === 'built-in' ? 'Built-in' : 'Custom'}
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

        {/* Description */}
        {systemPrompt.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              fontStyle: 'normal',
              backgroundColor: 'rgba(0,0,0,0.02)',
              p: 1,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            {systemPrompt.description}
          </Typography>
        )}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
          <Box>
            {systemPrompt.tokenCount?.toLocaleString() || 'Unknown'} tokens
          </Box>
          {systemPrompt.categories && systemPrompt.categories.length > 0 && (
            <Box>
              {systemPrompt.categories.join(', ')}
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

// Optimized Grid Component with lazy loading for better performance
const OptimizedSystemPromptsGrid = React.memo<{
  prompts: any[];
  onViewEdit: (systemPrompt: any) => void;
}>(({ prompts, onViewEdit }) => {
  const [visibleCount, setVisibleCount] = useState(20); // Start with 20 prompts
  const [isLoading, setIsLoading] = useState(false);
  
  // Load more prompts when scrolling
  const loadMore = useCallback(() => {
    if (visibleCount < prompts.length && !isLoading) {
      setIsLoading(true);
      // Simulate loading delay for smooth UX
      setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 20, prompts.length));
        setIsLoading(false);
      }, 100);
    }
  }, [visibleCount, prompts.length, isLoading]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && visibleCount < prompts.length) {
            loadMore();
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe the last visible card
    const lastCard = document.querySelector('[data-last-card="true"]');
    if (lastCard) {
      observer.observe(lastCard);
    }

    return () => observer.disconnect();
  }, [visibleCount, prompts.length, loadMore]);

  const visiblePrompts = prompts.slice(0, visibleCount);

  return (
    <Box>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: 'repeat(2, 1fr)', 
          lg: 'repeat(3, 1fr)' 
        }, 
        gap: 3 
      }}>
        {visiblePrompts.map((systemPrompt, index) => (
          <Box 
            key={systemPrompt.id}
            data-last-card={index === visibleCount - 1}
          >
            <SystemPromptCard 
              systemPrompt={systemPrompt} 
              onViewEdit={onViewEdit}
            />
          </Box>
        ))}
      </Box>
      
      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {/* Load more button for better UX */}
      {visibleCount < prompts.length && !isLoading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Button 
            variant="outlined" 
            onClick={loadMore}
            startIcon={<AddIcon />}
          >
            Load More Prompts ({prompts.length - visibleCount} remaining)
          </Button>
        </Box>
      )}
    </Box>
  );
});

OptimizedSystemPromptsGrid.displayName = 'OptimizedSystemPromptsGrid';

const SystemPromptsPage = React.memo(() => {
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: systemPrompts, loading } = useAppSelector((state) => state.systemPrompts);
  const { settings } = useAppSelector((state) => state.settings);
  const unifiedStorage = useUnifiedStorage();
  const isDirectoryRequired = useFilesystemDirectoryRequired();
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Fabric, 2: Built-in, 3: User
  
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
    description: '',
    content: '',
    categories: ''
  });
  
  // Form states
  const [systemPromptForm, setSystemPromptForm] = useState({
    name: '',
    description: '',
    content: '',
    categories: ''
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
  const { fabricPrompts, builtInPrompts, userPrompts } = useMemo(() => {
    const fabric = systemPrompts.filter(sp => sp.source === 'fabric');
    const builtIn = systemPrompts.filter(sp => sp.source === 'built-in');
    const user = systemPrompts.filter(sp => sp.source === 'user' || !sp.source);
    return { fabricPrompts: fabric, builtInPrompts: builtIn, userPrompts: user };
  }, [systemPrompts]);

  // Get current tab's prompts
  const currentTabPrompts = useMemo(() => {
    switch (activeTab) {
      case 1: return fabricPrompts;
      case 2: return builtInPrompts;
      case 3: return userPrompts;
      default: return systemPrompts; // All
    }
  }, [activeTab, fabricPrompts, builtInPrompts, userPrompts, systemPrompts]);

  // Debounced search query for better performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize filtered prompts based on debounced search query, category filter, and current tab
  const filteredPrompts = useMemo(() => {
    let filtered = currentTabPrompts;
    
    // Apply text search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(prompt => 
        prompt.name.toLowerCase().includes(query) ||
        (prompt.description && prompt.description.toLowerCase().includes(query)) ||
        prompt.content.toLowerCase().includes(query) ||
        (prompt.categories && prompt.categories.some(cat => cat.toLowerCase().includes(query)))
      );
    }
    
    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(prompt => 
        prompt.categories && prompt.categories.some(cat => selectedCategories.includes(cat))
      );
    }
    
    return filtered;
  }, [currentTabPrompts, debouncedSearchQuery, selectedCategories]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setSelectedSystemPrompt(null);
  }, []);

  const handleCreateSystemPrompt = useCallback(() => {
    setSystemPromptForm({
      name: '',
      description: '',
      content: '',
      categories: ''
    });
    setCreateDialogOpen(true);
  }, []);

  const handleEditSystemPrompt = useCallback(() => {
    if (selectedSystemPrompt) {
      setSystemPromptForm({
        name: selectedSystemPrompt.name,
        description: selectedSystemPrompt.description || '',
        content: selectedSystemPrompt.content,
        categories: selectedSystemPrompt.categories ? selectedSystemPrompt.categories.join(', ') : ''
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
          description: systemPromptForm.description.trim() || undefined,
          content: systemPromptForm.content.trim(),
          categories: systemPromptForm.categories.trim() ? systemPromptForm.categories.trim().split(',').map(cat => cat.trim()).filter(cat => cat) : [],
          isBuiltIn: false,
          isDefault: false,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateDialogOpen(false);
      setSystemPromptForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error creating system prompt:', error);
    } finally {
      setIsCreating(false);
    }
  }, [dispatch, currentProfile?.id, systemPromptForm]);

  const handleUpdateSystemPromptSubmit = useCallback(async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsUpdating(true);
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: systemPromptForm.name.trim(),
          description: systemPromptForm.description.trim() || undefined,
          content: systemPromptForm.content.trim(),
          categories: systemPromptForm.categories.trim() ? systemPromptForm.categories.trim().split(',').map(cat => cat.trim()).filter(cat => cat) : [],
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setSystemPromptForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [dispatch, selectedSystemPrompt, currentProfile?.id, systemPromptForm]);

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
      description: systemPrompt.description || '',
      content: systemPrompt.content,
      categories: systemPrompt.categories ? systemPrompt.categories.join(', ') : ''
    });
    setViewEditDialogOpen(true);
  }, []);

  const handleViewEditSubmit = useCallback(async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !viewEditForm.name.trim() || !viewEditForm.content.trim()) return;
    
    setIsUpdating(true); // Changed from isViewEditing to isUpdating
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: viewEditForm.name.trim(),
          description: viewEditForm.description.trim() || undefined,
          content: viewEditForm.content.trim(),
          categories: viewEditForm.categories.trim() ? viewEditForm.categories.trim().split(',').map(cat => cat.trim()).filter(cat => cat) : []
        },
        profileId: currentProfile.id 
      })).unwrap();
      
      setViewEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setViewEditForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
    } finally {
      setIsUpdating(false); // Changed from isViewEditing to isUpdating
    }
  }, [dispatch, selectedSystemPrompt, currentProfile?.id, viewEditForm]);

  // Memoize search query change handler with performance optimization
  const handleSearchQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only update if the value actually changed
    if (value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [searchQuery]);



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
      {/* Storage Directory Banner */}
      <StorageDirectoryBanner pageType="system-prompts" />
      
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
        {unifiedStorage.status === 'configured' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSystemPrompt}
            disabled={isDirectoryRequired}
            sx={{ borderRadius: 2 }}
          >
            Add System Prompt
          </Button>
        )}
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
            <Box sx={{ width: { xs: '100%', md: '300px' } }}>
              <CategoryFilter
                systemPrompts={currentTabPrompts}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                placeholder="Filter by category"
                size="small"
                fullWidth
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* Tabs for different prompt sources */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab 
            label={`All (${systemPrompts.length})`} 
            icon={<SettingsIcon />}
            iconPosition="start"
          />
          <Tab 
            label={`Fabric (${fabricPrompts.length})`} 
            icon={<ExtensionIcon />}
            iconPosition="start"
          />
          <Tab 
            label={`Built-in (${builtInPrompts.length})`} 
            icon={<SettingsIcon />}
            iconPosition="start"
          />
          <Tab 
            label={`Custom (${userPrompts.length})`} 
            icon={<CodeIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* System Prompts Virtualized Grid */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Loading system prompts...
          </Typography>
        </Box>
      ) : unifiedStorage.status !== 'configured' && activeTab === 3 ? (
        // Show centered error message for Custom tab when storage not configured
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
          minHeight: '400px'
        }}>
          <CodeIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
            No storage option selected.
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.5 }}>
            No Custom System Prompts Available. Please configure storage to use this feature
          </Typography>
        </Box>
      ) : filteredPrompts.length > 0 ? (
        <Box sx={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}>
          <OptimizedSystemPromptsGrid
            prompts={filteredPrompts}
            onViewEdit={handleViewEditSystemPrompt}
          />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CodeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            {searchQuery ? 'No system prompts match your search' : 
             activeTab === 3 ? 'No custom system prompts yet' :
             activeTab === 2 ? 'No built-in system prompts' :
             activeTab === 1 ? 'No Fabric patterns' :
             'No system prompts available'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {activeTab === 3 ? 'Create your first custom system prompt to define specific AI behaviors' :
             'Try adjusting your search or switching to a different tab'}
          </Typography>
          {activeTab === 3 && unifiedStorage.status === 'configured' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateSystemPrompt} disabled={isDirectoryRequired}>
              Create System Prompt
            </Button>
          )}
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
              label="Description (optional)"
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={systemPromptForm.categories}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, categories: e.target.value }))}
              placeholder="e.g., Technical, Development, Code Quality (comma-separated)"
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
              label="Description (optional)"
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={systemPromptForm.categories}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, categories: e.target.value }))}
              placeholder="e.g., Technical, Development, Code Quality (comma-separated)"
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
              label="Description (optional)"
              value={viewEditForm.description}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, description: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={viewEditForm.categories}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, categories: e.target.value }))}
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
