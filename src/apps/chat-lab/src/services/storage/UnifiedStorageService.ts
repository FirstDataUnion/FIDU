/**
 * Unified Storage Service
 * Provides a unified interface to interact with the currently active storage adapter
 */

import { getStorageService } from './StorageService';
import type {
  Conversation,
  Message,
  FilterOptions,
  ConversationsResponse,
} from '../../types';

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
    // Prefer the storage service's explicit reinitialize to ensure adapter rebuild
    if ((this.storageService as any).reinitialize) {
      await (this.storageService as any).reinitialize();
    } else {
      await this.storageService.initialize();
    }
  }

  async switchMode(mode: 'local' | 'cloud'): Promise<void> {
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
    return await adapter.createConversation(
      profileId,
      conversation,
      messages,
      originalPrompt
    );
  }

  async updateConversation(
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    const adapter = this.storageService.getAdapter();
    return await adapter.updateConversation(
      conversation,
      messages,
      originalPrompt
    );
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
    this.ensureStorageInitialized();
    const adapter = this.storageService.getAdapter();
    return await adapter.getAPIKey(provider);
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    this.ensureStorageInitialized();
    const adapter = this.storageService.getAdapter();
    return await adapter.isAPIKeyAvailable(provider);
  }

  async getAllAPIKeys(): Promise<any[]> {
    this.ensureStorageInitialized();
    const adapter = this.storageService.getAdapter();
    return await adapter.getAllAPIKeys();
  }

  async saveAPIKey(provider: string, apiKey: string): Promise<any> {
    this.ensureStorageInitialized();
    const adapter = this.storageService.getAdapter();
    return await adapter.saveAPIKey(provider, apiKey);
  }

  async deleteAPIKey(id: string): Promise<void> {
    this.ensureStorageInitialized();
    const adapter = this.storageService.getAdapter();
    return await adapter.deleteAPIKey(id);
  }

  // Context operations
  async getContexts(
    queryParams?: any,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<any> {
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
  async getSystemPrompts(
    queryParams?: any,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<any> {
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

  // Background Agent operations
  async getBackgroundAgents(
    queryParams?: any,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).getBackgroundAgents !== 'function') {
      throw new Error(
        'Background Agents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).getBackgroundAgents(
      queryParams,
      page,
      limit,
      profileId
    );
  }

  async getBackgroundAgentById(agentId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).getBackgroundAgentById !== 'function') {
      throw new Error(
        'Background Agents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).getBackgroundAgentById(agentId);
  }

  async createBackgroundAgent(agent: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).createBackgroundAgent !== 'function') {
      throw new Error(
        'Background Agents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).createBackgroundAgent(agent, profileId);
  }

  async updateBackgroundAgent(agent: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).updateBackgroundAgent !== 'function') {
      throw new Error(
        'Background Agents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).updateBackgroundAgent(agent, profileId);
  }

  async deleteBackgroundAgent(agentId: string): Promise<string> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).deleteBackgroundAgent !== 'function') {
      throw new Error(
        'Background Agents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).deleteBackgroundAgent(agentId);
  }

  // Document operations
  async getDocuments(
    queryParams?: any,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).getDocuments !== 'function') {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).getDocuments(
      queryParams,
      page,
      limit,
      profileId
    );
  }

  async getDocumentById(documentId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).getDocumentById !== 'function') {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).getDocumentById(documentId);
  }

  async createDocument(document: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).createDocument !== 'function') {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).createDocument(document, profileId);
  }

  async updateDocument(document: any, profileId: string): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).updateDocument !== 'function') {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).updateDocument(document, profileId);
  }

  /**
   * Appends text to the end of a MarkdownDocument
   * @param documentId - The ID of the document to append to
   * @param text - The text to append (will be added with a newline separator)
   * @param profileId - The profile ID that owns the document
   * @returns The updated document
   */
  async appendTextToDocument(
    documentId: string,
    text: string,
    profileId: string
  ): Promise<any> {
    const adapter = this.storageService.getAdapter();
    if (
      typeof (adapter as any).getDocumentById !== 'function'
      || typeof (adapter as any).updateDocument !== 'function'
    ) {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }

    // Get the current document
    const document = await (adapter as any).getDocumentById(documentId);

    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    // Append text with a newline separator (add double newline for markdown paragraph separation)
    const separator = document.content.trim().length > 0 ? '\n\n---\n\n' : '';
    const updatedContent = document.content + separator + text;

    // Update the document
    return await (adapter as any).updateDocument(
      { ...document, content: updatedContent },
      profileId
    );
  }

  async deleteDocument(documentId: string): Promise<void> {
    const adapter = this.storageService.getAdapter();
    if (typeof (adapter as any).deleteDocument !== 'function') {
      throw new Error(
        'Documents are not supported by the current storage adapter'
      );
    }
    return await (adapter as any).deleteDocument(documentId);
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
    if (
      'clearAllCloudDatabaseFiles' in adapter
      && typeof adapter.clearAllCloudDatabaseFiles === 'function'
    ) {
      await (adapter as any).clearAllCloudDatabaseFiles();
    } else {
      throw new Error(
        'Clear cloud database files not supported by current storage adapter'
      );
    }
    await this.storageService.reinitialize();
  }

  isOnline(): boolean {
    const adapter = this.storageService.getAdapter();
    return adapter.isOnline();
  }

  /**
   * Ensures that the storage service is properly initialized before performing operations
   * @throws Error with user-friendly message if storage is not initialized
   */
  private ensureStorageInitialized(): void {
    if (!this.storageService.isInitialized()) {
      throw new Error(
        'Storage is not set up yet. Please configure your storage options in Settings before managing API keys.'
      );
    }
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
