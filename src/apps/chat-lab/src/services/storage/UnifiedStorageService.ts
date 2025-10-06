/**
 * Unified Storage Service
 * Provides a unified interface to interact with the currently active storage adapter
 */

import { getStorageService } from './StorageService';
import type { Conversation, Message, FilterOptions, ConversationsResponse } from '../../types';

export class UnifiedStorageService {
  private storageService = getStorageService();

  async initialize(): Promise<void> {
    await this.storageService.initialize();
  }

  /**
   * Force re-initialization of the storage service
   * Useful after authentication changes
   */
  async reinitialize(): Promise<void> {
    await this.storageService.initialize();
  }

  async switchMode(mode: 'local' | 'cloud' | 'filesystem'): Promise<void> {
    await this.storageService.switchMode(mode);
  }

  getAdapter() {
    return this.storageService.getAdapter();
  }

  isInitialized(): boolean {
    return this.storageService.isInitialized();
  }

  getCurrentMode(): string {
    return this.storageService.getCurrentMode();
  }

  setUserId(userId: string): void {
    this.storageService.setUserId(userId);
  }

  // Conversation operations
  async createConversation(
    profileId: string,
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    const adapter = this.storageService.getAdapter();
    return await adapter.createConversation(profileId, conversation, messages, originalPrompt);
  }

  async updateConversation(
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    const adapter = this.storageService.getAdapter();
    return await adapter.updateConversation(conversation, messages, originalPrompt);
  }

  async getConversations(
    filters?: FilterOptions,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<ConversationsResponse> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getConversations(filters, page, limit, profileId);
  }

  async getConversationById(id: string): Promise<Conversation> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getConversationById(id);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getMessages(conversationId);
  }

  // API Key operations
  async getAPIKey(provider: string): Promise<string | null> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getAPIKey(provider);
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    const adapter = this.storageService.getAdapter();
    return await adapter.isAPIKeyAvailable(provider);
  }

  // Context operations
  async getContexts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getContexts(queryParams, page, limit, profileId);
  }

  async getContextById(contextId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getContextById(contextId);
  }

  async createContext(context: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.createContext(context, profileId);
  }

  async updateContext(context: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.updateContext(context, profileId);
  }

  async deleteContext(contextId: string): Promise<void> {
    const adapter = this.storageService.getAdapter();
    return await adapter.deleteContext(contextId);
  }

  // System Prompt operations
  async getSystemPrompts(queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getSystemPrompts(queryParams, page, limit, profileId);
  }

  async getSystemPromptById(systemPromptId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.getSystemPromptById(systemPromptId);
  }

  async createSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.createSystemPrompt(systemPrompt, profileId);
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    return await adapter.updateSystemPrompt(systemPrompt, profileId);
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    const adapter = this.storageService.getAdapter();
    return await adapter.deleteSystemPrompt(systemPromptId);
  }

  // Sync operations
  async sync(): Promise<void> {
    const adapter = this.storageService.getAdapter();
    return await adapter.sync();
  }

  /**
   * Clear all database files from Google Drive (for testing)
   */
  async clearAllCloudDatabaseFiles(): Promise<void> {
    const adapter = this.storageService.getAdapter();
    // Check if the adapter supports clearing database files 
    if ('clearAllCloudDatabaseFiles' in adapter && typeof adapter.clearAllCloudDatabaseFiles === 'function') {
      return await (adapter as any).clearAllCloudDatabaseFiles();
    } else {
      throw new Error('Clear cloud database files not supported by current storage adapter');
    }
  }

  isOnline(): boolean {
    const adapter = this.storageService.getAdapter();
    return adapter.isOnline();
  }
}

// Singleton instance
let unifiedStorageServiceInstance: UnifiedStorageService | null = null;

export function getUnifiedStorageService(): UnifiedStorageService {
  if (!unifiedStorageServiceInstance) {
    unifiedStorageServiceInstance = new UnifiedStorageService();
  }
  return unifiedStorageServiceInstance;
}
