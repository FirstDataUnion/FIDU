import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import type { Conversation } from '../../types';

// Create a theme for testing
const theme = createTheme();

// Mock conversation data factory
export const createMockConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
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
  ...overrides,
});

// Create multiple mock conversations
export const createMockConversations = (count: number, baseOverrides: Partial<Conversation> = {}): Conversation[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockConversation({
      id: `${index + 1}`,
      title: `Conversation ${index + 1}`,
      ...baseOverrides,
    })
  );
};

// Test data for different scenarios
export const testConversations = {
  chatgpt: createMockConversation({
    id: '1',
    title: 'ChatGPT AI Discussion',
    platform: 'chatgpt',
    lastMessage: 'Hello from ChatGPT',
    tags: ['ai', 'chat'],
  }),
  claude: createMockConversation({
    id: '2',
    title: 'Claude Technical Chat',
    platform: 'claude',
    lastMessage: 'Hello from Claude',
    tags: ['ai', 'technical'],
    isFavorite: true,
  }),
  gemini: createMockConversation({
    id: '3',
    title: 'General Discussion',
    platform: 'gemini',
    lastMessage: 'Hello from Gemini',
    tags: ['general'],
    isArchived: false,
  }),
  archived: createMockConversation({
    id: '4',
    title: 'Archived Chat',
    platform: 'chatgpt',
    lastMessage: 'This is archived',
    tags: ['archived'],
    isArchived: true,
  }),
};

// Redux store factory
export const createTestStore = (initialState: any = {}) => {
  return configureStore({
    reducer: {
      conversations: (state = { items: [] }) => state,
      auth: (state = { currentProfile: null }) => state,
      ...initialState,
    },
  });
};

// Render with providers wrapper
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: any;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  { initialState = {}, ...renderOptions }: CustomRenderOptions = {}
) => {
  const store = createTestStore(initialState);
  
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </Provider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
};

// Common test assertions
export const expectConversationVisible = (title: string) => {
  expect(screen.getByText(title)).toBeInTheDocument();
};

export const expectConversationNotVisible = (title: string) => {
  expect(screen.queryByText(title)).not.toBeInTheDocument();
};

export const expectConversationCount = (count: number) => {
  expect(screen.getByTestId('filtered-conversations')).toHaveTextContent(count.toString());
};

// Mock functions for common interactions
export const createMockHandlers = () => ({
  onSelect: jest.fn(),
  onTagManagement: jest.fn(),
  onSearch: jest.fn(),
  onFilterChange: jest.fn(),
});

// Test data cleanup
export const resetMocks = () => {
  jest.clearAllMocks();
};
