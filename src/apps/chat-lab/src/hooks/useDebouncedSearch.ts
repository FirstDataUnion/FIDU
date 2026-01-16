import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
  onSearch?: (query: string) => void;
}

export const useDebouncedSearch = ({
  delay = 300,
  minLength = 2,
  onSearch,
}: UseDebouncedSearchOptions = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounce the search query
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (searchQuery.length >= minLength) {
      setIsSearching(true);
      timeoutRef.current = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        setIsSearching(false);
        onSearch?.(searchQuery);
      }, delay);
    } else if (searchQuery.length === 0) {
      // Clear immediately if search is empty
      setDebouncedQuery('');
      setIsSearching(false);
      onSearch?.('');
    } else {
      setIsSearching(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchQuery, delay, minLength, onSearch]);

  // Update search query
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Get search suggestions (placeholder for future implementation)
  const getSuggestions = useCallback(
    (query: string): string[] => {
      if (query.length < minLength) return [];

      // This could be expanded to include actual search suggestions
      // For now, return empty array
      return [];
    },
    [minLength]
  );

  return {
    searchQuery,
    debouncedQuery,
    isSearching,
    updateSearchQuery,
    clearSearch,
    getSuggestions,
  };
};
