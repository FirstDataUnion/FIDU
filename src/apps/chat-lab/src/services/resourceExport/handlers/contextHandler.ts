/**
 * Context Resource Handler
 * Handles export/import of contexts
 */

import { getUnifiedStorageService } from '../../storage/UnifiedStorageService';
import type {
  ResourceHandler,
  ExportableResource,
  IdMapping,
  ContextExport,
  ResourceType,
} from '../types';
import type { Context } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

export class ContextHandler implements ResourceHandler<Context> {
  getResourceType(): ResourceType {
    return 'context';
  }

  async getAllResources(profileId: string): Promise<Context[]> {
    const storage = getUnifiedStorageService();
    const response = await storage.getContexts(undefined, 1, 1000, profileId);
    return response.contexts || [];
  }

  async exportResource(
    resource: Context,
    _profileId: string
  ): Promise<ExportableResource> {
    // Sanitize context - remove ownership IDs and timestamps
    const exportData: ContextExport = {
      id: resource.id, // Preserve original ID for reference resolution
      title: resource.title,
      body: resource.body,
      tokenCount: resource.tokenCount,
      tags: resource.tags || [],
      isBuiltIn: resource.isBuiltIn,
      conversationIds: resource.conversationIds, // Will be mapped if conversations are imported
      conversationMetadata: resource.conversationMetadata,
    };

    return {
      originalId: resource.id,
      resourceType: 'context',
      data: exportData,
    };
  }

  async importResource(
    exportable: ExportableResource,
    _profileId: string,
    _userId: string,
    idMapping?: IdMapping
  ): Promise<Context> {
    const exportData = exportable.data as ContextExport;

    // Generate new ID
    const newId = uuidv4();

    // Update ID mapping if provided
    if (idMapping) {
      idMapping[exportData.id] = newId;
    }

    // Map conversation IDs if they were also imported
    let mappedConversationIds: string[] | undefined;
    if (exportData.conversationIds && idMapping) {
      mappedConversationIds = exportData.conversationIds
        .map(oldId => idMapping[oldId])
        .filter(id => id !== undefined);
    }

    // Re-hydrate context with new ownership
    const now = new Date().toISOString();
    const imported: Context = {
      id: newId,
      title: exportData.title,
      body: exportData.body,
      tokenCount: exportData.tokenCount,
      tags: exportData.tags || [],
      isBuiltIn: false, // Always false for imported contexts
      conversationIds: mappedConversationIds,
      conversationMetadata: exportData.conversationMetadata,
      createdAt: now,
      updatedAt: now,
    };

    return imported;
  }

  validateImport(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const required = ['id', 'title', 'body'];
    for (const field of required) {
      if (!(field in data)) {
        return false;
      }
    }

    // Validate types
    if (typeof data.title !== 'string' || typeof data.body !== 'string') {
      return false;
    }

    return true;
  }
}
