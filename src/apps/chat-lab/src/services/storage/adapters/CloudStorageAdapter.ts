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

export class CloudStorageAdapter implements StorageAdapter {
  private initialized = false;
  private dbManager: BrowserSQLiteManager | null = null;

  constructor(_config: StorageConfig) {
    // Config not used in current implementation
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize the browser SQLite manager
      this.dbManager = new BrowserSQLiteManager({
        conversationsDbName: 'fidu_conversations',
        apiKeysDbName: 'fidu_api_keys'
      });

      await this.dbManager.initialize();
      this.initialized = true;
      console.log('Cloud storage adapter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cloud storage adapter:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.dbManager?.isInitialized() === true;
  }

  // Conversation operations
  async createConversation(
    profileId: string, 
    conversation: Partial<Conversation>, 
    messages: Message[], 
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    this.ensureInitialized();

    // Transform conversation to data packet format (similar to local adapter)
    const dataPacket = this.transformConversationToDataPacket(profileId, conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId(profileId, dataPacket.id, 'create');
    
    try {
      const storedPacket = await this.dbManager!.storeDataPacket(requestId, dataPacket);
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
    this.ensureInitialized();

    if (!conversation.id) {
      throw new Error('Conversation ID is required to update conversation');
    }

    // Transform conversation to data packet update format
    const dataPacket = this.transformConversationToDataPacketUpdate(conversation, messages, originalPrompt);
    
    // Generate request ID for idempotency
    const requestId = this.generateRequestId();
    
    try {
      const updatedPacket = await this.dbManager!.updateDataPacket(requestId, dataPacket);
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
    this.ensureInitialized();

    // Build query parameters
    const queryParams = {
      user_id: 'current_user', // TODO: Get from auth context
      profile_id: profileId,
      tags: filters?.tags ? ['Chat-Bot-Conversation', ...filters.tags] : ['Chat-Bot-Conversation'],
      from_timestamp: filters?.dateRange?.start,
      to_timestamp: filters?.dateRange?.end,
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: 'desc'
    };

    try {
      const dataPackets = await this.dbManager!.listDataPackets(queryParams);
      const conversations = dataPackets.map(packet => this.transformDataPacketToConversation(packet));
      
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
    this.ensureInitialized();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(id);
      return this.transformDataPacketToConversation(dataPacket);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    this.ensureInitialized();

    try {
      const dataPacket = await this.dbManager!.getDataPacketById(conversationId);
      
      if (!dataPacket.data?.interactions) {
        return [];
      }
      
      // Transform interactions to Message format
      return dataPacket.data.interactions.map((interaction: any, index: number) => ({
        id: `${conversationId}-${index}`,
        conversationId: conversationId,
        content: interaction.content,
        role: (interaction.actor.toLowerCase() === 'bot' ? 'assistant' : interaction.actor.toLowerCase()) as 'user' | 'assistant' | 'system',
        timestamp: new Date(interaction.timestamp).toISOString(),
        platform: interaction.model || dataPacket.data.sourceChatbot.toLowerCase(),
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
      const apiKey = await this.dbManager!.getAPIKeyByProvider(provider, 'current_user'); // TODO: Get from auth context
      return apiKey ? apiKey.api_key : null;
    } catch (error) {
      console.error(`Error fetching API key for provider ${provider}:`, error);
      return null;
    }
  }

  async isAPIKeyAvailable(provider: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const apiKey = await this.dbManager!.getAPIKeyByProvider(provider, 'current_user'); // TODO: Get from auth context
      return apiKey !== null;
    } catch (error) {
      console.error(`Error checking API key availability for provider ${provider}:`, error);
      return false;
    }
  }

  // Context operations - placeholder implementations
  async getContexts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async createContext(_context: any, _profileId: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async updateContext(_context: any, _profileId: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async deleteContext(_contextId: string): Promise<string> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  // System Prompt operations - placeholder implementations
  async getSystemPrompts(_queryParams?: any, _page = 1, _limit = 20, _profileId?: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async createSystemPrompt(_systemPrompt: any, _profileId: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async updateSystemPrompt(_systemPrompt: any, _profileId: string): Promise<any> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  async deleteSystemPrompt(_systemPromptId: string): Promise<string> {
    throw new Error('Cloud storage adapter not yet implemented');
  }

  // Sync operations
  async sync(): Promise<void> {
    // TODO: Implement Google Drive sync
    console.log('Cloud storage sync - not yet implemented');
  }

  isOnline(): boolean {
    // TODO: Check if Google Drive is accessible
    return navigator.onLine;
  }

  // Helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('Cloud storage adapter not initialized. Call initialize() first.');
    }
  }

  private generateRequestId(profileId?: string, packetId?: string, operation?: string): string {
    if (profileId && packetId && operation) {
      const content = `${profileId}-${packetId}-${operation}`;
      // Simple hash function for request ID generation
      return btoa(content).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
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
      user_id: 'current_user', // TODO: Get from auth context
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
          embellishmentIds: originalPrompt.embellishments?.map(emb => emb.id) || [],
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
          embellishmentIds: originalPrompt.embellishments?.map(emb => emb.id) || [],
          estimatedTokens: originalPrompt.metadata?.estimatedTokens || 0
        } : undefined
      }
    };
  }

  private transformDataPacketToConversation(packet: any): Conversation {
    // Add validation to ensure required fields exist
    if (!packet.data?.interactions?.length) {
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
    if (packet.data.originalPrompt) {
      let systemPrompts: any[] = [];
      
      if (packet.data.originalPrompt?.systemPromptIds && packet.data.originalPrompt.systemPromptIds.length > 0) {
        systemPrompts = packet.data.originalPrompt.systemPromptIds.map((id: string, index: number) => ({
          id: id,
          name: packet.data.originalPrompt.systemPromptNames?.[index] || 'Unknown',
          content: packet.data.originalPrompt.systemPromptContents?.[index] || '',
          description: '',
          tokenCount: 0,
          isDefault: false,
          isBuiltIn: true,
          source: 'user',
          categories: ['Technical'],
          createdAt: packet.create_timestamp,
          updatedAt: packet.update_timestamp
        }));
      } else if (packet.data.originalPrompt?.systemPromptId) {
        systemPrompts = [{
          id: packet.data.originalPrompt.systemPromptId,
          name: packet.data.originalPrompt.systemPromptName || 'Unknown',
          content: packet.data.originalPrompt.systemPromptContent || '',
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
        promptText: packet.data.originalPrompt.promptText,
        context: packet.data.originalPrompt.contextId ? {
          id: packet.data.originalPrompt.contextId,
          title: packet.data.originalPrompt.contextTitle || 'Unknown Context',
          body: packet.data.originalPrompt.contextDescription || '',
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
          estimatedTokens: packet.data.originalPrompt.estimatedTokens
        }
      };
    }

    return {
      id: packet.id,
      title: packet.data.conversationTitle || packet.data.conversationUrl,
      platform: packet.data.sourceChatbot.toLowerCase() as "chatgpt" | "claude" | "gemini" | "other",
      createdAt: packet.create_timestamp,
      updatedAt: packet.update_timestamp,
      lastMessage: packet.data.interactions[packet.data.interactions.length - 1].content,
      messageCount: packet.data.interactions.length,
      tags: packet.tags || [],
      isArchived: packet.data.isArchived || false,
      isFavorite: packet.data.isFavorite || false,
      participants: packet.data.participants || [],
      status: packet.data.status || 'active',
      originalPrompt
    };
  }
}
