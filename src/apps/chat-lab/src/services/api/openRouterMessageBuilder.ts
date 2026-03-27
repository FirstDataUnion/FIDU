/**
 * Utility functions for converting ChatLab prompt structure to OpenRouter messages array format
 */

import type { Message } from '../../types';
import type { OpenRouterMessage } from '../../types/openRouter';
import type { Context } from '../../types';
import type { SystemPrompt } from '../../types';

/**
 * Helper function to safely get context content
 */
function getContextContent(ctx: Context | string | any): string {
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
}

/**
 * Merge multiple system prompts into a single system message
 */
export function mergeSystemPrompts(systemPrompts: SystemPrompt[]): string {
  if (!systemPrompts || systemPrompts.length === 0) {
    return '';
  }

  const systemPromptContent = systemPrompts
    .map(prompt => prompt.content)
    .filter(content => content && content.trim())
    .join('\n\n');

  return systemPromptContent;
}

/**
 * Format contexts for inclusion in messages
 */
export function formatContexts(contexts: Context[] | Context | any): string {
  const contextsArray = Array.isArray(contexts)
    ? contexts
    : contexts
      ? [contexts]
      : [];

  if (contextsArray.length === 0) {
    return '';
  }

  const contextContents = contextsArray
    .map(ctx => getContextContent(ctx))
    .filter(content => content && content.trim());

  if (contextContents.length === 0) {
    return '';
  }

  if (contextContents.length === 1) {
    return `Given the following existing background context: ${contextContents[0]}`;
  } else {
    // Multiple contexts - combine with clear separation
    const formattedContexts = contextContents
      .map((content, index) => `Context ${index + 1}:\n${content}`)
      .join('\n\n');
    return `Given the following existing background contexts:\n\n${formattedContexts}`;
  }
}

/**
 * Convert ChatLab prompt structure to OpenRouter messages array format
 *
 * @param systemPrompts - Array of system prompts
 * @param embellishments - Array of embellishments (additional instructions)
 * @param contexts - Context(s) to include
 * @param conversationMessages - Conversation history messages
 * @param userPrompt - Current user prompt
 * @returns Array of OpenRouter messages
 */
export function convertToOpenRouterMessages(
  systemPrompts: SystemPrompt[] = [],
  embellishments: any[] = [],
  contexts: Context[] | Context | any = [],
  conversationMessages: Message[] = [],
  userPrompt: string
): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  // 1. Build system message from system prompts, embellishments, and contexts
  const systemParts: string[] = [];

  // Add system prompts
  const systemPromptContent = mergeSystemPrompts(systemPrompts);
  if (systemPromptContent) {
    systemParts.push(systemPromptContent);
  }

  // Add embellishment instructions
  if (embellishments && embellishments.length > 0) {
    const selectedInstructions = embellishments
      .map(embellishment => embellishment.instructions)
      .filter(instruction => instruction && instruction.length > 0);

    if (selectedInstructions.length > 0) {
      systemParts.push(
        `Additional Instructions:\n${selectedInstructions.join('\n')}`
      );
    }
  }

  // Add contexts
  const contextContent = formatContexts(contexts);
  if (contextContent) {
    systemParts.push(contextContent);
  }

  // Add instruction about how to handle the prompt
  const hasContexts = contextContent.length > 0;
  if (hasContexts && conversationMessages.length > 0) {
    if (Array.isArray(contexts) && contexts.length > 1) {
      systemParts.push(
        'Answer the following prompt, keeping the existing contexts of the conversation in mind, treating them as either previous parts of the same conversation, or just as framing for the following prompt.'
      );
    } else {
      systemParts.push(
        'Answer the following prompt, keeping the existing context of the conversation in mind, treating it as either a previous part of the same conversation, or just as a framing for the following prompt.'
      );
    }
  } else if (hasContexts) {
    if (Array.isArray(contexts) && contexts.length > 1) {
      systemParts.push(
        'Answer the following prompt, keeping the existing contexts in mind.'
      );
    } else {
      systemParts.push(
        'Answer the following prompt, keeping the existing context in mind.'
      );
    }
  } else if (conversationMessages.length > 0) {
    systemParts.push(
      'Answer the following prompt, keeping the existing context of the conversation in mind and continuing the flow of the conversation.'
    );
  } else {
    systemParts.push('Answer the following prompt.');
  }

  // Create system message if we have any system content
  if (systemParts.length > 0) {
    messages.push({
      role: 'system',
      content: systemParts.join('\n\n'),
    });
  }

  // 2. Add conversation history (excluding system messages)
  const historyMessages = conversationMessages.filter(
    msg => msg.role !== 'system'
  );
  for (const msg of historyMessages) {
    // Map ChatLab roles to OpenRouter roles
    const role: 'user' | 'assistant' =
      msg.role === 'user' ? 'user' : 'assistant';
    messages.push({
      role,
      content: msg.content,
    });
  }

  // 3. Add the current user prompt
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  return messages;
}
