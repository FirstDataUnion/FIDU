import React from 'react';
import '@testing-library/jest-dom';
import { useConversationFilters } from '../../hooks/useConversationFilters';
import ConversationCard from '../../components/conversations/ConversationCard';
import { ConversationPage } from '../pageObjects/ConversationPage';
import { renderWithProviders, testConversations, resetMocks } from '../utils/testUtils';

// Simple test component focused only on search
const ConversationSearchTestComponent: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const { filteredConversations } = useConversationFilters({
    conversations: [testConversations.chatgpt, testConversations.claude, testConversations.gemini],
    searchQuery,
    selectedPlatforms: [],
    selectedTags: [],
    showArchived: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  return (
    <div>
      <input
        data-testid="search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search conversations..."
      />
      
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
        <span data-testid="total-conversations">3</span>
        <span data-testid="filtered-conversations">{filteredConversations.length}</span>
      </div>
    </div>
  );
};

describe('Conversation Search', () => {
  let page: ConversationPage;

  beforeEach(() => {
    resetMocks();
    renderWithProviders(<ConversationSearchTestComponent />);
    page = new ConversationPage();
  });

  it('should display all conversations when search is empty', () => {
    expect(page.getTotalConversations()).toHaveTextContent('3');
    expect(page.getFilteredConversations()).toHaveTextContent('3');
    
    page.expectConversationVisible('ChatGPT AI Discussion');
    page.expectConversationVisible('Claude Technical Chat');
    page.expectConversationVisible('General Discussion');
  });

  it('should filter conversations by title', async () => {
    await page.searchFor('ChatGPT');
    await page.expectConversationCount(1);
    
    page.expectConversationVisible('ChatGPT AI Discussion');
    page.expectConversationNotVisible('Claude Technical Chat');
    page.expectConversationNotVisible('General Discussion');
  });

  it('should filter conversations by last message content', async () => {
    await page.searchFor('Claude');
    await page.expectConversationCount(1);
    
    page.expectConversationVisible('Claude Technical Chat');
    page.expectConversationNotVisible('ChatGPT AI Discussion');
    page.expectConversationNotVisible('General Discussion');
  });

  it('should filter conversations by tags', async () => {
    await page.searchFor('ai');
    await page.expectConversationCount(2);
    
    page.expectConversationVisible('ChatGPT AI Discussion');
    page.expectConversationVisible('Claude Technical Chat');
    page.expectConversationNotVisible('General Discussion');
  });

  it('should show no results when search matches nothing', async () => {
    await page.searchFor('nonexistent');
    await page.expectConversationCount(0);
    
    page.expectConversationNotVisible('ChatGPT AI Discussion');
    page.expectConversationNotVisible('Claude Technical Chat');
    page.expectConversationNotVisible('General Discussion');
  });

  it('should be case-insensitive', async () => {
    await page.searchFor('chatgpt');
    await page.expectConversationCount(1);
    
    page.expectConversationVisible('ChatGPT AI Discussion');
  });
});
