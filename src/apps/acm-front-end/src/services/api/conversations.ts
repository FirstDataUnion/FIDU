import { apiClient } from './apiClients';
import type { Conversation, FilterOptions, DataPacketQueryParams } from '../../types';

interface DataPacket {
  id: string;
  user_id: string;
  timestamp: string;
  packet: {
    tags: string[];
    type: string;
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
  };
}

interface DataPacketsResponse {
  data_packets: DataPacket[];
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
  if (!packet.packet?.data?.interactions?.length) {
    console.warn('Data packet missing required fields:', packet);
    throw new Error('Invalid data packet format');
  }

  return {
    id: packet.id,
    title: packet.packet.data.conversationUrl,
    platform: packet.packet.data.sourceChatbot.toLowerCase() as "chatgpt" | "claude" | "gemini" | "other",
    createdAt: packet.timestamp, // Store as ISO string
    updatedAt: packet.timestamp, // Store as ISO string
    lastMessage: packet.packet.data.interactions[packet.packet.data.interactions.length - 1].content,
    messageCount: packet.packet.data.interactions.length,
    tags: packet.packet.tags || [],
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
      //user_id: filters?.user_id, We will need this eventually
      from_timestamp: filters?.dateRange?.start,
      to_timestamp: filters?.dateRange?.end,
      packet_type: "unstructured",
      limit: limit,
      offset: (page - 1) * limit,
      sort_order: "desc",
    };

    try {
      const response = await apiClient.get<DataPacketsResponse>('/data-packets', {
        params: queryParams,
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

      // Check if data_packets exists and is an array
      if (!Array.isArray(response.data)) {
        console.error('Invalid response format - data_packets is not an array:', response.data);
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
      const response = await apiClient.get<{ data_packet: DataPacket }>(`/data-packets/${id}`);
      if (response.status === 200 && response.data?.data_packet) {
        return transformDataPacketToConversation(response.data.data_packet);
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
        console.log('API getMessages packet.packet:', packet.packet);
        console.log('API getMessages packet.packet?.data:', packet.packet?.data);
        console.log('API getMessages packet.packet?.data?.interactions:', packet.packet?.data?.interactions);
        
        if (!packet.packet?.data?.interactions) {
          console.log('No interactions found in packet, returning empty array');
          return [];
        }
        
        // Transform interactions to Message format
        const messages = packet.packet.data.interactions.map((interaction, index) => ({
          id: `${conversationId}-${index}`,
          conversationId: conversationId,
          content: interaction.content,
          role: interaction.actor.toLowerCase() as 'user' | 'assistant' | 'system',
          timestamp: new Date(interaction.timestamp).toISOString(),
          platform: packet.packet.data.sourceChatbot.toLowerCase(),
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