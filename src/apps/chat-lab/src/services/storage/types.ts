/**
 * Storage types and interfaces
 */

import type { Conversation, Message, FilterOptions } from '../../types';

export const StorageMode = {
  CLOUD: 'cloud',
} as const;

export type StorageMode = (typeof StorageMode)[keyof typeof StorageMode];

export interface StorageConfig {
  mode: StorageMode;
  baseURL?: string;
  userId?: string;
  workspaceId?: string; // Identifies active workspace
  workspaceType?: 'personal' | 'shared'; // Affects Drive folder routing
  driveFolderId?: string; // For shared workspaces (non-AppData)
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export interface StorageAdapter {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  setUserId(userId: string): void;

  // Conversation operations
  createConversation(
    profileId: string,
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation>;

  updateConversation(
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation>;

  getConversations(
    filters?: FilterOptions,
    page?: number,
    limit?: number,
    profileId?: string
  ): Promise<ConversationsResponse>;

  getConversationById(id: string): Promise<Conversation>;
  getMessages(conversationId: string): Promise<Message[]>;
  deleteConversation(conversationId: string): Promise<void>;

  // API Key operations
  getAPIKey(provider: string): Promise<string | null>;
  isAPIKeyAvailable(provider: string): Promise<boolean>;
  getAllAPIKeys(): Promise<any[]>;
  saveAPIKey(provider: string, apiKey: string): Promise<any>;
  deleteAPIKey(id: string): Promise<void>;

  // Context operations
  getContexts(
    queryParams?: any,
    page?: number,
    limit?: number,
    profileId?: string
  ): Promise<any>;
  getContextById(contextId: string): Promise<any>;
  createContext(context: any, profileId: string): Promise<any>;
  updateContext(context: any, profileId: string): Promise<any>;
  deleteContext(contextId: string): Promise<void>;

  // System Prompt operations
  getSystemPrompts(
    queryParams?: any,
    page?: number,
    limit?: number,
    profileId?: string
  ): Promise<any>;
  getSystemPromptById(systemPromptId: string): Promise<any>;
  createSystemPrompt(systemPrompt: any, profileId: string): Promise<any>;
  updateSystemPrompt(systemPrompt: any, profileId: string): Promise<any>;
  deleteSystemPrompt(systemPromptId: string): Promise<string>;

  // Sync operations
  sync(): Promise<void>;
  isOnline(): boolean;
}
