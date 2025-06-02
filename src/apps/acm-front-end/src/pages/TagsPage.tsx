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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Slider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  Collapse
} from '@mui/material';
import { 
  LocalOffer as TagIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  ColorLens as ColorIcon,
  Category as CategoryIcon,
  AutoAwesome as AutoIcon,
  Analytics as AnalyticsIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  Upload as ImportIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchConversations } from '../store/slices/conversationsSlice';
import { fetchMemories } from '../store/slices/memoriesSlice';
import type { Tag, TagsState, ConversationsState, MemoriesState, RootState } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tag-tabpanel-${index}`}
      aria-labelledby={`tag-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const TagsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const tagsState = useAppSelector((state: RootState) => state.tags as TagsState);
  const conversationsState = useAppSelector((state: RootState) => state.conversations as ConversationsState);
  const memoriesState = useAppSelector((state: RootState) => state.memories as MemoriesState);

  // Extract with proper typing
  const tags = tagsState.items;
  const loading = tagsState.loading;
  const error = tagsState.error;
  const conversations = conversationsState.items;
  const memories = memoriesState.items;

  // Tab state
  const [currentTab, setCurrentTab] = useState(0);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [usageFilter, setUsageFilter] = useState([0, 100]);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAutoTagDialog, setShowAutoTagDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Category collapse state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // New tag form state
  const [newTag, setNewTag] = useState({
    name: '',
    description: '',
    color: '#2196F3',
    category: 'General'
  });

  // Auto-tagging state
  const [autoTagSettings, setAutoTagSettings] = useState({
    enabled: true,
    confidence: 0.7,
    categories: ['Technology', 'Personal', 'Work']
  });

  useEffect(() => {
    dispatch(fetchTags());
    dispatch(fetchConversations());
    dispatch(fetchMemories());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchTags());
  };

  // Filter tags based on search and filters
  const filteredTags = tags.filter((tag: Tag) => {
    if (searchQuery && !tag.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !tag.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (categoryFilter && tag.category !== categoryFilter) {
      return false;
    }
    const usage = tag.usageCount || 0;
    const maxUsage = Math.max(...tags.map((t: Tag) => t.usageCount || 0), 1);
    const usagePercent = (usage / maxUsage) * 100;
    if (usagePercent < usageFilter[0] || usagePercent > usageFilter[1]) {
      return false;
    }
    return true;
  });

  // Get categories
  const categories = [...new Set(tags.map((t: Tag) => t.category).filter(Boolean))] as string[];

  // Get tag statistics
  const tagStats = {
    total: tags.length,
    byCategory: categories.reduce((acc: Record<string, number>, cat: string) => {
      acc[cat] = tags.filter((t: Tag) => t.category === cat).length;
      return acc;
    }, {}),
    averageUsage: tags.reduce((sum: number, t: Tag) => sum + (t.usageCount || 0), 0) / Math.max(tags.length, 1),
    mostUsed: tags.sort((a: Tag, b: Tag) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5)
  };

  const handleCreateTag = () => {
    console.log('Creating tag:', newTag);
    // Here you would dispatch an action to create the tag
    setShowCreateDialog(false);
    setNewTag({ name: '', description: '', color: '#2196F3', category: 'General' });
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setNewTag({
      name: tag.name,
      description: tag.description || '',
      color: tag.color || '#2196F3',
      category: tag.category || 'General'
    });
    setShowEditDialog(true);
  };

  const handleSaveEditTag = () => {
    console.log('Updating tag:', editingTag?.id, newTag);
    // Here you would dispatch an action to update the tag
    setShowEditDialog(false);
    setEditingTag(null);
    setNewTag({ name: '', description: '', color: '#2196F3', category: 'General' });
  };

  const handleDeleteTag = (tag: Tag) => {
    console.log('Deleting tag:', tag.id);
    // Here you would dispatch an action to delete the tag
    setAnchorEl(null);
    setSelectedTag(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, tag: Tag) => {
    setAnchorEl(event.currentTarget);
    setSelectedTag(tag);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTag(null);
  };

  const generateAutoTags = () => {
    console.log('Generating auto tags with settings:', autoTagSettings);
    // Simulate auto-tag generation
    const suggestedTags = [
      { name: 'Machine Learning', category: 'Technology', confidence: 0.85 },
      { name: 'Career Planning', category: 'Personal', confidence: 0.78 },
      { name: 'Code Review', category: 'Work', confidence: 0.92 }
    ];
    
    console.log('Suggested tags:', suggestedTags);
    setShowAutoTagDialog(false);
  };

  const exportTags = () => {
    const data = JSON.stringify(tags, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'acm-tags.json';
    link.click();
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const TagCard: React.FC<{ tag: Tag }> = ({ tag }) => (
    <Card sx={{ '&:hover': { boxShadow: 3 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Chip
            label={tag.name}
            sx={{ 
              backgroundColor: tag.color || '#2196F3',
              color: 'white',
              fontWeight: 'bold'
            }}
          />
          <IconButton size="small" onClick={(e) => handleMenuOpen(e, tag)}>
            <MoreIcon />
          </IconButton>
        </Box>
        
        {tag.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tag.description}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {tag.category && (
            <Chip label={tag.category} size="small" variant="outlined" />
          )}
          <Chip label={`${tag.usageCount || 0} uses`} size="small" variant="outlined" />
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          Created: {new Date(tag.createdAt).toLocaleDateString()}
        </Typography>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading tags...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Error loading tags:</strong> {error}
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
          Tag Management ({tags.length})
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
            onClick={() => setShowAutoTagDialog(true)}
            startIcon={<AutoIcon />}
          >
            Auto-Tag
          </Button>
          <Button
            variant="outlined"
            onClick={exportTags}
            startIcon={<ExportIcon />}
          >
            Export
          </Button>
          <Button
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
            startIcon={<AddIcon />}
          >
            Create Tag
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="All Tags" icon={<TagIcon />} />
          <Tab label="Categories" icon={<CategoryIcon />} />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={currentTab} index={0}>
        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              md: '1fr 200px 150px 100px' 
            }, 
            gap: 2, 
            alignItems: 'center' 
          }}>
            <TextField
              fullWidth
              label="Search tags"
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
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography gutterBottom>Usage Range</Typography>
              <Slider
                value={usageFilter}
                onChange={(e, newValue) => setUsageFilter(newValue as number[])}
                valueLabelDisplay="auto"
                min={0}
                max={100}
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {filteredTags.length} of {tags.length} tags
            </Typography>
          </Box>
        </Box>

        {/* Tags Grid */}
        {filteredTags.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <TagIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {searchQuery || categoryFilter ? 'No tags match your filters' : 'No tags found'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {searchQuery || categoryFilter 
                  ? 'Try adjusting your search terms or filters'
                  : 'Create your first tag to start organizing your conversations.'
                }
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => setShowCreateDialog(true)}
                startIcon={<AddIcon />}
              >
                Create Tag
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(3, 1fr)' 
            }, 
            gap: 3 
          }}>
            {filteredTags.map((tag: Tag) => (
              <TagCard tag={tag} key={tag.id} />
            ))}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        {/* Category Management */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Tag Categories</Typography>
          <List>
            {categories.map((category) => (
              <React.Fragment key={category}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => toggleCategory(category)}>
                    <ListItemIcon>
                      {expandedCategories[category] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">{category}</Typography>
                          <Chip 
                            label={tagStats.byCategory[category]} 
                            size="small" 
                            variant="outlined" 
                          />
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                <Collapse in={expandedCategories[category]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {tags.filter((t: Tag) => t.category === category).map((tag: Tag) => (
                      <ListItem key={tag.id} sx={{ pl: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={tag.name}
                            size="small"
                            sx={{ backgroundColor: tag.color, color: 'white' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {tag.usageCount || 0} uses
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {/* Analytics */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            md: '1fr 1fr' 
          }, 
          gap: 3 
        }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tag Usage Statistics
              </Typography>
              {/* Chart placeholder */}
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Usage chart will go here
                </Typography>
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Distribution
              </Typography>
              {/* Chart placeholder */}
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Distribution chart will go here
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleEditTag(selectedTag!); handleMenuClose(); }}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit Tag</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleDeleteTag(selectedTag!); handleMenuClose(); }}>
          <ListItemIcon><DeleteIcon /></ListItemIcon>
          <ListItemText>Delete Tag</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Tag Name"
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={newTag.description}
              onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTag.category}
                onChange={(e) => setNewTag({ ...newTag, category: e.target.value })}
              >
                {['General', 'Technology', 'Personal', 'Work', 'Learning'].map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography gutterBottom>Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#607D8B'].map((color) => (
                  <Box
                    key={color}
                    sx={{
                      width: 40,
                      height: 40,
                      backgroundColor: color,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: newTag.color === color ? '3px solid #000' : '1px solid #ccc'
                    }}
                    onClick={() => setNewTag({ ...newTag, color })}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateTag} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tag</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Tag Name"
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={newTag.description}
              onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTag.category}
                onChange={(e) => setNewTag({ ...newTag, category: e.target.value })}
              >
                {['General', 'Technology', 'Personal', 'Work', 'Learning'].map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography gutterBottom>Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#607D8B'].map((color) => (
                  <Box
                    key={color}
                    sx={{
                      width: 40,
                      height: 40,
                      backgroundColor: color,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: newTag.color === color ? '3px solid #000' : '1px solid #ccc'
                    }}
                    onClick={() => setNewTag({ ...newTag, color })}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveEditTag} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Auto-Tag Dialog */}
      <Dialog open={showAutoTagDialog} onClose={() => setShowAutoTagDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Auto-Tag Configuration</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoTagSettings.enabled}
                  onChange={(e) => setAutoTagSettings({ ...autoTagSettings, enabled: e.target.checked })}
                />
              }
              label="Enable Auto-Tagging"
            />
            <Box>
              <Typography gutterBottom>Confidence Threshold: {autoTagSettings.confidence}</Typography>
              <Slider
                value={autoTagSettings.confidence}
                onChange={(_, value) => setAutoTagSettings({ ...autoTagSettings, confidence: value as number })}
                min={0.1}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
            <Autocomplete
              multiple
              options={['Technology', 'Personal', 'Work', 'Learning', 'AI', 'Programming']}
              value={autoTagSettings.categories}
              onChange={(_, value) => setAutoTagSettings({ ...autoTagSettings, categories: value })}
              renderInput={(params) => (
                <TextField {...params} label="Target Categories" placeholder="Select categories" />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutoTagDialog(false)}>Cancel</Button>
          <Button onClick={generateAutoTags} variant="contained">Generate Tags</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagsPage; 