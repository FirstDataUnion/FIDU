/**
 * System Prompt Resource Handler
 * Handles export/import of system prompts
 */

import { getUnifiedStorageService } from '../../storage/UnifiedStorageService';
import type {
  ResourceHandler,
  ExportableResource,
  IdMapping,
  SystemPromptExport,
  ResourceType,
} from '../types';
import type { SystemPrompt } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

export class SystemPromptHandler implements ResourceHandler<SystemPrompt> {
  getResourceType(): ResourceType {
    return 'systemPrompt';
  }

  async getAllResources(profileId: string): Promise<SystemPrompt[]> {
    const storage = getUnifiedStorageService();
    const response = await storage.getSystemPrompts(
      undefined,
      1,
      1000,
      profileId
    );
    return response.systemPrompts || [];
  }

  async exportResource(
    resource: SystemPrompt,
    _profileId: string
  ): Promise<ExportableResource> {
    // Sanitize system prompt - remove ownership IDs and timestamps
    const exportData: SystemPromptExport = {
      id: resource.id, // Preserve original ID for reference resolution
      name: resource.name,
      description: resource.description,
      content: resource.content,
      tokenCount: resource.tokenCount,
      isDefault: resource.isDefault,
      isBuiltIn: resource.isBuiltIn,
      source: resource.source,
      categories: resource.categories || [],
    };

    return {
      originalId: resource.id,
      resourceType: 'systemPrompt',
      data: exportData,
    };
  }

  async importResource(
    exportable: ExportableResource,
    _profileId: string,
    _userId: string,
    idMapping?: IdMapping
  ): Promise<SystemPrompt> {
    const exportData = exportable.data as SystemPromptExport;

    // Generate new ID
    const newId = uuidv4();

    // Update ID mapping if provided
    if (idMapping) {
      idMapping[exportData.id] = newId;
    }

    // Re-hydrate system prompt with new ownership
    const now = new Date().toISOString();
    const imported: SystemPrompt = {
      id: newId,
      name: exportData.name,
      description: exportData.description,
      content: exportData.content,
      tokenCount: exportData.tokenCount,
      isDefault: false, // Always false for imported prompts
      isBuiltIn: false, // Always false for imported prompts
      source: 'user', // Imported prompts are user-created
      categories: exportData.categories || [],
      createdAt: now,
      updatedAt: now,
    };

    return imported;
  }

  validateImport(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const required = ['id', 'name', 'content'];
    for (const field of required) {
      if (!(field in data)) {
        return false;
      }
    }

    // Validate types
    if (typeof data.name !== 'string' || typeof data.content !== 'string') {
      return false;
    }

    return true;
  }
}
