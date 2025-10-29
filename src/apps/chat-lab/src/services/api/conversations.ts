import { fiduVaultAPIClient } from './apiClientFIDUVault';
import type { Conversation, FilterOptions, DataPacketQueryParams, ConversationDataPacket, Message, ConversationDataPacketUpdate, SystemPrompt } from '../../types';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { PROTECTED_TAGS } from '../../constants/protectedTags';
import { extractUniqueModels } from '../../utils/conversationUtils';


export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationResponse {
  conversation: Conversation;
}

// Transform API data packet to local Conversation type
const transformDataPacketToConversation = (packet: ConversationDataPacket): Conversation => {
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
      status: 'active',
      modelsUsed: []
    };
  }

  // Transform original prompt data if it exists
  let originalPrompt: Conversation['originalPrompt'] | undefined;
  if (packet.data.originalPrompt) {
    // Handle multiple system prompts if available, fallback to single prompt for backward compatibility
    let systemPrompts: SystemPrompt[] = [];
    
    if (packet.data.originalPrompt?.systemPromptIds && packet.data.originalPrompt.systemPromptIds.length > 0) {
      // New format with multiple system prompts
      systemPrompts = packet.data.originalPrompt.systemPromptIds.map((id, index) => ({
        id: id,
        name: packet.data.originalPrompt!.systemPromptNames?.[index] || 'Unknown',
        content: packet.data.originalPrompt!.systemPromptContents?.[index] || '',
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
      // Backward compatibility with single system prompt
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
        isBuiltIn: false, // Custom contexts from FIDU Vault
        conversationIds: [],
        conversationMetadata: {
          totalMessages: 0,
          lastAddedAt: packet.create_timestamp,
          platforms: []
        }
      } : null,
      systemPrompts: systemPrompts,
      // Keep backward compatibility
      systemPrompt: systemPrompts.length > 0 ? systemPrompts[0] : undefined,
      metadata: {
        estimatedTokens: packet.data.originalPrompt.estimatedTokens
      }
    };
  }

  // Use stored modelsUsed if available, otherwise compute from interactions (lazy migration)
  // This saves computation for conversations that already have it stored
  const modelsUsed = packet.data.modelsUsed && Array.isArray(packet.data.modelsUsed)
    ? packet.data.modelsUsed
    : extractUniqueModels(packet.data.interactions || []);

  return {
    id: packet.id,
    title: packet.data.conversationTitle || packet.data.conversationUrl,
    platform: packet.data.sourceChatbot.toLowerCase() as "chatgpt" | "claude" | "gemini" | "other",
    createdAt: packet.create_timestamp, // Store as ISO string
    updatedAt: packet.update_timestamp, // Store as ISO string
    lastMessage: packet.data.interactions[packet.data.interactions.length - 1].content,
    messageCount: packet.data.interactions.length,
    tags: packet.tags || [],
    isArchived: packet.data.isArchived || false,
    isFavorite: packet.data.isFavorite || false,
    participants: packet.data.participants || [],
    status: packet.data.status || 'active',
    modelsUsed,
    originalPrompt
  };
};

const transformConversationToDataPacket = (profile_id: string, conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']): ConversationDataPacket => {
  // Compute modelsUsed from messages and merge with existing
  const computedModelsUsed = extractUniqueModels(messages);
  const existingModelsUsed = conversation.modelsUsed || [];
  const mergedModelsUsed = [...new Set([...existingModelsUsed, ...computedModelsUsed])];

  return {
    id: conversation.id || crypto.randomUUID(),
    profile_id: profile_id,
    create_timestamp: '',
    update_timestamp: '',
    tags: [...PROTECTED_TAGS, ...(conversation.tags?.filter(tag => !PROTECTED_TAGS.includes(tag as any)) || [])],
    data: {
      sourceChatbot: (conversation.platform || 'other').toUpperCase(),
      interactions: messages.map((message) => ({
        actor: message.role,
        timestamp: message.timestamp.toString(),
        content: message.content,
        attachments: message.attachments?.map(att => att.url || att.toString()) || [],
        // Store the model that generated this specific message
        model: message.platform || conversation.platform || 'unknown'
      })),
      targetModelRequested: conversation.platform || 'other',
      conversationUrl: 'FIDU_Chat_Lab',
      conversationTitle: conversation.title || 'Untitled Conversation',
      isArchived: conversation.isArchived || false,
      isFavorite: conversation.isFavorite || false,
      participants: conversation.participants || [],
      status: conversation.status || 'active',
      // Store modelsUsed for efficient retrieval (computed once, reused on subsequent loads)
      modelsUsed: mergedModelsUsed,
      // Include original prompt information if available
      originalPrompt: originalPrompt ? {
        promptText: originalPrompt.promptText,
        contextId: originalPrompt.context?.id,
        contextTitle: originalPrompt.context?.title,
        contextDescription: originalPrompt.context?.body,
        // Support multiple system prompts
        systemPromptIds: originalPrompt.systemPrompts?.map(sp => sp.id) || [],
        systemPromptContents: originalPrompt.systemPrompts?.map(sp => sp.content) || [],
        systemPromptNames: originalPrompt.systemPrompts?.map(sp => sp.name) || [],
        // Keep backward compatibility
        systemPromptId: originalPrompt.systemPrompt?.id || originalPrompt.systemPrompts?.[0]?.id,
        systemPromptContent: originalPrompt.systemPrompt?.content || originalPrompt.systemPrompts?.[0]?.content,
        systemPromptName: originalPrompt.systemPrompt?.name || originalPrompt.systemPrompts?.[0]?.name,
        // Store embellishment IDs
        embellishmentIds: (originalPrompt as any).embellishments?.map((emb: any) => emb.id) || [],
        estimatedTokens: originalPrompt.metadata?.estimatedTokens || 0
      } : undefined
    }
  };
};

const transformConversationToDataPacketUpdate = (conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']): ConversationDataPacketUpdate => {
  if (!conversation.id) {
    throw new Error('Conversation ID is required to update conversation');
  }
  
  // Compute modelsUsed from messages and merge with existing
  const computedModelsUsed = extractUniqueModels(messages);
  const existingModelsUsed = conversation.modelsUsed || [];
  const mergedModelsUsed = [...new Set([...existingModelsUsed, ...computedModelsUsed])];

  return {
    id: conversation.id,
    tags: conversation.tags || [], // Preserve existing tags for updates
    data: {
      sourceChatbot: (conversation.platform || 'other').toUpperCase(),
      interactions: messages.map((message) => ({
        actor: message.role,
        timestamp: message.timestamp.toString(),
        content: message.content,
        attachments: message.attachments?.map(att => att.url || att.toString()) || [],
        // Store the model that generated this specific message
        model: message.platform || conversation.platform || 'unknown'
      })),
      targetModelRequested: conversation.platform || 'other',
      conversationUrl: 'FIDU_Chat_Lab',
      conversationTitle: conversation.title || 'Untitled Conversation',
      isArchived: conversation.isArchived || false,
      isFavorite: conversation.isFavorite || false,
      participants: conversation.participants || [],
      status: conversation.status || 'active',
      // Store modelsUsed for efficient retrieval (computed once, reused on subsequent loads)
      modelsUsed: mergedModelsUsed,
      // Include original prompt information if available
      originalPrompt: originalPrompt ? {
        promptText: originalPrompt.promptText,
        contextId: originalPrompt.context?.id,
        contextTitle: originalPrompt.context?.title,
        contextDescription: originalPrompt.context?.body,
        // Support multiple system prompts
        systemPromptIds: originalPrompt.systemPrompts?.map(sp => sp.id) || [],
        systemPromptContents: originalPrompt.systemPrompts?.map(sp => sp.content) || [],
        systemPromptNames: originalPrompt.systemPrompts?.map(sp => sp.name) || [],
        // Keep backward compatibility
        systemPromptId: originalPrompt.systemPrompt?.id || originalPrompt.systemPrompts?.[0]?.id,
        systemPromptContent: originalPrompt.systemPrompt?.content || originalPrompt.systemPrompts?.[0]?.content,
        systemPromptName: originalPrompt.systemPrompt?.name || originalPrompt.systemPrompts?.[0]?.name,
        // Store embellishment IDs
        embellishmentIds: (originalPrompt as any).embellishments?.map((emb: any) => emb.id) || [],
        estimatedTokens: originalPrompt.metadata?.estimatedTokens || 0
      } : undefined
    }
  };
};

export const conversationsApi = {

  createConversation: async (profile_id: string, conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']) => {
    const dataPacket = transformConversationToDataPacket(profile_id, conversation, messages, originalPrompt);
    
    // Use the generated conversation ID from the dataPacket, not the undefined conversation.id
    const content = `${profile_id}-${dataPacket.id}-create`;
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace for creates
    const request_id = uuidv5(content, namespace); // Generate UUID 
    
    const dataPacketCreateRequest = {
      request_id,
      data_packet: dataPacket
    }
    const response = await fiduVaultAPIClient.post<ConversationDataPacket>('/data-packets', dataPacketCreateRequest);
    return transformDataPacketToConversation(response.data);
  },

  updateConversation: async (conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']) => {
    const dataPacket = transformConversationToDataPacketUpdate(conversation, messages, originalPrompt);
    // No strong need for deterministic request_id here 
    // seed one from timestamp, but i see it causing more problems than it'd fix. 
    const request_id = uuidv4().toString()
    const dataPacketUpdateRequest = {
      request_id,
      data_packet: dataPacket
    }
    const response = await fiduVaultAPIClient.put<ConversationDataPacket>('/data-packets/' + conversation.id, dataPacketUpdateRequest);
    return transformDataPacketToConversation(response.data);
  },

  /**
   * Get all conversations with optional filtering and pagination
   */
  getAll: async (filters?: FilterOptions, page = 1, limit = 20, profileId?: string) => {
    const queryParams: DataPacketQueryParams = {
      tags: ["Chat-Bot-Conversation", ...(filters?.tags || [])],
      profile_id: profileId, // Include profile_id for authenticated requests
      from_timestamp: filters?.dateRange?.start,
      to_timestamp: filters?.dateRange?.end,
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: "desc",
    };

    try {
      const response = await fiduVaultAPIClient.get<ConversationDataPacket[]>('/data-packets', {
        params: queryParams,
        paramsSerializer: {
          serialize: (params) => {
            const searchParams = new URLSearchParams();
            
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                  // Create multiple parameters with the same name for arrays
                  value.forEach(item => {
                    searchParams.append(key, String(item));
                  });
                } else {
                  searchParams.append(key, String(value));
                }
              }
            });
            
            return searchParams.toString();
          }
        }
      });

      // Check if response.data exists and has the expected structure
      if (!response.data) {
        console.error('No data received from API');
        return {
          conversations: [],
          total: 0,
          page: 1,
          limit: 20
        };
      }

      // Check if response.data is an array
      if (!Array.isArray(response.data)) {
        console.error('Invalid response format - response.data is not an array:', response.data);
        return {
          conversations: [],
          total: 0,
          page: 1,
          limit: 20
        };
      }

      // Transform the API response to our local format
      const conversations: ConversationsResponse = {
        conversations: response.data.map(transformDataPacketToConversation),
        total: response.data.length,
        page: 1,
        limit: 20
      };

      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  /**
   * Get a single conversation by ID
   */
  getById: async (id: string) => {
    try {
      const response = await fiduVaultAPIClient.get<ConversationDataPacket>(`/data-packets/${id}`);
      if (response.status === 200 && response.data) {
        return transformDataPacketToConversation(response.data);
      } else {
        throw new Error(response.message || "Failed to get conversation");
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  },

  /**
   * Create a new conversation
   */
  create: async (_conversation: Partial<Conversation>) => {
    throw new Error("Not implemented");
  },

  /**
   * Update an existing conversation
   */
  update: async (_id: string, _updates: Partial<Conversation>) => {
    throw new Error("Not implemented");
  },

  /**
   * Delete a conversation
   */
  delete: async (_id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Archive a conversation
   */
  archive: async (_id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Unarchive a conversation
   */
  unarchive: async (_id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Toggle favorite status of a conversation
   */
  toggleFavorite: async (_id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Get messages for a specific conversation
   */
  getMessages: async (conversationId: string) => {
    try {
      const response = await fiduVaultAPIClient.get<ConversationDataPacket>(`/data-packets/${conversationId}`);
      
      if (response.status === 200 && response.data) {
        const packet = response.data;
        if (!packet.data?.interactions) {
          console.log('No interactions found in packet, returning empty array');
          return [];
        }
        
        // Transform interactions to Message format
        const messages = packet.data.interactions.map((interaction, index) => ({
          id: `${conversationId}-${index}`,
          conversationId: conversationId,
          content: interaction.content,
          role: (interaction.actor.toLowerCase() === 'bot' ? 'assistant' : interaction.actor.toLowerCase()) as 'user' | 'assistant' | 'system',
          timestamp: new Date(interaction.timestamp).toISOString(),
          // Use per-message model if available, fall back to conversation-level model for backward compatibility
          platform: interaction.model || packet.data.sourceChatbot.toLowerCase(),
          metadata: {
            attachments: interaction.attachments || []
          },
          attachments: interaction.attachments?.map((attachment, attIndex) => ({
            id: `${conversationId}-${index}-${attIndex}`,
            name: attachment,
            type: 'file' as const,
            url: attachment
          })) || [],
          isEdited: false
        }));
        
        return messages;
      } else {
        console.error('API getMessages failed - response structure:', {
          status: response.status,
          hasData: !!response.data,
          responseMessage: response.message
        });
        throw new Error(response.message || "Failed to get conversation messages");
      }
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  },

  /**
   * Add tags to a conversation
   */
  addTags: async (_id: string, _tags: string[]) => {
    throw new Error("Not implemented");
  },

  /**
   * Remove tags from a conversation
   */
  removeTags: async (_id: string, _tags: string[]) => {
    throw new Error("Not implemented");
  },
}; 