/**
 * React hook for using the unified storage service
 * Provides easy access to storage operations in React components
 */

import { useEffect, useState } from 'react';
import { unifiedStorageService } from '../services/storage/UnifiedStorageService';
import type { Conversation, Message, FilterOptions } from '../types';

export interface UseStorageReturn {
  // Service state
  isInitialized: boolean;
  storageMode: string;
  isCloudMode: boolean;
  isLocalMode: boolean;
  isOnline: boolean;
  
  // Conversation operations
  createConversation: (profileId: string, conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']) => Promise<Conversation>;
  updateConversation: (conversation: Partial<Conversation>, messages: Message[], originalPrompt?: Conversation['originalPrompt']) => Promise<Conversation>;
  getConversations: (filters?: FilterOptions, page?: number, limit?: number, profileId?: string) => Promise<any>;
  getConversationById: (id: string) => Promise<Conversation>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  
  // API Key operations
  getAPIKey: (provider: string) => Promise<string | null>;
  isAPIKeyAvailable: (provider: string) => Promise<boolean>;
  
  // Context operations
  getContexts: (queryParams?: any, page?: number, limit?: number, profileId?: string) => Promise<any>;
  createContext: (context: any, profileId: string) => Promise<any>;
  updateContext: (context: any, profileId: string) => Promise<any>;
  deleteContext: (contextId: string) => Promise<string>;
  
  // System Prompt operations
  getSystemPrompts: (queryParams?: any, page?: number, limit?: number, profileId?: string) => Promise<any>;
  createSystemPrompt: (systemPrompt: any, profileId: string) => Promise<any>;
  updateSystemPrompt: (systemPrompt: any, profileId: string) => Promise<any>;
  deleteSystemPrompt: (systemPromptId: string) => Promise<string>;
  
  // Sync operations
  sync: () => Promise<void>;
}

export function useStorage(): UseStorageReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageMode, setStorageMode] = useState('local');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await unifiedStorageService.initialize();
        setIsInitialized(true);
        setStorageMode(unifiedStorageService.getStorageMode());
        setIsOnline(unifiedStorageService.isOnline());
      } catch (error) {
        console.error('Failed to initialize storage service:', error);
      }
    };

    initializeStorage();
  }, []);

  return {
    // Service state
    isInitialized,
    storageMode,
    isCloudMode: unifiedStorageService.isCloudMode(),
    isLocalMode: unifiedStorageService.isLocalMode(),
    isOnline,
    
    // Conversation operations
    createConversation: unifiedStorageService.createConversation.bind(unifiedStorageService),
    updateConversation: unifiedStorageService.updateConversation.bind(unifiedStorageService),
    getConversations: unifiedStorageService.getConversations.bind(unifiedStorageService),
    getConversationById: unifiedStorageService.getConversationById.bind(unifiedStorageService),
    getMessages: unifiedStorageService.getMessages.bind(unifiedStorageService),
    
    // API Key operations
    getAPIKey: unifiedStorageService.getAPIKey.bind(unifiedStorageService),
    isAPIKeyAvailable: unifiedStorageService.isAPIKeyAvailable.bind(unifiedStorageService),
    
    // Context operations
    getContexts: unifiedStorageService.getContexts.bind(unifiedStorageService),
    createContext: unifiedStorageService.createContext.bind(unifiedStorageService),
    updateContext: unifiedStorageService.updateContext.bind(unifiedStorageService),
    deleteContext: unifiedStorageService.deleteContext.bind(unifiedStorageService),
    
    // System Prompt operations
    getSystemPrompts: unifiedStorageService.getSystemPrompts.bind(unifiedStorageService),
    createSystemPrompt: unifiedStorageService.createSystemPrompt.bind(unifiedStorageService),
    updateSystemPrompt: unifiedStorageService.updateSystemPrompt.bind(unifiedStorageService),
    deleteSystemPrompt: unifiedStorageService.deleteSystemPrompt.bind(unifiedStorageService),
    
    // Sync operations
    sync: unifiedStorageService.sync.bind(unifiedStorageService),
  };
}
