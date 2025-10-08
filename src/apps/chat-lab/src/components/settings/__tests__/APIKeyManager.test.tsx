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
    
    // Setup default mock implementation
    (getUnifiedStorageService as jest.Mock).mockReturnValue({
      getAllAPIKeys: mockGetAllAPIKeys,
      saveAPIKey: mockSaveAPIKey,
      deleteAPIKey: mockDeleteAPIKey,
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
      (getEnvironmentInfo as jest.Mock).mockReturnValueOnce({
        storageMode: 'local',
      });

      const { container } = renderComponent();
      expect(container.firstChild).toBeNull();
    });

    it('should display loading state initially', () => {
      mockGetAllAPIKeys.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderComponent();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
        expect(screen.getByText(/No API keys configured yet/i)).toBeInTheDocument();
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
      const openaiOption = await screen.findByText('OpenAI');
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
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Update API Key/i })).toBeInTheDocument();
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
      const openaiOption = await screen.findByText('OpenAI');
      fireEvent.click(openaiOption);

      // Enter new API key
      fireEvent.change(apiKeyInput, { target: { value: 'sk-newkey456' } });

      // Click update
      const updateButton = await screen.findByRole('button', { name: /Update API Key/i });
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

    it('should show delete confirmation dialog', async () => {
      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it('should delete API key when confirmed', async () => {
      mockDeleteAPIKey.mockResolvedValue(undefined);
      mockGetAllAPIKeys.mockResolvedValueOnce([
        {
          id: '1',
          provider: 'openai',
          create_timestamp: '2024-01-01T00:00:00Z',
          update_timestamp: '2024-01-01T00:00:00Z',
        },
      ]).mockResolvedValueOnce([]);

      const deleteButton = screen.getByTitle('Delete API Key');
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByRole('button', { name: 'Delete' });
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
      const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
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
      const confirmButton = await screen.findByRole('button', { name: 'Delete' });
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
