/**
 * Local storage adapter that wraps FIDU Vault API calls
 * This adapter implements the storage interface for local mode
 */

import type { 
  StorageAdapter, 
  ConversationsResponse, 
  StorageConfig 
} from '../types';
import type { Conversation, Message, FilterOptions } from '../../../types';
import { conversationsApi } from '../../api/conversations';
import { apiKeyService } from '../../api/apiKeyService';
import { contextsApi } from '../../api/contexts';
import { systemPromptsApi } from '../../api/systemPrompts';

export class LocalStorageAdapter implements StorageAdapter {
  private initialized = false;

  constructor(_config: StorageConfig) {
    // Config not used in current implementation
  }

  async initialize(): Promise<void> {
    // Local storage doesn't need initialization
    this.initialized = true;
    console.log('Local storage adapter initialized successfully');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setUserId(userId: string): void {
    // Local storage adapter doesn't need to track user ID as it uses the FIDU Vault API
    // which handles user authentication through the API token
    console.log('LocalStorageAdapter: setUserId called with', userId);
  }

  // Conversation operations
  async createConversation(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    return await conversationsApi.createConversation(profileId, conversation, messages, originalPrompt);
  }

  async updateConversation(
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    return await conversationsApi.updateConversation(conversation, messages, originalPrompt);
  }

  async getConversations(
    filters?: FilterOptions, 
    page = 1, 
    limit = 20, 
    profileId?: string
  ): Promise<ConversationsResponse> {
    return await conversationsApi.getAll(filters, page, limit, profileId);
  }

  async getConversationById(id: string): Promise<Conversation> {
    return await conversationsApi.getById(id);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return await conversationsApi.getMessages(conversationId);
  }

  // API Key operations
  async getAPIKey(provider: string): Promise<string | null> {
    return await apiKeyService.getAPIKeyForProvider(provider as 'openai' | 'anthropic' | 'google');
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    return await apiKeyService.isAPIKeyAvailable(provider as 'openai' | 'anthropic' | 'google');
  }

  async getAllAPIKeys(): Promise<any[]> {
    // In local mode, API keys are managed through FIDU Vault UI
    console.warn('[LocalStorageAdapter] getAllAPIKeys not supported in local mode. Manage API keys through FIDU Vault.');
    return [];
  }

  async saveAPIKey(_provider: string, _apiKey: string): Promise<any> {
    // In local mode, API keys are managed through FIDU Vault UI
    throw new Error('API key management not supported in local mode. Please use FIDU Vault to manage API keys.');
  }

  async deleteAPIKey(_id: string): Promise<void> {
    // In local mode, API keys are managed through FIDU Vault UI
    throw new Error('API key management not supported in local mode. Please use FIDU Vault to manage API keys.');
  }

  // Context operations
  async getContexts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    return await contextsApi.getAll(queryParams, page, limit, profileId);
  }

  async getContextById(_contextId: string): Promise<any> {
    // Note: contextsApi doesn't have getById, would need to be implemented
    throw new Error('getContextById not implemented in contextsApi');
  }

  async createContext(context: any, profileId: string): Promise<any> {
    return await contextsApi.createContext(context, profileId);
  }

  async updateContext(context: any, profileId: string): Promise<any> {
    return await contextsApi.updateContext(context, profileId);
  }

  async deleteContext(contextId: string): Promise<void> {
    await contextsApi.deleteContext(contextId);
  }

  // System Prompt operations
  async getSystemPrompts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    return await systemPromptsApi.getAll(queryParams, page, limit, profileId);
  }

  async getSystemPromptById(_systemPromptId: string): Promise<any> {
    // Note: systemPromptsApi doesn't have getById, would need to be implemented
    throw new Error('getSystemPromptById not implemented in systemPromptsApi');
  }

  async createSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    return await systemPromptsApi.createSystemPrompt(systemPrompt, profileId);
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    return await systemPromptsApi.updateSystemPrompt(systemPrompt, profileId);
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    return await systemPromptsApi.deleteSystemPrompt(systemPromptId);
  }

  // Sync operations
  async sync(): Promise<void> {
    // Local storage doesn't need sync
    console.log('Local storage sync - no action needed');
  }

  isOnline(): boolean {
    return true; // Web app always online
  }
}
