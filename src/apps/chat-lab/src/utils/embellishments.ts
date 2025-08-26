import type { Embellishment } from '../types';

// Central definition of all available embellishments
export const availableEmbellishments: Embellishment[] = [
  {
    id: '1',
    name: 'Concise',
    instructions: 'Ensure this prompt is kept concise and short. Never use more than 5 bullet points. Do not go into excessive detail. Focus on the most important information only.',
    category: 'style',
    color: '#2196F3',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Friendly',
    instructions: 'Maintain a friendly, warm, and approachable tone throughout the response. Use conversational language and show empathy where appropriate.',
    category: 'tone',
    color: '#4CAF50',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Professional',
    instructions: 'Use professional, formal language suitable for business communication. Avoid casual expressions and maintain a respectful, authoritative tone.',
    category: 'tone',
    color: '#FF9800',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Creative',
    instructions: 'Approach this prompt with creativity and imagination. Think outside the box and provide innovative solutions or perspectives.',
    category: 'approach',
    color: '#9C27B0',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Detailed',
    instructions: 'Provide a comprehensive and thorough response. Include relevant details, examples, and explanations to ensure complete understanding.',
    category: 'style',
    color: '#607D8B',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Simple',
    instructions: 'Explain this in simple, easy-to-understand terms. Avoid jargon and complex language. Use clear examples and straightforward explanations.',
    category: 'style',
    color: '#795548',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper function to get embellishment by name
export const getEmbellishmentByName = (name: string): Embellishment | undefined => {
  return availableEmbellishments.find(emb => emb.name === name);
};

// Helper function to get embellishment by ID
export const getEmbellishmentById = (id: string): Embellishment | undefined => {
  return availableEmbellishments.find(emb => emb.id === id);
};

// Helper function to get built-in embellishments
export const getBuiltInEmbellishments = (): Embellishment[] => {
  return availableEmbellishments.filter(emb => emb.isBuiltIn);
};

// Helper function to get custom embellishments
export const getCustomEmbellishments = (): Embellishment[] => {
  return availableEmbellishments.filter(emb => !emb.isBuiltIn);
};
