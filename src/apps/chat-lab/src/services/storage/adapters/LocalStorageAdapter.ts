/**
 * Local storage adapter that wraps the existing FIDU Vault API calls
 * This adapter maintains backward compatibility with the current implementation
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
    // Local storage doesn't require initialization
    // The existing API clients handle their own initialization
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
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
    return await apiKeyService.getAPIKeyForProvider(provider as any);
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    return await apiKeyService.isAPIKeyAvailable(provider as any);
  }

  // Context operations
  async getContexts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    return await contextsApi.getAll(queryParams, page, limit, profileId);
  }

  async createContext(context: any, profileId: string): Promise<any> {
    return await contextsApi.createContext(context, profileId);
  }

  async updateContext(context: any, profileId: string): Promise<any> {
    return await contextsApi.updateContext(context, profileId);
  }

  async deleteContext(contextId: string): Promise<string> {
    return await contextsApi.deleteContext(contextId);
  }

  // System Prompt operations (optional)
  async getSystemPrompts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    if (systemPromptsApi) {
      return await systemPromptsApi.getAll(queryParams, page, limit, profileId);
    }
    throw new Error('System prompts not available');
  }

  async createSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    if (systemPromptsApi) {
      return await systemPromptsApi.createSystemPrompt(systemPrompt, profileId);
    }
    throw new Error('System prompts not available');
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    if (systemPromptsApi) {
      return await systemPromptsApi.updateSystemPrompt(systemPrompt, profileId);
    }
    throw new Error('System prompts not available');
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    if (systemPromptsApi) {
      return await systemPromptsApi.deleteSystemPrompt(systemPromptId);
    }
    throw new Error('System prompts not available');
  }

  // Sync operations (not applicable for local storage)
  async sync(): Promise<void> {
    // Local storage doesn't need sync
    return Promise.resolve();
  }

  isOnline(): boolean {
    // Local storage is always "online" when the local FIDU Vault is running
    return true;
  }
}
