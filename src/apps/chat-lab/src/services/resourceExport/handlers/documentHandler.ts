import { getUnifiedStorageService } from "../../storage/UnifiedStorageService";
import type { ExportableResource, DocumentExport, ResourceHandler, ResourceType, IdMapping } from "../types";
import type { Document } from "../../../types";
import { v4 as uuidv4 } from 'uuid';

export class DocumentHandler implements ResourceHandler<Document> {
  getResourceType(): ResourceType {
    return 'document';
  }

  async getAllResources(profileId: string): Promise<Document[]> {
    const storage = getUnifiedStorageService();
    const response = await storage.getDocuments(undefined, 1, 1000, profileId);
    return response.documents || [];
  }

  async exportResource(resource: Document, _profileId: string): Promise<ExportableResource> {
    const exportData: DocumentExport = {
        id: resource.id, // Preserve original ID for reference resolution
        title: resource.title,
        content: resource.content,
        tags: resource.tags || [],
    }

    return {
        originalId: resource.id,
        resourceType: 'document',
        data: exportData,
    }
  }

  async importResource(exportable: ExportableResource, _profileId: string, _userId: string, idMapping?: IdMapping): Promise<Document> {
    const exportData = exportable.data as DocumentExport;

    // Generate new ID
    const newId = uuidv4();

    // Update ID mapping if provided
    if (idMapping) {
      idMapping[exportData.id] = newId;
    }

    // Re-hydrate document with new ownership
    const now = new Date().toISOString();
    const imported: Document = {
        id: newId,
        title: exportData.title,
        content: exportData.content,
        tags: exportData.tags || [],
        createdAt: now,
        updatedAt: now,
    }
    return imported;
  }

  validateImport(data: any): boolean {
    if (!data || typeof data !== 'object') {
        return false;
      }
  
      const required = ['id', 'title', 'content'];
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