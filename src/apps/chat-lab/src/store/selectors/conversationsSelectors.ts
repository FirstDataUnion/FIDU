import { createSelector } from '@reduxjs/toolkit';
import type { RootState, Conversation } from '../../types';
import { getModelDisplayName } from '../../utils/conversationUtils';
import { getEffectiveProfileId } from '../../utils/workspaceHelpers';

// Base selectors
const selectConversationsState = (state: RootState) => state.conversations;
const selectAuthState = (state: RootState) => state.auth;

// Memoized selectors
export const selectConversations = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.items
);

export const selectConversationsLoading = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.loading
);

export const selectConversationsError = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.error
);

export const selectCurrentConversation = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.currentConversation
);

export const selectCurrentMessages = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.currentMessages
);

export const selectMessagesLoading = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.messagesLoading
);

export const selectConversationsFilters = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.filters
);

export const selectConversationsPagination = createSelector(
  [selectConversationsState],
  conversationsState => conversationsState.pagination
);

// Memoized filtered conversations selector
export const selectFilteredConversations = createSelector(
  [selectConversations, selectConversationsFilters],
  (conversations, filters) => {
    if (!conversations.length) return [];

    return conversations.filter(conversation => {
      // Search query filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        const matchesTitle = conversation.title
          .toLowerCase()
          .includes(searchLower);
        const matchesContent = conversation.lastMessage
          ?.toLowerCase()
          .includes(searchLower);
        const matchesTags = conversation.tags.some((tag: string) =>
          tag.toLowerCase().includes(searchLower)
        );
        // Search in modelsUsed - check if any model display name matches
        const matchesModels =
          conversation.modelsUsed?.some(
            (model: string) =>
              getModelDisplayName(model).toLowerCase().includes(searchLower)
              || model.toLowerCase().includes(searchLower)
          ) || false;
        if (!matchesTitle && !matchesContent && !matchesTags && !matchesModels)
          return false;
      }

      // Tags filter
      if (
        filters.tags
        && filters.tags.length > 0
        && !filters.tags.some((tag: string) => conversation.tags.includes(tag))
      ) {
        return false;
      }

      // Archived filter
      if (
        filters.isArchived !== undefined
        && conversation.isArchived !== filters.isArchived
      ) {
        return false;
      }

      // Favorite filter
      if (
        filters.isFavorite !== undefined
        && conversation.isFavorite !== filters.isFavorite
      ) {
        return false;
      }

      return true;
    });
  }
);

// Memoized sorted conversations selector
export const selectSortedConversations = createSelector(
  [selectFilteredConversations, selectConversationsFilters],
  (filteredConversations, filters) => {
    if (!filteredConversations.length) return [];

    return [...filteredConversations].sort(
      (a: Conversation, b: Conversation) => {
        const aVal = a[
          filters.sortBy || ('updatedAt' as keyof Conversation)
        ] as any;
        const bVal = b[
          filters.sortBy || ('updatedAt' as keyof Conversation)
        ] as any;
        const multiplier = (filters.sortOrder || 'desc') === 'desc' ? -1 : 1;

        if (aVal < bVal) return -1 * multiplier;
        if (aVal > bVal) return 1 * multiplier;
        return 0;
      }
    );
  }
);

// Memoized derived data selectors
export const selectAllTags = createSelector(
  [selectConversations],
  conversations => [
    ...new Set(conversations.flatMap((c: Conversation) => c.tags)),
  ]
);

// Note: selectAllPlatforms removed - platform filtering is deprecated

export const selectConversationStats = createSelector(
  [selectConversations],
  conversations => {
    const total = conversations.length;
    const archived = conversations.filter(c => c.isArchived).length;
    const favorites = conversations.filter(c => c.isFavorite).length;
    const totalMessages = conversations.reduce(
      (sum, c) => sum + c.messageCount,
      0
    );

    return {
      total,
      archived,
      favorites,
      totalMessages,
      averageMessagesPerConversation:
        total > 0 ? Math.round(totalMessages / total) : 0,
    };
  }
);

// Memoized pagination selector
export const selectPaginatedConversations = createSelector(
  [selectSortedConversations, selectConversationsPagination],
  (sortedConversations, pagination) => {
    const { page = 1, limit = 20 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      conversations: sortedConversations.slice(startIndex, endIndex),
      hasNextPage: endIndex < sortedConversations.length,
      hasPrevPage: page > 1,
      currentPage: page,
      totalPages: Math.ceil(sortedConversations.length / limit),
    };
  }
);

// Auth selectors
export const selectCurrentProfile = createSelector(
  [selectAuthState],
  authState => authState.currentProfile
);

export const selectCurrentWorkspace = createSelector(
  [selectAuthState],
  authState => authState.currentWorkspace
);

/**
 * Get the effective profile ID from the current workspace
 * - Personal workspaces: returns the actual profile ID
 * - Shared workspaces: returns the virtual profile ID format (workspace-${id}-default)
 * - Returns null if no workspace is selected
 */
export const selectEffectiveProfileId = createSelector(
  [selectCurrentWorkspace],
  workspace => {
    if (!workspace) return null;
    try {
      return getEffectiveProfileId(workspace);
    } catch (error) {
      console.error('Failed to get effective profile ID:', error);
      return null;
    }
  }
);

export const selectIsAuthenticated = createSelector(
  [selectAuthState],
  authState => authState.isAuthenticated
);
