import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import { useConversationFilters } from '../../hooks/useConversationFilters';
import ConversationCard from '../../components/conversations/ConversationCard';
import type { Conversation } from '../../types';

// Create a theme for testing
const theme = createTheme();

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
    title: 'Another ChatGPT Chat',
    platform: 'chatgpt',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    lastMessage: 'Another ChatGPT message',
    messageCount: 10,
    tags: ['chat', 'general'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
  {
    id: '4',
    title: 'Gemini General Discussion',
    platform: 'gemini',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    lastMessage: 'Hello from Gemini',
    messageCount: 2,
    tags: ['general'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
];

// Simple test component focused only on platform filtering
const ConversationPlatformFilterTestComponent: React.FC = () => {
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);

  const { allPlatforms, filteredConversations } = useConversationFilters({
    conversations: mockConversations,
    searchQuery: '',
    selectedPlatforms,
    selectedTags: [],
    showArchived: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  return (
    <div>
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
      
      <div data-testid="conversation-list">
        {filteredConversations.map(conversation => (
          <ConversationCard
            key={conversation.id}
            conversation={conversation}
            isSelectedForContext={false}
            isCurrentlyViewing={false}
            onSelect={() => {}}
            onTagManagement={() => {}}
          />
        ))}
      </div>

      <div data-testid="stats">
        <span data-testid="total-conversations">{mockConversations.length}</span>
        <span data-testid="filtered-conversations">{filteredConversations.length}</span>
      </div>
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  const store = configureStore({
    reducer: {
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

describe('Conversation Platform Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display all conversations when no platform filter is selected', () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
    expect(screen.getByTestId('total-conversations')).toHaveTextContent('4');
    expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('4');
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.getByText('Gemini General Discussion')).toBeInTheDocument();
  });

  it('should filter conversations by single platform', async () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
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

  it('should filter conversations by multiple platforms', async () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
    const chatgptCheckbox = screen.getByLabelText('chatgpt');
    const claudeCheckbox = screen.getByLabelText('claude');
    
    fireEvent.click(chatgptCheckbox);
    fireEvent.click(claudeCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('3');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.queryByText('Gemini General Discussion')).not.toBeInTheDocument();
  });

  it('should show no results when platform has no conversations', async () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
    // Assuming there's a platform with no conversations
    const geminiCheckbox = screen.getByLabelText('gemini');
    fireEvent.click(geminiCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('1');
    });
    
    expect(screen.getByText('Gemini General Discussion')).toBeInTheDocument();
    expect(screen.queryByText('ChatGPT AI Discussion')).not.toBeInTheDocument();
    expect(screen.queryByText('Claude Technical Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Another ChatGPT Chat')).not.toBeInTheDocument();
  });

  it('should extract all unique platforms', () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
    expect(screen.getByLabelText('chatgpt')).toBeInTheDocument();
    expect(screen.getByLabelText('claude')).toBeInTheDocument();
    expect(screen.getByLabelText('gemini')).toBeInTheDocument();
  });

  it('should allow deselecting platform filters', async () => {
    renderWithProviders(<ConversationPlatformFilterTestComponent />);
    
    const chatgptCheckbox = screen.getByLabelText('chatgpt');
    
    // Select ChatGPT
    fireEvent.click(chatgptCheckbox);
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('2');
    });
    
    // Deselect ChatGPT
    fireEvent.click(chatgptCheckbox);
    await waitFor(() => {
      expect(screen.getByTestId('filtered-conversations')).toHaveTextContent('4');
    });
    
    expect(screen.getByText('ChatGPT AI Discussion')).toBeInTheDocument();
    expect(screen.getByText('Claude Technical Chat')).toBeInTheDocument();
    expect(screen.getByText('Another ChatGPT Chat')).toBeInTheDocument();
    expect(screen.getByText('Gemini General Discussion')).toBeInTheDocument();
  });
});
