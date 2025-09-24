import React, { useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  OutlinedInput,
  Checkbox,
  ListItemText
} from '@mui/material';
import type { SystemPrompt } from '../../types';

interface CategoryFilterProps {
  systemPrompts: SystemPrompt[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  systemPrompts,
  selectedCategories,
  onCategoriesChange,
  placeholder = 'Filter by category',
  multiple = true,
  size = 'small',
  fullWidth = false
}) => {
  // Extract all unique categories from system prompts
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    systemPrompts.forEach(prompt => {
      prompt.categories?.forEach(category => {
        categories.add(category);
      });
    });
    return Array.from(categories).sort();
  }, [systemPrompts]);

  const handleChange = (event: any) => {
    const value = event.target.value;
    if (multiple) {
      onCategoriesChange(typeof value === 'string' ? value.split(',') : value);
    } else {
      onCategoriesChange(typeof value === 'string' ? [value] : []);
    }
  };

  if (availableCategories.length === 0) {
    return null;
  }

  return (
    <FormControl size={size} fullWidth={fullWidth}>
      <InputLabel id="category-filter-label">{placeholder}</InputLabel>
      <Select
        labelId="category-filter-label"
        multiple={multiple}
        value={selectedCategories}
        onChange={handleChange}
        input={<OutlinedInput label={placeholder} />}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((value) => (
              <Chip 
                key={value} 
                label={value} 
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        )}
        displayEmpty
      >
        {multiple && (
          <MenuItem value="">
            <ListItemText primary="All Categories" />
          </MenuItem>
        )}
        {availableCategories.map((category) => (
          <MenuItem key={category} value={category}>
            <Checkbox
              checked={selectedCategories.indexOf(category) > -1}
              size="small"
            />
            <ListItemText primary={category} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default CategoryFilter;
