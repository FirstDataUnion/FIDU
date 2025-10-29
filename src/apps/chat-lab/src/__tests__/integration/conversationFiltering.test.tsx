import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import { useConversationFilters } from '../../hooks/useConversationFilters';
import ConversationCard from '../../components/conversations/ConversationCard';
import type { Conversation } from '../../types';

// Create a theme for testing
const theme = createTheme();

// Simple test data
const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'Test Conversation',
    platform: 'chatgpt',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastMessage: 'Hello world',
    messageCount: 5,
    tags: ['test'],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active',
  },
];

// Simple integration test component
const ConversationIntegrationTestComponent: React.FC = () => {
  const { filteredConversations } = useConversationFilters({
    conversations: mockConversations,
    searchQuery: '',
    selectedTags: [],
    showArchived: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  return (
    <div>
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

describe('Conversation Integration', () => {
  it('should render conversation card with real utility functions', () => {
    renderWithProviders(<ConversationIntegrationTestComponent />);
    
    // Test that the component renders without errors
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('5 messages')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
