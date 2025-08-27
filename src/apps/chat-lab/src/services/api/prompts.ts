import { createNLPWorkbenchAPIClientWithSettings } from './apiClientNLPWorkbench';
import type { Message } from '../../types';

const DEFAULT_WAIT_TIME_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = 1500;

// Factory function to create prompts API
export const createPromptsApi = () => {
  const nlpWorkbenchAPIClient = createNLPWorkbenchAPIClientWithSettings();

  return {
    executePrompt: async (
      conversationMessages: Message[],
      context: any,
      prompt: string,
      selectedModel: string,
      profileId?: string,
      systemPrompt?: any,
      embellishments?: any[]
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

      // Build the complete prompt - ALWAYS include all available resources
      let agentPrompt = '';
      
      // 1. ALWAYS start with system prompt if available
      if (systemPrompt?.content) {
        agentPrompt = `${systemPrompt.content}\n\n`;
      }
      
      // 2. ALWAYS add embellishment instructions if any are selected
      if (embellishments && embellishments.length > 0) {
        const selectedInstructions = embellishments
          .map(embellishment => embellishment.instructions)
          .filter(instruction => instruction && instruction.length > 0);
        
        if (selectedInstructions.length > 0) {
          agentPrompt += `Additional Instructions:\n${selectedInstructions.join('\n')}\n\n`;
        }
      }
      
      // 3. Helper function to safely get context content
      const getContextContent = (ctx: any): string => {
        if (!ctx) {
          return '';
        }
        
        if (typeof ctx === 'string') {
          return ctx;
        }
        
        if (ctx.body && typeof ctx.body === 'string') {
          return ctx.body;
        }
        
        if (ctx.title && typeof ctx.title === 'string') {
          return ctx.title;
        }
        
        return String(ctx);
      };
      
      const contextContent = getContextContent(context);
      
      // 4. ALWAYS add context if available
      if (contextContent) {
        agentPrompt += `Given the following existing background context: ${contextContent}\n\n`;
      }
      
      // 5. ALWAYS add conversation history if available
      if (conversationMessages.length > 0) {
        const conversationHistory = formatConversationHistory(conversationMessages);
        agentPrompt += `Given the following conversation history: ${conversationHistory}\n\n`;
      }
      
      // 6. ALWAYS add the instruction and prompt
      if (contextContent && conversationMessages.length > 0) {
        // Both context and conversation history available
        agentPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind, treating it as either a previous part of the same conversation, or just as a framing for the following prompt:\n\n`;
      } else if (contextContent) {
        // Only context available
        agentPrompt += `Answer the following prompt, keeping the existing context in mind:\n\n`;
      } else if (conversationMessages.length > 0) {
        // Only conversation history available
        agentPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind and continuing the flow of the conversation:\n\n`;
      } else {
        // Neither context nor conversation history
        agentPrompt += `Answer the following prompt:\n\n`;
      }
      
      // 7. ALWAYS add the user's prompt
      agentPrompt += `Prompt: ${prompt}`;

      let agentCallback = null;
      switch (selectedModel) {
        case "gpt-3.5-turbo":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT35TurboGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-4.0-turbo":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT40TurboGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-4o":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT4oGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "claude-3-opus":
          agentCallback = nlpWorkbenchAPIClient.executeClaude3OpusGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "claude-3-sonnet":
          agentCallback = nlpWorkbenchAPIClient.executeClaude3SonnetGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "claude-3-haiku":
          agentCallback = nlpWorkbenchAPIClient.executeClaude3HaikuGeneralAgent.bind(nlpWorkbenchAPIClient);
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