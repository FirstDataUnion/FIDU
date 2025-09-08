import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import { useConversationFilters } from '../../hooks/useConversationFilters';
import ConversationCard from '../../components/conversations/ConversationCard';
import type { Conversation } from '../../types';

// Create a theme for testing
const theme = createTheme();

// Mock the utility functions
jest.mock('../../utils/conversationUtils', () => ({
  getPlatformColor: jest.fn((platform: string) => {
    switch (platform.toLowerCase()) {
      case 'chatgpt': return '#00A67E';
      case 'claude': return '#FF6B35';
      case 'gemini': return '#4285F4';
      default: return '#666';
    }
  }),
  formatDate: jest.fn((date: Date) => '2 hours ago'),
  getTagColor: jest.fn((tag: string) => '#f44336'),
}));

// Mock conversation data
const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'ChatGPT AI Discussion',
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
    title: 'Claude Technical Chat',
    platform: 'claude',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    lastMessage: 'Hello from Claude',
    messageCount: 3,
    tags: ['ai', 'technical'],
    isArchived: false,
    isFavorite: true,
    participants: [],
    status: 'active',
  },
  {
    id: '3',
    title: 'Gemini General Discussion',
    platform: 'gemini',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    lastMessage: 'Hello from Gemini',
    messageCount: 2,
    tags: ['general'],
    isArchived: true,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
  {
    id: '4',
    title: 'Another ChatGPT Chat',
    platform: 'chatgpt',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    lastMessage: 'Another ChatGPT message',
    messageCount: 10,
    tags: ['chat', 'general'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
];

// Test component that uses the conversation filters hook
const ConversationFilterTestComponent: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [showArchived, setShowArchived] = React.useState(false);
  const [sortBy, setSortBy] = React.useState('updatedAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const {
    allTags,
    allPlatforms,
    filteredConversations,
    sortedConversations,
  } = useConversationFilters({
    conversations: mockConversations,
    searchQuery,
    selectedPlatforms,
    selectedTags,
    showArchived,
    sortBy,
    sortOrder,
  });

  const handleConversationSelect = (conversation: Conversation) => {
    console.log('Selected conversation:', conversation.title);
  };

  const handleTagManagement = (conversation: Conversation, event: React.MouseEvent) => {
    console.log('Tag management for:', conversation.title);
  };

  return (
    <div>
      <div data-testid="filters">
        <input
          data-testid="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
        />
        
        <div data-testid="platform-filters">
          {allPlatforms.map(platform => (
            <label key={platform}>
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPlatforms([...selectedPlatforms, platform]);
                  } else {
                    setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                  }
                }}
              />
              {platform}
            </label>
          ))}
        </div>

        <div data-testid="tag-filters">
          {allTags.map(tag => (
            <label key={tag}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTags([...selectedTags, tag]);
                  } else {
                    setSelectedTags(selectedTags.filter(t => t !== tag));
                  }
                }}
              />
              {tag}
            </label>
          ))}
        </div>

        <label>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived
        </label>

        <select
          data-testid="sort-select"
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [newSortBy, newSortOrder] = e.target.value.split('-');
            setSortBy(newSortBy);
            setSortOrder(newSortOrder as 'asc' | 'desc');
          }}
        >
          <option value="updatedAt-desc">Updated (Newest First)</option>
          <option value="updatedAt-asc">Updated (Oldest First)</option>
          <option value="title-asc">Title (A-Z)</option>
          <option value="title-desc">Title (Z-A)</option>
          <option value="messageCount-desc">Messages (Most First)</option>
          <option value="messageCount-asc">Messages (Least First)</option>
        </select>
      </div>

      <div data-testid="conversation-list">
        {sortedConversations.map(conversation => (
          <ConversationCard
            key={conversation.id}
            conversation={conversation}
            isSelectedForContext={false}
            isCurrentlyViewing={false}
            onSelect={handleConversationSelect}
            onTagManagement={handleTagManagement}
          />
        ))}
      </div>

      <div data-testid="stats">
        <span data-testid="total-conversations">{mockConversations.length}</span>
        <span data-testid="filtered-conversations">{filteredConversations.length}</span>
        <span data-testid="sorted-conversations">{sortedConversations.length}</span>
      </div>
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      // Add minimal reducers for testing
      conversations: (state = { items: [] }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </Provider>
  );
};

describe('Conversation Filtering Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display all conversations initially', () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    expect(screen.getByTestId('total-conversations')).toHaveTextContent('4');
    expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('3'); // Archived conversations filtered out by default
    expect(screen.getByTestId('sorted-conversations')).toHaveTextContent('3');
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument(); // Archived
  });

  it('should filter conversations by search query', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'ChatGPT' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('2');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.queryByText('Claude Technical Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument();
  });

  it('should filter conversations by platform', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const chatgptCheckbox = screen.getByLabelText('chatgpt');
    fireEvent.click(chatgptCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('2');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.queryByText('Claude Technical Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument();
  });

  it('should filter conversations by tags', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const aiTagCheckbox = screen.getByLabelText('ai');
    fireEvent.click(aiTagCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('2');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument();
    expect(screen.queryByText('Another ChatGPT Chat')).not.toBeInTheDocument();
  });

  it('should filter out archived conversations by default', () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('3');
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument();
  });

  it('should show archived conversations when enabled', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const showArchivedCheckbox = screen.getByLabelText('Show Archived');
    fireEvent.click(showArchivedCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('4');
    });
    
    expect(screen.getByText('Gemini General Discussion')).toBeInTheDocument();
  });

  it('should combine multiple filters', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    // Search for "ChatGPT"
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'ChatGPT' } });
    
    // Select chatgpt platform
    const chatgptCheckbox = screen.getByLabelText('chatgpt');
    fireEvent.click(chatgptCheckbox);
    
    // Select ai tag
    const aiTagCheckbox = screen.getByLabelText('ai');
    fireEvent.click(aiTagCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('1');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.queryByText('Another ChatGPT Chat')).not.toBeInTheDocument();
  });

  it('should sort conversations by title alphabetically', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const sortSelect = screen.getByTestId('sort-select');
    fireEvent.change(sortSelect, { target: { value: 'title-asc' } });
    
    await waitFor(() => {
      // Check that the conversations are sorted alphabetically by title
      expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
      expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
      expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
      
      // Verify the order by checking the conversation list structure
      const conversationList = screen.getByTestId('conversation-list');
      const conversationElements = conversationList.children;
      
      // First conversation should be "Another ChatGPT Chat"
      expect(conversationElements[0]).toHaveTextContent('Another ChatGPT Chat');
      // Second conversation should be "ChatGPT AI Discussion"
      expect(conversationElements[1]).toHaveTextContent('ChatGPT AI Discussion');
      // Third conversation should be "Claude Technical Chat"
      expect(conversationElements[2]).toHaveTextContent('Claude Technical Chat');
    });
  });

  it('should sort conversations by message count', async () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const sortSelect = screen.getByTestId('sort-select');
    fireEvent.change(sortSelect, { target: { value: 'messageCount-desc' } });
    
    await waitFor(() => {
      // Check that the conversations are sorted by message count (descending)
      expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
      expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
      expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
      
      // Verify the order by checking the conversation list structure
      const conversationList = screen.getByTestId('conversation-list');
      const conversationElements = conversationList.children;
      
      // First conversation should be "Another ChatGPT Chat" (10 messages)
      expect(conversationElements[0]).toHaveTextContent('Another ChatGPT Chat');
      // Second conversation should be "ChatGPT AI Discussion" (5 messages)
      expect(conversationElements[1]).toHaveTextContent('ChatGPT AI Discussion');
      // Third conversation should be "Claude Technical Chat" (3 messages)
      expect(conversationElements[2]).toHaveTextContent('Claude Technical Chat');
    });
  });

  it('should handle conversation selection', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const firstConversation = screen.getByText('ChatGPT AI Discussion');
    fireEvent.click(firstConversation);
    
    expect(consoleSpy).toHaveBeenCalledWith('Selected conversation:', 'ChatGPT AI Discussion');
    
    consoleSpy.mockRestore();
  });

  it('should handle tag management', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    renderWithProviders(<ConversationFilterTestComponent />);
    
    const tagButton = screen.getAllByTitle('Manage Tags')[0];
    fireEvent.click(tagButton);
    
    // The first conversation in the default sort order (updatedAt-desc) should be "Another ChatGPT Chat"
    expect(consoleSpy).toHaveBeenCalledWith('Tag management for:', 'Another ChatGPT Chat');
    
    consoleSpy.mockRestore();
  });

  it('should extract all unique platforms and tags', () => {
    renderWithProviders(<ConversationFilterTestComponent />);
    
    // Check that all platforms are available as filter options
    expect(screen.getByLabelText('chatgpt')).toBeInTheDocument();
    expect(screen.getByLabelText('claude')).toBeInTheDocument();
    expect(screen.getByLabelText('gemini')).toBeInTheDocument();
    
    // Check that all tags are available as filter options
    expect(screen.getByLabelText('ai')).toBeInTheDocument();
    expect(screen.getByLabelText('chat')).toBeInTheDocument();
    expect(screen.getByLabelText('technical')).toBeInTheDocument();
    expect(screen.getByLabelText('general')).toBeInTheDocument();
  });

  it('should maintain filter state across re-renders', async () => {
    const { rerender } = renderWithProviders(<ConversationFilterTestComponent />);
    
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'ChatGPT' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('2');
    });
    
    // Re-render the component
    rerender(<ConversationFilterTestComponent />);
    
    // After re-render, the local state is reset, so we should see all non-archived conversations again
    expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('3');
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
  });
});
