/**
 * File System Storage Adapter
 * Implements storage interface using local file system via File System Access API
 * Uses direct file operations for normal operations and bulk processing for sync
 */

import type { 
  StorageAdapter, 
  ConversationsResponse, 
  StorageConfig 
} from '../types';
import type { Conversation, Message, FilterOptions } from '../../../types';
import { FileSystemService } from '../filesystem/FileSystemService';
import { BrowserSQLiteManager } from '../database/BrowserSQLiteManager';
import { v5 as uuidv5 } from 'uuid';

// File names for our SQLite databases
const CONVERSATIONS_DB_FILE = 'conversations.db';
const API_KEYS_DB_FILE = 'api_keys.db';

export class FileSystemStorageAdapter implements StorageAdapter {
  private initialized = false;
  private fileSystemService: FileSystemService;
  private dbManager: BrowserSQLiteManager | null = null;

  constructor(_config: StorageConfig) {
    this.fileSystemService = new FileSystemService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check browser compatibility
    if (!FileSystemService.isSupported()) {
      const compatibility = FileSystemService.getBrowserCompatibility();
      throw new Error(`File System Access API not supported: ${compatibility.message}`);
    }

    // Try to restore directory handle from IndexedDB
    await this.restoreDirectoryHandle();

    this.initialized = true;
    console.log('File System Storage Adapter initialized successfully');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Request directory access from user
   */
  async requestDirectoryAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fileSystemService.requestDirectoryAccess();
      
      // Store directory handle in IndexedDB for persistence
      await this.persistDirectoryHandle();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to access directory' 
      };
    }
  }

  /**
   * Get current directory info
   */
  getDirectoryInfo() {
    return this.fileSystemService.getDirectoryInfo();
  }

  /**
   * Clear directory access
   */
  async clearDirectoryAccess(): Promise<void> {
    this.fileSystemService.clearDirectoryAccess();
    await this.clearPersistedDirectoryHandle();
  }

  /**
   * Check if directory is accessible
   */
  isDirectoryAccessible(): boolean {
    return this.fileSystemService.isDirectoryAccessible();
  }

  // Conversation operations - Direct file operations
  async createConversation(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    // Load current database into memory for processing
    const dbManager = await this.getOrCreateDbManager();
    
    // Transform conversation to data packet format (similar to CloudStorageAdapter)
    const dataPacket = this.transformConversationToDataPacket(profileId, conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId(profileId, dataPacket.id, 'create');
    
    try {
      const storedPacket = await dbManager.storeDataPacket(requestId, dataPacket);
      return this.transformDataPacketToConversation(storedPacket);
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async updateConversation(
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    if (!conversation.id) {
      throw new Error('Conversation ID is required for updates');
    }

    // Load current database into memory
    const dbManager = await this.getOrCreateDbManager();

    // Transform conversation to data packet format for update
    const dataPacket = this.transformConversationToDataPacketUpdate(conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId('current_user', dataPacket.id, 'update');
    
    try {
      const storedPacket = await dbManager.storeDataPacket(requestId, dataPacket);
      return this.transformDataPacketToConversation(storedPacket);
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  async getConversations(
    filters?: FilterOptions, 
    page = 1, 
    limit = 20, 
    profileId?: string
  ): Promise<ConversationsResponse> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const dbManager = await this.getOrCreateDbManager();
    
    // Get data packets from database
    const allDataPackets = await dbManager.listDataPackets({ userId: profileId || 'current_user' });
    
    // Apply simple filtering and pagination
    let filteredPackets = allDataPackets;
    if (filters?.tags?.length) {
      filteredPackets = allDataPackets.filter(packet => 
        packet.tags?.some((tag: string) => filters.tags?.includes(tag))
      );
    }
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPackets = filteredPackets.slice(startIndex, endIndex);
    
    // Transform to conversations
    const conversations = paginatedPackets.map((packet: any) => this.transformDataPacketToConversation(packet));
    
    return {
      conversations,
      total: conversations.length,
      page,
      limit
    };
  }

  async getConversationById(id: string): Promise<Conversation> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const dbManager = await this.getOrCreateDbManager();
    const dataPacket = await dbManager.getDataPacketById(id);
    return this.transformDataPacketToConversation(dataPacket);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const dbManager = await this.getOrCreateDbManager();
    const dataPacket = await dbManager.getDataPacketById(conversationId);
    // Extract messages from the conversation data
    const data = dataPacket.data || {};
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        parsedData = {};
      }
    }
    
    const messages: Message[] = parsedData.interactions?.map((interaction: any, index: number) => ({
      id: `${dataPacket.id}-${index}`,
      conversationId: dataPacket.id,
      role: interaction.actor,
      content: interaction.content,
      timestamp: new Date(interaction.timestamp),
      platform: interaction.model || parsedData.sourceChatbot || 'unknown',
      attachments: interaction.attachments?.map((url: string) => ({ url })) || [],
      isEdited: false
    })) || [];
    
    return messages;
  }

  // API Key operations - Direct file operations
  async getAPIKey(provider: string): Promise<string | null> {
    if (!this.isDirectoryAccessible()) {
      return null;
    }

    const dbManager = await this.getOrCreateDbManager();
    const apiKey = await dbManager.getAPIKeyByProvider(provider, 'current_user');
    return apiKey?.api_key || null;
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    if (!this.isDirectoryAccessible()) {
      return false;
    }

    const dbManager = await this.getOrCreateDbManager();
    const apiKey = await dbManager.getAPIKeyByProvider(provider, 'current_user');
    return !!apiKey;
  }

  // Context operations - Not implemented yet
  async getContexts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    throw new Error('Context operations not yet implemented for file system storage');
  }

  async getContextById(_contextId: string): Promise<any> {
    throw new Error('Context operations not yet implemented for file system storage');
  }

  async createContext(_context: any, _profileId: string): Promise<any> {
    throw new Error('Context operations not yet implemented for file system storage');
  }

  async updateContext(_context: any, _profileId: string): Promise<any> {
    throw new Error('Context operations not yet implemented for file system storage');
  }

  async deleteContext(_contextId: string): Promise<void> {
    throw new Error('Context operations not yet implemented for file system storage');
  }

  // System Prompt operations - Not implemented yet
  async getSystemPrompts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    throw new Error('System prompt operations not yet implemented for file system storage');
  }

  async getSystemPromptById(_systemPromptId: string): Promise<any> {
    throw new Error('System prompt operations not yet implemented for file system storage');
  }

  async createSystemPrompt(_systemPrompt: any, _profileId: string): Promise<any> {
    throw new Error('System prompt operations not yet implemented for file system storage');
  }

  async updateSystemPrompt(_systemPrompt: any, _profileId: string): Promise<any> {
    throw new Error('System prompt operations not yet implemented for file system storage');
  }

  async deleteSystemPrompt(_systemPromptId: string): Promise<string> {
    throw new Error('System prompt operations not yet implemented for file system storage');
  }

  // Sync operations - Bulk processing for migration
  async sync(): Promise<void> {
    // For file system storage, sync means ensuring files are written
    if (this.isDirectoryAccessible() && this.dbManager) {
      await this.writeDatabaseToFile(this.dbManager);
    }
  }

  isOnline(): boolean {
    return true; // File system is always "online"
  }

  // Bulk operations for migration
  /**
   * Export all databases for migration to cloud storage
   */
  async exportDatabasesForMigration(): Promise<{
    conversationsDb: ArrayBuffer;
    apiKeysDb: ArrayBuffer;
  }> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const conversationsDbResult = await this.fileSystemService.readFile(CONVERSATIONS_DB_FILE);
    const apiKeysDbResult = await this.fileSystemService.readFile(API_KEYS_DB_FILE);

    if (!conversationsDbResult.success || !conversationsDbResult.data) {
      throw new Error('Failed to read conversations database');
    }

    if (!apiKeysDbResult.success || !apiKeysDbResult.data) {
      throw new Error('Failed to read API keys database');
    }

    return {
      conversationsDb: conversationsDbResult.data,
      apiKeysDb: apiKeysDbResult.data
    };
  }

  /**
   * Import databases from cloud storage
   */
  async importDatabasesFromMigration(data: {
    conversationsDb: ArrayBuffer;
    apiKeysDb: ArrayBuffer;
  }): Promise<void> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const conversationsResult = await this.fileSystemService.writeFile(CONVERSATIONS_DB_FILE, data.conversationsDb);
    const apiKeysResult = await this.fileSystemService.writeFile(API_KEYS_DB_FILE, data.apiKeysDb);

    if (!conversationsResult.success) {
      throw new Error(`Failed to write conversations database: ${conversationsResult.error}`);
    }

    if (!apiKeysResult.success) {
      throw new Error(`Failed to write API keys database: ${apiKeysResult.error}`);
    }

    // Clear the in-memory database manager so it reloads from files
    this.dbManager = null;
  }

  // Private helper methods
  private async getOrCreateDbManager(): Promise<BrowserSQLiteManager> {
    if (this.dbManager && this.dbManager.isInitialized()) {
      return this.dbManager;
    }

    // Create new database manager
    this.dbManager = new BrowserSQLiteManager({
      conversationsDbName: 'fidu_conversations',
      apiKeysDbName: 'fidu_api_keys'
    });

    await this.dbManager.initialize();

    // Load existing data from files if they exist
    await this.loadDatabaseFromFiles();

    return this.dbManager;
  }

  private async loadDatabaseFromFiles(): Promise<void> {
    if (!this.dbManager) return;

    try {
      // Try to load conversations database
      const conversationsResult = await this.fileSystemService.readFile(CONVERSATIONS_DB_FILE);
      if (conversationsResult.success && conversationsResult.data) {
        await this.dbManager.importConversationsDB(new Uint8Array(conversationsResult.data));
      }

      // Try to load API keys database
      const apiKeysResult = await this.fileSystemService.readFile(API_KEYS_DB_FILE);
      if (apiKeysResult.success && apiKeysResult.data) {
        await this.dbManager.importAPIKeysDB(new Uint8Array(apiKeysResult.data));
      }
    } catch (error) {
      console.log('No existing database files found, starting with empty database');
    }
  }

  private async writeDatabaseToFile(dbManager: BrowserSQLiteManager): Promise<void> {
    try {
      // Export databases to binary format
      const conversationsData = await dbManager.exportConversationsDB();
      const apiKeysData = await dbManager.exportAPIKeysDB();

      // Write to files
      const conversationsResult = await this.fileSystemService.writeFile(CONVERSATIONS_DB_FILE, conversationsData);
      const apiKeysResult = await this.fileSystemService.writeFile(API_KEYS_DB_FILE, apiKeysData);

      if (!conversationsResult.success) {
        throw new Error(`Failed to write conversations database: ${conversationsResult.error}`);
      }

      if (!apiKeysResult.success) {
        throw new Error(`Failed to write API keys database: ${apiKeysResult.error}`);
      }
    } catch (error) {
      console.error('Failed to write database to file:', error);
      throw error;
    }
  }

  // Persistence methods for directory handle
  private async persistDirectoryHandle(): Promise<void> {
    try {
      const handle = this.fileSystemService.getDirectoryHandleForPersistence();
      if (handle) {
        // Store in IndexedDB for persistence
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['directoryHandles'], 'readwrite');
        const store = transaction.objectStore('directoryHandles');
        await store.put(handle, 'currentDirectory');
      }
    } catch (error) {
      console.warn('Failed to persist directory handle:', error);
    }
  }

  private async restoreDirectoryHandle(): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['directoryHandles'], 'readonly');
      const store = transaction.objectStore('directoryHandles');
      const handle = await store.get('currentDirectory');
      
      if (handle) {
        // Note: IndexedDB persistence of FileSystemDirectoryHandle is complex
        // For now, we'll require users to re-select directory on each session
        // this.fileSystemService.setDirectoryHandle(handle);
      }
    } catch (error) {
      console.log('No persisted directory handle found');
    }
  }

  private async clearPersistedDirectoryHandle(): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['directoryHandles'], 'readwrite');
      const store = transaction.objectStore('directoryHandles');
      await store.delete('currentDirectory');
    } catch (error) {
      console.warn('Failed to clear persisted directory handle:', error);
    }
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FIDUFileSystem', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('directoryHandles')) {
          db.createObjectStore('directoryHandles');
        }
      };
    });
  }

  // Transformation methods (copied from CloudStorageAdapter)
  private transformConversationToDataPacket(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): any {
    return {
      id: conversation.id || crypto.randomUUID(),
      profile_id: profileId,
      user_id: 'current_user',
      create_timestamp: new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: ['Chat-Bot-Conversation', 'FIDU-CHAT-LAB-Conversation', ...(conversation.tags?.filter(tag => tag !== 'FIDU-CHAT-LAB-Conversation') || [])],
      data: {
        sourceChatbot: (conversation.platform || 'other').toUpperCase(),
        interactions: messages.map((message) => ({
          actor: message.role,
          timestamp: message.timestamp.toString(),
          content: message.content,
          attachments: message.attachments?.map(att => att.url || att.toString()) || [],
          model: message.platform || conversation.platform || 'unknown'
        })),
        targetModelRequested: conversation.platform || 'other',
        conversationUrl: 'FIDU_Chat_Lab',
        conversationTitle: conversation.title || 'Untitled Conversation',
        isArchived: conversation.isArchived || false,
        isFavorite: conversation.isFavorite || false,
        participants: conversation.participants || [],
        status: conversation.status || 'active',
        originalPrompt: originalPrompt ? {
          promptText: originalPrompt.promptText,
          contextId: originalPrompt.context?.id,
          contextTitle: originalPrompt.context?.title,
          contextDescription: originalPrompt.context?.body,
          systemPromptIds: originalPrompt.systemPrompts?.map(sp => sp.id) || [],
          systemPromptContents: originalPrompt.systemPrompts?.map(sp => sp.content) || [],
          systemPromptNames: originalPrompt.systemPrompts?.map(sp => sp.name) || [],
          systemPromptId: originalPrompt.systemPrompt?.id || originalPrompt.systemPrompts?.[0]?.id,
          systemPromptContent: originalPrompt.systemPrompt?.content || originalPrompt.systemPrompts?.[0]?.content,
          systemPromptName: originalPrompt.systemPrompt?.name || originalPrompt.systemPrompts?.[0]?.name,
          estimatedTokens: originalPrompt.metadata?.estimatedTokens || 0
        } : undefined
      }
    };
  }

  private transformConversationToDataPacketUpdate(
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): any {
    if (!conversation.id) {
      throw new Error('Conversation ID is required to update conversation');
    }
    
    return {
      id: conversation.id,
      tags: conversation.tags || [],
      data: {
        sourceChatbot: (conversation.platform || 'other').toUpperCase(),
        interactions: messages.map((message) => ({
          actor: message.role,
          timestamp: message.timestamp.toString(),
          content: message.content,
          attachments: message.attachments?.map(att => att.url || att.toString()) || [],
          model: message.platform || conversation.platform || 'unknown'
        })),
        targetModelRequested: conversation.platform || 'other',
        conversationUrl: 'FIDU_Chat_Lab',
        conversationTitle: conversation.title || 'Untitled Conversation',
        isArchived: conversation.isArchived || false,
        isFavorite: conversation.isFavorite || false,
        participants: conversation.participants || [],
        status: conversation.status || 'active',
        originalPrompt: originalPrompt ? {
          promptText: originalPrompt.promptText,
          contextId: originalPrompt.context?.id,
          contextTitle: originalPrompt.context?.title,
          contextDescription: originalPrompt.context?.body,
          systemPromptIds: originalPrompt.systemPrompts?.map(sp => sp.id) || [],
          systemPromptContents: originalPrompt.systemPrompts?.map(sp => sp.content) || [],
          systemPromptNames: originalPrompt.systemPrompts?.map(sp => sp.name) || [],
          systemPromptId: originalPrompt.systemPrompt?.id || originalPrompt.systemPrompts?.[0]?.id,
          systemPromptContent: originalPrompt.systemPrompt?.content || originalPrompt.systemPrompts?.[0]?.content,
          systemPromptName: originalPrompt.systemPrompt?.name || originalPrompt.systemPrompts?.[0]?.name,
          estimatedTokens: originalPrompt.metadata?.estimatedTokens || 0
        } : undefined
      }
    };
  }

  private transformDataPacketToConversation(packet: any): Conversation {
    // Ensure data object exists and provides defaults
    const data = packet.data || {};
    
    // Defensive parsing: if data is a string waiting to be parsed, parse it
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse conversation data as JSON string:', error);
        parsedData = {};
      }
    }
    
    // Ensure object from any source, even if null
    const finalData = parsedData || {};

    // Add validation to ensure required fields exist
    if (!finalData.interactions?.length) {
      return {
        id: packet.id,
        title: "Error: Could not parse data packet as conversation",
        platform: "other",
        createdAt: packet.create_timestamp,
        updatedAt: packet.update_timestamp,
        lastMessage: "Error: Could not parse data packet as conversation",
        messageCount: 0,
        tags: [],
        isArchived: false,
        isFavorite: false,
        participants: [],
        status: 'active'
      };
    }

    // Transform original prompt data if it exists
    let originalPrompt: Conversation['originalPrompt'] | undefined;
    if (finalData.originalPrompt) {
      let systemPrompts: any[] = [];
      if (finalData.originalPrompt.systemPromptIds?.length > 0) {
        systemPrompts = finalData.originalPrompt.systemPromptIds.map((id: string, index: number) => ({
          id,
          content: finalData.originalPrompt.systemPromptContents?.[index] || '',
          name: finalData.originalPrompt.systemPromptNames?.[index] || ''
        }));
      }

      originalPrompt = {
        promptText: finalData.originalPrompt.promptText || '',
        context: finalData.originalPrompt.contextId ? {
          id: finalData.originalPrompt.contextId,
          title: finalData.originalPrompt.contextTitle || '',
          body: finalData.originalPrompt.contextDescription || '',
          tokenCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          isBuiltIn: false
        } : undefined,
        systemPrompts,
        systemPrompt: systemPrompts.length > 0 ? systemPrompts[0] : undefined,
        metadata: {
          estimatedTokens: finalData.originalPrompt.estimatedTokens || 0
        }
      };
    }

    // Transform messages from interactions
    const messages: Message[] = finalData.interactions.map((interaction: any, index: number) => ({
      id: `${packet.id}-${index}`,
      conversationId: packet.id,
      role: interaction.actor,
      content: interaction.content,
      timestamp: new Date(interaction.timestamp),
      platform: interaction.model || finalData.sourceChatbot || 'unknown',
      attachments: interaction.attachments?.map((url: string) => ({ url })) || [],
      isEdited: false
    }));

    return {
      id: packet.id,
      title: finalData.conversationTitle || 'Untitled Conversation',
      platform: finalData.sourceChatbot?.toLowerCase() || 'other',
      createdAt: packet.create_timestamp,
      updatedAt: packet.update_timestamp,
      lastMessage: messages.length > 0 ? messages[messages.length - 1].content : '',
      messageCount: messages.length,
      tags: packet.tags || [],
      isArchived: finalData.isArchived || false,
      isFavorite: finalData.isFavorite || false,
      participants: finalData.participants || [],
      status: finalData.status || 'active',
      originalPrompt
    };
  }

  private generateRequestId(userId: string, conversationId: string, operation: string): string {
    return uuidv5(`${userId}-${conversationId}-${operation}-${Date.now()}`, uuidv5.DNS);
  }
}
