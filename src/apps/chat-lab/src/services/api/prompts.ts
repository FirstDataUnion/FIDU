import { createNLPWorkbenchAPIClientWithSettings } from './apiClientNLPWorkbench';
import type { Message } from '../../types';

// Unified function to build the complete prompt
export const buildCompletePrompt = (
  systemPrompts: any[],
  embellishments: any[],
  context: any,
  conversationMessages: Message[],
  userPrompt: string
): string => {
  let agentPrompt = '';
  
  // 1. Start with system prompts if available
  if (systemPrompts && systemPrompts.length > 0) {
    const systemPromptContent = systemPrompts
      .map(prompt => prompt.content)
      .filter(content => content && content.trim())
      .join('\n\n');
    
    if (systemPromptContent) {
      agentPrompt = `${systemPromptContent}\n\n`;
    }
  }
  
  // 2. Add embellishment instructions if any are selected
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
  
  // 4. Add context if available
  if (contextContent) {
    agentPrompt += `Given the following existing background context: ${contextContent}\n\n`;
  }
  
  // 5. Add conversation history if available
  if (conversationMessages.length > 0) {
    const conversationHistory = conversationMessages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
    
    agentPrompt += `Given the following conversation history: ${conversationHistory}\n\n`;
  }
  
  // 6. Add the instruction and prompt
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
  
  // 7. Add the user's prompt
  agentPrompt += `Prompt: ${userPrompt}`;
  
  return agentPrompt;
};

const DEFAULT_WAIT_TIME_MS = 90000; // 90 seconds to match server timeout
const DEFAULT_POLL_INTERVAL_MS = 2000; // 2 seconds polling interval

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
      systemPrompts?: any[], // Changed to array to support multiple system prompts
      embellishments?: any[]
    ) => {
      if (!profileId) {
        throw new Error('Profile ID is required to execute a prompt');
      }

      // Build the complete prompt using the unified function
      const agentPrompt = buildCompletePrompt(
        systemPrompts || [],
        embellishments || [],
        context,
        conversationMessages,
        prompt
      );

      let agentCallback = null;
      switch (selectedModel) {
        // Gemini Models
        case "gemini-flash":
          agentCallback = nlpWorkbenchAPIClient.executeGeminiFlashGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gemini-pro":
          agentCallback = nlpWorkbenchAPIClient.executeGeminiProGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        // Claude Models
        case "claude-haiku":
          agentCallback = nlpWorkbenchAPIClient.executeClaudeHaikuGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "claude-sonnet":
          agentCallback = nlpWorkbenchAPIClient.executeClaudeSonnetGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        // ChatGPT Models
        case "gpt-3.5-turbo":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT35TurboGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-4.0":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT40GeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-4.0-turbo":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT40TurboGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-4.0-mini":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT40MiniGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-5.0":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT50GeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-5.0-mini":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT50MiniGeneralAgent.bind(nlpWorkbenchAPIClient);
          break;
        case "gpt-5.0-nano":
          agentCallback = nlpWorkbenchAPIClient.executeChatGPT50NanoGeneralAgent.bind(nlpWorkbenchAPIClient);
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