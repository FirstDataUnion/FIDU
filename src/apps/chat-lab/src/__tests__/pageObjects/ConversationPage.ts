import { screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Page Object for Conversation-related UI interactions
 * This encapsulates the UI structure and provides a clean API for tests
 */
export class ConversationPage {
  // Search functionality
  getSearchInput() {
    return screen.getByTestId('search-input');
  }

  async searchFor(query: string) {
    const searchInput = this.getSearchInput();
    fireEvent.change(searchInput, { target: { value: query } });
  }

  clearSearch() {
    const searchInput = this.getSearchInput();
    fireEvent.change(searchInput, { target: { value: '' } });
  }

  // Platform filtering
  getPlatformFilter(platform: string) {
    return screen.getByLabelText(platform);
  }

  async selectPlatform(platform: string) {
    const checkbox = this.getPlatformFilter(platform);
    fireEvent.click(checkbox);
  }

  async deselectPlatform(platform: string) {
    const checkbox = this.getPlatformFilter(platform);
    fireEvent.click(checkbox);
  }

  // Tag filtering
  getTagFilter(tag: string) {
    return screen.getByLabelText(tag);
  }

  async selectTag(tag: string) {
    const checkbox = this.getTagFilter(tag);
    fireEvent.click(checkbox);
  }

  async deselectTag(tag: string) {
    const checkbox = this.getTagFilter(tag);
    fireEvent.click(checkbox);
  }

  // Archive filtering
  getShowArchivedCheckbox() {
    return screen.getByLabelText('Show Archived');
  }

  async toggleShowArchived() {
    const checkbox = this.getShowArchivedCheckbox();
    fireEvent.click(checkbox);
  }

  // Sorting
  getSortSelect() {
    return screen.getByTestId('sort-select');
  }

  async selectSortOption(sortBy: string, sortOrder: 'asc' | 'desc') {
    const select = this.getSortSelect();
    const value = `${sortBy}-${sortOrder}`;
    fireEvent.change(select, { target: { value } });
  }

  // Conversation list
  getConversationCards() {
    return screen.getAllByTestId('conversation-card');
  }

  getConversationByTitle(title: string) {
    return screen.getByText(title);
  }

  async clickConversation(title: string) {
    const conversation = this.getConversationByTitle(title);
    fireEvent.click(conversation);
  }

  async clickTagButton(conversationTitle: string) {
    const conversation = this.getConversationByTitle(conversationTitle);
    const tagButton = conversation.closest('[data-testid="conversation-card"]')?.querySelector('[title="Manage Tags"]');
    if (tagButton) {
      fireEvent.click(tagButton as HTMLElement);
    }
  }

  // Statistics
  getTotalConversations() {
    return screen.getByTestId('total-conversations');
  }

  getFilteredConversations() {
    return screen.getByTestId('filtered-conversations');
  }

  getSortedConversations() {
    return screen.getByTestId('sorted-conversations');
  }

  // Assertions
  async expectConversationCount(count: number) {
    await waitFor(() => {
      expect(this.getFilteredConversations()).toHaveTextContent(count.toString());
    });
  }

  expectConversationVisible(title: string) {
    expect(this.getConversationByTitle(title)).toBeInTheDocument();
  }

  expectConversationNotVisible(title: string) {
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  }

  async expectConversationsInOrder(titles: string[]) {
    const cards = this.getConversationCards();
    titles.forEach((title, index) => {
      expect(cards[index]).toHaveTextContent(title);
    });
  }

  // Wait for async operations
  async waitForFiltering() {
    await waitFor(() => {
      // Wait for the filtering to complete
      expect(this.getFilteredConversations()).toBeInTheDocument();
    });
  }
}
