/**
 * Background Agent Resource Handler
 * Handles export/import of background agents
 */

import { getUnifiedStorageService } from '../../storage/UnifiedStorageService';
import type {
  ResourceHandler,
  ExportableResource,
  IdMapping,
  BackgroundAgentExport,
  ResourceType,
} from '../types';
import type { BackgroundAgent } from '../../../types';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../../../store';
import { selectIsFeatureFlagEnabled } from '../../../store/selectors/featureFlagsSelectors';

export class BackgroundAgentHandler implements ResourceHandler<BackgroundAgent> {
  getResourceType(): ResourceType {
    return 'backgroundAgent';
  }

  async getAllResources(profileId: string): Promise<BackgroundAgent[]> {
    const storage = getUnifiedStorageService();
    const response = await storage.getBackgroundAgents(
      undefined,
      1,
      1000,
      profileId
    );
    return response.backgroundAgents || [];
  }

  async exportResource(
    resource: BackgroundAgent,
    _profileId: string
  ): Promise<ExportableResource> {
    let outputDocument: { id: string; title: string } | undefined;
    if (resource.outputDocumentId) {
      const storage = getUnifiedStorageService();
      const document = await storage.getDocumentById(resource.outputDocumentId);
      outputDocument = {
        id: document.id,
        title: document.title,
      };
    }
    // Sanitize background agent - remove ownership IDs and timestamps
    const exportData: BackgroundAgentExport = {
      id: resource.id, // Preserve original ID for reference resolution
      name: resource.name,
      description: resource.description,
      enabled: resource.enabled,
      actionType: resource.actionType,
      promptTemplate: resource.promptTemplate,
      runEveryNTurns: resource.runEveryNTurns,
      verbosityThreshold: resource.verbosityThreshold,
      outputDocument: outputDocument,
      contextWindowStrategy: resource.contextWindowStrategy,
      contextParams: resource.contextParams,
      outputSchemaName: resource.outputSchemaName,
      customOutputSchema: resource.customOutputSchema,
      notifyChannel: resource.notifyChannel,
      isSystem: resource.isSystem || false,
      categories: resource.categories || [],
      version: resource.version,
    };

    return {
      originalId: resource.id,
      resourceType: 'backgroundAgent',
      data: exportData,
    };
  }

  async importResource(
    exportable: ExportableResource,
    profileId: string,
    _userId: string,
    idMapping?: IdMapping
  ): Promise<BackgroundAgent> {
    const exportData = exportable.data as BackgroundAgentExport;

    // Validate action type
    if (
      exportData.actionType !== 'alert'
      && exportData.actionType !== 'update_document'
    ) {
      throw new Error(`Invalid action type: ${exportData.actionType}`);
    }

    // Generate new ID
    const newId = uuidv4();

    // Update ID mapping if provided
    if (idMapping) {
      idMapping[exportData.id] = newId;
    }

    let outputDocumentId: string | undefined;
    // If the agent has an output document
    if (exportData.outputDocument) {
      // Look up the document in the mapping in case it was already imported/created
      outputDocumentId = idMapping?.[exportData.outputDocument.id];
      // But if not, create a new document
      if (!outputDocumentId) {
        // Check if documents feature flag is enabled
        const state = store.getState();
        const isDocumentsEnabled = selectIsFeatureFlagEnabled(
          state,
          'documents'
        );
        if (!isDocumentsEnabled) {
          throw new Error('Documents feature is disabled');
        }

        const storage = getUnifiedStorageService();
        const created = await storage.createDocument(
          {
            title: exportData.outputDocument.title,
            content: '',
          },
          profileId
        );
        outputDocumentId = created.id;
        // And store the new ID, in case it is needed for other agents
        if (idMapping) {
          idMapping[exportData.outputDocument.id] = created.id;
        }
      }
    }

    // Re-hydrate background agent with new ownership
    const now = new Date().toISOString();
    const imported: BackgroundAgent = {
      id: newId,
      name: exportData.name,
      description: exportData.description,
      enabled: exportData.enabled,
      actionType: exportData.actionType,
      promptTemplate: exportData.promptTemplate,
      runEveryNTurns: exportData.runEveryNTurns,
      verbosityThreshold: exportData.verbosityThreshold,
      outputDocumentId: outputDocumentId,
      contextWindowStrategy: exportData.contextWindowStrategy,
      contextParams: exportData.contextParams,
      outputSchemaName: exportData.outputSchemaName || 'default',
      customOutputSchema: exportData.customOutputSchema ?? null,
      notifyChannel: exportData.notifyChannel,
      isSystem: false, // Always false for imported agents
      categories: exportData.categories || [],
      version: exportData.version,
      createdAt: now,
      updatedAt: now,
    };

    return imported;
  }

  validateImport(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const required = ['id', 'name', 'actionType', 'promptTemplate'];
    for (const field of required) {
      if (!(field in data)) {
        return false;
      }
    }

    // Validate action type
    if (data.actionType !== 'alert' && data.actionType !== 'update_document') {
      return false;
    }

    // Validate types
    if (
      typeof data.name !== 'string'
      || typeof data.promptTemplate !== 'string'
    ) {
      return false;
    }

    return true;
  }
}
