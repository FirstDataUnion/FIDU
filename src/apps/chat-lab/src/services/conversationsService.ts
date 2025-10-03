/**
 * Conversations Service
 * Provides conversation operations using the storage abstraction
 */

import { getUnifiedStorageService } from './storage/UnifiedStorageService';
import type { Conversation, Message, FilterOptions, ConversationsResponse } from '../types';
import { ensureProtectedTags } from '../constants/protectedTags';

export const conversationsService = {
  /**
   * Create a new conversation
   */
  async createConversation(
    profileId: string,
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    return await storage.createConversation(profileId, conversation, messages, originalPrompt);
  },

  /**
   * Update an existing conversation
   */
  async updateConversation(
    conversation: Partial<Conversation>,
    messages: Message[],
    originalPrompt?: Conversation['originalPrompt']
  ): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    return await storage.updateConversation(conversation, messages, originalPrompt);
  },

  /**
   * Get all conversations with optional filtering and pagination
   */
  async getAll(
    filters?: FilterOptions,
    page = 1,
    limit = 20,
    profileId?: string
  ): Promise<ConversationsResponse> {
    const storage = getUnifiedStorageService();
    return await storage.getConversations(filters, page, limit, profileId);
  },

  /**
   * Get a specific conversation by ID
   */
  async getById(id: string): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    return await storage.getConversationById(id);
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const storage = getUnifiedStorageService();
    return await storage.getMessages(conversationId);
  },

  /**
   * Archive a conversation
   */
  async archive(id: string): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    const conversation = await storage.getConversationById(id);
    const updatedConversation = { ...conversation, isArchived: true };
    return await storage.updateConversation(updatedConversation, [], conversation.originalPrompt);
  },

  /**
   * Unarchive a conversation
   */
  async unarchive(id: string): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    const conversation = await storage.getConversationById(id);
    const updatedConversation = { ...conversation, isArchived: false };
    return await storage.updateConversation(updatedConversation, [], conversation.originalPrompt);
  },

  /**
   * Toggle favorite status of a conversation
   */
  async toggleFavorite(id: string): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    const conversation = await storage.getConversationById(id);
    const updatedConversation = { ...conversation, isFavorite: !conversation.isFavorite };
    return await storage.updateConversation(updatedConversation, [], conversation.originalPrompt);
  },

  /**
   * Update tags for a conversation
   */
  async updateTags(id: string, tags: string[]): Promise<Conversation> {
    const storage = getUnifiedStorageService();
    const conversation = await storage.getConversationById(id);
    
    // Ensure protected tags are always included
    const updatedTags = ensureProtectedTags(tags);
    const updatedConversation = { ...conversation, tags: updatedTags };
    
    return await storage.updateConversation(updatedConversation, [], conversation.originalPrompt);
  },

  /**
   * Delete a conversation
   */
  async delete(_id: string): Promise<void> {
    // Note: This would need to be implemented in the storage adapters
    throw new Error('Delete conversation not yet implemented in storage adapters');
  }
};
