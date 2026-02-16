/**
 * Resource Import Service
 * Handles importing resources from JSON format with proper re-hydration
 */

import { SystemPromptHandler } from './handlers/systemPromptHandler';
import { ContextHandler } from './handlers/contextHandler';
import { BackgroundAgentHandler } from './handlers/backgroundAgentHandler';
import { ConversationHandler } from './handlers/conversationHandler';
import { DocumentHandler } from './handlers/documentHandler';
import type {
  ResourceExport,
  ImportResult,
  IdMapping,
  ResourceType,
} from './types';
import { RESOURCE_EXPORT_VERSION } from './types';
import { getUnifiedStorageService } from '../storage/UnifiedStorageService';
import { unsyncedDataManager } from '../storage/UnsyncedDataManager';
import type { Message, SystemPrompt, Context } from '../../types';
import type { BackgroundAgent } from '../api/backgroundAgents';
import { store } from '../../store';
import { selectIsFeatureFlagEnabled } from '../../store/selectors/featureFlagsSelectors';

/**
 * Resource Import Service
 */
export class ResourceImportService {
  private systemPromptHandler = new SystemPromptHandler();
  private contextHandler = new ContextHandler();
  private backgroundAgentHandler = new BackgroundAgentHandler();
  private conversationHandler = new ConversationHandler();
  private documentHandler = new DocumentHandler();

  /**
   * Validate import file format
   */
  validateExportFormat(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid file format: not an object' };
    }

    if (!data.version) {
      return {
        valid: false,
        error: 'Invalid file format: missing version field',
      };
    }

    if (!data.resources || typeof data.resources !== 'object') {
      return {
        valid: false,
        error: 'Invalid file format: missing resources field',
      };
    }

    // Check version compatibility (for now, accept any version >= 1.0.0)
    const version = data.version;
    if (version !== RESOURCE_EXPORT_VERSION) {
      // Log warning but allow import for forward compatibility
      console.warn(
        `Import version ${version} differs from current ${RESOURCE_EXPORT_VERSION}`
      );
    }

    return { valid: true };
  }

  /**
   * Import resources from export data
   */
  async importResources(
    exportData: ResourceExport,
    profileId: string,
    userId: string,
    options?: {
      skipDuplicates?: boolean;
      renameOnConflict?: boolean;
    }
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: {
        systemPrompts: 0,
        contexts: 0,
        backgroundAgents: 0,
        conversations: 0,
        documents: 0,
      },
      errors: [],
      warnings: [],
    };

    const storage = getUnifiedStorageService();
    const idMapping: IdMapping = {};

    // Import order matters: system prompts and contexts first (for conversation references),
    // then background agents, then conversations

    // 1. Import system prompts
    if (
      exportData.resources.systemPrompts
      && exportData.resources.systemPrompts.length > 0
    ) {
      for (const exportedPrompt of exportData.resources.systemPrompts) {
        try {
          // Validate
          if (!this.systemPromptHandler.validateImport(exportedPrompt)) {
            result.errors.push({
              resourceType: 'systemPrompt',
              resourceName: exportedPrompt.name || 'Unknown',
              error: 'Invalid system prompt data',
            });
            continue;
          }

          // Check for duplicates if needed
          if (options?.skipDuplicates) {
            const existing = await storage.getSystemPrompts(
              undefined,
              1,
              1000,
              profileId
            );
            const exists = existing.systemPrompts?.some(
              (sp: SystemPrompt) =>
                sp.name === exportedPrompt.name && !sp.isBuiltIn
            );
            if (exists) {
              result.warnings.push({
                resourceType: 'systemPrompt',
                resourceName: exportedPrompt.name,
                warning: 'Skipped duplicate system prompt',
              });
              continue;
            }
          }

          // Import
          const exportable = {
            originalId: exportedPrompt.id,
            resourceType: 'systemPrompt' as ResourceType,
            data: exportedPrompt,
          };
          const imported = await this.systemPromptHandler.importResource(
            exportable,
            profileId,
            userId,
            idMapping
          );

          // Save to storage
          await storage.createSystemPrompt(imported, profileId);
          result.imported.systemPrompts++;
        } catch (error: any) {
          result.success = false;
          result.errors.push({
            resourceType: 'systemPrompt',
            resourceName: exportedPrompt.name || 'Unknown',
            error: error.message || 'Failed to import system prompt',
          });
        }
      }
    }

    // 2. Import contexts
    if (
      exportData.resources.contexts
      && exportData.resources.contexts.length > 0
    ) {
      for (const exportedContext of exportData.resources.contexts) {
        try {
          // Validate
          if (!this.contextHandler.validateImport(exportedContext)) {
            result.errors.push({
              resourceType: 'context',
              resourceName: exportedContext.title || 'Unknown',
              error: 'Invalid context data',
            });
            continue;
          }

          // Check for duplicates if needed
          if (options?.skipDuplicates) {
            const existing = await storage.getContexts(
              undefined,
              1,
              1000,
              profileId
            );
            const exists = existing.contexts?.some(
              (ctx: Context) =>
                ctx.title === exportedContext.title && !ctx.isBuiltIn
            );
            if (exists) {
              result.warnings.push({
                resourceType: 'context',
                resourceName: exportedContext.title,
                warning: 'Skipped duplicate context',
              });
              continue;
            }
          }

          // Import
          const exportable = {
            originalId: exportedContext.id,
            resourceType: 'context' as ResourceType,
            data: exportedContext,
          };
          const imported = await this.contextHandler.importResource(
            exportable,
            profileId,
            userId,
            idMapping
          );

          // Save to storage
          await storage.createContext(imported, profileId);
          result.imported.contexts++;
        } catch (error: any) {
          result.success = false;
          result.errors.push({
            resourceType: 'context',
            resourceName: exportedContext.title || 'Unknown',
            error: error.message || 'Failed to import context',
          });
        }
      }
    }

    // 3. Import documents
    if (
      exportData.resources.documents
      && exportData.resources.documents.length > 0
    ) {
      for (const exportedDocument of exportData.resources.documents) {
        try {
          // Validate
          if (!this.documentHandler.validateImport(exportedDocument)) {
            result.errors.push({
              resourceType: 'document',
              resourceName: exportedDocument.title || 'Unknown',
              error: 'Invalid document data',
            });
            continue;
          }

          // Check for duplicates if needed
          if (options?.skipDuplicates) {
            const existing = await storage.getDocuments(
              undefined,
              1,
              1000,
              profileId
            );
            const exists = existing.documents?.some(
              (doc: Document) => doc.title === exportedDocument.title
            );
            if (exists) {
              result.warnings.push({
                resourceType: 'document',
                resourceName: exportedDocument.title,
                warning: 'Skipped duplicate document',
              });
              continue;
            }
          }

          // Import document
          const exportable = {
            originalId: exportedDocument.id,
            resourceType: 'document' as ResourceType,
            data: exportedDocument,
          };
          const imported = await this.documentHandler.importResource(
            exportable,
            profileId,
            userId,
            idMapping
          );

          // Check if documents feature flag is enabled
          const state = store.getState();
          const isDocumentsEnabled = selectIsFeatureFlagEnabled(
            state,
            'documents'
          );
          if (!isDocumentsEnabled) {
            throw new Error('Documents feature is disabled');
          }

          // Save to storage
          await storage.createDocument(imported, profileId);
          result.imported.documents++;
        } catch (error: any) {
          result.success = false;
          result.errors.push({
            resourceType: 'document',
            resourceName: exportedDocument.title || 'Unknown',
            error: error.message || 'Failed to import document',
          });
        }
      }
    }

    // 4. Import background agents
    if (
      exportData.resources.backgroundAgents
      && exportData.resources.backgroundAgents.length > 0
    ) {
      for (const exportedAgent of exportData.resources.backgroundAgents) {
        try {
          // Validate
          if (!this.backgroundAgentHandler.validateImport(exportedAgent)) {
            result.errors.push({
              resourceType: 'backgroundAgent',
              resourceName: exportedAgent.name || 'Unknown',
              error: 'Invalid background agent data',
            });
            continue;
          }

          // Check for duplicates if needed
          if (options?.skipDuplicates) {
            const existing = await storage.getBackgroundAgents(
              undefined,
              1,
              1000,
              profileId
            );
            const exists = existing.backgroundAgents?.some(
              (agent: BackgroundAgent) =>
                agent.name === exportedAgent.name && !agent.isSystem
            );
            if (exists) {
              result.warnings.push({
                resourceType: 'backgroundAgent',
                resourceName: exportedAgent.name,
                warning: 'Skipped duplicate background agent',
              });
              continue;
            }
          }

          // Import
          const exportable = {
            originalId: exportedAgent.id,
            resourceType: 'backgroundAgent' as ResourceType,
            data: exportedAgent,
          };
          const imported = await this.backgroundAgentHandler.importResource(
            exportable,
            profileId,
            userId,
            idMapping
          );

          // Save to storage
          await storage.createBackgroundAgent(imported, profileId);
          result.imported.backgroundAgents++;
        } catch (error: any) {
          result.success = false;
          result.errors.push({
            resourceType: 'backgroundAgent',
            resourceName: exportedAgent.name || 'Unknown',
            error: error.message || 'Failed to import background agent',
          });
        }
      }
    }

    // 5. Import conversations (with messages)
    if (
      exportData.resources.conversations
      && exportData.resources.conversations.length > 0
    ) {
      for (const exportedConversation of exportData.resources.conversations) {
        try {
          // Validate
          if (!this.conversationHandler.validateImport(exportedConversation)) {
            result.errors.push({
              resourceType: 'conversation',
              resourceName: exportedConversation.title || 'Unknown',
              error: 'Invalid conversation data',
            });
            continue;
          }

          // Import conversation
          const exportable = {
            originalId: exportedConversation.id,
            resourceType: 'conversation' as ResourceType,
            data: exportedConversation,
          };
          const imported = await this.conversationHandler.importResource(
            exportable,
            profileId,
            userId,
            idMapping
          );

          // Extract messages from exported conversation data
          // Transform the exported messages to match the Message format
          const exportedMessages = exportedConversation.messages || [];
          const messages: Message[] = exportedMessages.map((msg, index) => ({
            id: `${imported.id}-msg-${index}`,
            conversationId: imported.id,
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp,
            platform: msg.platform || exportedConversation.platform || 'other',
            attachments: msg.attachments?.map((att, attIndex) => {
              // Convert 'other' type to 'file' for compatibility
              let attachmentType: 'file' | 'image' | 'link' | 'code' = 'file';
              if (att.type === 'image') attachmentType = 'image';
              else if (att.type === 'link') attachmentType = 'link';
              else if (att.type === 'code') attachmentType = 'code';
              // 'other' and anything else defaults to 'file'

              return {
                id: `${imported.id}-msg-${index}-att-${attIndex}`,
                name: att.name,
                type: attachmentType,
                url: att.url,
              };
            }),
            metadata: msg.metadata,
            isEdited: msg.isEdited || false,
          }));

          // Create conversation with messages
          await storage.createConversation(
            profileId,
            imported,
            messages,
            imported.originalPrompt
          );

          result.imported.conversations++;
        } catch (error: any) {
          result.success = false;
          result.errors.push({
            resourceType: 'conversation',
            resourceName: exportedConversation.title || 'Unknown',
            error: error.message || 'Failed to import conversation',
          });
        }
      }
    }

    // Mark as unsynced if in cloud mode
    try {
      unsyncedDataManager.markAsUnsynced();
    } catch {
      // Ignore if not in cloud mode
    }

    return result;
  }

  /**
   * Parse import file
   */
  async parseImportFile(file: File): Promise<ResourceExport> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          resolve(data);
        } catch {
          reject(new Error('Failed to parse JSON file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }
}

// Singleton instance
let importServiceInstance: ResourceImportService | null = null;

export function getResourceImportService(): ResourceImportService {
  if (!importServiceInstance) {
    importServiceInstance = new ResourceImportService();
  }
  return importServiceInstance;
}
