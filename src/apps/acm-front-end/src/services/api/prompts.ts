import { apiClient } from './apiClients';
import type { FilterOptions, PromptDataPacket, DataPacketQueryParams, Prompt } from '../../types';

interface PromptsResponse {
	prompts: Prompt[];
	total: number;
	page: number;
	limit: number;
};

const transformDataPacketToPrompt = (packet: PromptDataPacket): Prompt => {
  // Add validation to ensure required fields exist
  
  if (!packet.data?.prompt) {
    console.warn('Data packet missing required fields:', packet);
    throw new Error('Invalid data packet format');
  }

  return {
    id: packet.id,
    title: packet.data.prompt_title,
		prompt: packet.data.prompt,
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp,
    tags: packet.tags || [],
  };
};

const transformPromptToDataPacket = (prompt: Prompt, profileId: string): {
  id: string;
  profile_id: string;
  tags: string[];
  data: {
    prompt_title: string;
    prompt: string;
  };
} => {
  // Add validation to ensure required fields exist
  if (!prompt.prompt) {
    console.warn('Prompt missing required fields:', prompt);
    throw new Error('Invalid prompt format: prompt is required');
  }

  return {
    id: prompt.id,
    profile_id: profileId,
    tags: ["ACM", "ACM-LAB-Prompt", ...(prompt.tags || [])],
    data: {
      prompt_title: prompt.title || "Untitled Prompt",
      prompt: prompt.prompt,
    },
  };
};

export const promptsApi = {

	getAll: async (filters?: FilterOptions, page = 1, limit = 20, profileId?: string) => {
		const queryParams: DataPacketQueryParams = {
			tags: ["ACM", "ACM-LAB-Prompt", ...(filters?.tags || [])],
			profile_id: profileId, // Include profile_id for authenticated requests
			limit: limit,
			offset: (page - 1) * limit,
			sort_order: "desc",
		};

		try {
			const response = await apiClient.get<PromptDataPacket[]>('/data-packets', {
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
					prompts: [],
					total: 0,
					page: 1,
					limit: 20
				};
			}

			// Transform the API response to our local format
			const prompts: PromptsResponse = {
				prompts: response.data.map(transformDataPacketToPrompt),
				total: response.data.length,
				page: page,
				limit: limit
			};

			return prompts;
		} catch (error) {
			console.error('Error fetching prompts:', error);
			throw error;
		}
	},

	savePrompt: async (prompt: Prompt, profileId?: string) => {
		if (!profileId) {
			throw new Error('Profile ID is required to save a prompt');
		}

		try {
			// Convert prompt to data packet format
			const dataPacket = transformPromptToDataPacket(prompt, profileId);
			
			// Create the request payload
			const requestPayload = {
				request_id: `save-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				data_packet: dataPacket
			};

			// Submit to the data packet API
			const response = await apiClient.post('/data-packets', requestPayload);

			// Transform the response back to a Prompt
			const savedDataPacket = response.data as PromptDataPacket;
			return transformDataPacketToPrompt(savedDataPacket);
		} catch (error) {
			console.error('Error saving prompt:', error);
			throw error;
		}
	},

	executePrompt: async (
		context: any,
		prompt: string,
		selectedModels: string[],
		profileId?: string
	) => {
		if (!profileId) {
			throw new Error('Profile ID is required to execute a prompt');
		}

		// Placeholder implementation - just log the parameters
		console.log('=== Prompt Execution Request ===');
		console.log('Context:', context);
		console.log('Prompt:', prompt);
		console.log('Selected Models:', selectedModels);
		console.log('Profile ID:', profileId);
		console.log('================================');

		// TODO: Implement actual API call to execute prompt
		// This would typically make a call to an AI service API
		// For now, we'll return a mock response
		
		return {
			id: `exec-${Date.now()}`,
			status: 'completed',
			responses: selectedModels.map(modelId => ({
				modelId,
				content: `Mock response from ${modelId} for prompt: "${prompt.substring(0, 50)}..."`
			})),
			timestamp: new Date().toISOString()
		};
	},
}