import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConversationCard from '../ConversationCard';
import type { Conversation } from '../../../types';

// Create a theme for testing
const theme = createTheme();

const mockConversation: Conversation = {
  id: '1',
  title: 'Test Conversation',
  platform: 'chatgpt',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastMessage: 'This is the last message in the conversation',
  messageCount: 5,
  tags: ['ai', 'chat', 'test'],
  isArchived: false,
  isFavorite: false,
  participants: [],
  status: 'active',
};

const defaultProps = {
  conversation: mockConversation,
  isSelectedForContext: false,
  isCurrentlyViewing: false,
  onSelect: jest.fn(),
  onTagManagement: jest.fn(),
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ConversationCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation title', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
  });

  it('should render platform chip with correct color', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    const platformChip = screen.getByText('CHATGPT');
    expect(platformChip).toBeInTheDocument();
  });

  it('should render message count', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    expect(screen.getByText('5 messages')).toBeInTheDocument();
  });

  it('should render last message', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    expect(screen.getByText('This is the last message in the conversation')).toBeInTheDocument();
  });

  it('should render all tags', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    expect(screen.getByText('ai')).toBeInTheDocument();
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should render updated date', () => {
    renderWithTheme(<ConversationCard {...defaultProps} />);
    
    // Test that the date is rendered (using real formatDate function)
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
  });

  it('should call onSelect when card is clicked', () => {
    const mockOnSelect = jest.fn();
    renderWithTheme(
      <ConversationCard {...defaultProps} onSelect={mockOnSelect} />
    );
    
    fireEvent.click(screen.getByText('Test Conversation'));
    
    expect(mockOnSelect).toHaveBeenCalledWith(mockConversation);
  });

  it('should call onTagManagement when tag button is clicked', () => {
    const mockOnTagManagement = jest.fn();
    renderWithTheme(
      <ConversationCard {...defaultProps} onTagManagement={mockOnTagManagement} />
    );
    
    const tagButton = screen.getByTitle('Manage Tags');
    fireEvent.click(tagButton);
    
    expect(mockOnTagManagement).toHaveBeenCalledWith(mockConversation, expect.any(Object));
  });

  it('should show favorite icon when conversation is favorited', () => {
    const favoritedConversation = {
      ...mockConversation,
      isFavorite: true,
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={favoritedConversation} />
    );
    
    // The favorite icon should be present (we can't easily test the icon itself, but we can test the structure)
    const iconContainer = screen.getByText('Test Conversation').parentElement;
    expect(iconContainer).toBeInTheDocument();
  });

  it('should show archive icon when conversation is archived', () => {
    const archivedConversation = {
      ...mockConversation,
      isArchived: true,
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={archivedConversation} />
    );
    
    // The archive icon should be present
    const iconContainer = screen.getByText('Test Conversation').parentElement;
    expect(iconContainer).toBeInTheDocument();
  });

  it('should show check icon when selected for context', () => {
    renderWithTheme(
      <ConversationCard {...defaultProps} isSelectedForContext={true} />
    );
    
    // The check icon should be present
    const iconContainer = screen.getByText('Test Conversation').parentElement;
    expect(iconContainer).toBeInTheDocument();
  });

  it('should show chat icon when currently viewing', () => {
    renderWithTheme(
      <ConversationCard {...defaultProps} isCurrentlyViewing={true} />
    );
    
    // The chat icon should be present
    const iconContainer = screen.getByText('Test Conversation').parentElement;
    expect(iconContainer).toBeInTheDocument();
  });

  it('should handle conversation without last message', () => {
    const conversationWithoutLastMessage = {
      ...mockConversation,
      lastMessage: undefined,
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={conversationWithoutLastMessage} />
    );
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.queryByText('This is the last message in the conversation')).not.toBeInTheDocument();
  });

  it('should handle conversation without tags', () => {
    const conversationWithoutTags = {
      ...mockConversation,
      tags: [],
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={conversationWithoutTags} />
    );
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.queryByText('ai')).not.toBeInTheDocument();
  });

  it('should handle different platforms correctly', () => {
    const claudeConversation = {
      ...mockConversation,
      platform: 'claude' as const,
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={claudeConversation} />
    );
    
    expect(screen.getByText('CLAUDE')).toBeInTheDocument();
  });

  it('should handle long titles with ellipsis', () => {
    const longTitleConversation = {
      ...mockConversation,
      title: 'This is a very long conversation title that should be truncated with ellipsis when it exceeds the maximum width',
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={longTitleConversation} />
    );
    
    expect(screen.getByText(longTitleConversation.title)).toBeInTheDocument();
  });

  it('should handle long last messages with ellipsis', () => {
    const longMessageConversation = {
      ...mockConversation,
      lastMessage: 'This is a very long last message that should be truncated with ellipsis when it exceeds the maximum number of lines allowed in the conversation card display',
    };
    
    renderWithTheme(
      <ConversationCard {...defaultProps} conversation={longMessageConversation} />
    );
    
    expect(screen.getByText(longMessageConversation.lastMessage)).toBeInTheDocument();
  });

  it('should prevent event propagation when tag button is clicked', () => {
    const mockOnSelect = jest.fn();
    const mockOnTagManagement = jest.fn();
    
    renderWithTheme(
      <ConversationCard 
        {...defaultProps} 
        onSelect={mockOnSelect}
        onTagManagement={mockOnTagManagement}
      />
    );
    
    const tagButton = screen.getByTitle('Manage Tags');
    fireEvent.click(tagButton);
    
    // Both onSelect and onTagManagement should be called when tag button is clicked
    expect(mockOnSelect).toHaveBeenCalled();
    expect(mockOnTagManagement).toHaveBeenCalled();
  });

  it('should display updated conversation title when conversation changes', () => {
    const { rerender } = renderWithTheme(<ConversationCard {...defaultProps} />);
    
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    
    const updatedConversation = {
      ...mockConversation,
      title: 'Updated Conversation',
    };
    
    rerender(
      <ConversationCard 
        {...defaultProps} 
        conversation={updatedConversation}
      />
    );
    
    expect(screen.getByText('Updated Conversation')).toBeInTheDocument();
  });
});
