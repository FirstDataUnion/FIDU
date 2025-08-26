import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  TextField,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  Memory as MemoryIcon,
  Label as TagIcon,
  FilterList as FilterIcon,
  ViewKanban as ContextIcon,
  Science as PromptLabIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'conversation' | 'context' | 'prompt' | 'persona' | 'memory' | 'tag';
  matchedText?: string;
  metadata?: any;
}

interface UniversalSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  size?: 'small' | 'medium';
  autoFocus?: boolean;
}

export default function UniversalSearch({ 
  onResultSelect, 
  placeholder = "Search everything...",
  size = 'medium',
  autoFocus = false
}: UniversalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock data for demonstration
  const mockResults: SearchResult[] = useMemo(() => [
    {
      id: 'conv-1',
      title: 'Frontend Architecture Discussion',
      subtitle: 'Claude-3-Sonnet • 2 hours ago',
      type: 'conversation',
      matchedText: 'React state management patterns...',
      metadata: { platform: 'claude', messageCount: 23 }
    },
    {
      id: 'ctx-1',
      title: 'React Best Practices Context',
      subtitle: '5 files • Updated yesterday',
      type: 'context',
      matchedText: 'Component lifecycle and hooks...',
      metadata: { fileCount: 5, lastUpdated: new Date().toISOString() }
    },
    {
      id: 'prompt-1',
      title: 'Code Review Assistant',
      subtitle: 'System Prompt • Technical',
      type: 'prompt',
      matchedText: 'You are an expert code reviewer...',
      metadata: { tokenCount: 150, category: 'development' }
    },
    {
      id: 'persona-1',
      title: 'Frontend Developer',
      subtitle: 'Active • 45 conversations',
      type: 'persona',
      matchedText: 'React, TypeScript, modern web development',
      metadata: { isActive: true, conversationCount: 45 }
    },
    {
      id: 'memory-1',
      title: 'Prefers functional components',
      subtitle: 'Preference • High importance',
      type: 'memory',
      matchedText: 'User prefers functional React components over class...',
      metadata: { importance: 'high', memoryType: 'preference' }
    },
    {
      id: 'tag-1',
      title: 'react-hooks',
      subtitle: 'Tag • 12 conversations',
      type: 'tag',
      metadata: { usage: 12, category: 'technology' }
    }
  ], []);

  useEffect(() => {
    setResults(mockResults);
  }, [mockResults]);

  useEffect(() => {
    if (query.length > 0) {
      // Simulate search with filtering
      const filteredResults = mockResults.filter(result => {
        const matchesQuery = result.title.toLowerCase().includes(query.toLowerCase()) ||
                            result.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
                            result.matchedText?.toLowerCase().includes(query.toLowerCase());
        
        const matchesFilters = activeFilters.length === 0 || activeFilters.includes(result.type);
        
        return matchesQuery && matchesFilters;
      });
      
      setResults(filteredResults);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, activeFilters, mockResults]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'conversation': return <ChatIcon fontSize="small" />;
      case 'context': return <ContextIcon fontSize="small" />;
      case 'prompt': return <PromptLabIcon fontSize="small" />;
      case 'persona': return <PsychologyIcon fontSize="small" />;
      case 'memory': return <MemoryIcon fontSize="small" />;
      case 'tag': return <TagIcon fontSize="small" />;
      default: return <SearchIcon fontSize="small" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'conversation': return '#1976D2';
      case 'context': return '#388E3C';
      case 'prompt': return '#7B1FA2';
      case 'persona': return '#F57C00';
      case 'memory': return '#C2185B';
      case 'tag': return '#5D4037';
      default: return '#757575';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Add to recent searches
    setRecentSearches(prev => {
      const newRecent = [query, ...prev.filter(q => q !== query)].slice(0, 5);
      return newRecent;
    });
    
    setQuery('');
    setIsOpen(false);
    onResultSelect?.(result);
  };

  const handleFilterToggle = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const filterOptions = [
    { key: 'conversation', label: 'Conversations', color: '#1976D2' },
    { key: 'context', label: 'Contexts', color: '#388E3C' },
    { key: 'prompt', label: 'Prompts', color: '#7B1FA2' },
    { key: 'persona', label: 'Personas', color: '#F57C00' },
    { key: 'memory', label: 'Memories', color: '#C2185B' },
    { key: 'tag', label: 'Tags', color: '#5D4037' },
  ];

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        ref={inputRef}
        fullWidth
        size={size}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {activeFilters.length > 0 && (
                <Badge badgeContent={activeFilters.length} color="primary">
                  <FilterIcon />
                </Badge>
              )}
              {query && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setQuery('');
                    setIsOpen(false);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'background.paper',
          },
        }}
      />

      {/* Filter Pills */}
      {activeFilters.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {activeFilters.map(filter => {
            const option = filterOptions.find(opt => opt.key === filter);
            return (
              <Chip
                key={filter}
                label={option?.label}
                size="small"
                onDelete={() => handleFilterToggle(filter)}
                sx={{
                  backgroundColor: option?.color,
                  color: 'white',
                  '& .MuiChip-deleteIcon': {
                    color: 'rgba(255,255,255,0.8)',
                    '&:hover': {
                      color: 'white',
                    },
                  },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Search Results */}
      {isOpen && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: 1,
            maxHeight: 400,
            overflow: 'auto',
            boxShadow: 3,
          }}
        >
          {/* Filter Options */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Filter by type:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {filterOptions.map(option => (
                <Chip
                  key={option.key}
                  label={option.label}
                  size="small"
                  variant={activeFilters.includes(option.key) ? 'filled' : 'outlined'}
                  onClick={() => handleFilterToggle(option.key)}
                  sx={{
                    backgroundColor: activeFilters.includes(option.key) ? option.color : 'transparent',
                    borderColor: option.color,
                    color: activeFilters.includes(option.key) ? 'white' : option.color,
                    '&:hover': {
                      backgroundColor: option.color,
                      color: 'white',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Recent Searches */}
          {query.length === 0 && recentSearches.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ p: 1, color: 'text.secondary' }}>
                Recent searches
              </Typography>
              <List dense>
                {recentSearches.map((search, index) => (
                  <ListItem
                    key={index}
                    onClick={() => setQuery(search)}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      <SearchIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={search} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Search Results */}
          {results.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" sx={{ p: 1, color: 'text.secondary' }}>
                Search results
              </Typography>
              <List dense>
                {results.map((result) => (
                  <ListItem
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>
                      <Box sx={{ color: getTypeColor(result.type) }}>
                        {getTypeIcon(result.type)}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={result.title}
                      secondary={result.subtitle}
                    />
                    <Chip
                      label={result.type}
                      size="small"
                      sx={{
                        backgroundColor: getTypeColor(result.type),
                        color: 'white',
                        fontSize: '0.7rem'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ) : query.length > 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No results found for "{query}"
              </Typography>
            </Box>
          ) : null}
        </Paper>
      )}
    </Box>
  );
} 