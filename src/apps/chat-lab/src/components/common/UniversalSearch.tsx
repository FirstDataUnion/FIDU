import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Badge,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  Chat as ChatIcon,
  Psychology as ContextIcon,
  Science as PromptLabIcon,
  Label as TagIcon,
} from '@mui/icons-material';
import type { SearchResult } from '../../types';

interface UniversalSearchProps {
  placeholder?: string;
  size?: 'small' | 'medium';
  autoFocus?: boolean;
  onResultSelect?: (result: SearchResult) => void;
}

const UniversalSearch = React.memo<UniversalSearchProps>(
  ({
    placeholder = 'Search conversations, contexts, prompts, and tags...',
    size = 'medium',
    autoFocus = false,
    onResultSelect,
  }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<string[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);

    // Mock search results - in a real app, this would come from an API
    const mockResults = useMemo(
      () => [
        {
          type: 'conversation' as const,
          item: {
            id: 'conv-1',
            title: 'React TypeScript Best Practices',
            platform: 'chatgpt',
            messageCount: 25,
            tags: ['react', 'typescript'],
          },
          relevanceScore: 0.95,
          matchedFields: ['title', 'content'],
          highlightedContent: 'React TypeScript Best Practices',
          title: 'React TypeScript Best Practices',
          subtitle: '25 messages • chatgpt',
          id: 'conv-1',
        },
        {
          type: 'context' as const,
          item: {
            id: 'ctx-1',
            title: 'Frontend Development Context',
            body: 'Context for frontend development discussions...',
            tokenCount: 150,
          },
          relevanceScore: 0.87,
          matchedFields: ['title', 'body'],
          highlightedContent: 'Frontend Development Context',
          title: 'Frontend Development Context',
          subtitle: '150 tokens',
          id: 'ctx-1',
        },
      ],
      []
    );

    // Memoize filtered results to prevent recalculation on every render
    const filteredResults = useMemo(() => {
      if (query.length === 0) return [];

      return mockResults.filter(result => {
        const item = result.item as any;
        const matchesQuery =
          item.title?.toLowerCase().includes(query.toLowerCase())
          || item.body?.toLowerCase().includes(query.toLowerCase())
          || result.highlightedContent
            ?.toLowerCase()
            .includes(query.toLowerCase());

        const matchesFilters =
          activeFilters.length === 0 || activeFilters.includes(result.type);

        return matchesQuery && matchesFilters;
      });
    }, [query, activeFilters, mockResults]);

    // Update results when filtered results change
    useEffect(() => {
      setResults(filteredResults);
      setIsOpen(query.length > 0);
    }, [filteredResults, query.length]);

    // Memoize type icon getter to prevent recreation on every render
    const getTypeIcon = useCallback((type: string) => {
      switch (type) {
        case 'conversation':
          return <ChatIcon fontSize="small" />;
        case 'context':
          return <ContextIcon fontSize="small" />;
        case 'prompt':
          return <PromptLabIcon fontSize="small" />;
        case 'tag':
          return <TagIcon fontSize="small" />;
        default:
          return <SearchIcon fontSize="small" />;
      }
    }, []);

    // Memoize type color getter
    const getTypeColor = useCallback((type: string) => {
      switch (type) {
        case 'conversation':
          return '#1976D2';
        case 'context':
          return '#388E3C';
        case 'prompt':
          return '#7B1FA2';
        case 'tag':
          return '#5D4037';
        default:
          return '#757575';
      }
    }, []);

    // Memoize result click handler
    const handleResultClick = useCallback(
      (result: SearchResult) => {
        setQuery('');
        setIsOpen(false);
        onResultSelect?.(result);
      },
      [onResultSelect]
    );

    // Memoize filter toggle handler
    const handleFilterToggle = useCallback((filter: string) => {
      setActiveFilters(prev =>
        prev.includes(filter)
          ? prev.filter(f => f !== filter)
          : [...prev, filter]
      );
    }, []);

    // Memoize clear query handler
    const handleClearQuery = useCallback(() => {
      setQuery('');
      setIsOpen(false);
    }, []);

    // Memoize query change handler
    const handleQueryChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
      },
      []
    );

    // Memoize filter options to prevent recreation
    const filterOptions = useMemo(
      () => [
        { key: 'conversation', label: 'Conversations', color: '#1976D2' },
        { key: 'context', label: 'Contexts', color: '#388E3C' },
        { key: 'prompt', label: 'Prompts', color: '#7B1FA2' },
        { key: 'tag', label: 'Tags', color: '#5D4037' },
      ],
      []
    );

    // Memoize active filters content
    const activeFiltersContent = useMemo(
      () =>
        activeFilters.map(filter => {
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
        }),
      [activeFilters, filterOptions, handleFilterToggle]
    );

    // Memoize search results content
    const searchResultsContent = useMemo(() => {
      if (results.length === 0) {
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No results found
            </Typography>
          </Box>
        );
      }

      return (
        <List>
          {results.map((result, index) => (
            <React.Fragment key={result.id || index}>
              <ListItem
                component="div"
                onClick={() => handleResultClick(result)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon sx={{ color: getTypeColor(result.type) }}>
                  {getTypeIcon(result.type)}
                </ListItemIcon>
                <ListItemText
                  primary={result.title}
                  secondary={result.subtitle}
                  primaryTypographyProps={{
                    variant: 'body1',
                    fontWeight: 500,
                  }}
                  secondaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                />
              </ListItem>
              {index < results.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      );
    }, [results, handleResultClick, getTypeColor, getTypeIcon]);

    return (
      <Box sx={{ position: 'relative', width: '100%' }}>
        <TextField
          ref={inputRef}
          fullWidth
          size={size}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={handleQueryChange}
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
                  <IconButton size="small" onClick={handleClearQuery}>
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
            {activeFiltersContent}
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
              border: 1,
              borderColor: 'divider',
            }}
          >
            {searchResultsContent}
          </Paper>
        )}
      </Box>
    );
  }
);

UniversalSearch.displayName = 'UniversalSearch';

export default UniversalSearch;
