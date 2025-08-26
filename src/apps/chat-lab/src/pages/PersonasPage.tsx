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
  Stack,
  Divider,
  Paper,
  InputAdornment,
  Fab,
  Alert,
  CircularProgress,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Psychology as PsychologyIcon,
  Chat as ChatIcon,
  Code as CodeIcon,
  Brush as BrushIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  SwapHoriz as SwitchIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
// import { fetchPersonas, createPersona, updatePersona, deletePersona, switchPersona } from '../store/slices/personasSlice';

export default function PersonasPage() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.personas || { 
    loading: false, 
    error: null 
  });

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  
  // Form state
  const [personaForm, setPersonaForm] = useState({
    name: '',
    description: '',
    avatar: '👤',
    communicationStyle: 'technical' as 'formal' | 'casual' | 'technical' | 'creative',
    expertise: [] as string[],
    preferredModels: [] as string[],
    defaultSystemPrompt: ''
  });

  useEffect(() => {
    // dispatch(fetchPersonas());
  }, [dispatch]);

  // Mock data
  const mockPersonas = [
    {
      id: 'persona-1',
      name: 'Frontend Developer',
      description: 'Focused on React, TypeScript, and modern web development',
      avatar: '👨‍💻',
      contextIds: ['ctx-1'],
      preferences: {
        preferredModels: ['claude-3-sonnet', 'gpt-4-turbo'],
        defaultSystemPrompt: 'sys-1',
        communicationStyle: 'technical' as const,
        expertise: ['React', 'TypeScript', 'CSS', 'JavaScript', 'HTML']
      },
      isActive: true,
      conversationCount: 45,
      createdAt: new Date('2024-01-10').toISOString(),
      lastUsed: new Date('2024-01-15').toISOString()
    },
    {
      id: 'persona-2',
      name: 'Backend Developer',
      description: 'API design, databases, and server-side architecture',
      avatar: '⚙️',
      contextIds: ['ctx-2', 'ctx-3'],
      preferences: {
        preferredModels: ['claude-3-opus', 'gpt-4'],
        defaultSystemPrompt: 'sys-3',
        communicationStyle: 'technical' as const,
        expertise: ['Python', 'Node.js', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS']
      },
      isActive: false,
      conversationCount: 32,
      createdAt: new Date('2024-01-05').toISOString(),
      lastUsed: new Date('2024-01-12').toISOString()
    },
    {
      id: 'persona-3',
      name: 'Tech Lead',
      description: 'Architecture decisions, team leadership, and project planning',
      avatar: '🏗️',
      contextIds: ['ctx-1', 'ctx-2'],
      preferences: {
        preferredModels: ['claude-3-opus', 'gpt-4-turbo'],
        defaultSystemPrompt: 'sys-1',
        communicationStyle: 'formal' as const,
        expertise: ['System Architecture', 'Team Management', 'Project Planning', 'Technical Strategy']
      },
      isActive: false,
      conversationCount: 28,
      createdAt: new Date('2024-01-08').toISOString(),
      lastUsed: new Date('2024-01-13').toISOString()
    },
    {
      id: 'persona-4',
      name: 'Data Scientist',
      description: 'Machine learning, data analysis, and statistical modeling',
      avatar: '📊',
      contextIds: ['ctx-4'],
      preferences: {
        preferredModels: ['claude-3-opus', 'gemini-ultra'],
        defaultSystemPrompt: 'sys-1',
        communicationStyle: 'technical' as const,
        expertise: ['Python', 'R', 'Machine Learning', 'Statistics', 'Data Visualization', 'SQL']
      },
      isActive: false,
      conversationCount: 15,
      createdAt: new Date('2024-01-12').toISOString(),
      lastUsed: new Date('2024-01-14').toISOString()
    },
    {
      id: 'persona-5',
      name: 'UI/UX Designer',
      description: 'User experience design and interface prototyping',
      avatar: '🎨',
      contextIds: [],
      preferences: {
        preferredModels: ['claude-3-sonnet', 'gpt-4'],
        defaultSystemPrompt: 'sys-4',
        communicationStyle: 'creative' as const,
        expertise: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Accessibility']
      },
      isActive: false,
      conversationCount: 12,
      createdAt: new Date('2024-01-14').toISOString(),
      lastUsed: new Date('2024-01-14').toISOString()
    }
  ];

  const availableModels = [
    'claude-3-opus', 'claude-3-sonnet', 'gpt-4-turbo', 'gpt-4', 'gemini-ultra', 'gemini-pro'
  ];

  const expertiseOptions = [
    'React', 'TypeScript', 'JavaScript', 'Python', 'Node.js', 'CSS', 'HTML',
    'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Machine Learning', 'Data Science',
    'UI/UX Design', 'System Architecture', 'Project Management', 'DevOps'
  ];

  const filteredPersonas = mockPersonas.filter(persona => {
    if (filterBy === 'active' && !persona.isActive) return false;
    if (filterBy === 'recent' && new Date().getTime() - new Date(persona.lastUsed).getTime() > 7 * 24 * 60 * 60 * 1000) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        persona.name.toLowerCase().includes(query) ||
        persona.description.toLowerCase().includes(query) ||
        persona.preferences.expertise.some(skill => skill.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleContextMenuOpen = (event: React.MouseEvent<HTMLElement>, persona: any) => {
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setSelectedPersona(persona);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
    setSelectedPersona(null);
  };

  const handleCreatePersona = () => {
    setPersonaForm({
      name: '',
      description: '',
      avatar: '👤',
      communicationStyle: 'technical',
      expertise: [],
      preferredModels: [],
      defaultSystemPrompt: ''
    });
    setCreateDialogOpen(true);
  };

  const handleEditPersona = () => {
    if (selectedPersona) {
      setPersonaForm({
        name: selectedPersona.name,
        description: selectedPersona.description,
        avatar: selectedPersona.avatar,
        communicationStyle: selectedPersona.preferences.communicationStyle,
        expertise: selectedPersona.preferences.expertise,
        preferredModels: selectedPersona.preferences.preferredModels,
        defaultSystemPrompt: selectedPersona.preferences.defaultSystemPrompt
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  };

  const handleSwitchPersona = () => {
    // dispatch(switchPersona(personaId));
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'formal': return <BusinessIcon />;
      case 'casual': return <ChatIcon />;
      case 'technical': return <CodeIcon />;
      case 'creative': return <BrushIcon />;
      default: return <PersonIcon />;
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'formal': return '#1976D2';
      case 'casual': return '#4CAF50';
      case 'technical': return '#FF9800';
      case 'creative': return '#9C27B0';
      default: return '#757575';
    }
  };

  const PersonaCard = ({ persona }: { persona: any }) => (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: persona.isActive ? 2 : 1,
        borderColor: persona.isActive ? 'primary.main' : 'divider',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* Header with menu */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
        <IconButton
          size="small"
          onClick={(e) => handleContextMenuOpen(e, persona)}
          sx={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      
      {/* Active indicator */}
      {persona.isActive && (
        <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
          <Chip 
            label="Active" 
            size="small" 
            color="primary"
            sx={{ fontSize: '0.7rem' }}
          />
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1, pt: 6 }}>
        {/* Avatar and basic info */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ fontSize: '3rem', mb: 1 }}>
            {persona.avatar}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {persona.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {persona.description}
          </Typography>
          
          {/* Communication style */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 2 }}>
            <Box sx={{ color: getStyleColor(persona.preferences.communicationStyle) }}>
              {getStyleIcon(persona.preferences.communicationStyle)}
            </Box>
            <Chip 
              label={persona.preferences.communicationStyle} 
              size="small" 
              sx={{ 
                backgroundColor: getStyleColor(persona.preferences.communicationStyle),
                color: 'white',
                fontSize: '0.7rem'
              }} 
            />
          </Box>
        </Box>

        {/* Expertise tags */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Expertise:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {persona.preferences.expertise.slice(0, 6).map((skill: string) => (
              <Chip
                key={skill}
                label={skill}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {persona.preferences.expertise.length > 6 && (
              <Chip
                label={`+${persona.preferences.expertise.length - 6} more`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, fontSize: '0.8rem', color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ChatIcon fontSize="small" />
            {persona.conversationCount} chats
          </Box>
          <Box>
            Last used: {new Date(persona.lastUsed).toLocaleDateString()}
          </Box>
        </Box>

        {/* Preferred models */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Preferred Models:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {persona.preferences.preferredModels.slice(0, 2).map((model: string) => (
              <Chip
                key={model}
                label={model}
                size="small"
                color="secondary"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {persona.preferences.preferredModels.length > 2 && (
              <Chip
                label={`+${persona.preferences.preferredModels.length - 2}`}
                size="small"
                color="secondary"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
        <Button 
          size="small" 
          variant="outlined"
          onClick={() => handleSwitchPersona()}
          disabled={persona.isActive}
        >
          {persona.isActive ? 'Current' : 'Switch To'}
        </Button>
        <Button size="small" variant="text" startIcon={<ChatIcon />}>
          Start Chat
        </Button>
      </CardActions>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Personas [COMING SOON]
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage different AI interaction personalities and their preferences
        </Typography>
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Box sx={{ flexGrow: 1, width: { xs: '100%', md: 'auto' } }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search personas..."
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
          <Box sx={{ width: { xs: '100%', md: '200px' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter</InputLabel>
              <Select
                value={filterBy}
                label="Filter"
                onChange={(e) => setFilterBy(e.target.value)}
              >
                <MenuItem value="all">All Personas</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="recent">Recently Used</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ width: { xs: '100%', md: '200px' } }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePersona}
            >
              Create Persona
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Active Persona Banner */}
      {mockPersonas.find(p => p.isActive) && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" startIcon={<SettingsIcon />}>
              Configure
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>{mockPersonas.find(p => p.isActive)?.name}</strong> is currently active. 
            All new conversations will use this persona's preferences.
          </Typography>
        </Alert>
      )}

      {/* Personas Grid */}
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
          gap: 3,
          flexGrow: 1 
        }}>
          {filteredPersonas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {filteredPersonas.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PsychologyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No personas found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || filterBy !== 'all' ? 'Try adjusting your search or filters' : 'Create your first persona to get started'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreatePersona}>
            Create Persona
          </Button>
        </Box>
      )}

      {/* FAB */}
      <Fab
        color="primary"
        aria-label="add persona"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleCreatePersona}
      >
        <AddIcon />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
      >
        <MenuItem onClick={() => handleSwitchPersona()} disabled={selectedPersona?.isActive}>
          <SwitchIcon sx={{ mr: 1 }} />
          Switch To
        </MenuItem>
        <MenuItem onClick={handleEditPersona}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose}>
          <CopyIcon sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleContextMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, color: 'error.main' }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Persona Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Persona</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Persona Name"
                  value={personaForm.name}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Avatar (Emoji)"
                  value={personaForm.avatar}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, avatar: e.target.value }))}
                  placeholder="👤"
                />
              </Stack>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={personaForm.description}
                onChange={(e) => setPersonaForm(prev => ({ ...prev, description: e.target.value }))}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Communication Style</InputLabel>
                  <Select
                    value={personaForm.communicationStyle}
                    label="Communication Style"
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, communicationStyle: e.target.value as any }))}
                  >
                    <MenuItem value="formal">Formal</MenuItem>
                    <MenuItem value="casual">Casual</MenuItem>
                    <MenuItem value="technical">Technical</MenuItem>
                    <MenuItem value="creative">Creative</MenuItem>
                  </Select>
                </FormControl>
                <Autocomplete
                  multiple
                  options={availableModels}
                  value={personaForm.preferredModels}
                  onChange={(_e, newValue) => setPersonaForm(prev => ({ ...prev, preferredModels: newValue }))}
                  renderInput={(params) => (
                    <TextField {...params} label="Preferred Models" />
                  )}
                />
              </Stack>
              <Autocomplete
                multiple
                options={expertiseOptions}
                value={personaForm.expertise}
                onChange={(_e, newValue) => setPersonaForm(prev => ({ ...prev, expertise: newValue }))}
                renderInput={(params) => (
                  <TextField {...params} label="Areas of Expertise" />
                )}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreatePersona}
            disabled={loading || !personaForm.name.trim() || !personaForm.description.trim()}
          >
            {loading ? 'Creating...' : 'Create Persona'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Persona Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Persona</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Persona Name"
                  value={personaForm.name}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Avatar (Emoji)"
                  value={personaForm.avatar}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, avatar: e.target.value }))}
                />
              </Stack>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={personaForm.description}
                onChange={(e) => setPersonaForm(prev => ({ ...prev, description: e.target.value }))}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Communication Style</InputLabel>
                  <Select
                    value={personaForm.communicationStyle}
                    label="Communication Style"
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, communicationStyle: e.target.value as any }))}
                  >
                    <MenuItem value="formal">Formal</MenuItem>
                    <MenuItem value="casual">Casual</MenuItem>
                    <MenuItem value="technical">Technical</MenuItem>
                    <MenuItem value="creative">Creative</MenuItem>
                  </Select>
                </FormControl>
                <Autocomplete
                  multiple
                  options={availableModels}
                  value={personaForm.preferredModels}
                  onChange={(_e, newValue) => setPersonaForm(prev => ({ ...prev, preferredModels: newValue }))}
                  renderInput={(params) => (
                    <TextField {...params} label="Preferred Models" />
                  )}
                />
              </Stack>
              <Autocomplete
                multiple
                options={expertiseOptions}
                value={personaForm.expertise}
                onChange={(_e, newValue) => setPersonaForm(prev => ({ ...prev, expertise: newValue }))}
                renderInput={(params) => (
                  <TextField {...params} label="Areas of Expertise" />
                )}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button variant="contained" onClick={handleEditPersona}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 