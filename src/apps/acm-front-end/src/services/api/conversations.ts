import { apiClient } from './apiClients';
import type { Conversation, FilterOptions, DataPacketQueryParams } from '../../types';

interface DataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    sourceChatbot: string;
    interactions: Array<{
      actor: string;
      timestamp: string;
      content: string;
      attachments: string[];
    }>;
    originalACMsUsed: string[];
    targetModelRequested: string;
    conversationUrl: string;
  };
}

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
const transformDataPacketToConversation = (packet: DataPacket): Conversation => {
  // Add validation to ensure required fields exist
  console.log('transformDataPacketToConversation packet:', packet);
  if (!packet.data?.interactions?.length) {
    console.warn('Data packet missing required fields:', packet);
    throw new Error('Invalid data packet format');
  }

  return {
    id: packet.id,
    title: packet.data.conversationUrl,
    platform: packet.data.sourceChatbot.toLowerCase() as "chatgpt" | "claude" | "gemini" | "other",
    createdAt: packet.create_timestamp, // Store as ISO string
    updatedAt: packet.update_timestamp, // Store as ISO string
    lastMessage: packet.data.interactions[packet.data.interactions.length - 1].content,
    messageCount: packet.data.interactions.length,
    tags: packet.tags || [],
    isArchived: false,
    isFavorite: false,
    participants: [],
    status: 'active'
  };
};

export const conversationsApi = {
  /**
   * Get all conversations with optional filtering and pagination
   */
  getAll: async (filters?: FilterOptions, page = 1, limit = 20) => {
    const queryParams: DataPacketQueryParams = {
      tags: ["ACM", ...(filters?.tags || [])],
      //profile_id: filters?.profile_id, We will need this eventually
      from_timestamp: filters?.dateRange?.start,
      to_timestamp: filters?.dateRange?.end,
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: "desc",
    };

    try {
      const response = await apiClient.get<DataPacket[]>('/data-packets', {
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

      // Log the response for debugging
      console.log('API Response:', response.data);

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
      const response = await apiClient.get<DataPacket>(`/data-packets/${id}`);
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
  create: async (conversation: Partial<Conversation>) => {
    throw new Error("Not implemented");
  },

  /**
   * Update an existing conversation
   */
  update: async (id: string, updates: Partial<Conversation>) => {
    throw new Error("Not implemented");
  },

  /**
   * Delete a conversation
   */
  delete: async (id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Archive a conversation
   */
  archive: async (id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Unarchive a conversation
   */
  unarchive: async (id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Toggle favorite status of a conversation
   */
  toggleFavorite: async (id: string) => {
    throw new Error("Not implemented");
  },

  /**
   * Get messages for a specific conversation
   */
  getMessages: async (conversationId: string) => {
    try {
      console.log('API getMessages called with conversationId:', conversationId);
      const response = await apiClient.get<DataPacket>(`/data-packets/${conversationId}`);
      console.log('API getMessages response:', response);
      console.log('API getMessages response.data:', response.data);
      console.log('API getMessages response.status:', response.status);
      
      if (response.status === 200 && response.data) {
        const packet = response.data;
        console.log('API getMessages packet:', packet);
        console.log('API getMessages packet.data:', packet.data);
        console.log('API getMessages packet.data?.interactions:', packet.data?.interactions);
        
        if (!packet.data?.interactions) {
          console.log('No interactions found in packet, returning empty array');
          return [];
        }
        
        // Transform interactions to Message format
        const messages = packet.data.interactions.map((interaction, index) => ({
          id: `${conversationId}-${index}`,
          conversationId: conversationId,
          content: interaction.content,
          role: interaction.actor.toLowerCase() as 'user' | 'assistant' | 'system',
          timestamp: new Date(interaction.timestamp).toISOString(),
          platform: packet.data.sourceChatbot.toLowerCase(),
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
        
        console.log('API getMessages transformed messages:', messages);
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
  addTags: async (id: string, tags: string[]) => {
    throw new Error("Not implemented");
  },

  /**
   * Remove tags from a conversation
   */
  removeTags: async (id: string, tags: string[]) => {
    throw new Error("Not implemented");
  },
}; 