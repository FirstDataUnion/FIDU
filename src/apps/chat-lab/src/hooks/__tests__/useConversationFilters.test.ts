import { renderHook } from '@testing-library/react';
import { useConversationFilters } from '../useConversationFilters';
import type { Conversation } from '../../types';

const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'ChatGPT Conversation',
    platform: 'chatgpt',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastMessage: 'Hello from ChatGPT',
    messageCount: 5,
    tags: ['ai', 'chat'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
  {
    id: '2',
    title: 'Claude Discussion',
    platform: 'claude',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    lastMessage: 'Hello from Claude',
    messageCount: 3,
    tags: ['ai', 'discussion'],
    isArchived: false,
    isFavorite: true,
    participants: [],
    status: 'active',
  },
  {
    id: '3',
    title: 'Archived Chat',
    platform: 'gemini',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    lastMessage: 'Hello from Gemini',
    messageCount: 2,
    tags: ['archived'],
    isArchived: true,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
  {
    id: '4',
    title: 'General Discussion',
    platform: 'chatgpt',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    lastMessage: 'General chat message',
    messageCount: 10,
    tags: ['general', 'chat'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
];

describe('useConversationFilters', () => {
  it('should return all conversations when no filters are applied', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(4);
    expect(result.current.sortedConversations).toHaveLength(4);
  });

  it('should extract all unique tags', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.allTags).toEqual(['ai', 'chat', 'discussion', 'archived', 'general']);
  });

  it('should filter by search query in title', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: 'ChatGPT',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(1);
    expect(result.current.filteredConversations[0].title).toBe('ChatGPT Conversation');
  });

  it('should filter by search query in last message', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: 'Claude',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(1);
    expect(result.current.filteredConversations[0].title).toBe('Claude Discussion');
  });

  it('should filter by search query in tags', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: 'ai',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(2);
    expect(result.current.filteredConversations.map(c => c.title)).toEqual([
      'ChatGPT Conversation',
      'Claude Discussion',
    ]);
  });


  it('should filter by selected tags', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: ['chat'],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(2);
    expect(result.current.filteredConversations.every(c => c.tags.includes('chat'))).toBe(true);
  });

  it('should filter out archived conversations when showArchived is false', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: false,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(3);
    expect(result.current.filteredConversations.every(c => !c.isArchived)).toBe(true);
  });

  it('should combine multiple filters', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: 'ChatGPT',
        selectedTags: ['chat'],
        showArchived: false,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(1);
    expect(result.current.filteredConversations[0].title).toBe('ChatGPT Conversation');
  });

  it('should sort conversations by updatedAt in descending order', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    const sorted = result.current.sortedConversations;
    expect(sorted[0].id).toBe('4'); // Most recent
    expect(sorted[3].id).toBe('1'); // Oldest
  });

  it('should sort conversations by updatedAt in ascending order', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      })
    );

    const sorted = result.current.sortedConversations;
    expect(sorted[0].id).toBe('1'); // Oldest
    expect(sorted[3].id).toBe('4'); // Most recent
  });

  it('should sort conversations by title', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'title',
        sortOrder: 'asc',
      })
    );

    const sorted = result.current.sortedConversations;
    expect(sorted[0].title).toBe('Archived Chat');
    expect(sorted[1].title).toBe('ChatGPT Conversation');
    expect(sorted[2].title).toBe('Claude Discussion');
    expect(sorted[3].title).toBe('General Discussion');
  });

  it('should sort conversations by messageCount', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'messageCount',
        sortOrder: 'desc',
      })
    );

    const sorted = result.current.sortedConversations;
    expect(sorted[0].messageCount).toBe(10);
    expect(sorted[1].messageCount).toBe(5);
    expect(sorted[2].messageCount).toBe(3);
    expect(sorted[3].messageCount).toBe(2);
  });

  it('should handle empty conversations array', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: [],
        searchQuery: '',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(0);
    expect(result.current.sortedConversations).toHaveLength(0);
    expect(result.current.allTags).toEqual([]);
  });

  it('should handle case-insensitive search', () => {
    const { result } = renderHook(() =>
      useConversationFilters({
        conversations: mockConversations,
        searchQuery: 'chatgpt',
        selectedTags: [],
        showArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );

    expect(result.current.filteredConversations).toHaveLength(1);
    expect(result.current.filteredConversations[0].title).toBe('ChatGPT Conversation');
  });

});
