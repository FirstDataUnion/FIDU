/**
 * Unified storage service that provides a consistent interface for all storage operations
 * This service abstracts away the differences between local and cloud storage
 */

import { storageService } from './StorageService';
import type { Conversation, Message, FilterOptions } from '../../types';

export class UnifiedStorageService {
  private initialized = false;

  /**
   * Initialize the unified storage service
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await storageService.initialize();
      this.initialized = true;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && storageService.isInitialized();
  }

  /**
   * Get the current storage mode
   */
  getStorageMode(): string {
    return storageService.getStorageMode();
  }

  /**
   * Check if running in cloud mode
   */
  isCloudMode(): boolean {
    return storageService.isCloudMode();
  }

  /**
   * Check if running in local mode
   */
  isLocalMode(): boolean {
    return storageService.isLocalMode();
  }

  // Conversation operations
  async createConversation(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    this.ensureInitialized();
    return await storageService.getAdapter().createConversation(profileId, conversation, messages, originalPrompt);
  }

  async updateConversation(
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    this.ensureInitialized();
    return await storageService.getAdapter().updateConversation(conversation, messages, originalPrompt);
  }

  async getConversations(
    filters?: FilterOptions, 
    page = 1, 
    limit = 20, 
    profileId?: string
  ) {
    this.ensureInitialized();
    return await storageService.getAdapter().getConversations(filters, page, limit, profileId);
  }

  async getConversationById(id: string): Promise<Conversation> {
    this.ensureInitialized();
    return await storageService.getAdapter().getConversationById(id);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    this.ensureInitialized();
    return await storageService.getAdapter().getMessages(conversationId);
  }

  // API Key operations
  async getAPIKey(provider: string): Promise<string | null> {
    this.ensureInitialized();
    return await storageService.getAdapter().getAPIKey(provider);
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    this.ensureInitialized();
    return await storageService.getAdapter().isAPIKeyAvailable(provider);
  }

  // Context operations
  async getContexts(queryParams?: any, page = 1, limit = 20, profileId?: string) {
    this.ensureInitialized();
    return await storageService.getAdapter().getContexts(queryParams, page, limit, profileId);
  }

  async createContext(context: any, profileId: string) {
    this.ensureInitialized();
    return await storageService.getAdapter().createContext(context, profileId);
  }

  async updateContext(context: any, profileId: string) {
    this.ensureInitialized();
    return await storageService.getAdapter().updateContext(context, profileId);
  }

  async deleteContext(contextId: string): Promise<string> {
    this.ensureInitialized();
    return await storageService.getAdapter().deleteContext(contextId);
  }

  // System Prompt operations
  async getSystemPrompts(queryParams?: any, page = 1, limit = 20, profileId?: string) {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.getSystemPrompts) {
      return await adapter.getSystemPrompts(queryParams, page, limit, profileId);
    }
    throw new Error('System prompts not supported by current storage adapter');
  }

  async createSystemPrompt(systemPrompt: any, profileId: string) {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.createSystemPrompt) {
      return await adapter.createSystemPrompt(systemPrompt, profileId);
    }
    throw new Error('System prompts not supported by current storage adapter');
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string) {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.updateSystemPrompt) {
      return await adapter.updateSystemPrompt(systemPrompt, profileId);
    }
    throw new Error('System prompts not supported by current storage adapter');
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.deleteSystemPrompt) {
      return await adapter.deleteSystemPrompt(systemPromptId);
    }
    throw new Error('System prompts not supported by current storage adapter');
  }

  // Sync operations (for cloud mode)
  async sync(): Promise<void> {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.sync) {
      return await adapter.sync();
    }
    // Local mode doesn't need sync
  }

  isOnline(): boolean {
    this.ensureInitialized();
    const adapter = storageService.getAdapter();
    if (adapter.isOnline) {
      return adapter.isOnline();
    }
    return true; // Default to online for local mode
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('UnifiedStorageService not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const unifiedStorageService = new UnifiedStorageService();
