/**
 * Cloud storage adapter that uses Google Drive + Browser SQLite
 * This adapter implements the storage interface for cloud mode
 */

import type { 
  StorageAdapter, 
  ConversationsResponse, 
  StorageConfig 
} from '../types';
import type { Conversation, Message, FilterOptions } from '../../../types';
import { BrowserSQLiteManager } from '../database/BrowserSQLiteManager';
import { GoogleDriveAuthService, getGoogleDriveAuthService } from '../../auth/GoogleDriveAuth';
import { GoogleDriveService } from '../drive/GoogleDriveService';
import { SyncService } from '../sync/SyncService';
import { SmartAutoSyncService } from '../sync/SmartAutoSyncService';
import { unsyncedDataManager } from '../UnsyncedDataManager';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { PROTECTED_TAGS } from '../../../constants/protectedTags';

export class CloudStorageAdapter implements StorageAdapter {
  private initialized = false;
  private dbManager: BrowserSQLiteManager | null = null;
  private authService: GoogleDriveAuthService | null = null;
  private driveService: GoogleDriveService | null = null;
  private syncService: SyncService | null = null;
  private smartAutoSyncService: SmartAutoSyncService | null = null;
  private userId: string | null = null;

  constructor(_config: StorageConfig) {
    // Config not used in current implementation
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.isFullyInitialized()) {
        return;
      } 
      
      // Reset if not fully initialized
      if (this.authService?.isAuthenticated()) {
        this.initialized = false;
      } else {
        this.initialized = false;
      }
    }

    try {
      // Initialize Google Drive authentication
      this.authService = await getGoogleDriveAuthService();
      await this.authService.initialize();

      if (!this.authService.isAuthenticated()) {
        this.initialized = true;
        return;
      }

      // User is authenticated, proceed with full initialization
      await this.initializeWithAuthentication();
      this.initialized = true;
      
    } catch (error) {
      console.error('Failed to initialize cloud storage adapter:', error);
      this.initialized = true;
    }
  }

  private async initializeWithAuthentication(): Promise<void> {
    // Initialize the browser SQLite manager with encryption enabled
    this.dbManager = new BrowserSQLiteManager({
      conversationsDbName: 'fidu_conversations',
      apiKeysDbName: 'fidu_api_keys',
      enableEncryption: true
    });

    await this.dbManager.initialize();

    // Initialize Google Drive service
    this.driveService = new GoogleDriveService(this.authService!);
    await this.driveService.initialize();

    // Initialize sync service
    this.syncService = new SyncService(
      this.dbManager,
      this.driveService,
      this.authService!,
      15 * 60 * 1000 // 15 minutes sync interval (not used by smart auto-sync)
    );
    await this.syncService.initialize();
    
    // Initialize smart auto-sync service with settings from localStorage
    const settings = this.loadSettingsFromStorage();
    const delayMinutes = settings?.syncSettings?.autoSyncDelayMinutes || 5;
    
    this.smartAutoSyncService = new SmartAutoSyncService(this.syncService, {
      delayMinutes,               // Use setting from localStorage or default to 5 minutes
      maxRetries: 3,            // Max 3 retry attempts
      retryDelayMinutes: 10     // Wait 10 minutes between retries
    });
    
    // Perform initial sync from Google Drive
    try {
      await this.syncService.syncFromDrive();
    } catch (error) {
      console.error('Initial sync failed, continuing with empty database:', error);
    }
    
    // Enable smart auto-sync
    this.smartAutoSyncService.enable();

    // Ensure database is ready
    if (!this.dbManager?.isInitialized()) {
      await this.dbManager!.initialize();
    }
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
      // Auto-generate a user ID for cloud mode if none is set
      // This can happen during mode switching before the hook sets the user ID
      const STORAGE_KEY = 'fidu-cloud-user-id';
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

  isFullyInitialized(): boolean {
    const dbValid = this.dbManager?.isInitialized() === true;
    const authValid = this.isAuthenticated() === true;
    const initValid = this.initialized === true;
    
    return initValid && dbValid && authValid;
  }

  isAuthenticated(): boolean {
    return this.authService?.isAuthenticated() ?? false;
  }

  // Conversation operations
  async createConversation(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    await this.ensureAuthenticated();

    // Transform conversation to data packet format (similar to local adapter)
    const dataPacket = this.transformConversationToDataPacket(profileId, conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId(profileId, dataPacket.id, 'create');
    
    try {
      const storedPacket = await this.dbManager!.storeDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we created new local data
      unsyncedDataManager.markAsUnsynced();
      
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
    await this.ensureAuthenticated();

    if (!conversation.id) {
      throw new Error('Conversation ID is required to update conversation');
    }

    // Transform conversation to data packet update format
    const dataPacket = this.transformConversationToDataPacketUpdate(conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId();
    
    try {
      const updatedPacket = await this.dbManager!.updateDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we updated local data
      unsyncedDataManager.markAsUnsynced();
      
      return this.transformDataPacketToConversation(updatedPacket);
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
    await this.ensureAuthenticated();

    // Build query parameters
    const queryParams = {
      user_id: this.ensureUserId(),
      profile_id: profileId,
      tags: filters?.tags ? [...PROTECTED_TAGS, ...filters.tags] : [...PROTECTED_TAGS],
      from_timestamp: filters?.dateRange?.start,
      to_timestamp: filters?.dateRange?.end,
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: 'desc'
    };

    try {
      const dataPackets = await this.dbManager!.listDataPackets(queryParams);
      const conversations = dataPackets.map((packet: any) => this.transformDataPacketToConversation(packet));
      
      return {
        conversations,
        total: conversations.length, // TODO: Implement proper count query
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversationById(id: string): Promise<Conversation> {
    await this.ensureAuthenticated();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(id);
      return this.transformDataPacketToConversation(dataPacket);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    await this.ensureAuthenticated();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(conversationId);
      
      // Ensure data object exists and provides defaults
      const data = dataPacket.data || {};
      
      // Defensive parsing: if data is a string waiting to be parsed, parse it
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (error) {
          console.warn('Failed to parse message data as JSON string:', error);
          parsedData = {};
        }
      }
      
      // Ensure object from any source, even if null
      const finalData = parsedData || {};
      
      if (!finalData.interactions || !Array.isArray(finalData.interactions)) {
        return [];
      }
      
      // Transform interactions to Message format
      return finalData.interactions.map((interaction: any, index: number) => ({
        id: `${conversationId}-${index}`,
        conversationId: conversationId,
        content: interaction.content || '',
        role: (interaction.actor?.toLowerCase() === 'bot' ? 'assistant' : interaction.actor?.toLowerCase()) as 'user' | 'assistant' | 'system',
        timestamp: new Date(interaction.timestamp).toISOString(),
        platform: interaction.model || finalData.sourceChatbot?.toLowerCase() || 'other',
        metadata: {
          attachments: interaction.attachments || []
        },
        attachments: interaction.attachments?.map((attachment: string, attIndex: number) => ({
          id: `${conversationId}-${index}-${attIndex}`,
          name: attachment,
          type: 'file' as const,
          url: attachment
        })) || [],
        isEdited: false
      }));
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  // API Key operations
  async getAPIKey(provider: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      const apiKey = await this.dbManager!.getAPIKeyByProvider(provider, this.ensureUserId());
      if (apiKey && apiKey.api_key) {
        const keyPreview = apiKey.api_key.substring(0, 10) + '...';
        console.log(`🔑 [CloudStorageAdapter] Found API key for provider: ${provider}, key preview: ${keyPreview}`);
        return apiKey.api_key;
      } else {
        console.info(`ℹ️ [CloudStorageAdapter] No API key configured for provider: ${provider}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching API key for provider ${provider}:`, error);
      return null;
    }
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const apiKey = await this.dbManager!.getAPIKeyByProvider(provider, this.ensureUserId());
      const available = apiKey !== null;
      console.log(`🔑 [CloudStorageAdapter] API key availability for ${provider}: ${available ? 'Available' : 'Not configured'}`);
      return available;
    } catch (error) {
      console.error(`Error checking API key availability for provider ${provider}:`, error);
      return false;
    }
  }

  async getAllAPIKeys(): Promise<any[]> {
    this.ensureInitialized();

    try {
      const apiKeys = await this.dbManager!.getAllAPIKeys(this.ensureUserId());
      console.log(`🔑 [CloudStorageAdapter] Retrieved ${apiKeys.length} API keys`);
      return apiKeys;
    } catch (error) {
      console.error('Error fetching all API keys:', error);
      return [];
    }
  }

  async saveAPIKey(provider: string, apiKey: string): Promise<any> {
    this.ensureInitialized();

    try {
      const userId = this.ensureUserId();
      
      // Check if API key already exists for this provider
      const existingKey = await this.dbManager!.getAPIKeyByProvider(provider, userId);
      
      if (existingKey) {
        // Update existing key
        console.log(`🔑 [CloudStorageAdapter] Updating existing API key for provider: ${provider}`);
        const updated = await this.dbManager!.updateAPIKey(existingKey.id, apiKey, userId);
        
        // Mark as unsynced since we updated local data
        unsyncedDataManager.markAsUnsynced();
        
        return updated;
      } else {
        // Create new key
        console.log(`🔑 [CloudStorageAdapter] Creating new API key for provider: ${provider}`);
        const newApiKey = {
          id: crypto.randomUUID(),
          provider,
          api_key: apiKey,
          user_id: userId,
          create_timestamp: new Date().toISOString(),
          update_timestamp: new Date().toISOString()
        };
        const stored = await this.dbManager!.storeAPIKey(newApiKey);
        
        // Mark as unsynced since we created new local data
        unsyncedDataManager.markAsUnsynced();
        
        return stored;
      }
    } catch (error) {
      console.error(`Error saving API key for provider ${provider}:`, error);
      throw error;
    }
  }

  async deleteAPIKey(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      console.log(`🔑 [CloudStorageAdapter] Deleting API key with ID: ${id}`);
      await this.dbManager!.deleteAPIKey(id);
      
      // Mark as unsynced since we deleted local data
      unsyncedDataManager.markAsUnsynced();
    } catch (error) {
      console.error(`Error deleting API key with ID ${id}:`, error);
      throw error;
    }
  }

  // Context operations - implemented using data packets
  async getContexts(_queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    // Check if adapter is initialized but not necessarily authenticated
    if (!this.isInitialized()) {
      throw new Error('Cloud storage adapter not initialized. Call initialize() first.');
    }
    
    // If not authenticated, throw appropriate error
    if (!this.isAuthenticated()) {
      throw new Error('User must authenticate with Google Drive first. Please connect your Google Drive account.');
    }
    
    // Ensure fully ready
    await this.ensureFullyReady();

    const contextQueryParams = {
      user_id: this.ensureUserId(),
      profile_id: profileId,
      tags: ['FIDU-CHAT-LAB-Context'],
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: 'desc'
    };

    try {
      const dataPackets = await this.dbManager!.listDataPackets(contextQueryParams);
      const contexts = dataPackets.map((packet: any) => this.transformDataPacketToContext(packet));
      
      return {
        contexts,
        total: contexts.length,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching contexts:', error);
      throw error;
    }
  }

  async getContextById(contextId: string): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(contextId);
      return this.transformDataPacketToContext(dataPacket);
    } catch (error) {
      console.error('Error fetching context:', error);
      throw error;
    }
  }

  async createContext(context: any, profileId: string): Promise<any> {
    await this.ensureAuthenticated();

    const dataPacket = this.transformContextToDataPacket(context, profileId);
    const requestId = this.generateRequestId(profileId, dataPacket.id, 'create');
    
    try {
      const storedPacket = await this.dbManager!.storeDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we created new local data
      unsyncedDataManager.markAsUnsynced();
      
      // Ensure we have valid data packet for transformation
      const finalStoredData = (storedPacket?.id !== undefined && storedPacket?.data) ? storedPacket : dataPacket;
      
      return this.transformDataPacketToContext(finalStoredData);
    } catch (error) {
      console.error('Error creating context:', error);
      throw error;
    }
  }

  async updateContext(context: any, profileId: string): Promise<any> {
    await this.ensureAuthenticated();

    if (!context.id) {
      throw new Error('Context ID is required to update context');
    }

    const dataPacket = this.transformContextToDataPacket(context, profileId);
    const requestId = this.generateRequestId();
    
    try {
      const updatedPacket = await this.dbManager!.updateDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we updated local data
      unsyncedDataManager.markAsUnsynced();
      
      return this.transformDataPacketToContext(updatedPacket);
    } catch (error) {
      console.error('Error updating context:', error);
      throw error;
    }
  }

  async deleteContext(contextId: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.dbManager!.deleteDataPacket(contextId);
      
      // Mark as unsynced since we deleted local data
      unsyncedDataManager.markAsUnsynced();
    } catch (error) {
      console.error('Error deleting context:', error);
      throw error;
    }
  }

  // System Prompt operations - implemented using data packets
  async getSystemPrompts(_queryParams?: any, page = 1, limit = 20, profileId?: string): Promise<any> {
    await this.ensureAuthenticated();

    const systemPromptQueryParams = {
      user_id: this.ensureUserId(),
      profile_id: profileId,
      tags: ['FIDU-CHAT-LAB-SystemPrompt'],
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: 'desc'
    };

    try {
      const dataPackets = await this.dbManager!.listDataPackets(systemPromptQueryParams);
      const systemPrompts = dataPackets.map((packet: any) => this.transformDataPacketToSystemPrompt(packet));
      
      return {
        systemPrompts,
        total: systemPrompts.length,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching system prompts:', error);
      throw error;
    }
  }

  async getSystemPromptById(systemPromptId: string): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(systemPromptId);
      return this.transformDataPacketToSystemPrompt(dataPacket);
    } catch (error) {
      console.error('Error fetching system prompt:', error);
      throw error;
    }
  }

  async createSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    await this.ensureAuthenticated();

    const dataPacket = this.transformSystemPromptToDataPacket(systemPrompt, profileId);
    const requestId = this.generateRequestId(profileId, dataPacket.id, 'create');
    
    try {
      const storedPacket = await this.dbManager!.storeDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we created new local data
      unsyncedDataManager.markAsUnsynced();
      
      return this.transformDataPacketToSystemPrompt(storedPacket);
    } catch (error) {
      console.error('Error creating system prompt:', error);
      throw error;
    }
  }

  async updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any> {
    await this.ensureAuthenticated();

    if (!systemPrompt.id) {
      throw new Error('System prompt ID is required to update system prompt');
    }

    const dataPacket = this.transformSystemPromptToDataPacket(systemPrompt, profileId);
    const requestId = this.generateRequestId();
    
    try {
      const updatedPacket = await this.dbManager!.updateDataPacket(requestId, dataPacket);
      
      // Mark as unsynced since we updated local data
      unsyncedDataManager.markAsUnsynced();
      
      return this.transformDataPacketToSystemPrompt(updatedPacket);
    } catch (error) {
      console.error('Error updating system prompt:', error);
      throw error;
    }
  }

  async deleteSystemPrompt(systemPromptId: string): Promise<string> {
    await this.ensureAuthenticated();

    try {
      await this.dbManager!.deleteDataPacket(systemPromptId);
      
      // Mark as unsynced since we deleted local data
      unsyncedDataManager.markAsUnsynced();
      
      return systemPromptId;
    } catch (error) {
      console.error('Error deleting system prompt:', error);
      throw error;
    }
  }

  // Sync operations
  async sync(): Promise<void> {
    await this.ensureAuthenticated();
    
    if (this.smartAutoSyncService) {
      // User initiated sync - use force sync to bypass smart timing
      console.log('🔍 [CloudStorageAdapter] User triggered sync - forcing immediate sync');
      await this.smartAutoSyncService.forceSync();
    } else if (this.syncService) {
      // Fallback to regular sync if smart auto-sync not available
      console.log('🔍 [CloudStorageAdapter] User triggered sync - using fallback sync');
      await this.syncService.syncToDrive({ forceUpload: true });
      unsyncedDataManager.markAsSynced();
    }
  }

  /**
   * Clear all database files from Google Drive (for testing)
   */
  async clearAllCloudDatabaseFiles(): Promise<void> {
    try {
      await this.ensureAuthenticated();
      return await this.driveService!.clearAllDatabaseFiles();
    } catch (error) {
      console.error('Failed to clear cloud database files:', error);
      throw error;
    }
  }

  isOnline(): boolean {
    return true; // Web app always online
  }

  // Additional methods for Google Drive integration
  async getAuthStatus(): Promise<any> {
    if (this.authService) {
      return this.authService.getAuthStatus();
    }
    return { isAuthenticated: false, user: null, expiresAt: null };
  }

  async authenticate(): Promise<void> {
    if (this.authService) {
      await this.authService.authenticate();
      // After successful authentication, complete the initialization
      if (this.authService.isAuthenticated()) {
        if (!this.isFullyInitialized()) {
          console.log('Authentication successful, completing full initialization...');
          // Directly complete the full initialization instead of resetting
          await this.initializeWithAuthentication();
        } else {
          console.log('Authentication successful and storage already fully initialized');
        }
      }
    }
  }

  async deauthenticate(): Promise<void> {
    if (this.authService) {
      await this.authService.revokeAccess();
    }
    
    // Reset all initialization states
    this.initialized = false;
    this.dbManager = null;
    this.driveService = null;
    this.syncService = null;
    
    // Clean up smart auto-sync service
    if (this.smartAutoSyncService) {
      this.smartAutoSyncService.destroy();
      this.smartAutoSyncService = null;
    }
    
    console.log('De-authenticated from Google Drive');
  }

  async getSyncStatus(): Promise<any> {
    if (this.smartAutoSyncService) {
      const smartStatus = this.smartAutoSyncService.getStatus();
      const baseStatus = this.syncService?.getSyncStatus() || {
        lastSyncTime: null,
        syncInProgress: false,
        error: null,
        filesStatus: { conversations: false, apiKeys: false, metadata: false }
      };
      
      return {
        ...baseStatus,
        smartAutoSync: smartStatus,
        autoSyncEnabled: smartStatus.enabled
      };
    } else if (this.syncService) {
      return this.syncService.getSyncStatus();
    }
    return {
      lastSyncTime: null,
      syncInProgress: false,
      error: null,
      filesStatus: { conversations: false, apiKeys: false, metadata: false },
      autoSyncEnabled: false
    };
  }

  /**
   * Load settings from localStorage
   */
  private loadSettingsFromStorage(): any {
    try {
      const stored = localStorage.getItem('fidu-chat-lab-settings');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    return null;
  }

  /**
   * Update auto-sync configuration
   */
  updateAutoSyncConfig(config: { delayMinutes?: number }): void {
    console.log('🔍 [CloudStorageAdapter] Updating auto-sync config:', config);
    if (this.smartAutoSyncService) {
      this.smartAutoSyncService.updateConfig(config);
    } else {
      console.warn('🔍 [CloudStorageAdapter] Smart auto-sync service not available');
    }
  }

  // Helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('Cloud storage adapter not initialized. Call initialize() first.');
    }
  }

  private async ensureFullyReady(): Promise<void> {
    this.ensureInitialized();
    
    // Check authentication first
    if (!this.isAuthenticated()) {
      throw new Error('User must authenticate with Google Drive first. Please connect your Google Drive account.');
    }
    
    // Check full initialization
    if (!this.isFullyInitialized()) {
      // If not fully initialized but authenticated, try to re-complete initialization
      console.log('Cloud storage not fully initialized, attempting to complete initialization...');
      try {
        await this.initializeWithAuthentication();
      } catch (error) {
        console.error('Failed to complete initialization:', error);
        throw new Error('Cloud storage not fully initialized. Please try again.');
      }
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    // First check if we're even initialized
    if (!this.isInitialized()) {
      throw new Error('Cloud storage adapter not initialized. Call initialize() first.');
    }
    
    // If not authenticated, don't throw error immediately - let the UI handle authentication flow
    if (!this.isAuthenticated()) {
      throw new Error('User must authenticate with Google Drive first. Please connect your Google Drive account.');
    }
    
    // Ensure full readiness if authenticated
    await this.ensureFullyReady();
  }

  private generateRequestId(profileId?: string, packetId?: string, operation?: string): string {
    if (profileId && packetId && operation && operation === 'create') {
      // Use exactly the same request ID generation logic as the local storage mode
      const content = `${profileId}-${packetId}-${operation}`;
      const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace for creates (same as local mode)
      return uuidv5(content, namespace);
    }
    return crypto.randomUUID();
  }

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
        status: 'active'
      };
    }

    // Transform original prompt data if it exists
    let originalPrompt: Conversation['originalPrompt'] | undefined;
    if (finalData.originalPrompt) {
      let systemPrompts: any[] = [];
      
      if (finalData.originalPrompt?.systemPromptIds && finalData.originalPrompt.systemPromptIds.length > 0) {
        systemPrompts = finalData.originalPrompt.systemPromptIds.map((id: string, index: number) => ({
          id: id,
          name: finalData.originalPrompt.systemPromptNames?.[index] || 'Unknown',
          content: finalData.originalPrompt.systemPromptContents?.[index] || '',
          description: '',
          tokenCount: 0,
          isDefault: false,
          isBuiltIn: true,
          source: 'user',
          categories: ['Technical'],
          createdAt: packet.create_timestamp,
          updatedAt: packet.update_timestamp
        }));
      } else if (finalData.originalPrompt?.systemPromptId) {
        systemPrompts = [{
          id: finalData.originalPrompt.systemPromptId,
          name: finalData.originalPrompt.systemPromptName || 'Unknown',
          content: finalData.originalPrompt.systemPromptContent || '',
          description: '',
          tokenCount: 0,
          isDefault: false,
          isBuiltIn: true,
          source: 'user',
          categories: ['Technical'],
          createdAt: packet.create_timestamp,
          updatedAt: packet.update_timestamp
        }];
      }

      originalPrompt = {
        promptText: finalData.originalPrompt.promptText,
        context: finalData.originalPrompt.contextId ? {
          id: finalData.originalPrompt.contextId,
          title: finalData.originalPrompt.contextTitle || 'Unknown Context',
          body: finalData.originalPrompt.contextDescription || '',
          tokenCount: 0,
          createdAt: packet.create_timestamp,
          updatedAt: packet.update_timestamp,
          tags: [],
          isBuiltIn: false,
          conversationIds: [],
          conversationMetadata: {
            totalMessages: 0,
            lastAddedAt: packet.create_timestamp,
            platforms: []
          }
        } : null,
        systemPrompts: systemPrompts,
        systemPrompt: systemPrompts.length > 0 ? systemPrompts[0] : undefined,
        metadata: {
          estimatedTokens: finalData.originalPrompt.estimatedTokens
        }
      };
    }

    return {
      id: packet.id,
      title: finalData.conversationTitle || finalData.conversationUrl,
      platform: finalData.sourceChatbot?.toLowerCase() as "chatgpt" | "claude" | "gemini" | "other" || "other",
      createdAt: packet.create_timestamp,
      updatedAt: packet.update_timestamp,
      lastMessage: finalData.interactions[finalData.interactions.length - 1]?.content || '',
      messageCount: finalData.interactions.length || 0,
      tags: packet.tags || [],
      isArchived: finalData.isArchived || false,
      isFavorite: finalData.isFavorite || false,
      participants: finalData.participants || [],
      status: finalData.status || 'active',
      originalPrompt
    };
  }

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

  private transformDataPacketToContext(packet: any): any {
    const data = packet.data || {};
    
    // Handle JSON string data parsing
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse data as JSON string:', error);
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

  private transformDataPacketToSystemPrompt(packet: any): any {
    const data = packet.data || {};
    
    // Handle JSON string data parsing
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.warn('Failed to parse data as JSON string:', error);
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
}
