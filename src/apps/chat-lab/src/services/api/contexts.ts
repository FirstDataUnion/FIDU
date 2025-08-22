import { fiduVaultAPIClient } from './apiClientFIDUVault';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// FIDU Vault Data Packet types for Contexts
export interface ContextDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    context_title: string;
    context_body: string;
    token_count: number;
  };
}

// Transform FIDU Vault data packet to local Context format
const transformDataPacketToContext = (packet: ContextDataPacket): any => {
  return {
    id: packet.id,
    title: packet.data.context_title,
    body: packet.data.context_body,
    tokenCount: packet.data.token_count || 0,
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp,
    tags: packet.tags.filter(tag => tag !== 'FIDU-CHAT-LAB-Context')
  };
};

// Transform local Context format to FIDU Vault data packet
const transformContextToDataPacket = (context: any, profileId: string): ContextDataPacket => {
  return {
    id: context.id || crypto.randomUUID(),
    profile_id: profileId,
    create_timestamp: context.createdAt || new Date().toISOString(),
    update_timestamp: context.updatedAt || new Date().toISOString(),
    tags: ["FIDU-CHAT-LAB-Context", ...(context.tags || [])],
    data: {
      context_title: context.title || "Untitled Context",
      context_body: context.body || "",
      token_count: context.tokenCount || 0,
    },
  };
};

// Factory function to create contexts API with settings
export const createContextsApi = (_getApiKeyFromSettings?: () => string | undefined) => {
  return {
    getAll: async (queryParams?: any, page = 1, limit = 20, profileId?: string) => {
      try {
        const response = await fiduVaultAPIClient.get<ContextDataPacket[]>('/data-packets', {
          params: {
            tags: ["FIDU-CHAT-LAB-Context"],
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
            contexts: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        // Check if response.data is an array
        if (!Array.isArray(response.data)) {
          console.error('Invalid response format - response.data is not an array:', response.data);
          return {
            contexts: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        // Transform the API response to our local format
        const contexts = response.data.map(transformDataPacketToContext);
        
        return {
          contexts,
          total: contexts.length, // Note: API should provide total count
          page,
          limit
        };
      } catch (error: any) {
        console.error('Error fetching contexts:', error);
        throw error;
      }
    },

    createContext: async (context: any, profileId: string) => {
      try {
        const dataPacket = transformContextToDataPacket(context, profileId);
        const content = `${profileId}-${context.id || dataPacket.id}-create`;
        const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace for creates
        const request_id = uuidv5(content, namespace); // Generate UUID 
        
        const dataPacketCreateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.post<ContextDataPacket>('/data-packets', dataPacketCreateRequest);
        return transformDataPacketToContext(response.data);
      } catch (error: any) {
        console.error('Error creating context:', error);
        throw error;
      }
    },

    updateContext: async (context: any, profileId: string) => {
      try {
        if (!context.id) {
          throw new Error('Context ID is required to update context');
        }
        
        const dataPacket = transformContextToDataPacket(context, profileId);
        const request_id = uuidv4().toString();
        
        const dataPacketUpdateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.put<ContextDataPacket>('/data-packets/' + context.id, dataPacketUpdateRequest);
        return transformDataPacketToContext(response.data);
      } catch (error: any) {
        console.error('Error updating context:', error);
        throw error;
      }
    },

    deleteContext: async (contextId: string) => {
      try {
        await fiduVaultAPIClient.delete(`/data-packets/${contextId}`);
        return contextId;
      } catch (error: any) {
        console.error('Error deleting context:', error);
        throw error;
      }
    }
  };
};

// Export default instance
export const contextsApi = createContextsApi();
