import type { MarkdownDocument } from '../../types';
import { fiduVaultAPIClient } from './apiClientFIDUVault';

export interface DocumentDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    title: string;
    content: string;
  };
}

export interface DocumentDataPacketUpdate {
  id: string;
  tags: string[];
  data: {
    title: string;
    content: string;
  };
}

const transformDataPacketToDocument = (packet: DocumentDataPacket): MarkdownDocument => {
  return {
    id: packet.id,
    title: packet.data.title,
    content: packet.data.content,
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp,
    tags: packet.tags
  };
}

const transformDocumentToDataPacket = (document: MarkdownDocument, profileId: string): DocumentDataPacket => {
  return {
    id: document.id,
    profile_id: profileId,
    create_timestamp: document.createdAt,
    update_timestamp: document.updatedAt,
    tags: document.tags,
    data: {
      title: document.title,
      content: document.content
    }
  };
}

// TODO: Add more methods here as needed
const createDocumentsApi = () => {
    return {
        getAll: async (queryParams?: any, page = 1, limit = 20, profileId?: string) => {
            try {
                const response = await fiduVaultAPIClient.get<DocumentDataPacket[]>('/data-packets', {
                    params: {
                        tags: ["FIDU-CHAT-LAB-Document"],
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
                                        value.forEach((item) => searchParams.append(key, String(item)));
                                    } else {
                                        searchParams.append(key, String(value));
                                    }
                                }
                            });
                            return searchParams.toString();
                        }
                    }
                });
                if (!response.data) {
                    console.error('No data received from API');
                    return {
                        documents: [],
                        total: 0,
                        page: 1,
                        limit: 20
                    };
                }
                if (!Array.isArray(response.data)) {
                    console.error('Invalid response format - response.data is not an array:', response.data);
                    return {
                        documents: [],
                        total: 0,
                        page: 1,
                        limit: 20
                    };
                }
                const documents = response.data.map(transformDataPacketToDocument);
                return {
                    documents,
                    total: documents.length,
                    page,
                    limit
                };
            } catch (error) {
                console.error('Error fetching documents:', error);
                throw error;
            }
        },
    };
};

// Export default instance
export const documentsApi = createDocumentsApi();
