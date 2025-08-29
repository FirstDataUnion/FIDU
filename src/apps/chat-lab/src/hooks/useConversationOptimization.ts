import { useMemo, useCallback, useRef } from 'react';
import type { Conversation } from '../types';

interface UseConversationOptimizationOptions {
  conversations: Conversation[];
  searchQuery: string;
  selectedPlatforms: string[];
  selectedTags: string[];
  showArchived: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const useConversationOptimization = ({
  conversations,
  searchQuery,
  selectedPlatforms,
  selectedTags,
  showArchived,
  sortBy,
  sortOrder
}: UseConversationOptimizationOptions) => {
  const previousFilters = useRef({
    searchQuery,
    selectedPlatforms,
    selectedTags,
    showArchived,
    sortBy,
    sortOrder
  });

  // Memoized expensive calculations
  const allTags = useMemo(() => 
    [...new Set(conversations.flatMap((c: Conversation) => c.tags))], 
    [conversations]
  );
  
  const allPlatforms = useMemo(() => 
    [...new Set(conversations.map((c: Conversation) => c.platform))], 
    [conversations]
  );

  // Check if filters have changed to avoid unnecessary recalculations
  const filtersChanged = useMemo(() => {
    const current = { searchQuery, selectedPlatforms, selectedTags, showArchived, sortBy, sortOrder };
    const changed = JSON.stringify(current) !== JSON.stringify(previousFilters.current);
    if (changed) {
      previousFilters.current = current;
    }
    return changed;
  }, [searchQuery, selectedPlatforms, selectedTags, showArchived, sortBy, sortOrder]);

  // Memoized filtered conversations
  const filteredConversations = useMemo(() => {
    if (!filtersChanged && conversations.length === previousFilters.current.conversations?.length) {
      return conversations; // Return cached result if nothing changed
    }

    return conversations.filter((conversation: Conversation) => {
      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesTitle = conversation.title.toLowerCase().includes(searchLower);
        const matchesContent = conversation.lastMessage?.toLowerCase().includes(searchLower);
        const matchesTags = conversation.tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
        if (!matchesTitle && !matchesContent && !matchesTags) return false;
      }
      
      // Platform filter
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(conversation.platform)) {
        return false;
      }
      
      // Tags filter
      if (selectedTags.length > 0 && !selectedTags.some((tag: string) => conversation.tags.includes(tag))) {
        return false;
      }
      
      // Archived filter
      if (!showArchived && conversation.isArchived) {
        return false;
      }
      
      return true;
    });
  }, [conversations, filtersChanged, searchQuery, selectedPlatforms, selectedTags, showArchived]);

  // Memoized sorted conversations
  const sortedConversations = useMemo(() => {
    if (!filtersChanged) {
      return filteredConversations; // Return cached result if filters haven't changed
    }

    return [...filteredConversations].sort((a: Conversation, b: Conversation) => {
      const aVal = a[sortBy as keyof Conversation] as any;
      const bVal = b[sortBy as keyof Conversation] as any;
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      
      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });
  }, [filteredConversations, filtersChanged, sortBy, sortOrder]);

  // Optimized conversation grouping by platform
  const conversationsByPlatform = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    sortedConversations.forEach(conversation => {
      const platform = conversation.platform;
      if (!groups[platform]) {
        groups[platform] = [];
      }
      groups[platform].push(conversation);
    });
    return groups;
  }, [sortedConversations]);

  // Optimized conversation grouping by tags
  const conversationsByTag = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    sortedConversations.forEach(conversation => {
      conversation.tags.forEach(tag => {
        if (!groups[tag]) {
          groups[tag] = [];
        }
        groups[tag].push(conversation);
      });
    });
    return groups;
  }, [sortedConversations]);

  // Get conversation statistics
  const stats = useMemo(() => {
    const total = conversations.length;
    const filtered = filteredConversations.length;
    const archived = conversations.filter(c => c.isArchived).length;
    const favorites = conversations.filter(c => c.isFavorite).length;
    
    return {
      total,
      filtered,
      archived,
      favorites,
      filterEfficiency: total > 0 ? ((total - filtered) / total * 100).toFixed(1) : '0'
    };
  }, [conversations, filteredConversations]);

  // Optimized search function
  const searchConversations = useCallback((query: string, limit: number = 10) => {
    if (!query.trim()) return [];
    
    const searchLower = query.toLowerCase();
    const results: Array<{ conversation: Conversation; score: number }> = [];
    
    conversations.forEach(conversation => {
      let score = 0;
      
      // Title match (highest priority)
      if (conversation.title.toLowerCase().includes(searchLower)) {
        score += 100;
      }
      
      // Content match
      if (conversation.lastMessage?.toLowerCase().includes(searchLower)) {
        score += 50;
      }
      
      // Tag matches
      conversation.tags.forEach(tag => {
        if (tag.toLowerCase().includes(searchLower)) {
          score += 25;
        }
      });
      
      // Platform match
      if (conversation.platform.toLowerCase().includes(searchLower)) {
        score += 10;
      }
      
      if (score > 0) {
        results.push({ conversation, score });
      }
    });
    
    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.conversation);
  }, [conversations]);

  return {
    allTags,
    allPlatforms,
    filteredConversations,
    sortedConversations,
    conversationsByPlatform,
    conversationsByTag,
    stats,
    searchConversations,
    filtersChanged
  };
};
