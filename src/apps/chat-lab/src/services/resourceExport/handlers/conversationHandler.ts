/**
 * Conversation Resource Handler
 * Handles export/import of conversations and their messages
 */

import { getUnifiedStorageService } from '../../storage/UnifiedStorageService';
import type {
  ResourceHandler,
  ExportableResource,
  IdMapping,
  ConversationExport,
  MessageExport,
  ResourceType,
} from '../types';
import type { Conversation } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

export class ConversationHandler implements ResourceHandler<Conversation> {
  getResourceType(): ResourceType {
    return 'conversation';
  }

  async getAllResources(profileId: string): Promise<Conversation[]> {
    const storage = getUnifiedStorageService();
    const response = await storage.getConversations(
      undefined,
      1,
      1000,
      profileId
    );
    return response.conversations || [];
  }

  async exportResource(
    resource: Conversation,
    _profileId: string
  ): Promise<ExportableResource> {
    const storage = getUnifiedStorageService();

    // Fetch messages for this conversation
    const messages = await storage.getMessages(resource.id);

    // Export messages
    const exportedMessages: MessageExport[] = messages.map(msg => ({
      id: msg.id,
      conversationId: resource.id,
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
      platform: msg.platform,
      attachments: msg.attachments?.map(att => ({
        id: att.id || `${msg.id}-${att.name}`,
        name: att.name,
        type: att.type || 'file', // Message.Attachment type is already valid
        url: att.url || '',
      })),
      metadata: msg.metadata,
      isEdited: msg.isEdited || false,
    }));

    // Export original prompt with preserved IDs (will be mapped on import)
    const exportedOriginalPrompt = resource.originalPrompt
      ? {
          promptText: resource.originalPrompt.promptText,
          contextId: resource.originalPrompt.context?.id,
          contextTitle: resource.originalPrompt.context?.title,
          contextDescription: resource.originalPrompt.context?.body,
          systemPromptIds:
            resource.originalPrompt.systemPrompts?.map(sp => sp.id)
            || (resource.originalPrompt.systemPrompt?.id
              ? [resource.originalPrompt.systemPrompt.id]
              : []),
          systemPromptContents:
            resource.originalPrompt.systemPrompts?.map(sp => sp.content)
            || (resource.originalPrompt.systemPrompt?.content
              ? [resource.originalPrompt.systemPrompt.content]
              : []),
          systemPromptNames:
            resource.originalPrompt.systemPrompts?.map(sp => sp.name)
            || (resource.originalPrompt.systemPrompt?.name
              ? [resource.originalPrompt.systemPrompt.name]
              : []),
          systemPromptId: resource.originalPrompt.systemPrompt?.id,
          systemPromptContent: resource.originalPrompt.systemPrompt?.content,
          systemPromptName: resource.originalPrompt.systemPrompt?.name,
          embellishmentIds: undefined, // Not stored in originalPrompt type
          estimatedTokens:
            resource.originalPrompt.metadata?.estimatedTokens || 0,
        }
      : undefined;

    // Sanitize conversation - remove ownership IDs and timestamps
    const exportData: ConversationExport = {
      id: resource.id, // Preserve original ID for reference resolution
      title: resource.title,
      platform: resource.platform,
      lastMessage: resource.lastMessage,
      messageCount: resource.messageCount,
      tags: resource.tags || [],
      isArchived: resource.isArchived,
      isFavorite: resource.isFavorite,
      participants: resource.participants || [],
      status: resource.status,
      modelsUsed: resource.modelsUsed,
      messages: exportedMessages,
      originalPrompt: exportedOriginalPrompt,
    };

    return {
      originalId: resource.id,
      resourceType: 'conversation',
      data: exportData,
    };
  }

  async importResource(
    exportable: ExportableResource,
    _profileId: string,
    _userId: string,
    idMapping?: IdMapping
  ): Promise<Conversation> {
    const exportData = exportable.data as ConversationExport;

    // Generate new ID for conversation
    const newConversationId = uuidv4();

    // Update ID mapping if provided
    if (idMapping) {
      idMapping[exportData.id] = newConversationId;
    }

    // Map original prompt IDs if they were imported
    let mappedOriginalPrompt: Conversation['originalPrompt'] | undefined;
    if (exportData.originalPrompt && idMapping) {
      // Map context ID
      const mappedContextId = exportData.originalPrompt.contextId
        ? idMapping[exportData.originalPrompt.contextId]
        : undefined;

      // Map system prompt IDs
      const mappedSystemPromptIds = exportData.originalPrompt.systemPromptIds
        ?.map(oldId => idMapping[oldId])
        .filter(id => id !== undefined);

      mappedOriginalPrompt = {
        promptText: exportData.originalPrompt.promptText,
        context: mappedContextId ? ({ id: mappedContextId } as any) : null,
        systemPrompts: [], // Will be populated if system prompts are imported
        systemPrompt: mappedSystemPromptIds?.[0]
          ? ({ id: mappedSystemPromptIds[0] } as any)
          : undefined,
        metadata: {
          estimatedTokens: exportData.originalPrompt.estimatedTokens || 0,
        },
      };
    }

    // Re-hydrate conversation with new ownership
    const now = new Date().toISOString();
    const imported: Conversation = {
      id: newConversationId,
      title: exportData.title,
      platform: exportData.platform,
      createdAt: now,
      updatedAt: now,
      lastMessage: exportData.lastMessage,
      messageCount: exportData.messageCount,
      tags: exportData.tags || [],
      isArchived: exportData.isArchived,
      isFavorite: exportData.isFavorite,
      participants: exportData.participants || [],
      status: exportData.status,
      modelsUsed: exportData.modelsUsed,
      originalPrompt: mappedOriginalPrompt,
    };

    return imported;
  }

  validateImport(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const required = ['id', 'title', 'platform'];
    for (const field of required) {
      if (!(field in data)) {
        return false;
      }
    }

    // Validate types
    if (typeof data.title !== 'string' || typeof data.platform !== 'string') {
      return false;
    }

    // Validate messages array if present
    if (data.messages && !Array.isArray(data.messages)) {
      return false;
    }

    return true;
  }
}
