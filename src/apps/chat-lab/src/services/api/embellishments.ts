import { fiduVaultAPIClient } from './apiClientFIDUVault';
import type { Embellishment, EmbellishmentDataPacket } from '../../types';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Transform FIDU Vault data packet to local Embellishment format
const transformDataPacketToEmbellishment = (packet: EmbellishmentDataPacket): Embellishment => {
  return {
    id: packet.id,
    name: packet.data.name,
    instructions: packet.data.instructions,
    category: packet.data.category,
    color: packet.data.color,
    isBuiltIn: false, // All embellishments from FIDU Vault are custom
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp
  };
};

// Transform local Embellishment format to FIDU Vault data packet
const transformEmbellishmentToDataPacket = (embellishment: Embellishment, profileId: string): EmbellishmentDataPacket => {
  return {
    id: embellishment.id || crypto.randomUUID(),
    profile_id: profileId,
    create_timestamp: embellishment.createdAt,
    update_timestamp: embellishment.updatedAt,
    tags: ["FIDU-CHAT-LAB-Embellishment"],
    data: {
      name: embellishment.name,
      instructions: embellishment.instructions,
      category: embellishment.category,
      color: embellishment.color
    }
  };
};

// Factory function to create embellishments API
export const createEmbellishmentsApi = () => {
  return {
    getAll: async (queryParams?: any, page = 1, limit = 20, profileId?: string) => {
      try {
        const response = await fiduVaultAPIClient.get<EmbellishmentDataPacket[]>('/data-packets', {
          params: {
            tags: ["FIDU-CHAT-LAB-Embellishment"],
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
            embellishments: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        // Check if response.data is an array
        if (!Array.isArray(response.data)) {
          console.error('Invalid response format - response.data is not an array:', response.data);
          return {
            embellishments: [],
            total: 0,
            page: 1,
            limit: 20
          };
        }

        const embellishments = response.data.map(transformDataPacketToEmbellishment);
        
        return {
          embellishments,
          total: embellishments.length, // Note: FIDU Vault doesn't provide total count in this endpoint
          page,
          limit
        };
      } catch (error) {
        console.error('Error fetching embellishments:', error);
        throw error;
      }
    },

    getById: async (id: string) => {
      try {
        const response = await fiduVaultAPIClient.get<EmbellishmentDataPacket>(`/data-packets/${id}`);
        if (!response.data) {
          throw new Error('No data received from API');
        }
        return transformDataPacketToEmbellishment(response.data);
      } catch (error) {
        console.error('Error fetching embellishment:', error);
        throw error;
      }
    },

    create: async (embellishment: Omit<Embellishment, 'id' | 'createdAt' | 'updatedAt'>, profileId: string) => {
      try {
        const embellishmentWithDefaults: Embellishment = {
          ...embellishment,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const dataPacket = transformEmbellishmentToDataPacket(embellishmentWithDefaults, profileId);
        const content = `${profileId}-${embellishmentWithDefaults.id || dataPacket.id}-create`;
        const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace for creates
        const request_id = uuidv5(content, namespace); // Generate UUID 
        
        const dataPacketCreateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.post<EmbellishmentDataPacket>('/data-packets', dataPacketCreateRequest);
        if (!response.data) {
          throw new Error('No data received from API');
        }
        return transformDataPacketToEmbellishment(response.data);
      } catch (error) {
        console.error('Error creating embellishment:', error);
        throw error;
      }
    },

    update: async (id: string, updates: Partial<Embellishment>, profileId: string) => {
      try {
        // Create a complete embellishment object with the updates
        const updatedEmbellishment: Embellishment = {
          id,
          name: updates.name || '',
          instructions: updates.instructions || '',
          category: updates.category || 'style',
          color: updates.color || '#000000',
          isBuiltIn: false, // Custom embellishments are never built-in
          createdAt: updates.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const dataPacket = transformEmbellishmentToDataPacket(updatedEmbellishment, profileId);
        const request_id = uuidv4().toString();
        const dataPacketUpdateRequest = {
          request_id,
          data_packet: dataPacket
        };
        
        const response = await fiduVaultAPIClient.put<EmbellishmentDataPacket>(`/data-packets/${id}`, dataPacketUpdateRequest);
        if (!response.data) {
          throw new Error('No data received from API');
        }
        return transformDataPacketToEmbellishment(response.data);
      } catch (error) {
        console.error('Error updating embellishment:', error);
        throw error;
      }
    },

    delete: async (id: string) => {
      try {
        await fiduVaultAPIClient.delete(`/data-packets/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting embellishment:', error);
        throw error;
      }
    }
  };
};

// Export a default instance
export const embellishmentsApi = createEmbellishmentsApi();
