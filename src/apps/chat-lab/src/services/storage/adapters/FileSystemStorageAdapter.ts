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
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { PROTECTED_TAGS } from '../../../constants/protectedTags';
import { extractUniqueModels } from '../../../utils/conversationUtils';

// File names for our SQLite databases (matching Google Drive naming convention)
const CONVERSATIONS_DB_FILE = 'fidu_conversations_v1.db';
const API_KEYS_DB_FILE = 'fidu_api_keys_v1.db';
const METADATA_FILE = 'fidu_metadata_v1.json';

export class FileSystemStorageAdapter implements StorageAdapter {
  private initialized = false;
  private fileSystemService: FileSystemService;
  private dbManager: BrowserSQLiteManager | null = null;
  private userId: string | null = null;

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
    // File System Storage Adapter initialized successfully
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setUserId(userId: string): void {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID cannot be empty or null');
    }
    this.userId = userId;
  }

  private ensureUserId(): string {
    if (!this.userId) {
      // Auto-generate a user ID for file system mode if none is set
      const STORAGE_KEY = 'fidu-filesystem-user-id';
      let userId = localStorage.getItem(STORAGE_KEY);
      
      // Validate that the stored ID is a valid UUID format
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        // Generate a new UUID for this browser/device
        userId = uuidv4();
        localStorage.setItem(STORAGE_KEY, userId);
      }
      
      this.userId = userId;
    }
    return this.userId;
  }

  /**
   * Request directory access from user
   */
  async requestDirectoryAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fileSystemService.requestDirectoryAccess();
      
      // Store directory handle in IndexedDB for persistence
      await this.persistDirectoryHandle();
      
      // Automatically create database files if they don't exist
      await this.ensureDatabaseFilesExist();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to access directory' 
      };
    }
  }

  /**
   * Request directory access with smart re-selection hints
   */
  async requestDirectoryAccessWithHints(): Promise<{ success: boolean; error?: string; isReselection?: boolean }> {
    try {
      // Check if this is a re-selection scenario
      const hasPreviousSelection = this.fileSystemService.getDirectoryName() !== null;
      
      if (hasPreviousSelection) {
        // Re-selecting directory for user - providing smart hints
      }
      
      await this.fileSystemService.requestDirectoryAccessWithHints();
      
      // Store directory handle in IndexedDB for persistence
      await this.persistDirectoryHandle();
      
      // Automatically create database files if they don't exist
      await this.ensureDatabaseFilesExist();
      
      return { 
        success: true, 
        isReselection: hasPreviousSelection 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to access directory',
        isReselection: this.fileSystemService.getDirectoryName() !== null
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
    // Only return true if we have an active directory handle
    return this.fileSystemService.isDirectoryAccessible();
  }

  /**
   * Check if we have directory metadata but no active handle
   */
  hasDirectoryMetadata(): boolean {
    const hasDirectoryName = this.fileSystemService.getDirectoryName() !== null;
    const hasDirectoryHandle = this.fileSystemService.isDirectoryAccessible();
    return hasDirectoryName && !hasDirectoryHandle;
  }

  /**
   * Get directory name for display (even if handle is lost)
   */
  getDirectoryName(): string | null {
    return this.fileSystemService.getDirectoryName();
  }

  /**
   * Check if directory access is required after migration
   * Returns true if we have directory metadata but no active handle
   */
  requiresDirectoryAccessAfterMigration(): boolean {
    const hasDirectoryName = this.fileSystemService.getDirectoryName() !== null;
    const hasDirectoryHandle = this.fileSystemService.isDirectoryAccessible();
    return hasDirectoryName && !hasDirectoryHandle;
  }

  /**
   * Verify current directory permission is still valid
   */
  async verifyPermission(): Promise<boolean> {
    return await this.fileSystemService.verifyPermission();
  }

  /**
   * Request permission renewal for current directory
   */
  async renewPermission(): Promise<{ success: boolean; error?: string }> {
    return await this.fileSystemService.renewPermission();
  }

  /**
   * Get previously selected directory name (if any)
   */
  async getPreviousDirectoryName(): Promise<string | null> {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['directoryHandles'], 'readonly');
      const store = transaction.objectStore('directoryHandles');
      const metadata = (await store.get('currentDirectory')) as unknown as { directoryName: string; timestamp: number } | undefined;
      
      if (metadata && metadata.directoryName) {
        // Check if the metadata is recent (within 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (metadata.timestamp && metadata.timestamp > thirtyDaysAgo) {
          return metadata.directoryName;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if database files exist in the selected directory
   */
  async checkFilesExist(): Promise<{
    conversations: boolean;
    apiKeys: boolean;
    metadata: boolean;
  }> {
    if (!this.isDirectoryAccessible()) {
      return {
        conversations: false,
        apiKeys: false,
        metadata: false
      };
    }

    const conversationsExists = await this.fileSystemService.fileExists(CONVERSATIONS_DB_FILE);
    const apiKeysExists = await this.fileSystemService.fileExists(API_KEYS_DB_FILE);
    const metadataExists = await this.fileSystemService.fileExists(METADATA_FILE);

    return {
      conversations: conversationsExists,
      apiKeys: apiKeysExists,
      metadata: metadataExists
    };
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

    try {
      // Transform conversation to data packet format (same as CloudStorageAdapter)
      const dataPacket = this.transformConversationToDataPacket(profileId, conversation, messages, originalPrompt);
      
      // Creating conversation with direct file operations
      
      // Store directly in the conversations database file
      await this.storeDataPacketDirectly(dataPacket);
      
      // Conversation created successfully
      
      return this.transformDataPacketToConversation(dataPacket);
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
    const requestId = this.generateRequestId(this.ensureUserId(), dataPacket.id, 'update');
    
    try {
      const storedPacket = await dbManager.storeDataPacket(requestId, dataPacket);
      
      // Auto-sync after updating conversation
      await this.sync();
      
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

    try {
      // Ensure we have a valid userId for the query
      const userId = profileId || this.ensureUserId();
      // Loading conversations with direct file operations
      
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(userId);
      
      // Retrieved data packets from file
      
      // Apply filtering - first filter for conversation packets, then apply additional filters
      let filteredPackets = (allDataPackets || []).filter(packet => 
        packet.tags && packet.tags.some((tag: string) => PROTECTED_TAGS.includes(tag as any))
      );
      
      // Apply additional tag filters if provided
      if (filters?.tags?.length) {
        filteredPackets = filteredPackets.filter(packet => 
          packet.tags?.some((tag: string) => filters.tags?.includes(tag))
        );
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPackets = filteredPackets.slice(startIndex, endIndex);
      
      // Transform to conversations with validation
      const conversations: Conversation[] = paginatedPackets
        .filter((packet: any) => packet && packet.id) // Filter out invalid packets
        .map((packet: any) => {
          try {
            return this.transformDataPacketToConversation(packet);
          } catch (error) {
            console.warn('Failed to transform data packet to conversation:', error, packet);
            return null;
          }
        })
        .filter((conversation: Conversation | null): conversation is Conversation => conversation !== null); // Remove failed transformations
      
      console.log('Successfully loaded conversations:', conversations.length);
      
      return {
        conversations,
        total: conversations.length,
        page,
        limit
      };
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Return empty result instead of throwing to prevent UI crashes
      return {
        conversations: [],
        total: 0,
        page,
        limit
      };
    }
  }

  async getConversationById(id: string): Promise<Conversation> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Find the conversation with the matching ID
      const conversationPacket = allDataPackets.find((packet: any) => 
        packet.id === id && packet.tags && packet.tags.includes('Chat-Bot-Conversation')
      );
      
      if (!conversationPacket) {
        throw new Error(`Conversation with ID ${id} not found`);
      }
      
      return this.transformDataPacketToConversation(conversationPacket);
    } catch (error) {
      console.error('Error loading conversation:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Find the conversation with the matching ID
      const conversationPacket = allDataPackets.find((packet: any) => 
        packet.id === conversationId && packet.tags && packet.tags.includes('Chat-Bot-Conversation')
      );
      
      if (!conversationPacket) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }
      
      // Extract messages from the conversation data
      const data = conversationPacket.data || {};
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = {};
        }
      }
      
      const messages: Message[] = parsedData.interactions?.map((interaction: any, index: number) => ({
        id: `${conversationPacket.id}-${index}`,
        conversationId: conversationPacket.id,
        role: interaction.actor,
        content: interaction.content,
        timestamp: interaction.timestamp,
        platform: interaction.model || parsedData.sourceChatbot || 'unknown',
        attachments: interaction.attachments?.map((url: string) => ({ url })) || [],
        isEdited: false
      })) || [];
      
      return messages;
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  }

  // API Key operations - Direct file operations
  async getAPIKey(provider: string): Promise<string | null> {
    if (!this.isDirectoryAccessible()) {
      return null;
    }

    const dbManager = await this.getOrCreateDbManager();
    const apiKey = await dbManager.getAPIKeyByProvider(provider, this.ensureUserId());
    return apiKey?.api_key || null;
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    if (!this.isDirectoryAccessible()) {
      return false;
    }

    const dbManager = await this.getOrCreateDbManager();
    const apiKey = await dbManager.getAPIKeyByProvider(provider, this.ensureUserId());
    return !!apiKey;
  }

  async getAllAPIKeys(): Promise<any[]> {
    if (!this.isDirectoryAccessible()) {
      return [];
    }

    try {
      const dbManager = await this.getOrCreateDbManager();
      const apiKeys = await dbManager.getAllAPIKeys(this.ensureUserId());
      console.log(`🔑 [FileSystemStorageAdapter] Retrieved ${apiKeys.length} API keys`);
      return apiKeys;
    } catch (error) {
      console.error('Error fetching all API keys:', error);
      return [];
    }
  }

  async saveAPIKey(provider: string, apiKey: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      const dbManager = await this.getOrCreateDbManager();
      const userId = this.ensureUserId();
      
      // Check if API key already exists for this provider
      const existingKey = await dbManager.getAPIKeyByProvider(provider, userId);
      
      if (existingKey) {
        // Update existing key
        console.log(`🔑 [FileSystemStorageAdapter] Updating existing API key for provider: ${provider}`);
        const updated = await dbManager.updateAPIKey(existingKey.id, apiKey, userId);
        await this.writeDatabaseToFile(dbManager);
        return updated;
      } else {
        // Create new key
        console.log(`🔑 [FileSystemStorageAdapter] Creating new API key for provider: ${provider}`);
        const newApiKey = {
          id: crypto.randomUUID(),
          provider,
          api_key: apiKey,
          user_id: userId,
          create_timestamp: new Date().toISOString(),
          update_timestamp: new Date().toISOString()
        };
        const stored = await dbManager.storeAPIKey(newApiKey);
        await this.writeDatabaseToFile(dbManager);
        return stored;
      }
    } catch (error) {
      console.error(`Error saving API key for provider ${provider}:`, error);
      throw error;
    }
  }

  async deleteAPIKey(id: string): Promise<void> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      console.log(`🔑 [FileSystemStorageAdapter] Deleting API key with ID: ${id}`);
      const dbManager = await this.getOrCreateDbManager();
      await dbManager.deleteAPIKey(id);
      await this.writeDatabaseToFile(dbManager);
    } catch (error) {
      console.error(`Error deleting API key with ID ${id}:`, error);
      throw error;
    }
  }

  // Context operations - Direct file operations
  async getContexts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Filter for context data packets (those with FIDU-CHAT-LAB-Context tag)
      const contextPackets = (allDataPackets || []).filter((packet: any) => 
        packet.tags && packet.tags.includes('FIDU-CHAT-LAB-Context')
      );
      
      // Apply simple pagination
      const startIndex = (_page - 1) * _limit;
      const endIndex = startIndex + _limit;
      const paginatedPackets = contextPackets.slice(startIndex, endIndex);
      
      // Transform to contexts
      const contexts = paginatedPackets
        .filter((packet: any) => packet && packet.id)
        .map((packet: any) => {
          try {
            return this.transformDataPacketToContext(packet);
          } catch (error) {
            console.warn('Failed to transform context data packet:', error, packet);
            return null;
          }
        })
        .filter((context: any) => context !== null);
      
      return {
        contexts,
        total: contextPackets.length,
        page: _page,
        limit: _limit
      };
    } catch (error) {
      console.error('Error loading contexts:', error);
      return {
        contexts: [],
        total: 0,
        page: _page,
        limit: _limit
      };
    }
  }

  async getContextById(contextId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Find the context with the matching ID
      const contextPacket = allDataPackets.find((packet: any) => 
        packet.id === contextId && packet.tags && packet.tags.includes('FIDU-CHAT-LAB-Context')
      );
      
      if (!contextPacket) {
        throw new Error(`Context with ID ${contextId} not found`);
      }
      
      return this.transformDataPacketToContext(contextPacket);
    } catch (error) {
      console.error('Error loading context:', error);
      throw error;
    }
  }

  async createContext(context: any, profileId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Transform context to data packet format
      const dataPacket = this.transformContextToDataPacket(context, profileId);
      
      console.log('Creating context with direct file operations:', dataPacket.id);
      console.log('Data packet user_id:', dataPacket.user_id);
      console.log('Data packet profile_id:', dataPacket.profile_id);
      
      // Store directly in the conversations database file
      await this.storeDataPacketDirectly(dataPacket);
      
      console.log('Context created successfully:', dataPacket.id);
      
      return this.transformDataPacketToContext(dataPacket);
    } catch (error) {
      console.error('Error creating context:', error);
      throw error;
    }
  }

  async updateContext(context: any, profileId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    if (!context.id) {
      throw new Error('Context ID is required for updates');
    }

    try {
      // Transform context to data packet format for update
      const dataPacket = this.transformContextToDataPacketUpdate(context, profileId);
      
      console.log('Updating context with direct file operations:', dataPacket.id);
      
      // Store directly in the conversations database file
      await this.storeDataPacketDirectly(dataPacket);
      
      console.log('Context updated successfully:', dataPacket.id);
      
      return this.transformDataPacketToContext(dataPacket);
    } catch (error) {
      console.error('Error updating context:', error);
      throw error;
    }
  }

  async deleteContext(contextId: string): Promise<void> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      console.log('Deleting context with direct file operations:', contextId);
      
      // Read current conversations database
      const conversationsDbData = await this.readConversationsDatabase();
      
      if (conversationsDbData.byteLength === 0) {
        console.log('No conversations database file found, nothing to delete');
        return;
      }
      
      // Load database and delete the packet
      const dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'conversations',
        apiKeysDbName: 'api_keys',
        enableEncryption: true
      });
      await dbManager.initialize();
      await dbManager.importConversationsDB(new Uint8Array(conversationsDbData));
      await dbManager.deleteDataPacket(contextId);
      
      // Export and write updated database back to file
      const exported = await dbManager.exportConversationsDB();
      await this.writeConversationsDatabase(exported.buffer as ArrayBuffer);
      
      console.log('Context deleted successfully:', contextId);
    } catch (error) {
      console.error('Error deleting context:', error);
      throw error;
    }
  }

  // System Prompt operations - Direct file operations
  async getSystemPrompts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Filter for system prompt data packets (those with FIDU-CHAT-LAB-SystemPrompt tag)
      const systemPromptPackets = (allDataPackets || []).filter((packet: any) => 
        packet.tags && packet.tags.includes('FIDU-CHAT-LAB-SystemPrompt')
      );
      
      // Apply simple pagination
      const startIndex = (_page - 1) * _limit;
      const endIndex = startIndex + _limit;
      const paginatedPackets = systemPromptPackets.slice(startIndex, endIndex);
      
      // Transform to system prompts
      const systemPrompts = paginatedPackets
        .filter((packet: any) => packet && packet.id)
        .map((packet: any) => {
          try {
            return this.transformDataPacketToSystemPrompt(packet);
          } catch (error) {
            console.warn('Failed to transform system prompt data packet:', error, packet);
            return null;
          }
        })
        .filter((systemPrompt: any) => systemPrompt !== null);
      
      return {
        systemPrompts,
        total: systemPromptPackets.length,
        page: _page,
        limit: _limit
      };
    } catch (error) {
      console.error('Error loading system prompts:', error);
      return {
        systemPrompts: [],
        total: 0,
        page: _page,
        limit: _limit
      };
    }
  }

  async getSystemPromptById(systemPromptId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read data packets directly from the conversations database file
      const allDataPackets = await this.readDataPacketsFromFile(this.ensureUserId());
      
      // Find the system prompt with the matching ID
      const systemPromptPacket = allDataPackets.find((packet: any) => 
        packet.id === systemPromptId && packet.tags && packet.tags.includes('FIDU-CHAT-LAB-SystemPrompt')
      );
      
      if (!systemPromptPacket) {
        throw new Error(`System prompt with ID ${systemPromptId} not found`);
      }
      
      return this.transformDataPacketToSystemPrompt(systemPromptPacket);
    } catch (error) {
      console.error('Error loading system prompt:', error);
      throw error;
    }
  }

  async createSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Transform system prompt to data packet format
      const dataPacket = this.transformSystemPromptToDataPacket(systemPrompt, profileId);
      
      console.log('Creating system prompt with direct file operations:', dataPacket.id);
      console.log('Data packet user_id:', dataPacket.user_id);
      console.log('Data packet profile_id:', dataPacket.profile_id);
      
      // Store directly in the conversations database file
      await this.storeDataPacketDirectly(dataPacket);
      
      console.log('System prompt created successfully:', dataPacket.id);
      
      return this.transformDataPacketToSystemPrompt(dataPacket);
    } catch (error) {
      console.error('Error creating system prompt:', error);
      throw error;
    }
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    if (!systemPrompt.id) {
      throw new Error('System prompt ID is required for updates');
    }

    try {
      // Transform system prompt to data packet format for update
      const dataPacket = this.transformSystemPromptToDataPacketUpdate(systemPrompt, profileId);
      
      console.log('Updating system prompt with direct file operations:', dataPacket.id);
      
      // Store directly in the conversations database file
      await this.storeDataPacketDirectly(dataPacket);
      
      console.log('System prompt updated successfully:', dataPacket.id);
      
      return this.transformDataPacketToSystemPrompt(dataPacket);
    } catch (error) {
      console.error('Error updating system prompt:', error);
      throw error;
    }
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      console.log('Deleting system prompt with direct file operations:', systemPromptId);
      
      // Read current conversations database
      const conversationsDbData = await this.readConversationsDatabase();
      
      if (conversationsDbData.byteLength === 0) {
        console.log('No conversations database file found, nothing to delete');
        return systemPromptId;
      }
      
      // Load database and delete the packet
      const dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'conversations',
        apiKeysDbName: 'api_keys',
        enableEncryption: true
      });
      await dbManager.initialize();
      await dbManager.importConversationsDB(new Uint8Array(conversationsDbData));
      await dbManager.deleteDataPacket(systemPromptId);
      
      // Export and write updated database back to file
      const exported = await dbManager.exportConversationsDB();
      await this.writeConversationsDatabase(exported.buffer as ArrayBuffer);
      
      console.log('System prompt deleted successfully:', systemPromptId);
      
      return systemPromptId;
    } catch (error) {
      console.error('Error deleting system prompt:', error);
      throw error;
    }
  }

  // Direct file operations - Store data packets directly to files
  private async storeDataPacketDirectly(dataPacket: any): Promise<void> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    try {
      // Read current conversations database
      const conversationsDbData = await this.readConversationsDatabase();
      
      // Add the new data packet to the database
      const updatedDbData = await this.addDataPacketToDatabase(conversationsDbData, dataPacket);
      
      // Write updated database back to file
      await this.writeConversationsDatabase(updatedDbData);
      
      console.log('Data packet stored directly to file:', dataPacket.id);
    } catch (error) {
      console.error('Error storing data packet directly:', error);
      throw error;
    }
  }

  private async readConversationsDatabase(): Promise<ArrayBuffer> {
    try {
      const result = await this.fileSystemService.readFile(CONVERSATIONS_DB_FILE);
      if (result.success && result.data) {
        console.log(`Read conversations database file: ${result.data.byteLength} bytes`);
        return result.data;
      } else {
        console.log('No conversations database file found or read failed:', result.error);
        return new ArrayBuffer(0);
      }
    } catch (error) {
      console.log('Error reading conversations database file:', error);
      return new ArrayBuffer(0);
    }
  }

  private async writeConversationsDatabase(dbData: ArrayBuffer): Promise<void> {
    console.log(`Writing conversations database file: ${dbData.byteLength} bytes`);
    const result = await this.fileSystemService.writeFile(CONVERSATIONS_DB_FILE, dbData);
    if (!result.success) {
      throw new Error(`Failed to write conversations database: ${result.error}`);
    }
    console.log('Conversations database file written successfully');
  }

  private async addDataPacketToDatabase(dbData: ArrayBuffer, dataPacket: any): Promise<ArrayBuffer> {
    // Generate unique request ID using the same approach as other storage adapters
    const requestId = this.generateRequestId(dataPacket.user_id, dataPacket.id, 'create');
    
    // If database is empty, create a new one
    if (dbData.byteLength === 0) {
      const dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'conversations',
        apiKeysDbName: 'api_keys',
        enableEncryption: true
      });
      await dbManager.initialize();
      await dbManager.storeDataPacket(requestId, dataPacket);
      const exported = await dbManager.exportConversationsDB();
      return exported.buffer as ArrayBuffer;
    } else {
      // Load existing database, add packet, export
      const dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'conversations',
        apiKeysDbName: 'api_keys',
        enableEncryption: true
      });
      await dbManager.initialize();
      await dbManager.importConversationsDB(new Uint8Array(dbData));
      await dbManager.storeDataPacket(requestId, dataPacket);
      const exported = await dbManager.exportConversationsDB();
      return exported.buffer as ArrayBuffer;
    }
  }

  private async readDataPacketsFromFile(_userId: string): Promise<any[]> {
    try {
      // Read the conversations database file
      const dbData = await this.readConversationsDatabase();
      
      if (dbData.byteLength === 0) {
        console.log('No conversations database file found');
        return [];
      }
      
      // Load database and query for data packets
      const dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'conversations',
        apiKeysDbName: 'api_keys',
        enableEncryption: true
      });
      await dbManager.initialize();
      await dbManager.importConversationsDB(new Uint8Array(dbData));
      
      // Get data packets for the user - use this.ensureUserId() as that's what we store in the data packets
      const dataPackets = await dbManager.listDataPackets({ user_id: this.ensureUserId() });
      
      console.log(`Read ${dataPackets?.length || 0} data packets from file for user ${this.ensureUserId()}`);
      
      return dataPackets || [];
    } catch (error) {
      console.error('Error reading data packets from file:', error);
      return [];
    }
  }

  // Sync operations - Write current state to files (kept for compatibility)
  async sync(): Promise<void> {
    // For direct file operations, sync is a no-op since we write directly
    console.log('Sync called but using direct file operations - no sync needed');
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
    metadata?: any;
  }> {
    if (!this.isDirectoryAccessible()) {
      throw new Error('No directory access. Please select a directory first.');
    }

    const conversationsDbResult = await this.fileSystemService.readFile(CONVERSATIONS_DB_FILE);
    const apiKeysDbResult = await this.fileSystemService.readFile(API_KEYS_DB_FILE);
    const metadataResult = await this.fileSystemService.readFile(METADATA_FILE);

    if (!conversationsDbResult.success || !conversationsDbResult.data) {
      throw new Error('Failed to read conversations database');
    }

    if (!apiKeysDbResult.success || !apiKeysDbResult.data) {
      throw new Error('Failed to read API keys database');
    }

    let metadata: any = undefined;
    if (metadataResult.success && metadataResult.data) {
      try {
        const metadataText = new TextDecoder().decode(metadataResult.data);
        metadata = JSON.parse(metadataText);
      } catch (error) {
        console.warn('Failed to parse metadata file:', error);
      }
    }

    return {
      conversationsDb: conversationsDbResult.data,
      apiKeysDb: apiKeysDbResult.data,
      metadata
    };
  }

  /**
   * Import databases from cloud storage
   */
  async importDatabasesFromMigration(data: {
    conversationsDb: ArrayBuffer;
    apiKeysDb: ArrayBuffer;
    metadata?: any;
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

    // Write metadata file if provided
    if (data.metadata) {
      const metadataText = JSON.stringify(data.metadata, null, 2);
      const metadataBytes = new TextEncoder().encode(metadataText);
      const metadataResult = await this.fileSystemService.writeFile(METADATA_FILE, metadataBytes.buffer);
      
      if (!metadataResult.success) {
        console.warn(`Failed to write metadata file: ${metadataResult.error}`);
      }
    }

    // Clear the in-memory database manager so it reloads from files
    this.dbManager = null;
  }

  // Private helper methods
  private async getOrCreateDbManager(): Promise<BrowserSQLiteManager> {
    if (this.dbManager && this.dbManager.isInitialized()) {
      return this.dbManager;
    }

    // Check if we have directory name but no actual handle
    const hasDirectoryName = this.fileSystemService.getDirectoryName() !== null;
    const hasDirectoryHandle = this.fileSystemService.isDirectoryAccessible();
    
    if (hasDirectoryName && !hasDirectoryHandle) {
      throw new Error('Directory access lost. Please re-select your directory in Settings to continue.');
    }

    console.log('Creating new database manager...');
    
    // Create new database manager with encryption enabled
    this.dbManager = new BrowserSQLiteManager({
      conversationsDbName: 'fidu_conversations',
      apiKeysDbName: 'fidu_api_keys',
      enableEncryption: true
    });

    console.log('Initializing database manager...');
    await this.dbManager.initialize();
    console.log('Database manager initialized successfully');

    // Load existing data from files if they exist and we have directory access
    if (hasDirectoryHandle) {
      console.log('Loading existing data from files...');
      await this.loadDatabaseFromFiles();
    }

    return this.dbManager;
  }

  private async loadDatabaseFromFiles(): Promise<void> {
    if (!this.dbManager) return;

    try {
      // Try to load conversations database
      const conversationsResult = await this.fileSystemService.readFile(CONVERSATIONS_DB_FILE);
      if (conversationsResult.success && conversationsResult.data && conversationsResult.data.byteLength > 0) {
        try {
          await this.dbManager.importConversationsDB(new Uint8Array(conversationsResult.data));
          console.log('Successfully loaded conversations database from file');
        } catch (importError) {
          console.warn('Failed to import conversations database, starting with empty database:', importError);
        }
      }

      // Try to load API keys database
      const apiKeysResult = await this.fileSystemService.readFile(API_KEYS_DB_FILE);
      if (apiKeysResult.success && apiKeysResult.data && apiKeysResult.data.byteLength > 0) {
        try {
          await this.dbManager.importAPIKeysDB(new Uint8Array(apiKeysResult.data));
          console.log('Successfully loaded API keys database from file');
        } catch (importError) {
          console.warn('Failed to import API keys database, starting with empty database:', importError);
        }
      }
    } catch {
      console.log('No existing database files found or failed to load, starting with empty database');
    }
  }

  private async writeDatabaseToFile(dbManager: BrowserSQLiteManager): Promise<void> {
    try {
      // Export databases to binary format
      const conversationsData = await dbManager.exportConversationsDB();
      const apiKeysData = await dbManager.exportAPIKeysDB();

      console.log('Exporting databases:');
      console.log('- Conversations DB size:', conversationsData.byteLength, 'bytes');
      console.log('- API Keys DB size:', apiKeysData.byteLength, 'bytes');

      // Write to files
      const conversationsResult = await this.fileSystemService.writeFile(CONVERSATIONS_DB_FILE, conversationsData.buffer as ArrayBuffer);
      const apiKeysResult = await this.fileSystemService.writeFile(API_KEYS_DB_FILE, apiKeysData.buffer as ArrayBuffer);

      console.log('File write results:');
      console.log('- Conversations file:', conversationsResult.success ? 'SUCCESS' : `FAILED - ${conversationsResult.error}`);
      console.log('- API Keys file:', apiKeysResult.success ? 'SUCCESS' : `FAILED - ${apiKeysResult.error}`);

      if (!conversationsResult.success) {
        throw new Error(`Failed to write conversations database: ${conversationsResult.error}`);
      }

      if (!apiKeysResult.success) {
        throw new Error(`Failed to write API keys database: ${apiKeysResult.error}`);
      }

      // Write metadata file
      const metadata = {
        lastSync: new Date().toISOString(),
        version: '1',
        conversationsSize: conversationsData.length,
        apiKeysSize: apiKeysData.length,
        storageType: 'filesystem',
        directoryName: this.fileSystemService.getDirectoryName() || 'unknown'
      };

      const metadataText = JSON.stringify(metadata, null, 2);
      const metadataBytes = new TextEncoder().encode(metadataText);
      const metadataResult = await this.fileSystemService.writeFile(METADATA_FILE, metadataBytes.buffer);

      if (!metadataResult.success) {
        console.warn(`Failed to write metadata file: ${metadataResult.error}`);
      }
    } catch (error) {
      console.error('Failed to write database to file:', error);
      throw error;
    }
  }

  // Persistence methods for directory handle
  private async persistDirectoryHandle(): Promise<void> {
    try {
      const directoryInfo = this.fileSystemService.getDirectoryInfo();
      
      if (directoryInfo && directoryInfo.handle) {
        // Store the actual FileSystemDirectoryHandle in IndexedDB
        // FileSystemHandle objects are serializable and can be stored in IndexedDB
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['directoryHandles'], 'readwrite');
        const store = transaction.objectStore('directoryHandles');
        
        const handleData = {
          handle: directoryInfo.handle, // Store the actual handle
          directoryName: directoryInfo.path,
          permissionState: directoryInfo.permissionState,
          timestamp: Date.now()
        };
        
        console.log('About to store handle data:', {
          handle: handleData.handle,
          handleName: (handleData.handle as any)?.name,
          handleKind: (handleData.handle as any)?.kind,
          directoryName: handleData.directoryName,
          timestamp: handleData.timestamp
        });
        
        await store.put(handleData, 'currentDirectory');
        console.log('Directory handle persisted to IndexedDB successfully');
      } else {
        console.log('No directory info or handle available to persist');
      }
    } catch (error) {
      console.error('Failed to persist directory handle:', error);
    }
  }

  private async restoreDirectoryHandle(): Promise<void> {
    try {
      // Attempting to restore directory handle from IndexedDB
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['directoryHandles'], 'readonly');
      const store = transaction.objectStore('directoryHandles');
      const rawData = await new Promise((resolve, reject) => {
        const request = store.get('currentDirectory');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      // Raw data from IndexedDB retrieved
      
      // Test if we can access properties directly like the Stack Overflow example
      if (rawData && typeof rawData === 'object') {
        // Testing direct property access
      }
      
      const handleData = rawData as unknown as { 
        handle: any; 
        directoryName: string; 
        timestamp: number;
        permissionState?: string;
      } | undefined;
      
      // Retrieved handle data from IndexedDB
      
      if (handleData) {
        // Handle data details available
      }
      
      // Check if we have any data at all
      if (rawData && typeof rawData === 'object') {
        const data = rawData as any;
        
        // Check if the data is recent (within 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (data.timestamp && data.timestamp > thirtyDaysAgo) {
          
          // Try to use the handle if it exists and looks valid
          if (data.handle && typeof data.handle === 'object' && data.handle.kind === 'directory') {
            
            try {
              // Check if the handle has the requestPermission method
              if (typeof data.handle.requestPermission === 'function') {
                
                // First, try to check permission state without requesting
                // This avoids the "User activation is required" error during initialization
                try {
                  // Check if we can query the permission state
                  const permissionState = await data.handle.queryPermission({ mode: 'readwrite' });
                  
                  if (permissionState === 'granted') {
                    this.fileSystemService.setDirectoryHandle(data.handle, data.directoryName);
                  } else {
                    this.fileSystemService.setDirectoryName(data.directoryName);
                  }
                } catch {
                  // If queryPermission is not available or fails, fall back to directory name
                  console.log('Cannot query permission state, falling back to directory name display');
                  this.fileSystemService.setDirectoryName(data.directoryName);
                }
              } else {
                this.fileSystemService.setDirectoryName(data.directoryName);
              }
            } catch (permissionError) {
              console.error('Error checking permission for handle:', permissionError);
              this.fileSystemService.setDirectoryName(data.directoryName);
            }
          } else {
            this.fileSystemService.setDirectoryName(data.directoryName);
          }
        } 
      } 
    } catch (error) {
      console.error('Error restoring directory handle:', error);
    }
  }

  /**
   * Ensure database files exist in the selected directory
   */
  private async ensureDatabaseFilesExist(): Promise<void> {
    try {
      const filesExist = await this.checkFilesExist();
      
      // If no files exist, create them
      if (!filesExist.conversations && !filesExist.apiKeys && !filesExist.metadata) {
        console.log('No database files found, creating initial files...');
        
        // Create a new database manager and initialize it
        const dbManager = await this.getOrCreateDbManager();
        
        // Write the initial database files
        await this.writeDatabaseToFile(dbManager);
        
        console.log('Initial database files created successfully');
      } else {
        console.log('Database files already exist, skipping creation');
      }
    } catch (error) {
      console.error('Failed to ensure database files exist:', error);
      throw error;
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
      user_id: this.ensureUserId(),
      create_timestamp: new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: [...PROTECTED_TAGS, ...(conversation.tags?.filter(tag => !PROTECTED_TAGS.includes(tag as any)) || [])],
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
      user_id: this.ensureUserId(), // Required for encryption
      update_timestamp: new Date().toISOString(),
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
      status: 'active',
      modelsUsed: []
    };
  }

  // Use stored modelsUsed if available, otherwise compute from interactions (lazy migration)
  // This saves computation for conversations that already have it stored
  const modelsUsed = finalData.modelsUsed && Array.isArray(finalData.modelsUsed)
    ? finalData.modelsUsed
    : extractUniqueModels(finalData.interactions || []);

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
      timestamp: interaction.timestamp,
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
      modelsUsed,
      originalPrompt
    };
  }

  private generateRequestId(userId: string, conversationId: string, operation: string): string {
    return uuidv5(`${userId}-${conversationId}-${operation}-${Date.now()}`, uuidv5.DNS);
  }

  // Context transformation methods
  private transformContextToDataPacket(context: any, profileId: string): any {
    return {
      id: context.id || crypto.randomUUID(),
      profile_id: profileId,
      user_id: this.ensureUserId(),
      create_timestamp: new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: ['FIDU-CHAT-LAB-Context', ...(context.tags || [])],
      data: {
        context_title: context.title || 'Untitled Context',
        context_body: context.body || '',
        token_count: context.tokenCount || 0
      }
    };
  }

  private transformContextToDataPacketUpdate(context: any, profileId: string): any {
    return {
      id: context.id,
      profile_id: profileId,
      user_id: this.ensureUserId(),
      create_timestamp: context.createdAt || new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: ['FIDU-CHAT-LAB-Context', ...(context.tags || [])],
      data: {
        context_title: context.title || 'Untitled Context',
        context_body: context.body || '',
        token_count: context.tokenCount || 0
      }
    };
  }

  private transformDataPacketToContext(packet: any): any {
    const data = packet.data || {};
    
    // Handle JSON string data parsing
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse context data as JSON string:', error);
        parsedData = {};
      }
    }
    
    const finalData = parsedData || {};
    
    return {
      id: packet.id,
      title: finalData.context_title || 'Untitled Context',
      body: finalData.context_body || '',
      tokenCount: finalData.token_count || 0,
      createdAt: packet.create_timestamp,
      updatedAt: packet.update_timestamp,
      isBuiltIn: false,
      tags: (packet.tags || []).filter((tag: string) => tag !== 'FIDU-CHAT-LAB-Context'),
      conversationIds: [],
      conversationMetadata: {
        totalMessages: 0,
        lastAddedAt: packet.create_timestamp,
        platforms: []
      }
    };
  }

  // System prompt transformation methods
  private transformSystemPromptToDataPacket(systemPrompt: any, profileId: string): any {
    return {
      id: systemPrompt.id || crypto.randomUUID(),
      profile_id: profileId,
      user_id: this.ensureUserId(),
      create_timestamp: new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: ['FIDU-CHAT-LAB-SystemPrompt', ...(systemPrompt.categories || [])],
      data: {
        system_prompt_name: systemPrompt.name || 'Untitled System Prompt',
        system_prompt_content: systemPrompt.content || '',
        system_prompt_description: systemPrompt.description || '',
        token_count: systemPrompt.tokenCount || 0,
        is_default: systemPrompt.isDefault || false,
        is_built_in: systemPrompt.isBuiltIn || false,
        source: systemPrompt.source || 'user'
      }
    };
  }

  private transformSystemPromptToDataPacketUpdate(systemPrompt: any, profileId: string): any {
    return {
      id: systemPrompt.id,
      profile_id: profileId,
      user_id: this.ensureUserId(),
      create_timestamp: systemPrompt.createdAt || new Date().toISOString(),
      update_timestamp: new Date().toISOString(),
      tags: ['FIDU-CHAT-LAB-SystemPrompt', ...(systemPrompt.categories || [])],
      data: {
        system_prompt_name: systemPrompt.name || 'Untitled System Prompt',
        system_prompt_content: systemPrompt.content || '',
        system_prompt_description: systemPrompt.description || '',
        token_count: systemPrompt.tokenCount || 0,
        is_default: systemPrompt.isDefault || false,
        is_built_in: systemPrompt.isBuiltIn || false,
        source: systemPrompt.source || 'user'
      }
    };
  }

  private transformDataPacketToSystemPrompt(packet: any): any {
    const data = packet.data || {};
    
    // Handle JSON string data parsing
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse system prompt data as JSON string:', error);
        parsedData = {};
      }
    }
    
    const finalData = parsedData || {};
    
    return {
      id: packet.id,
      name: finalData.system_prompt_name || 'Untitled System Prompt',
      content: finalData.system_prompt_content || '',
      description: finalData.system_prompt_description || '',
      tokenCount: finalData.token_count || 0,
      isDefault: finalData.is_default || false,
      isBuiltIn: finalData.is_built_in || false,
      source: finalData.source || 'user',
      categories: (packet.tags || []).filter((tag: string) => tag !== 'FIDU-CHAT-LAB-SystemPrompt'),
      createdAt: packet.create_timestamp,
      updatedAt: packet.update_timestamp
    };
  }

  // Helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('File system storage adapter not initialized. Please configure your storage options in Settings first.');
    }
  }
}
