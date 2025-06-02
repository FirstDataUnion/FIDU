import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Chip, 
  Grid, 
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
  Divider,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { 
  Psychology as MemoryIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Category as CategoryIcon,
  PriorityHigh as HighPriorityIcon,
  Book as FactIcon,
  Person as PreferenceIcon,
  WorkOutline as ContextIcon,
  School as SkillIcon,
  Flag as GoalIcon,
  Link as LinkIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchMemories } from '../store/slices/memoriesSlice';
import { fetchTags } from '../store/slices/tagsSlice';
import type { Memory, Tag } from '../types';

const MemoriesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  // Use 'as any' to work around Redux type issues
  const memoriesState = useAppSelector((state) => state.memories) as any;
  const tagsState = useAppSelector((state) => state.tags) as any;

  const memories = memoriesState?.items || [];
  const loading = memoriesState?.loading || false;
  const error = memoriesState?.error || null;
  const availableTags = tagsState?.items || [];

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Memory['type'][]>([]);
  const [selectedImportance, setSelectedImportance] = useState<Memory['importance'][]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'importance' | 'title'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dialog states
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // New memory form state
  const [newMemory, setNewMemory] = useState({
    title: '',
    content: '',
    type: 'fact' as Memory['type'],
    importance: 'medium' as Memory['importance'],
    tags: [] as string[]
  });

  useEffect(() => {
    dispatch(fetchMemories());
    dispatch(fetchTags());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchMemories());
  };

  // Filter memories
  const filteredMemories = memories.filter((memory: Memory) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!memory.title.toLowerCase().includes(searchLower) && 
          !memory.content.toLowerCase().includes(searchLower) &&
          !memory.tags.some(tag => tag.toLowerCase().includes(searchLower))) {
        return false;
      }
    }

    // Type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes(memory.type)) {
      return false;
    }

    // Importance filter
    if (selectedImportance.length > 0 && !selectedImportance.includes(memory.importance)) {
      return false;
    }

    // Tags filter
    if (selectedTags.length > 0 && !selectedTags.some(tag => memory.tags.includes(tag))) {
      return false;
    }

    // Archive filter
    if (!showArchived && memory.isArchived) {
      return false;
    }

    return true;
  });

  // Sort memories
  const sortedMemories = [...filteredMemories].sort((a: Memory, b: Memory) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'importance':
        const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aValue = importanceOrder[a.importance];
        bValue = importanceOrder[b.importance];
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
      default:
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Get type icon
  const getTypeIcon = (type: Memory['type']) => {
    switch (type) {
      case 'fact': return <FactIcon />;
      case 'preference': return <PreferenceIcon />;
      case 'context': return <ContextIcon />;
      case 'skill': return <SkillIcon />;
      case 'goal': return <GoalIcon />;
      default: return <MemoryIcon />;
    }
  };

  // Get importance color
  const getImportanceColor = (importance: Memory['importance']) => {
    switch (importance) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#9e9e9e';
      default: return '#2196f3';
    }
  };

  const handleCreateMemory = () => {
    console.log('Creating memory:', newMemory);
    // Here you would dispatch an action to create the memory
    setShowCreateDialog(false);
    setNewMemory({
      title: '',
      content: '',
      type: 'fact',
      importance: 'medium',
      tags: []
    });
  };

  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setNewMemory({
      title: memory.title,
      content: memory.content,
      type: memory.type,
      importance: memory.importance,
      tags: memory.tags
    });
    setShowEditDialog(true);
  };

  const handleSaveEditMemory = () => {
    console.log('Updating memory:', editingMemory?.id, newMemory);
    // Here you would dispatch an action to update the memory
    setShowEditDialog(false);
    setEditingMemory(null);
    setNewMemory({
      title: '',
      content: '',
      type: 'fact',
      importance: 'medium',
      tags: []
    });
  };

  const handleDeleteMemory = (memory: Memory) => {
    console.log('Deleting memory:', memory.id);
    // Here you would dispatch an action to delete the memory
    setAnchorEl(null);
    setSelectedMemory(null);
  };

  const handleToggleArchive = (memory: Memory) => {
    console.log('Toggling archive for memory:', memory.id);
    // Here you would dispatch an action to toggle archive status
    setAnchorEl(null);
    setSelectedMemory(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, memory: Memory) => {
    setAnchorEl(event.currentTarget);
    setSelectedMemory(memory);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMemory(null);
  };

  const exportMemories = () => {
    const data = JSON.stringify(filteredMemories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'acm-memories.json';
    link.click();
  };

  const MemoryCard: React.FC<{ memory: Memory }> = ({ memory }) => (
    <Card sx={{ '&:hover': { boxShadow: 3 }, position: 'relative' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getTypeIcon(memory.type)}
            <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
              {memory.title}
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => handleMenuOpen(e, memory)}>
            <MoreIcon />
          </IconButton>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
          {memory.content.length > 150 ? `${memory.content.substring(0, 150)}...` : memory.content}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={memory.type}
            size="small"
            variant="outlined"
            icon={getTypeIcon(memory.type)}
          />
          <Chip
            label={memory.importance}
            size="small"
            sx={{ 
              backgroundColor: getImportanceColor(memory.importance),
              color: 'white'
            }}
          />
          {memory.source === 'extracted' && (
            <Chip label="Auto-extracted" size="small" variant="outlined" />
          )}
          {memory.isArchived && (
            <Chip label="Archived" size="small" variant="outlined" />
          )}
        </Box>
        
        {memory.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {memory.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" />
            ))}
            {memory.tags.length > 3 && (
              <Chip label={`+${memory.tags.length - 3} more`} size="small" variant="outlined" />
            )}
          </Box>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {memory.conversationIds.length} linked conversations
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(memory.updatedAt).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const FilterPanel = () => (
    <Accordion expanded={showFilters} onChange={() => setShowFilters(!showFilters)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Filters & Search</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          {/* Type Filter */}
          <Box>
            <Typography gutterBottom>Memory Types</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(['fact', 'preference', 'context', 'skill', 'goal'] as Memory['type'][]).map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTypes([...selectedTypes, type]);
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        }
                      }}
                    />
                  }
                  label={type}
                />
              ))}
            </Box>
          </Box>
          
          {/* Importance Filter */}
          <Box>
            <Typography gutterBottom>Importance</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(['critical', 'high', 'medium', 'low'] as Memory['importance'][]).map((importance) => (
                <FormControlLabel
                  key={importance}
                  control={
                    <Checkbox
                      checked={selectedImportance.includes(importance)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedImportance([...selectedImportance, importance]);
                        } else {
                          setSelectedImportance(selectedImportance.filter(i => i !== importance));
                        }
                      }}
                    />
                  }
                  label={importance}
                />
              ))}
            </Box>
          </Box>
          
          {/* Tags Filter */}
          <FormControl fullWidth>
            <InputLabel>Tags</InputLabel>
            <Select
              multiple
              value={selectedTags}
              onChange={(e) => setSelectedTags(e.target.value as string[])}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableTags.map((tag: Tag) => (
                <MenuItem key={tag.id} value={tag.name}>
                  {tag.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Show Archived */}
          <FormControlLabel
            control={
              <Checkbox
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
            }
            label="Show archived memories"
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading memories...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Error loading memories:</strong> {error}
        </Alert>
        <Button variant="outlined" onClick={handleRefresh} startIcon={<RefreshIcon />}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Knowledge Base ({memories.length} memories)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleRefresh}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={exportMemories}
            startIcon={<ExportIcon />}
          >
            Export
          </Button>
          <Button
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
            startIcon={<AddIcon />}
          >
            Add Memory
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <FilterPanel />

      {/* View Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="grid">Grid</ToggleButton>
            <ToggleButton value="list">List</ToggleButton>
          </ToggleButtonGroup>
          
          <FormControl size="small">
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="updatedAt">Updated</MenuItem>
              <MenuItem value="createdAt">Created</MenuItem>
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="importance">Importance</MenuItem>
            </Select>
          </FormControl>
          
          <ToggleButtonGroup
            value={sortOrder}
            exclusive
            onChange={(_, newOrder) => newOrder && setSortOrder(newOrder)}
            size="small"
          >
            <ToggleButton value="desc">↓</ToggleButton>
            <ToggleButton value="asc">↑</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          {filteredMemories.length} of {memories.length} memories
        </Typography>
      </Box>

      {/* Memories Grid/List */}
      {sortedMemories.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <MemoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {searchQuery || selectedTypes.length > 0 || selectedImportance.length > 0 || selectedTags.length > 0
                ? 'No memories match your filters'
                : 'No memories found'
              }
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {searchQuery || selectedTypes.length > 0 || selectedImportance.length > 0 || selectedTags.length > 0
                ? 'Try adjusting your search terms or filters'
                : 'Start building your knowledge base by adding your first memory.'
              }
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => setShowCreateDialog(true)}
              startIcon={<AddIcon />}
            >
              Add Memory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {sortedMemories.map((memory: Memory) => (
            <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} key={memory.id}>
              <MemoryCard memory={memory} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleEditMemory(selectedMemory!); handleMenuClose(); }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit Memory</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleToggleArchive(selectedMemory!); handleMenuClose(); }}>
          <ListItemIcon>
            {selectedMemory?.isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          </ListItemIcon>
          <ListItemText>
            {selectedMemory?.isArchived ? 'Unarchive' : 'Archive'}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDeleteMemory(selectedMemory!); handleMenuClose(); }}>
          <ListItemIcon><DeleteIcon /></ListItemIcon>
          <ListItemText>Delete Memory</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Memory Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Memory</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={newMemory.title}
              onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
            />
            <TextField
              fullWidth
              label="Content"
              multiline
              rows={4}
              value={newMemory.content}
              onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newMemory.type}
                  onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value as Memory['type'] })}
                >
                  <MenuItem value="fact">Fact</MenuItem>
                  <MenuItem value="preference">Preference</MenuItem>
                  <MenuItem value="context">Context</MenuItem>
                  <MenuItem value="skill">Skill</MenuItem>
                  <MenuItem value="goal">Goal</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Importance</InputLabel>
                <Select
                  value={newMemory.importance}
                  onChange={(e) => setNewMemory({ ...newMemory, importance: e.target.value as Memory['importance'] })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={newMemory.tags}
                onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availableTags.map((tag: Tag) => (
                  <MenuItem key={tag.id} value={tag.name}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateMemory} variant="contained">Add Memory</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Memory Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Memory</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={newMemory.title}
              onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
            />
            <TextField
              fullWidth
              label="Content"
              multiline
              rows={4}
              value={newMemory.content}
              onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newMemory.type}
                  onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value as Memory['type'] })}
                >
                  <MenuItem value="fact">Fact</MenuItem>
                  <MenuItem value="preference">Preference</MenuItem>
                  <MenuItem value="context">Context</MenuItem>
                  <MenuItem value="skill">Skill</MenuItem>
                  <MenuItem value="goal">Goal</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Importance</InputLabel>
                <Select
                  value={newMemory.importance}
                  onChange={(e) => setNewMemory({ ...newMemory, importance: e.target.value as Memory['importance'] })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={newMemory.tags}
                onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availableTags.map((tag: Tag) => (
                  <MenuItem key={tag.id} value={tag.name}>
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveEditMemory} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemoriesPage; 