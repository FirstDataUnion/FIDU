/**
 * React hook for using the unified storage service
 * Provides easy access to storage operations in React components
 */

import { useEffect, useState } from 'react';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
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
        const service = getUnifiedStorageService();
        await service.initialize();
        setIsInitialized(true);
        setStorageMode(localStorage.getItem('storage_mode') || 'local');
        setIsOnline(service.isOnline());
      } catch (error) {
        console.error('Failed to initialize storage service:', error);
      }
    };

    initializeStorage();
  }, []);

  const service = getUnifiedStorageService();
  
  return {
    // Service state
    isInitialized,
    storageMode,
    isCloudMode: storageMode === 'cloud',
    isLocalMode: storageMode === 'local',
    isOnline,
    
    // Conversation operations
    createConversation: service.createConversation.bind(service),
    updateConversation: service.updateConversation.bind(service),
    getConversations: service.getConversations.bind(service),
    getConversationById: service.getConversationById.bind(service),
    getMessages: service.getMessages.bind(service),
    
    // API Key operations
    getAPIKey: service.getAPIKey.bind(service),
    isAPIKeyAvailable: service.isAPIKeyAvailable.bind(service),
    
    // Context operations
    getContexts: service.getContexts.bind(service),
    createContext: service.createContext.bind(service),
    updateContext: service.updateContext.bind(service),
    deleteContext: (contextId: string) => service.deleteContext(contextId).then(() => contextId),
    
    // System Prompt operations
    getSystemPrompts: service.getSystemPrompts.bind(service),
    createSystemPrompt: service.createSystemPrompt.bind(service),
    updateSystemPrompt: service.updateSystemPrompt.bind(service),
    deleteSystemPrompt: service.deleteSystemPrompt.bind(service),
    
    // Sync operations
    sync: service.sync.bind(service),
  };
}
