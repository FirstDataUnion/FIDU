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
  FormControl,
  InputLabel,
  Select,
  Paper,
  InputAdornment,
  Fab,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  Stack,
  Collapse,
  Divider,
  Autocomplete
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Archive as ArchiveIcon,
  UnarchiveOutlined as UnarchiveIcon,
  FolderOutlined as FolderIcon,
  LinkOutlined as LinkIcon,
  AttachFile as FileIcon,
  ExpandLess,
  ExpandMore,
  Star as StarIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Tag as TagIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchTags } from '../store/slices/tagsSlice';
// import { fetchContexts, createContext, updateContext, deleteContext } from '../store/slices/contextsSlice';

export default function ContextsPage() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.contexts || { loading: false, error: null });
  const { items: tags } = useAppSelector((state) => state.tags as any);
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showArchived, setShowArchived] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<any>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Tag Management State
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedContextForTags, setSelectedContextForTags] = useState<any>(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  
  // Form states
  const [contextForm, setContextForm] = useState({
    name: '',
    description: '',
    type: 'project',
    isPublic: false,
    tags: [] as string[]
  });
  
  // File/Link expansion states
  const [expandedContexts, setExpandedContexts] = useState<Set<string>>(new Set());

  useEffect(() => {
    dispatch(fetchTags());
    // dispatch(fetchContexts());
  }, [dispatch]);

  // Mock data since we don't have the slice yet
  const mockContexts = [
    {
      id: 'ctx-1',
      name: 'React Development',
      description: 'Complete React.js development context with hooks, patterns, and best practices',
      type: 'project',
      isPublic: false,
      isArchived: false,
      isFavorite: true,
      tags: ['React', 'TypeScript', 'Frontend'],
      files: [
        { id: 'f1', name: 'component-patterns.md', size: 2048, type: 'markdown' },
        { id: 'f2', name: 'hooks-examples.ts', size: 1024, type: 'typescript' }
      ],
      links: [
        { id: 'l1', title: 'React Documentation', url: 'https://react.dev', description: 'Official React docs' }
      ],
      conversationIds: ['conv-1', 'conv-2'],
      tokenCount: 15420,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-15'),
      createdBy: 'user-1'
    },
    {
      id: 'ctx-2',
      name: 'API Architecture',
      description: 'REST API design patterns, authentication, and database schemas',
      type: 'reference',
      isPublic: true,
      isArchived: false,
      isFavorite: false,
      tags: ['API', 'Backend', 'Database'],
      files: [
        { id: 'f3', name: 'api-spec.yaml', size: 4096, type: 'yaml' },
        { id: 'f4', name: 'auth-flow.md', size: 1536, type: 'markdown' }
      ],
      links: [
        { id: 'l2', title: 'OpenAPI Spec', url: 'https://swagger.io/specification/', description: 'OpenAPI 3.0 specification' }
      ],
      conversationIds: ['conv-3'],
      tokenCount: 8750,
      createdAt: new Date('2024-01-08'),
      updatedAt: new Date('2024-01-12'),
      createdBy: 'user-1'
    },
    {
      id: 'ctx-3',
      name: 'Data Science Toolkit',
      description: 'Machine learning algorithms, data preprocessing, and visualization libraries',
      type: 'knowledge',
      isPublic: false,
      isArchived: true,
      isFavorite: false,
      tags: ['ML', 'Python', 'Data Science'],
      files: [
        { id: 'f5', name: 'ml-cheatsheet.pdf', size: 8192, type: 'pdf' }
      ],
      links: [],
      conversationIds: ['conv-4', 'conv-5'],
      tokenCount: 12300,
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-10'),
      createdBy: 'user-1'
    }
  ];

  const filteredContexts = mockContexts.filter(context => {
    if (!showArchived && context.isArchived) return false;
    if (filterBy !== 'all') {
      if (filterBy === 'favorites' && !context.isFavorite) return false;
      if (filterBy === 'public' && !context.isPublic) return false;
      if (filterBy !== 'favorites' && filterBy !== 'public' && context.type !== filterBy) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        context.name.toLowerCase().includes(query) ||
        context.description.toLowerCase().includes(query) ||
        context.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleContextMenuOpen = (event: React.MouseEvent<HTMLElement>, context: any) => {
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setSelectedContext(context);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
    setSelectedContext(null);
  };

  const handleCreateContext = () => {
    setContextForm({
      name: '',
      description: '',
      type: 'project',
      isPublic: false,
      tags: []
    });
    setCreateDialogOpen(true);
  };

  const handleEditContext = () => {
    if (selectedContext) {
      setContextForm({
        name: selectedContext.name,
        description: selectedContext.description,
        type: selectedContext.type,
        isPublic: selectedContext.isPublic,
        tags: selectedContext.tags
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  };

  const toggleExpanded = (contextId: string) => {
    setExpandedContexts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contextId)) {
        newSet.delete(contextId);
      } else {
        newSet.add(contextId);
      }
      return newSet;
    });
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'project': return '#2196F3';
      case 'reference': return '#4CAF50';
      case 'knowledge': return '#FF9800';
      case 'template': return '#9C27B0';
      default: return '#757575';
    }
  };

  const ContextCard = ({ context }: { context: any }) => {
    const isExpanded = expandedContexts.has(context.id);
    
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
              sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
              title="Manage Tags"
            >
              <TagIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => handleContextMenuOpen(e, context)}
              sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {/* Favorite star */}
        {context.isFavorite && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
            <StarIcon sx={{ color: '#FFD700', fontSize: 20 }} />
          </Box>
        )}

        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          {/* Type indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
              sx={{
                width: 4,
                height: 20,
                backgroundColor: getTypeColor(context.type),
                borderRadius: 2,
                mr: 1
              }}
            />
            <Chip 
              label={context.type} 
              size="small" 
              sx={{ 
                backgroundColor: getTypeColor(context.type),
                color: 'white',
                fontSize: '0.7rem'
              }} 
            />
            {context.isPublic && (
              <Chip 
                label="Public" 
                size="small" 
                variant="outlined"
                sx={{ ml: 1, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Title and description */}
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, lineHeight: 1.2 }}>
            {context.name}
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
            {context.description}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FolderIcon fontSize="small" />
              {context.files.length} files
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LinkIcon fontSize="small" />
              {context.links.length} links
            </Box>
            <Box>
              {context.tokenCount.toLocaleString()} tokens
            </Box>
          </Box>

          {/* Files and Links Expansion */}
          {(context.files.length > 0 || context.links.length > 0) && (
            <Box>
              <Button
                size="small"
                onClick={() => toggleExpanded(context.id)}
                endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                sx={{ fontSize: '0.75rem', p: 0.5 }}
              >
                View Details
              </Button>
              
              <Collapse in={isExpanded}>
                <Box sx={{ mt: 1, pl: 1 }}>
                  {context.files.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Files:
                      </Typography>
                      {context.files.map((file: any) => (
                        <Box key={file.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <FileIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="caption">{file.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({formatFileSize(file.size)})
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  
                  {context.links.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Links:
                      </Typography>
                      {context.links.map((link: any) => (
                        <Box key={link.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
                            {link.title}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          )}
        </CardContent>

        <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Updated {context.updatedAt.toLocaleDateString()}
          </Typography>
          <Box>
            <Button size="small" variant="outlined">
              Use Context
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
  const allTags = [...new Set(mockContexts.flatMap(c => c.tags))];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Contexts [COMING SOON]
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
            <Box sx={{ width: { xs: '50%', md: '150px' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter</InputLabel>
                <Select
                  value={filterBy}
                  label="Filter"
                  onChange={(e: SelectChangeEvent) => setFilterBy(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="project">Projects</MenuItem>
                  <MenuItem value="reference">References</MenuItem>
                  <MenuItem value="knowledge">Knowledge</MenuItem>
                  <MenuItem value="template">Templates</MenuItem>
                  <MenuItem value="favorites">Favorites</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ width: { xs: '50%', md: '150px' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort"
                  onChange={(e: SelectChangeEvent) => setSortBy(e.target.value)}
                >
                  <MenuItem value="updated">Last Updated</MenuItem>
                  <MenuItem value="created">Date Created</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="tokens">Token Count</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  size="small"
                />
              }
              label="Show Archived"
            />
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
            {searchQuery || filterBy !== 'all' ? 'Try adjusting your search or filters' : 'Create your first context to get started'}
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
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
      >
        <MenuItem onClick={handleEditContext}>
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
        <MenuItem onClick={handleContextMenuClose}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleContextMenuClose}>
          <ListItemIcon>
            {selectedContext?.isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{selectedContext?.isArchived ? 'Unarchive' : 'Archive'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose} sx={{ color: 'error.main' }}>
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
              label="Context Name"
              value={contextForm.name}
              onChange={(e) => setContextForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={contextForm.description}
              onChange={(e) => setContextForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={contextForm.type}
                label="Type"
                onChange={(e: SelectChangeEvent) => setContextForm(prev => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="project">Project</MenuItem>
                <MenuItem value="reference">Reference</MenuItem>
                <MenuItem value="knowledge">Knowledge</MenuItem>
                <MenuItem value="template">Template</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={contextForm.isPublic}
                  onChange={(e) => setContextForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                />
              }
              label="Make Public"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setCreateDialogOpen(false)}>
            Create Context
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
              label="Context Name"
              value={contextForm.name}
              onChange={(e) => setContextForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={contextForm.description}
              onChange={(e) => setContextForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={contextForm.type}
                label="Type"
                onChange={(e: SelectChangeEvent) => setContextForm(prev => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="project">Project</MenuItem>
                <MenuItem value="reference">Reference</MenuItem>
                <MenuItem value="knowledge">Knowledge</MenuItem>
                <MenuItem value="template">Template</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={contextForm.isPublic}
                  onChange={(e) => setContextForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                />
              }
              label="Make Public"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setEditDialogOpen(false)}>
            Save Changes
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