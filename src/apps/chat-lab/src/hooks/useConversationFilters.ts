import { useMemo } from 'react';
import type { Conversation } from '../types';

interface UseConversationFiltersProps {
  conversations: Conversation[];
  searchQuery: string;
  selectedPlatforms: string[];
  selectedTags: string[];
  showArchived: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const useConversationFilters = ({
  conversations,
  searchQuery,
  selectedPlatforms,
  selectedTags,
  showArchived,
  sortBy,
  sortOrder,
}: UseConversationFiltersProps) => {
  // Memoized expensive calculations
  const allTags = useMemo(() => 
    [...new Set(conversations.flatMap((c: Conversation) => c.tags))], 
    [conversations]
  );
  
  const allPlatforms = useMemo(() => 
    [...new Set(conversations.map((c: Conversation) => c.platform))], 
    [conversations]
  );

  // Memoized filtered conversations
  const filteredConversations = useMemo(() => {
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
  }, [conversations, searchQuery, selectedPlatforms, selectedTags, showArchived]);

  // Memoized sorted conversations
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a: Conversation, b: Conversation) => {
      const aVal = a[sortBy as keyof Conversation] as any;
      const bVal = b[sortBy as keyof Conversation] as any;
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      
      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });
  }, [filteredConversations, sortBy, sortOrder]);

  return {
    allTags,
    allPlatforms,
    filteredConversations,
    sortedConversations,
  };
};
