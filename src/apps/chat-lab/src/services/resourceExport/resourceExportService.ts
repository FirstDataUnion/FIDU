/**
 * Resource Export Service
 * Handles exporting resources to JSON format with proper sanitization
 */

import { SystemPromptHandler } from './handlers/systemPromptHandler';
import { ContextHandler } from './handlers/contextHandler';
import { BackgroundAgentHandler } from './handlers/backgroundAgentHandler';
import { ConversationHandler } from './handlers/conversationHandler';
import { DocumentHandler } from './handlers/documentHandler';
import type {
  ResourceExport,
  ExportSelection,
  SystemPromptExport,
  ContextExport,
  BackgroundAgentExport,
  ConversationExport,
  DocumentExport,
} from './types';
import { RESOURCE_EXPORT_VERSION } from './types';
import { APP_VERSION } from '../../utils/version';
import type {
  SystemPrompt,
  Context,
  Conversation,
  MarkdownDocument,
} from '../../types';
import type { BackgroundAgent } from '../../types';

/**
 * Resource Export Service
 */
export class ResourceExportService {
  private systemPromptHandler = new SystemPromptHandler();
  private contextHandler = new ContextHandler();
  private backgroundAgentHandler = new BackgroundAgentHandler();
  private conversationHandler = new ConversationHandler();
  private documentHandler = new DocumentHandler();

  /**
   * Export selected resources to JSON format
   */
  async exportResources(
    selection: ExportSelection,
    profileId: string,
    userEmail?: string
  ): Promise<ResourceExport> {
    const resources: ResourceExport['resources'] = {};

    // Export system prompts
    if (selection.systemPromptIds && selection.systemPromptIds.length > 0) {
      const allSystemPrompts =
        await this.systemPromptHandler.getAllResources(profileId);
      const selectedSystemPrompts = allSystemPrompts.filter(
        sp => selection.systemPromptIds!.includes(sp.id) && !sp.isBuiltIn
      );

      const exportedSystemPrompts: SystemPromptExport[] = [];
      for (const prompt of selectedSystemPrompts) {
        const exported = await this.systemPromptHandler.exportResource(
          prompt,
          profileId
        );
        exportedSystemPrompts.push(exported.data as SystemPromptExport);
      }
      if (exportedSystemPrompts.length > 0) {
        resources.systemPrompts = exportedSystemPrompts;
      }
    }

    // Export contexts
    if (selection.contextIds && selection.contextIds.length > 0) {
      const allContexts = await this.contextHandler.getAllResources(profileId);
      const selectedContexts = allContexts.filter(
        ctx => selection.contextIds!.includes(ctx.id) && !ctx.isBuiltIn
      );

      const exportedContexts: ContextExport[] = [];
      for (const context of selectedContexts) {
        const exported = await this.contextHandler.exportResource(
          context,
          profileId
        );
        exportedContexts.push(exported.data as ContextExport);
      }
      if (exportedContexts.length > 0) {
        resources.contexts = exportedContexts;
      }
    }

    // Export background agents
    if (
      selection.backgroundAgentIds
      && selection.backgroundAgentIds.length > 0
    ) {
      const allAgents =
        await this.backgroundAgentHandler.getAllResources(profileId);
      const selectedAgents = allAgents.filter(
        agent =>
          selection.backgroundAgentIds!.includes(agent.id) && !agent.isSystem
      );

      const exportedAgents: BackgroundAgentExport[] = [];
      for (const agent of selectedAgents) {
        const exported = await this.backgroundAgentHandler.exportResource(
          agent,
          profileId
        );
        exportedAgents.push(exported.data as BackgroundAgentExport);
      }
      if (exportedAgents.length > 0) {
        resources.backgroundAgents = exportedAgents;
      }
    }

    // Export conversations
    if (selection.conversationIds && selection.conversationIds.length > 0) {
      const allConversations =
        await this.conversationHandler.getAllResources(profileId);
      const selectedConversations = allConversations.filter(conv =>
        selection.conversationIds!.includes(conv.id)
      );

      const exportedConversations: ConversationExport[] = [];
      for (const conversation of selectedConversations) {
        const exported = await this.conversationHandler.exportResource(
          conversation,
          profileId
        );
        exportedConversations.push(exported.data as ConversationExport);
      }
      if (exportedConversations.length > 0) {
        resources.conversations = exportedConversations;
      }
    }

    // Export documents
    if (selection.documentIds && selection.documentIds.length > 0) {
      const allDocuments =
        await this.documentHandler.getAllResources(profileId);
      const selectedDocuments = allDocuments.filter(doc =>
        selection.documentIds!.includes(doc.id)
      );

      const exportedDocuments: DocumentExport[] = [];
      for (const document of selectedDocuments) {
        const exported = await this.documentHandler.exportResource(
          document,
          profileId
        );
        exportedDocuments.push(exported.data as DocumentExport);
      }
      if (exportedDocuments.length > 0) {
        resources.documents = exportedDocuments;
      }
    }

    // Build export object
    const exportData: ResourceExport = {
      version: RESOURCE_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: userEmail,
      resources,
      metadata: {
        appVersion: APP_VERSION,
      },
    };

    return exportData;
  }

  /**
   * Download export as JSON file
   */
  downloadExport(exportData: ResourceExport, filename?: string): void {
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      filename
      || `fidu-resources-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get all available resources for selection (excluding built-in/system resources)
   */
  async getAvailableResources(profileId: string): Promise<{
    systemPrompts: SystemPrompt[];
    contexts: Context[];
    backgroundAgents: BackgroundAgent[];
    conversations: Conversation[];
    documents: MarkdownDocument[];
  }> {
    const systemPrompts =
      await this.systemPromptHandler.getAllResources(profileId);
    const contexts = await this.contextHandler.getAllResources(profileId);
    const backgroundAgents =
      await this.backgroundAgentHandler.getAllResources(profileId);
    const conversations =
      await this.conversationHandler.getAllResources(profileId);
    const documents = await this.documentHandler.getAllResources(profileId);

    return {
      systemPrompts: systemPrompts.filter(sp => !sp.isBuiltIn),
      contexts: contexts.filter(ctx => !ctx.isBuiltIn),
      backgroundAgents: backgroundAgents.filter(agent => !agent.isSystem),
      conversations: conversations,
      documents: documents,
    };
  }
}

// Singleton instance
let exportServiceInstance: ResourceExportService | null = null;

export function getResourceExportService(): ResourceExportService {
  if (!exportServiceInstance) {
    exportServiceInstance = new ResourceExportService();
  }
  return exportServiceInstance;
}
