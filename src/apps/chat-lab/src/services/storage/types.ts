/**
 * Storage abstraction types for FIDU Chat Lab
 * Defines interfaces for both local and cloud storage backends
 */

import type { Conversation, Message, FilterOptions } from '../../types';

// Common response types
export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface ConversationResponse {
  conversation: Conversation;
}

// Storage mode constants
export const StorageMode = {
  LOCAL: 'local',
  CLOUD: 'cloud'
} as const;

export type StorageMode = typeof StorageMode[keyof typeof StorageMode];

// Storage adapter interface
export interface StorageAdapter {
  // Conversations
  createConversation(profileId: string, conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']): Promise<Conversation>;
  updateConversation(conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']): Promise<Conversation>;
  getConversations(filters?: FilterOptions, page?: number, limit?: number, profileId?: string): Promise<ConversationsResponse>;
  getConversationById(id: string): Promise<Conversation>;
  getMessages(conversationId: string): Promise<Message[]>;
  
  // API Keys
  getAPIKey(provider: string): Promise<string | null>;
  isAPIKeyAvailable(provider: string): Promise<boolean>;
  
  // Contexts
  getContexts(queryParams?: any, page?: number, limit?: number, profileId?: string): Promise<any>;
  createContext(context: any, profileId: string): Promise<any>;
  updateContext(context: any, profileId: string): Promise<any>;
  deleteContext(contextId: string): Promise<string>;
  
  // System Prompts (if needed)
  getSystemPrompts?(queryParams?: any, page?: number, limit?: number, profileId?: string): Promise<any>;
  createSystemPrompt?(systemPrompt: any, profileId: string): Promise<any>;
  updateSystemPrompt?(systemPrompt: any, profileId: string): Promise<any>;
  deleteSystemPrompt?(systemPromptId: string): Promise<string>;
  
  // Sync operations (for cloud mode)
  sync?(): Promise<void>;
  isOnline?(): boolean;
  
  // Initialization
  initialize(): Promise<void>;
  isInitialized(): boolean;
}

// Storage configuration
export interface StorageConfig {
  mode: StorageMode;
  localConfig?: {
    baseURL: string;
    timeout: number;
  };
  cloudConfig?: {
    googleDriveEnabled: boolean;
    syncInterval: number;
  };
}

// Storage factory interface
export interface StorageFactory {
  createAdapter(config: StorageConfig): StorageAdapter;
  getDefaultConfig(): StorageConfig;
}
