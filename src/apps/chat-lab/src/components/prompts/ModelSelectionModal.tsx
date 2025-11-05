import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  Box,
  Divider,
  TextField,
  InputAdornment,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  Stack
} from '@mui/material';
import {
  SmartToy as SmartToyIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Speed as SpeedIcon,
  Category as CategoryIcon,
  AutoAwesome as AutoIcon,
  Sort as SortIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { getAllModels, getModelsForMode, type ModelConfig, type ProviderKey } from '../../data/models';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

interface ModelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onAutoModeToggle?: (modelId: string) => void;
}

type SortOption = 'name' | 'provider' | 'speed' | 'category';
type FilterOption = 'all' | 'fast' | 'medium' | 'slow';

export default function ModelSelectionModal({
  open,
  onClose,
  selectedModel,
  onSelectModel,
  onAutoModeToggle
}: ModelSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [useBYOK, setUseBYOK] = useState(() => {
    try {
      const saved = localStorage.getItem('chatlab_byok_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [userProviders, setUserProviders] = useState<ProviderKey[] | null>(null);

  // Get all available models from the centralized configuration
  const availableModels = getAllModels();
  const autoRouterModel = availableModels.find(model => model.id === 'auto-router');
  const otherModels = availableModels.filter(model => model.id !== 'auto-router');


  // Persist BYOK toggle to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('chatlab_byok_enabled', useBYOK ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  }, [useBYOK]);

  // Load user's available providers when BYOK is toggled on
  React.useEffect(() => {
    let cancelled = false;
    const loadProviders = async () => {
      if (!useBYOK) {
        setUserProviders(null);
        return;
      }
      try {
        const storage = getUnifiedStorageService();
        const keys = await storage.getAllAPIKeys();
        if (cancelled) return;
        const providers = (keys || [])
          .map((k: any) => (k.provider as string)?.toLowerCase())
          .filter(Boolean)
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) as ProviderKey[];
        setUserProviders(providers);
      } catch {
        setUserProviders([]);
      }
    };
    loadProviders();
    return () => { cancelled = true; };
  }, [useBYOK]);

  // Filter models based on BYOK mode, search and filters
  const filteredModels = useMemo(() => {
    const baseList = useBYOK
      ? getModelsForMode({ useBYOK: true, userProviders: userProviders || undefined })
      : otherModels.filter(m => m.executionPath === 'openrouter');

    const filtered = baseList.filter(model => {
      // Search filter
      const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.capabilities.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase())) ||
        model.category.toLowerCase().includes(searchQuery.toLowerCase());

      // Provider filter
      const matchesProvider = providerFilter === 'all' || model.provider.toLowerCase() === providerFilter.toLowerCase();

      // Speed filter
      let matchesFilter = true;
      if (filterBy !== 'all') {
        switch (filterBy) {
          case 'fast':
            matchesFilter = model.speed === 'fast';
            break;
          case 'medium':
            matchesFilter = model.speed === 'medium';
            break;
          case 'slow':
            matchesFilter = model.speed === 'slow';
            break;
        }
      }

      return matchesSearch && matchesProvider && matchesFilter;
    });

    // Sort models
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'provider':
          return a.provider.localeCompare(b.provider);
        case 'speed': {
          const speedOrder = { fast: 0, medium: 1, slow: 2 };
          return speedOrder[a.speed] - speedOrder[b.speed];
        }
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  }, [otherModels, useBYOK, userProviders, searchQuery, sortBy, filterBy, providerFilter]);

  const handleModelSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  const handleAutoModeToggle = (enabled: boolean) => {
    if (enabled) {
      if (onAutoModeToggle) {
        onAutoModeToggle('auto-router');
      } else {
        onSelectModel('auto-router');
      }
    } else {
      // If disabling auto mode, select the first available model
      const firstModel = filteredModels[0] || otherModels[0];
      if (firstModel) {
        if (onAutoModeToggle) {
          onAutoModeToggle(firstModel.id);
        } else {
          onSelectModel(firstModel.id);
        }
      }
    }
    // Don't close the modal - let user see the change
  };

  const isAutoModeEnabled = selectedModel === 'auto-router';

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'primary';
      case 'anthropic':
        return 'secondary';
      case 'google':
        return 'success';
      case 'meta':
        return 'info';
      case 'mistral':
        return 'warning';
      case 'microsoft':
        return 'error';
      case 'xai':
        return 'default';
      case 'nlp workbench':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getSpeedIcon = (speed: ModelConfig['speed']) => {
    switch (speed) {
      case 'fast':
        return <SpeedIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'medium':
        return <SpeedIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'slow':
        return <SpeedIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      default:
        return <SpeedIcon sx={{ fontSize: 16 }} />;
    }
  };

  const uniqueProviders = Array.from(new Set(otherModels.map(model => model.provider))).sort();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box>
          <Typography component="span" variant="h6" sx={{ fontWeight: 600, display: 'block' }}>
            Select AI Model
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
            Choose the AI model for your conversation
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Auto Router Toggle */}
        {autoRouterModel && (
          <Box sx={{ p: 2, pb: 1 }}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 2, 
                backgroundColor: isAutoModeEnabled ? 'primary.light' : 'background.paper',
                border: isAutoModeEnabled ? '2px solid' : '1px solid',
                borderColor: isAutoModeEnabled ? 'primary.main' : 'divider',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <AutoIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: isAutoModeEnabled ? 'primary.main' : 'text.primary' }}>
                      {autoRouterModel.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {autoRouterModel.description}
                    </Typography>
                  </Box>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isAutoModeEnabled}
                      onChange={(e) => handleAutoModeToggle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Enable Auto Mode"
                  sx={{ ml: 0 }}
                />
              </Box>
            </Paper>
          </Box>
        )}

        <Divider />

        {/* Search and Filters */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack spacing={2}>
            {/* BYOK Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useBYOK}
                    onChange={(e) => setUseBYOK(e.target.checked)}
                    color="primary"
                  />
                }
                label="Use my own API keys"
              />
              {useBYOK && (userProviders?.length === 0) && (
                <Tooltip
                  title="No compatible models found. Add your provider API keys in Settings to enable BYOK."
                  placement="left"
                >
                  <Chip label="No providers configured" color="warning" size="small" />
                </Tooltip>
              )}
            </Box>

            {/* Search */}
            <TextField
              fullWidth
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              size="small"
            />

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  label="Sort by"
                  startAdornment={<SortIcon sx={{ mr: 1, fontSize: 16 }} />}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="provider">Provider</MenuItem>
                  <MenuItem value="speed">Speed</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Filter by</InputLabel>
                <Select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                  label="Filter by"
                  startAdornment={<FilterIcon sx={{ mr: 1, fontSize: 16 }} />}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="fast">Fast Speed</MenuItem>
                  <MenuItem value="medium">Medium Speed</MenuItem>
                  <MenuItem value="slow">Slow Speed</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  label="Provider"
                >
                  <MenuItem value="all">All Providers</MenuItem>
                  {uniqueProviders.map(provider => (
                    <MenuItem key={provider} value={provider}>{provider}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </Box>

        <Divider />

        {/* Models List */}
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredModels.map((model, index) => (
            <React.Fragment key={model.id}>
              <ListItem disablePadding>
                <Tooltip 
                  title={
                    <Box sx={{ maxWidth: 300 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        {model.name}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {model.description}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Capabilities:</strong> {model.capabilities.join(', ')}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Category:</strong> {model.category} | <strong>Speed:</strong> {model.speed}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Max Tokens:</strong> {model.maxTokens.toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  placement="right"
                  arrow
                  enterDelay={500}
                  leaveDelay={200}
                >
                  <ListItemButton
                    onClick={() => handleModelSelect(model.id)}
                    selected={selectedModel === model.id}
                    disabled={isAutoModeEnabled}
                    sx={{
                      py: 2,
                      opacity: isAutoModeEnabled ? 0.6 : 1,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        }
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <SmartToyIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {model.name}
                          </Typography>
                          {selectedModel === model.id && (
                            <CheckIcon color="primary" fontSize="small" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 1 }}>
                            {model.description}
                          </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip
                              label={model.provider}
                              size="small"
                              color={getProviderColor(model.provider) as any}
                              variant="outlined"
                            />
                            <Chip
                              label={model.category}
                              size="small"
                              variant="outlined"
                              icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {getSpeedIcon(model.speed)}
                              <Typography variant="caption" color="text.secondary" component="span">
                                {model.speed}
                              </Typography>
                            </Box>
                            <Chip
                              label={`${model.maxTokens.toLocaleString()} tokens`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
              {index < filteredModels.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        {filteredModels.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {useBYOK
                ? 'No models available. Add your provider API keys in Settings to enable BYOK.'
                : 'No models match your search and filters'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}