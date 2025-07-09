import { fiduCoreAPIClient } from './apiClientFIDUCore';
import { createNLPWorkbenchAPIClientWithSettings } from './apiClientNLPWorkbench';
import type { PromptDataPacket, DataPacketQueryParams, Prompt, Message } from '../../types';

const DEFAULT_WAIT_TIME_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = 1500;

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

// Factory function to create prompts API with settings
export const createPromptsApi = (getApiKeyFromSettings?: () => string | undefined) => {
  const nlpWorkbenchAPIClient = getApiKeyFromSettings 
    ? createNLPWorkbenchAPIClientWithSettings(getApiKeyFromSettings)
    : createNLPWorkbenchAPIClientWithSettings(() => undefined);

  return {
    getAll: async (queryParams?: DataPacketQueryParams, page = 1, limit = 20) => {
      try {
        const response = await fiduCoreAPIClient.get<PromptDataPacket[]>('/data-packets', {
          params: queryParams,
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
        const response = await fiduCoreAPIClient.post('/data-packets', requestPayload);

        // Transform the response back to a Prompt
        const savedDataPacket = response.data as PromptDataPacket;
        return transformDataPacketToPrompt(savedDataPacket);
      } catch (error) {
        console.error('Error saving prompt:', error);
        throw error;
      }
    },

    executePrompt: async (
      conversationMessages: Message[],
      context: any,
      prompt: string,
      selectedModel: string,
      profileId?: string
    ) => {
      if (!profileId) {
        throw new Error('Profile ID is required to execute a prompt');
      }

      // Format conversation history for the AI model
      const formatConversationHistory = (messages: Message[]): string => {
        return messages
          .filter(msg => msg.role !== 'system') // Filter out system messages for now
          .map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
          })
          .join('\n\n');
      };

      // Build the complete prompt with conversation history
      var agentPrompt = prompt
      if (context && conversationMessages.length > 0) {
        agentPrompt = `
        Given the following existing background context: ${context}

        And the following conversation history: ${formatConversationHistory(conversationMessages)}

        Answer the following prompt, keeping the existing context of the conversation in mind, 
        treating it as either a previous part of the same conversation, or just as a framing 
        for the following prompt: 

        Prompt: ${prompt}
        `
      } else if (context) {
        agentPrompt = `
        Given the following existing background context: ${context}
        
        Answer the following prompt, keeping the existing context of the conversation in mind, 
        treating it as either a previous part of the same conversation, or just as a framing 
        for the following prompt: 

        Prompt: ${prompt}
        `
      } else if (conversationMessages.length > 0) {	
        agentPrompt = `
        Given the following conversation history: ${formatConversationHistory(conversationMessages)}

        Answer the following prompt, keeping the existing context of the conversation in mind and 
        continuing the flow of the conversation:

        Prompt: ${prompt}`
      }

      var agentCallback = null;
      switch (selectedModel) {
        case "gpt-3.5-turbo":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPTGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        default:
          throw new Error(`Unsupported model: ${selectedModel}`);
      }

      const response = await nlpWorkbenchAPIClient.executeAgentAndWait(
        agentPrompt, 
        agentCallback, 
        DEFAULT_WAIT_TIME_MS,
        DEFAULT_POLL_INTERVAL_MS
      )
      
      console.log(response);

      const chatResponse = response.outputs.results[0]?.output?.result;
      
      return {
        id: `exec-${Date.now()}`,
        status: response.status,
        responses: {
          modelId: selectedModel,
          content: chatResponse,
        },
        timestamp: new Date().toISOString()
      };
    },
  };
};

// Export a default instance for backward compatibility
export const promptsApi = createPromptsApi();