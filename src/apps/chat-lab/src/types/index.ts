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
  // Original prompt information for conversation restart
  originalPrompt?: {
    promptText: string;
    context?: Context | null;
    systemPrompt: SystemPrompt;
    metadata?: {
      estimatedTokens: number;
    };
  };
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
  content: string;
  description: string;
  tokenCount: number;
  isDefault: boolean;
  isSystem: boolean; // true for built-in system prompts, false for user-created
  category?: string;
  modelCompatibility?: string[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface Prompt {
  id: string;
  title: string;
  promptText: string;           // Main prompt text
  context: Context | null;      // Optional context object
  systemPrompt: SystemPrompt;   // System prompt (always present)
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata?: {
    estimatedTokens: number;
  };
}

// Authentication Types
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

// FIDU Vault Data Packet types
export interface ConversationDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    sourceChatbot: string;
    interactions: Array<{
      actor: string;
      timestamp: string;
      content: string;
      attachments: string[];
    }>;
    targetModelRequested: string;
    conversationUrl: string;
    conversationTitle: string;
    isArchived: boolean;
    isFavorite: boolean;
    participants: string[];
    status: 'active' | 'archived' | 'deleted';
    // Original prompt information for conversation restart
    originalPrompt?: {
      promptText: string;
      contextId?: string;
      contextTitle?: string;
      contextDescription?: string;
      systemPromptId: string;
      systemPromptContent: string;
      systemPromptName: string;
      estimatedTokens: number;
    };
  };
}

export interface ConversationDataPacketUpdate {
  id: string;
  tags: string[];
  data: {
    sourceChatbot: string;
    interactions: Array<{
      actor: string;
      timestamp: string;
      content: string;
      attachments: string[];
    }>;
    targetModelRequested: string;
    conversationUrl: string;
    conversationTitle: string;
    isArchived: boolean;
    isFavorite: boolean;
    participants: string[];
    status: 'active' | 'archived' | 'deleted';
    // Original prompt information for conversation restart
    originalPrompt?: {
      promptText: string;
      contextId?: string;
      contextTitle?: string;
      contextDescription?: string;
      systemPromptId: string;
      systemPromptContent: string;
      systemPromptName: string;
      estimatedTokens: number;
    };
  };
}

export interface PromptDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    prompt_title: string;
    prompt_text: string;                    // Main prompt text
    context_id?: string;                    // Reference to context if present
    context_title?: string;                 // Context title for easier reference
    system_prompt_id: string;               // Reference to system prompt
    system_prompt_content: string;          // Full system prompt content
    system_prompt_name: string;             // System prompt name
    estimated_tokens: number;
  };
}

// Front End types

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date | string;
  platform: string;
  metadata?: Record<string, any>;
  attachments?: Attachment[];
  isEdited: boolean;
  editHistory?: MessageEdit[];
}

export interface MessageEdit {
  id: string;
  previousContent: string;
  editedAt: Date;
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

export interface Memory {
  id: string;
  title: string;
  content: string;
  type: 'fact' | 'preference' | 'context' | 'skill' | 'goal';
  tags: string[];
  conversationIds: string[];
  createdAt: Date;
  updatedAt: Date;
  importance: 'low' | 'medium' | 'high' | 'critical';
  isArchived: boolean;
  source: 'manual' | 'extracted' | 'imported';
  metadata?: Record<string, any>;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: Date | string;
  usageCount: number;
  category?: string;
}

export interface SearchResult {
  type: 'conversation' | 'message' | 'memory';
  item: Conversation | Message | Memory;
  relevanceScore: number;
  highlightedContent?: string;
  matchedFields: string[];
}

export interface UserSettings {
  id: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  autoExtractMemories: boolean;
  notificationsEnabled: boolean;
  defaultPlatform?: string;
  exportFormat: 'json' | 'markdown' | 'csv';
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
}

export interface ExportData {
  conversations: Conversation[];
  messages: Message[];
  memories: Memory[];
  tags: Tag[];
  settings: UserSettings;
  exportedAt: Date;
  version: string;
}

export interface ImportOptions {
  includeConversations: boolean;
  includeMessages: boolean;
  includeMemories: boolean;
  includeTags: boolean;
  includeSettings: boolean;
  mergeStrategy: 'replace' | 'merge' | 'skip';
}

export interface DatabaseStats {
  totalConversations: number;
  totalMessages: number;
  totalMemories: number;
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
  memoryStats: {
    totalByType: Record<string, number>;
    creationTrend: Array<{ date: string; count: number }>;
    importanceDistribution: Record<string, number>;
  };
  usageStats: {
    dailyActivity: Array<{ date: string; conversations: number; messages: number }>;
    peakUsageHours: Array<{ hour: number; activity: number }>;
    platformUsage: Record<string, { time: number; messages: number }>;
  };
}

// Redux State Types
export interface RootState {
  conversations: ConversationsState;
  memories: MemoriesState;
  tags: TagsState;
  search: SearchState;
  settings: SettingsState;
  ui: UIState;
  auth: AuthState;
}

export interface AuthState {
  user: User | null;
  currentProfile: Profile | null;
  profiles: Profile[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
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

export interface MemoriesState {
  items: Memory[];
  loading: boolean;
  error: string | null;
  filters: {
    types?: Memory['type'][];
    importance?: Memory['importance'][];
    tags?: string[];
    searchQuery?: string;
  };
}

export interface TagsState {
  items: Tag[];
  loading: boolean;
  error: string | null;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  filters: {
    types: ('conversation' | 'message' | 'memory')[];
    dateRange?: { start: Date; end: Date };
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
    type: 'conversation' | 'memory' | 'tag' | null;
    item: any;
  } | null;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
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

export interface MemoryCardProps {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onDelete: (memoryId: string) => void;
  onTagClick: (tag: string) => void;
  compact?: boolean;
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
  timestamp: Date;
}

// IndexedDB Store Names
export const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  MEMORIES: 'memories',
  TAGS: 'tags',
  SETTINGS: 'settings',
  ATTACHMENTS: 'attachments'
} as const;

export type StoreNames = typeof STORES[keyof typeof STORES]; 