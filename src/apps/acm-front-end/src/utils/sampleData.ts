import type { Conversation, Message, Memory, Tag, UserSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const sampleTags: Tag[] = [
  {
    id: uuidv4(),
    name: 'AI Development',
    color: '#2196F3',
    description: 'Topics related to AI and machine learning development',
    createdAt: new Date('2024-01-15'),
    usageCount: 15,
    category: 'Technology'
  },
  {
    id: uuidv4(),
    name: 'React',
    color: '#61DAFB',
    description: 'React.js related discussions',
    createdAt: new Date('2024-01-20'),
    usageCount: 12,
    category: 'Technology'
  },
  {
    id: uuidv4(),
    name: 'TypeScript',
    color: '#3178C6',
    description: 'TypeScript programming language',
    createdAt: new Date('2024-01-25'),
    usageCount: 8,
    category: 'Technology'
  },
  {
    id: uuidv4(),
    name: 'Personal',
    color: '#FF9800',
    description: 'Personal conversations and thoughts',
    createdAt: new Date('2024-02-01'),
    usageCount: 5,
    category: 'Personal'
  },
  {
    id: uuidv4(),
    name: 'Work',
    color: '#4CAF50',
    description: 'Work-related discussions',
    createdAt: new Date('2024-02-05'),
    usageCount: 10,
    category: 'Professional'
  }
];

export const sampleConversations: Conversation[] = [
  {
    id: uuidv4(),
    title: 'Building a React TypeScript Frontend',
    platform: 'chatgpt',
    createdAt: new Date('2024-05-30'),
    updatedAt: new Date('2024-05-31'),
    lastMessage: 'Great! The ACM Manager frontend is taking shape nicely.',
    messageCount: 25,
    tags: ['React', 'TypeScript', 'AI Development'],
    isArchived: false,
    isFavorite: true,
    participants: ['user', 'ChatGPT'],
    status: 'active'
  },
  {
    id: uuidv4(),
    title: 'IndexedDB Best Practices',
    platform: 'claude',
    createdAt: new Date('2024-05-29'),
    updatedAt: new Date('2024-05-30'),
    lastMessage: 'Remember to handle database versioning carefully when upgrading schemas.',
    messageCount: 18,
    tags: ['AI Development', 'TypeScript'],
    isArchived: false,
    isFavorite: false,
    participants: ['user', 'Claude'],
    status: 'active'
  },
  {
    id: uuidv4(),
    title: 'Career Development Discussion',
    platform: 'gemini',
    createdAt: new Date('2024-05-28'),
    updatedAt: new Date('2024-05-29'),
    lastMessage: 'Focus on building projects that showcase your skills.',
    messageCount: 12,
    tags: ['Personal', 'Work'],
    isArchived: false,
    isFavorite: false,
    participants: ['user', 'Gemini'],
    status: 'active'
  },
  {
    id: uuidv4(),
    title: 'Redux Toolkit Setup',
    platform: 'chatgpt',
    createdAt: new Date('2024-05-27'),
    updatedAt: new Date('2024-05-28'),
    lastMessage: 'The store configuration looks good with proper TypeScript typing.',
    messageCount: 15,
    tags: ['React', 'TypeScript'],
    isArchived: true,
    isFavorite: false,
    participants: ['user', 'ChatGPT'],
    status: 'archived'
  }
];

export const sampleMessages: Message[] = [
  {
    id: uuidv4(),
    conversationId: sampleConversations[0].id,
    content: 'I need help building a React TypeScript frontend for managing AI conversation memories.',
    role: 'user',
    timestamp: new Date('2024-05-30T10:00:00'),
    platform: 'chatgpt',
    isEdited: false
  },
  {
    id: uuidv4(),
    conversationId: sampleConversations[0].id,
    content: 'I\'d be happy to help you build a React TypeScript frontend for managing AI conversation memories! This sounds like an interesting project. Let me break down what we\'ll need to create...',
    role: 'assistant',
    timestamp: new Date('2024-05-30T10:01:00'),
    platform: 'chatgpt',
    isEdited: false
  },
  {
    id: uuidv4(),
    conversationId: sampleConversations[1].id,
    content: 'What are the best practices for working with IndexedDB in a TypeScript application?',
    role: 'user',
    timestamp: new Date('2024-05-29T14:30:00'),
    platform: 'claude',
    isEdited: false
  },
  {
    id: uuidv4(),
    conversationId: sampleConversations[1].id,
    content: 'Here are the key best practices for working with IndexedDB in TypeScript applications...',
    role: 'assistant',
    timestamp: new Date('2024-05-29T14:31:00'),
    platform: 'claude',
    isEdited: false
  }
];

export const sampleMemories: Memory[] = [
  {
    id: uuidv4(),
    title: 'React TypeScript Project Structure',
    content: 'Organize React TypeScript projects with clear separation: components/, hooks/, services/, store/, types/, utils/. Use index.ts files for clean imports.',
    type: 'skill',
    tags: ['React', 'TypeScript'],
    conversationIds: [sampleConversations[0].id],
    createdAt: new Date('2024-05-30'),
    updatedAt: new Date('2024-05-30'),
    importance: 'high',
    isArchived: false,
    source: 'extracted',
    metadata: {
      extractedFrom: 'conversation',
      confidence: 0.9
    }
  },
  {
    id: uuidv4(),
    title: 'IndexedDB Schema Versioning',
    content: 'Always increment database version when changing schema. Handle upgrades in onupgradeneeded event. Test migrations thoroughly.',
    type: 'fact',
    tags: ['AI Development'],
    conversationIds: [sampleConversations[1].id],
    createdAt: new Date('2024-05-29'),
    updatedAt: new Date('2024-05-29'),
    importance: 'medium',
    isArchived: false,
    source: 'extracted',
    metadata: {
      extractedFrom: 'conversation',
      confidence: 0.85
    }
  },
  {
    id: uuidv4(),
    title: 'Career Focus Areas',
    content: 'Focus on building projects that demonstrate practical skills. Showcase problem-solving abilities through real-world applications.',
    type: 'goal',
    tags: ['Personal', 'Work'],
    conversationIds: [sampleConversations[2].id],
    createdAt: new Date('2024-05-28'),
    updatedAt: new Date('2024-05-28'),
    importance: 'high',
    isArchived: false,
    source: 'manual',
    metadata: {
      notes: 'Important for career development'
    }
  }
];

export const sampleSettings: UserSettings = {
  id: 'default',
  theme: 'auto',
  language: 'en',
  autoExtractMemories: true,
  notificationsEnabled: true,
  defaultPlatform: 'chatgpt',
  exportFormat: 'json',
  privacySettings: {
    shareAnalytics: false,
    autoBackup: true,
    dataRetentionDays: 365
  },
  displaySettings: {
    itemsPerPage: 20,
    showTimestamps: true,
    compactView: false,
    groupByDate: true
  }
};

export const initializeSampleData = async () => {
  // This function can be called to populate the database with sample data
  console.log('Sample data ready for initialization');
  return {
    conversations: sampleConversations,
    messages: sampleMessages,
    memories: sampleMemories,
    tags: sampleTags,
    settings: sampleSettings
  };
};

// New function to actually populate the database
export const populateDatabaseWithSampleData = async () => {
  const { dbService } = await import('../services/database');
  
  try {
    console.log('Starting sample data population...');
    
    // Insert tags first (since they're referenced by other entities)
    for (const tag of sampleTags) {
      await dbService.saveTag(tag);
    }
    console.log('✓ Sample tags inserted');
    
    // Insert conversations
    for (const conversation of sampleConversations) {
      await dbService.saveConversation(conversation);
    }
    console.log('✓ Sample conversations inserted');
    
    // Insert messages
    for (const message of sampleMessages) {
      await dbService.saveMessage(message);
    }
    console.log('✓ Sample messages inserted');
    
    // Insert memories
    for (const memory of sampleMemories) {
      await dbService.saveMemory(memory);
    }
    console.log('✓ Sample memories inserted');
    
    // Insert settings
    await dbService.saveSettings(sampleSettings);
    console.log('✓ Sample settings inserted');
    
    console.log('🎉 All sample data has been successfully populated!');
    return true;
  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    throw error;
  }
};

// Function to check if database has any data
export const isDatabaseEmpty = async () => {
  const { dbService } = await import('../services/database');
  
  try {
    const [conversations, memories, tags] = await Promise.all([
      dbService.getConversations(),
      dbService.getMemories(),
      dbService.getTags()
    ]);
    
    return conversations.length === 0 && memories.length === 0 && tags.length === 0;
  } catch (error) {
    console.error('Error checking database status:', error);
    return true; // Assume empty if we can't check
  }
}; 