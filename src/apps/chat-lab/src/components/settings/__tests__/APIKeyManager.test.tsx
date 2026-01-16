import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { APIKeyManager } from '../APIKeyManager';
import { getUnifiedStorageService } from '../../../services/storage/UnifiedStorageService';
import { getEnvironmentInfo } from '../../../utils/environment';

// Mock the environment module
jest.mock('../../../utils/environment', () => ({
  getEnvironmentInfo: jest.fn(() => ({
    mode: 'cloud',
    isDevelopment: false,
    isProduction: true,
    identityServiceUrl: 'https://identity.firstdataunion.org',
    gatewayUrl: 'https://gateway.firstdataunion.org',
    storageMode: 'cloud',
    syncInterval: 300000,
  })),
}));

// Mock the UnifiedStorageService
jest.mock('../../../services/storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(),
}));

const theme = createTheme();

describe('APIKeyManager', () => {
  const mockGetAllAPIKeys = jest.fn();
  const mockSaveAPIKey = jest.fn();
  const mockDeleteAPIKey = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementation with all required methods
    (getUnifiedStorageService as jest.Mock).mockReturnValue({
      // API Key methods
      getAllAPIKeys: mockGetAllAPIKeys,
      saveAPIKey: mockSaveAPIKey,
      deleteAPIKey: mockDeleteAPIKey,
      getAPIKey: jest.fn().mockResolvedValue(null),
      isAPIKeyAvailable: jest.fn().mockResolvedValue(false),

      // Conversation methods (required by useStorage hook)
      createConversation: jest.fn().mockResolvedValue({}),
      updateConversation: jest.fn().mockResolvedValue({}),
      getConversations: jest
        .fn()
        .mockResolvedValue({ conversations: [], total: 0, page: 1, limit: 20 }),
      getConversationById: jest.fn().mockResolvedValue({}),
      getMessages: jest.fn().mockResolvedValue([]),

      // Context methods
      getContexts: jest
        .fn()
        .mockResolvedValue({ contexts: [], total: 0, page: 1, limit: 20 }),
      createContext: jest.fn().mockResolvedValue({}),
      updateContext: jest.fn().mockResolvedValue({}),
      deleteContext: jest.fn().mockResolvedValue(''),

      // System Prompt methods
      getSystemPrompts: jest
        .fn()
        .mockResolvedValue({ systemPrompts: [], total: 0, page: 1, limit: 20 }),
      createSystemPrompt: jest.fn().mockResolvedValue({}),
      updateSystemPrompt: jest.fn().mockResolvedValue({}),
      deleteSystemPrompt: jest.fn().mockResolvedValue(''),

      // Sync method
      sync: jest.fn().mockResolvedValue(undefined),

      // Service state methods
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getCurrentMode: jest.fn().mockReturnValue('cloud'),
      isOnline: jest.fn().mockReturnValue(true),
    });
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider theme={theme}>
        <APIKeyManager />
      </ThemeProvider>
    );
  };

  describe('Component Rendering', () => {
    it('should render the component when not in local deployment mode', async () => {
      mockGetAllAPIKeys.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Key Management')).toBeInTheDocument();
      });
    });

    it('should not render in local deployment mode', () => {
      // Store the original mock implementation
      const originalMock = (
        getEnvironmentInfo as jest.Mock
      ).getMockImplementation();

      (getEnvironmentInfo as jest.Mock).mockReturnValue({
        mode: 'local',
        isDevelopment: true,
        isProduction: false,
        identityServiceUrl: 'http://localhost:8000',
        gatewayUrl: 'http://localhost:8000',
        storageMode: 'local',
        syncInterval: 300000,
      });

      // Mock useStorage to return local storage mode for this test
      (getUnifiedStorageService as jest.Mock).mockReturnValue({
        // API Key methods
        getAllAPIKeys: mockGetAllAPIKeys,
        saveAPIKey: mockSaveAPIKey,
        deleteAPIKey: mockDeleteAPIKey,
        getAPIKey: jest.fn().mockResolvedValue(null),
        isAPIKeyAvailable: jest.fn().mockResolvedValue(false),

        // Conversation methods (required by useStorage hook)
        createConversation: jest.fn().mockResolvedValue({}),
        updateConversation: jest.fn().mockResolvedValue({}),
        getConversations: jest.fn().mockResolvedValue({
          conversations: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        getConversationById: jest.fn().mockResolvedValue({}),
        getMessages: jest.fn().mockResolvedValue([]),

        // Context methods
        getContexts: jest
          .fn()
          .mockResolvedValue({ contexts: [], total: 0, page: 1, limit: 20 }),
        createContext: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({}),
        deleteContext: jest.fn().mockResolvedValue(''),

        // System Prompt methods
        getSystemPrompts: jest.fn().mockResolvedValue({
          systemPrompts: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        createSystemPrompt: jest.fn().mockResolvedValue({}),
        updateSystemPrompt: jest.fn().mockResolvedValue({}),
        deleteSystemPrompt: jest.fn().mockResolvedValue(''),

        // Sync method
        sync: jest.fn().mockResolvedValue(undefined),

        // Service state methods
        initialize: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        getCurrentMode: jest.fn().mockReturnValue('local'), // This should be 'local' for the test
        isOnline: jest.fn().mockReturnValue(true),
      });

      const { container } = renderComponent();
      expect(container.firstChild).toBeNull();

      // Restore the original mocks
      (getEnvironmentInfo as jest.Mock).mockImplementation(originalMock);
      (getUnifiedStorageService as jest.Mock).mockReturnValue({
        // API Key methods
        getAllAPIKeys: mockGetAllAPIKeys,
        saveAPIKey: mockSaveAPIKey,
        deleteAPIKey: mockDeleteAPIKey,
        getAPIKey: jest.fn().mockResolvedValue(null),
        isAPIKeyAvailable: jest.fn().mockResolvedValue(false),

        // Conversation methods (required by useStorage hook)
        createConversation: jest.fn().mockResolvedValue({}),
        updateConversation: jest.fn().mockResolvedValue({}),
        getConversations: jest.fn().mockResolvedValue({
          conversations: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        getConversationById: jest.fn().mockResolvedValue({}),
        getMessages: jest.fn().mockResolvedValue([]),

        // Context methods
        getContexts: jest
          .fn()
          .mockResolvedValue({ contexts: [], total: 0, page: 1, limit: 20 }),
        createContext: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({}),
        deleteContext: jest.fn().mockResolvedValue(''),

        // System Prompt methods
        getSystemPrompts: jest.fn().mockResolvedValue({
          systemPrompts: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        createSystemPrompt: jest.fn().mockResolvedValue({}),
        updateSystemPrompt: jest.fn().mockResolvedValue({}),
        deleteSystemPrompt: jest.fn().mockResolvedValue(''),

        // Sync method
        sync: jest.fn().mockResolvedValue(undefined),

        // Service state methods
        initialize: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        getCurrentMode: jest.fn().mockReturnValue('cloud'),
        isOnline: jest.fn().mockReturnValue(true),
      });
    });

    it('should display loading state initially', async () => {
      mockGetAllAPIKeys.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Mock useStorage to return initialized state but with hanging API key load
      (getUnifiedStorageService as jest.Mock).mockReturnValue({
        // API Key methods
        getAllAPIKeys: mockGetAllAPIKeys,
        saveAPIKey: mockSaveAPIKey,
        deleteAPIKey: mockDeleteAPIKey,
        getAPIKey: jest.fn().mockResolvedValue(null),
        isAPIKeyAvailable: jest.fn().mockResolvedValue(false),

        // Conversation methods (required by useStorage hook)
        createConversation: jest.fn().mockResolvedValue({}),
        updateConversation: jest.fn().mockResolvedValue({}),
        getConversations: jest.fn().mockResolvedValue({
          conversations: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        getConversationById: jest.fn().mockResolvedValue({}),
        getMessages: jest.fn().mockResolvedValue([]),

        // Context methods
        getContexts: jest
          .fn()
          .mockResolvedValue({ contexts: [], total: 0, page: 1, limit: 20 }),
        createContext: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({}),
        deleteContext: jest.fn().mockResolvedValue(''),

        // System Prompt methods
        getSystemPrompts: jest.fn().mockResolvedValue({
          systemPrompts: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        createSystemPrompt: jest.fn().mockResolvedValue({}),
        updateSystemPrompt: jest.fn().mockResolvedValue({}),
        deleteSystemPrompt: jest.fn().mockResolvedValue(''),

        // Sync method
        sync: jest.fn().mockResolvedValue(undefined),

        // Service state methods - make initialize resolve immediately and return initialized state
        initialize: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true), // This should be true so it tries to load API keys
        getCurrentMode: jest.fn().mockReturnValue('cloud'),
        isOnline: jest.fn().mockReturnValue(true),
      });

      renderComponent();

      // Wait for the component to finish loading and show the loading spinner
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // Restore the original mock
      (getUnifiedStorageService as jest.Mock).mockReturnValue({
        // API Key methods
        getAllAPIKeys: mockGetAllAPIKeys,
        saveAPIKey: mockSaveAPIKey,
        deleteAPIKey: mockDeleteAPIKey,
        getAPIKey: jest.fn().mockResolvedValue(null),
        isAPIKeyAvailable: jest.fn().mockResolvedValue(false),

        // Conversation methods (required by useStorage hook)
        createConversation: jest.fn().mockResolvedValue({}),
        updateConversation: jest.fn().mockResolvedValue({}),
        getConversations: jest.fn().mockResolvedValue({
          conversations: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        getConversationById: jest.fn().mockResolvedValue({}),
        getMessages: jest.fn().mockResolvedValue([]),

        // Context methods
        getContexts: jest
          .fn()
          .mockResolvedValue({ contexts: [], total: 0, page: 1, limit: 20 }),
        createContext: jest.fn().mockResolvedValue({}),
        updateContext: jest.fn().mockResolvedValue({}),
        deleteContext: jest.fn().mockResolvedValue(''),

        // System Prompt methods
        getSystemPrompts: jest.fn().mockResolvedValue({
          systemPrompts: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        createSystemPrompt: jest.fn().mockResolvedValue({}),
        updateSystemPrompt: jest.fn().mockResolvedValue({}),
        deleteSystemPrompt: jest.fn().mockResolvedValue(''),

        // Sync method
        sync: jest.fn().mockResolvedValue(undefined),

        // Service state methods
        initialize: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        getCurrentMode: jest.fn().mockReturnValue('cloud'),
        isOnline: jest.fn().mockReturnValue(true),
      });
    });
  });

  describe('API Key Loading', () => {
    it('should load and display API keys on mount', async () => {
      const mockKeys = [
        {
          id: '1',
          provider: 'openai',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          provider: 'anthropic',
          create_timestamp: '2024-01-02T00:00:00Z',
          update_timestamp: '2024-01-02T00:00:00Z',
        },
      ];

      mockGetAllAPIKeys.mockResolvedValue(mockKeys);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument();
      });
    });

    it('should display message when no API keys exist', async () => {
      mockGetAllAPIKeys.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/No API keys configured yet/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle loading errors gracefully', async () => {
      mockGetAllAPIKeys.mockRejectedValue(new Error('Failed to load'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Adding API Keys', () => {
    beforeEach(async () => {
      mockGetAllAPIKeys.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('API Key Management')).toBeInTheDocument();
      });
    });

    it('should enable save button when provider and key are entered', async () => {
      const providerSelect = screen.getByLabelText('Provider');
      const apiKeyInput = screen.getByLabelText('API Key');
      const saveButton = screen.getByRole('button', { name: /Add API Key/i });

      expect(saveButton).toBeDisabled();

      // Select provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      // Enter API key
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test123' } });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should save new API key successfully', async () => {
      mockSaveAPIKey.mockResolvedValue({
        id: '1',
        provider: 'openai',
        create_timestamp: '2024-01-01T00:00:00Z',
        update_timestamp: '2024-01-01T00:00:00Z',
      });

      // After save, reload should return the new key
      mockGetAllAPIKeys.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: '1',
          provider: 'openai',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        },
      ]);

      const providerSelect = screen.getByLabelText('Provider');
      const apiKeyInput = screen.getByLabelText('API Key');
      const saveButton = screen.getByRole('button', { name: /Add API Key/i });

      // Select provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      // Enter API key
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test123' } });

      // Click save
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveAPIKey).toHaveBeenCalledWith('openai', 'sk-test123');
      });

      await waitFor(() => {
        expect(screen.getByText(/added successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle save errors', async () => {
      mockSaveAPIKey.mockRejectedValue(new Error('Save failed'));

      const providerSelect = screen.getByLabelText('Provider');
      const apiKeyInput = screen.getByLabelText('API Key');
      const saveButton = screen.getByRole('button', { name: /Add API Key/i });

      // Select provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByRole('option', {
        name: 'OpenAI',
      });
      fireEvent.click(openaiOption);

      // Enter API key
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test123' } });

      // Click save
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Updating API Keys', () => {
    beforeEach(async () => {
      mockGetAllAPIKeys.mockResolvedValue([
        {
          id: '1',
          provider: 'openai',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        },
      ]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });
    });

    it('should switch to update mode when selecting existing provider', async () => {
      const providerSelect = screen.getByLabelText('Provider');

      // Select existing provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByRole('option', {
        name: 'OpenAI',
      });
      fireEvent.click(openaiOption);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Update API Key/i })
        ).toBeInTheDocument();
      });
    });

    it('should update existing API key successfully', async () => {
      mockSaveAPIKey.mockResolvedValue({
        id: '1',
        provider: 'openai',
        create_timestamp: '2024-01-01T00:00:00Z',
        update_timestamp: '2024-01-02T00:00:00Z',
      });

      const providerSelect = screen.getByLabelText('Provider');
      const apiKeyInput = screen.getByLabelText('API Key');

      // Select existing provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByRole('option', {
        name: 'OpenAI',
      });
      fireEvent.click(openaiOption);

      // Enter new API key
      fireEvent.change(apiKeyInput, { target: { value: 'sk-newkey456' } });

      // Click update
      const updateButton = await screen.findByRole('button', {
        name: /Update API Key/i,
      });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockSaveAPIKey).toHaveBeenCalledWith('openai', 'sk-newkey456');
      });

      await waitFor(() => {
        expect(screen.getByText(/updated successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Deleting API Keys', () => {
    beforeEach(async () => {
      // Reset the mock to ensure clean state
      mockGetAllAPIKeys.mockReset();
      mockGetAllAPIKeys.mockResolvedValue([
        {
          id: '1',
          provider: 'openai',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        },
      ]);
      renderComponent();
      await waitFor(
        () => {
          // Look for the chip or row that displays the provider
          const elements = screen.queryAllByText('OpenAI');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should show delete confirmation dialog', async () => {
      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to delete/i)
        ).toBeInTheDocument();
      });
    });

    it('should delete API key when confirmed', async () => {
      mockDeleteAPIKey.mockResolvedValue(undefined);
      mockGetAllAPIKeys
        .mockResolvedValueOnce([
          {
            id: '1',
            provider: 'openai',
            create_timestamp: '2024-01-01T00:00:00Z',
            update_timestamp: '2024-01-01T00:00:00Z',
          },
        ])
        .mockResolvedValueOnce([]);

      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByRole('button', {
        name: 'Delete',
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteAPIKey).toHaveBeenCalledWith('1');
      });

      await waitFor(() => {
        expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
      });
    });

    it('should cancel deletion when cancel is clicked', async () => {
      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      // Cancel deletion
      const cancelButton = await screen.findByRole('button', {
        name: 'Cancel',
      });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockDeleteAPIKey).not.toHaveBeenCalled();
      });
    });

    it('should handle delete errors', async () => {
      mockDeleteAPIKey.mockRejectedValue(new Error('Delete failed'));

      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByRole('button', {
        name: 'Delete',
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Delete failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Key Visibility Toggle', () => {
    beforeEach(async () => {
      mockGetAllAPIKeys.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('API Key Management')).toBeInTheDocument();
      });
    });

    it('should toggle API key visibility', async () => {
      const apiKeyInput = screen.getByLabelText('API Key') as HTMLInputElement;

      // Initially should be password type
      expect(apiKeyInput.type).toBe('password');

      // Enter some text
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test123' } });

      // Find and click visibility toggle button
      const visibilityButton = screen.getByRole('button', { name: '' });
      fireEvent.click(visibilityButton);

      await waitFor(() => {
        expect(apiKeyInput.type).toBe('text');
      });

      // Click again to hide
      fireEvent.click(visibilityButton);

      await waitFor(() => {
        expect(apiKeyInput.type).toBe('password');
      });
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      mockGetAllAPIKeys.mockResolvedValue([]);
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('API Key Management')).toBeInTheDocument();
      });
    });

    it('should require both provider and API key', async () => {
      const saveButton = screen.getByRole('button', { name: /Add API Key/i });

      // Initially disabled
      expect(saveButton).toBeDisabled();

      // Select provider only
      const providerSelect = screen.getByLabelText('Provider');
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      // Still disabled without API key
      expect(saveButton).toBeDisabled();

      // Add API key
      const apiKeyInput = screen.getByLabelText('API Key');
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test123' } });

      // Now enabled
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should trim whitespace from API key', async () => {
      mockSaveAPIKey.mockResolvedValue({
        id: '1',
        provider: 'openai',
        create_timestamp: '2024-01-01T00:00:00Z',
        update_timestamp: '2024-01-01T00:00:00Z',
      });

      const providerSelect = screen.getByLabelText('Provider');
      const apiKeyInput = screen.getByLabelText('API Key');
      const saveButton = screen.getByRole('button', { name: /Add API Key/i });

      // Select provider
      fireEvent.mouseDown(providerSelect);
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      // Enter API key with whitespace
      fireEvent.change(apiKeyInput, { target: { value: '  sk-test123  ' } });

      // Click save
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveAPIKey).toHaveBeenCalledWith('openai', 'sk-test123');
      });
    });
  });
});
