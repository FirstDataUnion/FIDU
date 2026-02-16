import type { UserFeatureFlagsState } from '../store/slices/userFeatureFlagsSlice';
import type { SystemFeatureFlagsState } from '../store/slices/systemFeatureFlagsSlice';
import type {
  HistoricalSyncSettings,
  SyncSettings,
} from '../utils/syncSettingsMigration';

// Core Chat Lab Types
export interface Conversation {
  id: string;
  title: string;
  platform: 'chatgpt' | 'claude' | 'gemini' | 'other';
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
  tags: string[];
  isArchived: boolean;
  isFavorite: boolean;
  participants: string[];
  status: 'active' | 'archived' | 'deleted';
  // List of unique models used in this conversation (e.g., ["autorouter", "gpt-4o", "claude-3-5-sonnet"])
  // Computed from actual messages and updated when conversation is saved/updated
  modelsUsed?: string[];
  // Original prompt information for conversation restart
  originalPrompt?: {
    promptText: string;
    contexts?: Context[]; // Support multiple contexts
    context?: Context | null; // Keep for backward compatibility
    systemPrompts: SystemPrompt[]; // Support multiple system prompts
    systemPrompt?: SystemPrompt; // Keep for backward compatibility
    metadata?: {
      estimatedTokens: number;
    };
  };
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

// Context interface for prompt context
export interface Context {
  id: string;
  title: string;
  body: string;
  tokenCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isBuiltIn: boolean;
  // Conversation references for building context over time
  conversationIds?: string[];
  // Metadata about conversations in this context
  conversationMetadata?: {
    totalMessages: number;
    lastAddedAt: string;
    platforms: string[];
  };
}

// System Prompt interface
export interface SystemPrompt {
  id: string;
  name: string;
  description: string; // Description field
  content: string;
  tokenCount: number;
  isDefault: boolean;
  isBuiltIn: boolean; // true for built-in system prompts, false for user-created
  source?: 'fabric' | 'built-in' | 'user' | 'wharton' | 'wizard'; // source of the system prompt
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

// Document interface
// Not named Document to avoid shadowing the Document type from the browser
export interface MarkdownDocument {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// Workspace Types
export interface WorkspaceMetadata {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  driveFolderId?: string; // null/undefined for AppData (personal), folder ID for shared

  // Profile ID for personal workspaces (maps to Profile.id)
  profileId?: string; // Only present for personal workspaces

  // File locations within the Drive folder
  files?: {
    conversationsDbId?: string;
    apiKeysDbId?: string;
    metadataJsonId?: string;
  };

  // Membership (for shared workspaces)
  role?: 'owner' | 'member';
  members?: Array<{ email: string; role: 'owner' | 'member' }>;

  // Timestamps
  createdAt: string;
  lastAccessed: string;
}

export interface WorkspaceRegistry {
  workspaces: WorkspaceMetadata[];
  activeWorkspaceId: string | null;
}

// Unified Workspace Type - represents both personal and shared workspaces
export interface UnifiedWorkspace {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  // For personal workspaces: the actual profile ID from Identity Service
  // For shared workspaces: undefined (use workspace-${id}-default format)
  profileId?: string;
  // For shared workspaces: the Drive folder ID
  // For personal workspaces: undefined (uses AppData)
  driveFolderId?: string;
  // Membership info (only for shared workspaces)
  role?: 'owner' | 'member';
  members?: Array<{ email: string; role: 'owner' | 'member' }>;
  // Timestamps
  createdAt: string;
  lastAccessed: string;
}

// Authentication Types
// The IdentityService* types are partials of what the Identity Service returns.
export interface IdentityServiceProfile {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityServiceUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  profiles: IdentityServiceProfile[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  create_timestamp?: string;
  update_timestamp?: string;
  profiles: Profile[];
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  create_timestamp: string;
  update_timestamp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  request_id: string;
  password: string;
  user: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateProfileRequest {
  request_id: string;
  profile: {
    user_id: string;
    name: string;
  };
}

// Background Agent Alert Metadata stored in message metadata
export interface BackgroundAgentAlertMetadata {
  agentId: string;
  agentName?: string; // For display purposes
  createdAt: string;
  rating: number;
  severity: 'info' | 'warn' | 'error';
  message: string; // Legacy field - kept for backward compatibility, use shortMessage instead
  shortMessage?: string; // Brief notification for toast/popup (1-2 sentences)
  description?: string; // Detailed explanation for expanded view (2-4 paragraphs)
  details?: Record<string, any>;
  rawModelOutput?: string;
  parsedResult?: Record<string, any>;
}

// Front End types

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  platform: string;
  metadata?: Record<string, any>;
  attachments?: Attachment[];
  isEdited: boolean;
  editHistory?: MessageEdit[];
}

export interface MessageEdit {
  id: string;
  previousContent: string;
  editedAt: string;
  reason?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file' | 'link' | 'code';
  url?: string;
  content?: string;
  mimeType?: string;
  size?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: string;
  usageCount: number;
  category?: string;
}

export interface SearchResult {
  type: 'conversation' | 'message' | 'context' | 'prompt' | 'tag';
  item: Conversation | Message | any; // Using any for now since we don't have Context/Prompt types defined
  relevanceScore: number;
  highlightedContent?: string;
  matchedFields: string[];
  title?: string;
  subtitle?: string;
  id?: string;
}

export interface UserSettings {
  id: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  autoExtractMemories: boolean;
  notificationsEnabled: boolean;
  defaultPlatform?: string;
  exportFormat: 'json' | 'markdown' | 'csv';
  lastUsedModel?: string; // Store the last used model for persistence across tab switches
  storageMode: 'local' | 'cloud'; // Storage mode preference
  storageConfigured: boolean; // Whether user has completed initial storage setup
  userSelectedStorageMode: boolean; // Whether user has made a selection from settings page
  apiKeys: {
    nlpWorkbench?: string;
  };
  privacySettings: {
    shareAnalytics: boolean;
    autoBackup: boolean;
    dataRetentionDays: number;
  };
  displaySettings: {
    itemsPerPage: number;
    showTimestamps: boolean;
    compactView: boolean;
    groupByDate: boolean;
  };
  syncSettings: SyncSettings;
}

export type HistoricalUserSettings = Omit<UserSettings, 'syncSettings'> & {
  syncSettings: HistoricalSyncSettings;
};

export interface ExportData {
  conversations: Conversation[];
  messages: Message[];
  tags: Tag[];
  settings: UserSettings;
  exportedAt: Date;
  version: string;
}

export interface ImportOptions {
  includeConversations: boolean;
  includeMessages: boolean;
  includeTags: boolean;
  includeSettings: boolean;
  mergeStrategy: 'replace' | 'merge' | 'skip';
}

export interface DatabaseStats {
  totalConversations: number;
  totalMessages: number;
  totalTags: number;
  databaseSize: number;
  lastBackup?: Date;
  oldestConversation?: Date;
  newestConversation?: Date;
}

export interface FilterOptions {
  platforms?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  messageCountRange?: {
    min: number;
    max: number;
  };
  searchQuery?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
}

export interface DataPacketQueryParams {
  tags?: string[];
  profile_id?: string;
  from_timestamp?: Date;
  to_timestamp?: Date;
  limit?: number;
  offset?: number;
  sort_order?: string;
}

export interface AnalyticsData {
  conversationStats: {
    totalByPlatform: Record<string, number>;
    messagesPerDay: Array<{ date: string; count: number }>;
    averageConversationLength: number;
    topTags: Array<{ tag: string; count: number }>;
  };
  usageStats: {
    dailyActivity: Array<{
      date: string;
      conversations: number;
      messages: number;
    }>;
    peakUsageHours: Array<{ hour: number; activity: number }>;
    platformUsage: Record<string, { time: number; messages: number }>;
  };
}

// Redux State Types
export interface RootState {
  conversations: ConversationsState;
  ui: UIState;
  settings: SettingsState;
  contexts: ContextsState;
  systemPrompts: SystemPromptsState;
  documents: DocumentsState;
  promptLab: PromptLabState;
  search: SearchState;
  auth: AuthState;
  unifiedStorage: UnifiedStorageState;
  googleDriveAuth: GoogleDriveAuthState;
  systemFeatureFlags: SystemFeatureFlagsState;
  userFeatureFlags: UserFeatureFlagsState;
}

export interface AuthState {
  user: User | null;
  // Legacy: Keep for backward compatibility during migration
  currentProfile: Profile | null;
  profiles: Profile[];
  // New: Unified workspace state
  currentWorkspace: UnifiedWorkspace | null;
  personalWorkspaces: Profile[]; // Personal workspaces (profiles)
  // Computed: All workspaces (personal + shared) - populated from personalWorkspaces + WorkspaceRegistry
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

// Google Drive Authentication Types
export interface GoogleDriveUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleDriveAuthState {
  isAuthenticated: boolean;
  user: GoogleDriveUser | null;
  isLoading: boolean;
  error: string | null;
  showAuthModal: boolean;
  expiresAt: number | null;
  hasInsufficientPermissions: boolean;
}

export interface ConversationsState {
  items: Conversation[];
  loading: boolean;
  error: string | null;
  currentConversation: Conversation | null;
  currentMessages: Message[];
  messagesLoading: boolean;
  filters: FilterOptions;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  filters: {
    types: ('conversation' | 'message')[];
    dateRange?: { start: string; end: string };
    tags?: string[];
  };
  suggestions: string[];
}

export interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  error: string | null;
}

export interface UIState {
  sidebarOpen: boolean;
  currentPage: string;
  notifications: Notification[];
  modals: {
    exportData: boolean;
    importData: boolean;
    settings: boolean;
    deleteConfirmation: boolean;
  };
  draggedItem: {
    type: 'conversation' | 'tag' | null;
    item: any;
  } | null;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

// Additional Redux State Types
export interface ContextsState {
  items: Context[];
  loading: boolean;
  error: string | null;
  selectedContext: Context | null;
}

export interface SystemPromptsState {
  items: SystemPrompt[];
  loading: boolean;
  error: string | null;
  selectedSystemPrompt: SystemPrompt | null;
}

export interface DocumentsState {
  items: MarkdownDocument[];
  loading: boolean;
  error: string | null;
}

export interface PromptLabState {
  systemPrompts: SystemPrompt[];
  promptTemplates: PromptTemplate[];
  executions: PromptExecution[];
  currentPrompt: string;
  selectedSystemPrompts: string[];
  selectedModels: string[];
  contextSuggestions: ContextSuggestion[];
  isExecuting: boolean;
  loading: boolean;
  error: string | null;
  totalTokenCount: number;
  estimatedCost: number;
}

export interface UnifiedStorageState {
  // Core storage configuration
  mode: 'local' | 'cloud';
  status: 'unconfigured' | 'configuring' | 'configured' | 'error';
  userSelectedMode: boolean; // Whether user has made a selection from settings page

  // Google Drive specific state
  googleDrive: {
    isAuthenticated: boolean;
    user: GoogleDriveUser | null;
    isLoading: boolean;
    error: string | null;
    showAuthModal: boolean;
    expiresAt: number | null;
  };

  // Error handling
  error: string | null;
  isLoading: boolean;
}

// Additional types for PromptLab
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  systemPromptId: string;
  contextIds: string[];
  description: string;
  tokenCount: number;
  createdAt: string;
}

export interface ModelResponse {
  model: string;
  response: string;
  tokenCount: number;
  timeMs: number;
  cost: number;
  timestamp: string;
}

export interface PromptExecution {
  id: string;
  prompt: string;
  systemPromptId: string;
  contextIds: string[];
  models: string[];
  responses: ModelResponse[];
  createdAt: string;
  bestResponseModel?: string;
}

export interface ContextSuggestion {
  contextId: string;
  contextName: string;
  relevanceScore: number;
  reason: string;
  tokenCount: number;
}

// Component Props Types
export interface ConversationCardProps {
  conversation: Conversation;
  onSelect: (conversation: Conversation) => void;
  onEdit: (conversation: Conversation) => void;
  onDelete: (conversationId: string) => void;
  onToggleFavorite: (conversationId: string) => void;
  onToggleArchive: (conversationId: string) => void;
  selected?: boolean;
}

export interface SearchBarProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: any) => void;
  placeholder?: string;
  showFilters?: boolean;
}

// API Response Types
export interface APIResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

// IndexedDB Store Names (keeping for backward compatibility with existing code)
export const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  TAGS: 'tags',
  SETTINGS: 'settings',
  ATTACHMENTS: 'attachments',
} as const;

export type StoreNames = (typeof STORES)[keyof typeof STORES];
