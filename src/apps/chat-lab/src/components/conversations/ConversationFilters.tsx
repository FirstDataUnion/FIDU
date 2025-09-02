import React from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
} from '@mui/material';


interface ConversationFiltersProps {
  showFilters: boolean;
  selectedPlatforms: string[];
  selectedTags: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  allPlatforms: string[];
  allTags: string[];
  onPlatformsChange: (platforms: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderChange: (sortOrder: 'asc' | 'desc') => void;
}

const ConversationFilters: React.FC<ConversationFiltersProps> = React.memo(({
  showFilters,
  selectedPlatforms,
  selectedTags,
  sortBy,
  sortOrder,
  allPlatforms,
  allTags,
  onPlatformsChange,
  onTagsChange,
  onSortByChange,
  onSortOrderChange,
}) => {
  if (!showFilters) return null;

  return (
    <Paper sx={{ p: 2, mb: 1 }}>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          md: 'repeat(4, 1fr)' 
        }, 
        gap: 2 
      }}>
        <FormControl fullWidth size="small">
          <InputLabel sx={{ mb: 1, marginTop: 1 }}>Platforms</InputLabel>
          <Select
            multiple
            value={selectedPlatforms}
            onChange={(e) => onPlatformsChange(e.target.value as string[])}
            renderValue={(selected) => selected.join(', ')}
            sx={{ mt: 1 }}
          >
            {allPlatforms.map((platform) => (
              <MenuItem key={platform} value={platform}>
                <Checkbox checked={selectedPlatforms.includes(platform)} />
                {platform.toUpperCase()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl fullWidth size="small">
          <InputLabel sx={{ mb: 4, marginTop: 1 }}>Tags</InputLabel>
          <Select
            multiple
            value={selectedTags}
            onChange={(e) => onTagsChange(e.target.value as string[])}
            renderValue={(selected) => selected.join(', ')}
            sx={{ mt: 1 }}
          >
            {allTags.map((tag) => (
              <MenuItem key={tag} value={tag}>
                <Checkbox checked={selectedTags.includes(tag)} />
                {tag}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl fullWidth size="small">
          <InputLabel sx={{ mb: 1 }}>Sort By</InputLabel>
          <Select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            sx={{ mt: 1 }}
          >
            <MenuItem value="updatedAt">Last Updated</MenuItem>
            <MenuItem value="createdAt">Created Date</MenuItem>
            <MenuItem value="title">Title</MenuItem>
            <MenuItem value="messageCount">Message Count</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl fullWidth size="small">
          <InputLabel sx={{ mb: 1 }}>Order</InputLabel>
          <Select
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
            sx={{ mt: 1 }}
          >
            <MenuItem value="desc">Descending</MenuItem>
            <MenuItem value="asc">Ascending</MenuItem>
          </Select>
        </FormControl>
        

      </Box>
    </Paper>
  );
});

ConversationFilters.displayName = 'ConversationFilters';

export default ConversationFilters;
