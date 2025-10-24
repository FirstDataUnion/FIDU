// Built-in system prompts for FIDU Chat Lab
// These are core system prompts that are always available

import type { SystemPrompt } from '../../types';

export const builtInSystemPrompts: SystemPrompt[] = [
  {
    id: 'sys-1',
    name: 'General Assistant',
    description: 'A helpful, knowledgeable, and friendly AI assistant that can help with any task',
    content: 'You are a helpful, knowledgeable, and friendly AI assistant. You aim to be useful, accurate, and engaging in your responses. You can help with a wide variety of tasks and topics. Always be helpful and try to provide clear, accurate information.',
    tokenCount: 45,
    isDefault: true,
    isBuiltIn: true,
    source: 'built-in',
    categories: ['General'],
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString()
  }
];
