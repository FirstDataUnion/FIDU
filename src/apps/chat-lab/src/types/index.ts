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
  source?: 'fabric' | 'built-in' | 'user'; // source of the system prompt
  categories: string[];
  createdAt: string;
  updatedAt: string;
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
      model?: string; // Model that generated this specific message
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
      systemPromptIds: string[]; // Support multiple system prompts
      systemPromptContents: string[]; // Store all system prompt contents
      systemPromptNames: string[]; // Store all system prompt names
      systemPromptId?: string; // Keep for backward compatibility
      systemPromptContent?: string; // Keep for backward compatibility
      systemPromptName?: string; // Keep for backward compatibility
      embellishmentIds?: string[]; // Store selected embellishment IDs
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
      model?: string; // Model that generated this specific message
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
      systemPromptIds: string[]; // Support multiple system prompts
      systemPromptContents: string[]; // Store all system prompt contents
      systemPromptNames: string[]; // Store all system prompt names
      systemPromptId?: string; // Keep for backward compatibility
      systemPromptContent?: string; // Keep for backward compatibility
      systemPromptName?: string; // Keep for backward compatibility
      embellishmentIds?: string[]; // Store selected embellishment IDs
      estimatedTokens: number;
    };
  };
}



export interface EmbellishmentDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    name: string;
    instructions: string;
    category: 'style' | 'tone' | 'format' | 'approach';
    color: string;
  };
}

export interface EmbellishmentDataPacketUpdate {
  id: string;
  tags: string[];
  data: {
    name: string;
    instructions: string;
    category: 'style' | 'tone' | 'format' | 'approach';
    color: string;
  };
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
  storageMode: 'local' | 'cloud' | 'filesystem'; // Storage mode preference
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
    dailyActivity: Array<{ date: string; conversations: number; messages: number }>;
    peakUsageHours: Array<{ hour: number; activity: number }>;
    platformUsage: Record<string, { time: number; messages: number }>;
  };
}

// Redux State Types
export interface RootState {
  conversations: ConversationsState;
  search: SearchState;
  settings: SettingsState;
  ui: UIState;
  auth: AuthState;
  googleDriveAuth: GoogleDriveAuthState;
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
  ATTACHMENTS: 'attachments'
} as const;

export type StoreNames = typeof STORES[keyof typeof STORES]; 