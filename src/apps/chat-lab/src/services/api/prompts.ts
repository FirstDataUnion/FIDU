import { createNLPWorkbenchAPIClientWithSettings } from './apiClientNLPWorkbench';
import type { Message } from '../../types';

// Unified function to build the complete prompt
export const buildCompletePrompt = (
  systemPrompts: any[],
  embellishments: any[],
  contexts: any[] | any, // Accept both array and single context for backward compatibility
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

  // 4. Handle multiple contexts (backward compatible with single context)
  // Convert single context to array for processing
  const contextsArray = Array.isArray(contexts)
    ? contexts
    : contexts
      ? [contexts]
      : [];

  const contextContents = contextsArray
    .map(ctx => getContextContent(ctx))
    .filter(content => content && content.trim());

  if (contextContents.length > 0) {
    if (contextContents.length === 1) {
      agentPrompt += `Given the following existing background context: ${contextContents[0]}\n\n`;
    } else {
      // Multiple contexts - combine with clear separation
      agentPrompt += `Given the following existing background contexts:\n\n`;
      contextContents.forEach((content, index) => {
        agentPrompt += `Context ${index + 1}:\n${content}\n\n`;
      });
    }
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
  const hasContexts = contextContents.length > 0;
  if (hasContexts && conversationMessages.length > 0) {
    // Both contexts and conversation history available
    if (contextContents.length === 1) {
      agentPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind, treating it as either a previous part of the same conversation, or just as a framing for the following prompt:\n\n`;
    } else {
      agentPrompt += `Answer the following prompt, keeping the existing contexts of the conversation in mind, treating them as either previous parts of the same conversation, or just as framing for the following prompt:\n\n`;
    }
  } else if (hasContexts) {
    // Only contexts available
    if (contextContents.length === 1) {
      agentPrompt += `Answer the following prompt, keeping the existing context in mind:\n\n`;
    } else {
      agentPrompt += `Answer the following prompt, keeping the existing contexts in mind:\n\n`;
    }
  } else if (conversationMessages.length > 0) {
    // Only conversation history available
    agentPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind and continuing the flow of the conversation:\n\n`;
  } else {
    // Neither contexts nor conversation history
    agentPrompt += `Answer the following prompt:\n\n`;
  }

  // 7. Add the user's prompt
  agentPrompt += `Prompt: ${userPrompt}`;

  return agentPrompt;
};

const DEFAULT_WAIT_TIME_MS = 660000; // 11 minutes to match server timeout
const DEFAULT_POLL_INTERVAL_MS = 2000; // 2 seconds initial polling interval
const MAX_POLL_INTERVAL_MS = 3000; // 3 seconds maximum polling interval
const BACKOFF_THRESHOLD_MS = 240000; // 4 minutes - when to reach max backoff

// Factory function to create prompts API
export const createPromptsApi = () => {
  const nlpWorkbenchAPIClient = createNLPWorkbenchAPIClientWithSettings();

  return {
    executePrompt: async (
      conversationMessages: Message[],
      contexts: any[] | any, // Accept both array and single context for backward compatibility
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
        contexts,
        conversationMessages,
        prompt
      );

      let agentCallback = null;

      // Use the new centralized model execution method
      agentCallback = (input: string) =>
        nlpWorkbenchAPIClient.executeModelAgent(selectedModel, input);

      const response = await nlpWorkbenchAPIClient.executeAgentAndWait(
        agentPrompt,
        agentCallback,
        DEFAULT_WAIT_TIME_MS,
        DEFAULT_POLL_INTERVAL_MS,
        MAX_POLL_INTERVAL_MS,
        BACKOFF_THRESHOLD_MS
      );

      const resultBlock = response.outputs?.results?.[0];
      const chatResponse = resultBlock?.output?.result;
      const actualModel =
        typeof resultBlock?.actualModel === 'string'
          ? resultBlock.actualModel
          : undefined;

      return {
        id: `exec-${Date.now()}`,
        status: response.status,
        responses: {
          modelId: selectedModel,
          content: chatResponse,
          actualModel,
        },
        timestamp: new Date().toISOString(),
      };
    },
  };
};

// Export a default instance for backward compatibility
export const promptsApi = createPromptsApi();
