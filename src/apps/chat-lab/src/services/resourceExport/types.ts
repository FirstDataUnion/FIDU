/**
 * Resource Export/Import Types
 * Defines the structure for exporting and importing resources
 */

/**
 * Format version for compatibility checking
 */
export const RESOURCE_EXPORT_VERSION = '1.0.0';

/**
 * Exportable resource wrapper - stores original ID for reference resolution
 */
export interface ExportableResource {
  originalId: string;
  resourceType: ResourceType;
  data: any;
}

/**
 * Supported resource types
 */
export type ResourceType = 'systemPrompt' | 'context' | 'backgroundAgent' | 'conversation' | 'document';

/**
 * Main export format structure
 */
export interface ResourceExport {
  version: string;
  exportedAt: string;
  exportedBy?: string;
  resources: {
    systemPrompts?: SystemPromptExport[];
    contexts?: ContextExport[];
    backgroundAgents?: BackgroundAgentExport[];
    conversations?: ConversationExport[];
    documents?: DocumentExport[];
  };
  metadata?: {
    appVersion?: string;
    description?: string;
  };
}

/**
 * ID mapping for resolving references during import
 */
export interface IdMapping {
  [originalId: string]: string; // maps old ID to new ID
}

/**
 * Export formats for each resource type (sanitized, no ownership IDs)
 */
export interface SystemPromptExport {
  id: string; // Original ID preserved for reference resolution
  name: string;
  description: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  isBuiltIn: boolean;
  source?: 'fabric' | 'built-in' | 'user' | 'wharton' | 'wizard';
  categories: string[];
  // Note: createdAt/updatedAt removed, will be set to current time on import
}

export interface ContextExport {
  id: string; // Original ID preserved for reference resolution
  title: string;
  body: string;
  tokenCount: number;
  tags: string[];
  isBuiltIn: boolean;
  conversationIds?: string[]; // Will be mapped to new IDs if those conversations are also imported
  conversationMetadata?: {
    totalMessages: number;
    lastAddedAt: string;
    platforms: string[];
  };
}

export interface DocumentExport {
  id: string; // Original ID preserved for reference resolution
  title: string;
  content: string;
  tags: string[];
}

export interface BackgroundAgentExport {
  id: string; // Original ID preserved for reference resolution
  name: string;
  description: string;
  enabled: boolean;
  actionType: 'alert' | 'update_context';
  promptTemplate: string;
  runEveryNTurns: number;
  verbosityThreshold: number;
  contextWindowStrategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall';
  contextParams?: {
    lastN?: number;
    tokenLimit?: number;
  };
  outputSchemaName?: 'default' | 'custom';
  customOutputSchema?: Record<string, any> | null;
  notifyChannel: 'inline' | 'toast' | 'panel' | 'all';
  isSystem?: boolean;
  categories?: string[];
  version?: string;
}

export interface ConversationExport {
  id: string; // Original ID preserved for reference resolution
  title: string;
  platform: 'chatgpt' | 'claude' | 'gemini' | 'other';
  lastMessage?: string;
  messageCount: number;
  tags: string[];
  isArchived: boolean;
  isFavorite: boolean;
  participants: string[];
  status: 'active' | 'archived' | 'deleted';
  modelsUsed?: string[];
  messages: MessageExport[];
  originalPrompt?: {
    promptText: string;
    contextId?: string; // Will be mapped to new ID if context is imported
    contextTitle?: string;
    contextDescription?: string;
    systemPromptIds?: string[]; // Will be mapped to new IDs if system prompts are imported
    systemPromptContents?: string[];
    systemPromptNames?: string[];
    systemPromptId?: string; // Backward compatibility
    systemPromptContent?: string;
    systemPromptName?: string;
    embellishmentIds?: string[];
    estimatedTokens: number;
  };
}

export interface MessageExport {
  id: string;
  conversationId: string; // Will be mapped to new conversation ID
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  platform?: string;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
  metadata?: Record<string, any>;
  isEdited: boolean;
}

/**
 * Resource handler interface
 */
export interface ResourceHandler<T> {
  /**
   * Export a resource, removing ownership IDs and sanitizing data
   */
  exportResource(resource: T, profileId: string): Promise<ExportableResource>;
  
  /**
   * Import a resource, re-hydrating ownership IDs and generating new IDs
   */
  importResource(
    data: ExportableResource,
    profileId: string,
    userId: string,
    idMapping?: IdMapping
  ): Promise<T>;
  
  /**
   * Validate that the import data is valid for this resource type
   */
  validateImport(data: any): boolean;
  
  /**
   * Get the resource type name
   */
  getResourceType(): ResourceType;
  
  /**
   * Get all resources of this type from storage
   */
  getAllResources(profileId: string): Promise<T[]>;
}

/**
 * Import result for tracking what was imported
 */
export interface ImportResult {
  success: boolean;
  imported: {
    systemPrompts: number;
    contexts: number;
    backgroundAgents: number;
    conversations: number;
    documents: number;
  };
  errors: Array<{
    resourceType: ResourceType;
    resourceName: string;
    error: string;
  }>;
  warnings: Array<{
    resourceType: ResourceType;
    resourceName: string;
    warning: string;
  }>;
}

/**
 * Export selection - which resources to export
 */
export interface ExportSelection {
  systemPromptIds?: string[];
  contextIds?: string[];
  backgroundAgentIds?: string[];
  conversationIds?: string[];
  documentIds?: string[];
}

