import { fiduVaultAPIClient } from './apiClientFIDUVault';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// FIDU Vault Data Packet types for System Prompts
export interface SystemPromptDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    system_prompt_name: string;
    system_prompt_content: string;
    system_prompt_description: string;
    token_count: number;
    is_default: boolean;
    is_system: boolean;
    category?: string;
    model_compatibility?: string[];
  };
}

// Transform FIDU Vault data packet to local SystemPrompt format
const transformDataPacketToSystemPrompt = (packet: SystemPromptDataPacket): any => {
  return {
    id: packet.id,
    name: packet.data.system_prompt_name,
    content: packet.data.system_prompt_content,
    description: packet.data.system_prompt_description,
    tokenCount: packet.data.token_count || 0,
    isDefault: packet.data.is_default || false,
    isSystem: packet.data.is_system || false,
    category: packet.data.category,
    modelCompatibility: packet.data.model_compatibility || [],
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp,
    tags: packet.tags.filter(tag => tag !== 'FIDU-CHAT-LAB-SystemPrompt')
  };
};

// Transform local SystemPrompt format to FIDU Vault data packet
const transformSystemPromptToDataPacket = (systemPrompt: any, profileId: string): SystemPromptDataPacket => {
  return {
    id: systemPrompt.id || crypto.randomUUID(),
    profile_id: profileId,
    create_timestamp: systemPrompt.createdAt || new Date().toISOString(),
    update_timestamp: systemPrompt.updatedAt || new Date().toISOString(),
    tags: ["FIDU-CHAT-LAB-SystemPrompt", ...(systemPrompt.tags || [])],
    data: {
      system_prompt_name: systemPrompt.name || "Untitled System Prompt",
      system_prompt_content: systemPrompt.content || "",
      system_prompt_description: systemPrompt.description || "",
      token_count: systemPrompt.tokenCount || 0,
      is_default: systemPrompt.isDefault || false,
      is_system: systemPrompt.isSystem || false,
      category: systemPrompt.category,
      model_compatibility: systemPrompt.modelCompatibility || [],
    },
  };
};

// Factory function to create systemPrompts API with settings
export const createSystemPromptsApi = (_getApiKeyFromSettings?: () => string | undefined) => {
  return {
    getAll: async (queryParams?: any, page = 1, limit = 20, profileId?: string) => {
      try {
        const response = await fiduVaultAPIClient.get<SystemPromptDataPacket[]>('/data-packets', {
          params: {
            tags: ["FIDU-CHAT-LAB-SystemPrompt"],
            profile_id: profileId,
            limit: limit,
            offset: (page - 1) * limit,
            sort_order: "desc",
            ...queryParams
          },
          paramsSerializer: {
            serialize: (params: Record<string, any>) => {
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
            systemPrompts: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        // Check if response.data is an array
        if (!Array.isArray(response.data)) {
          console.error('Invalid response format - response.data is not an array:', response.data);
          return {
            systemPrompts: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        // Transform the API response to our local format
        const systemPrompts = response.data.map(transformDataPacketToSystemPrompt);
        
        return {
          systemPrompts,
          total: systemPrompts.length, // Note: API should provide total count
          page,
          limit
        };
      } catch (error: any) {
        console.error('Error fetching system prompts:', error);
        throw error;
      }
    },

    createSystemPrompt: async (systemPrompt: any, profileId: string) => {
      try {
        const dataPacket = transformSystemPromptToDataPacket(systemPrompt, profileId);
        const content = `${profileId}-${systemPrompt.id || dataPacket.id}-create`;
        const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace for creates
        const request_id = uuidv5(content, namespace); // Generate UUID 
        
        const dataPacketCreateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.post<SystemPromptDataPacket>('/data-packets', dataPacketCreateRequest);
        return transformDataPacketToSystemPrompt(response.data);
      } catch (error: any) {
        console.error('Error creating system prompt:', error);
        throw error;
      }
    },

    updateSystemPrompt: async (systemPrompt: any, profileId: string) => {
      try {
        if (!systemPrompt.id) {
          throw new Error('System Prompt ID is required to update system prompt');
        }
        
        const dataPacket = transformSystemPromptToDataPacket(systemPrompt, profileId);
        const request_id = uuidv4().toString();
        
        const dataPacketUpdateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.put<SystemPromptDataPacket>('/data-packets/' + systemPrompt.id, dataPacketUpdateRequest);
        return transformDataPacketToSystemPrompt(response.data);
      } catch (error: any) {
        console.error('Error updating system prompt:', error);
        throw error;
      }
    },

    deleteSystemPrompt: async (systemPromptId: string) => {
      try {
        await fiduVaultAPIClient.delete(`/data-packets/${systemPromptId}`);
        return systemPromptId;
      } catch (error: any) {
        console.error('Error deleting system prompt:', error);
        throw error;
      }
    }
  };
};

// Export default instance
export const systemPromptsApi = createSystemPromptsApi();
