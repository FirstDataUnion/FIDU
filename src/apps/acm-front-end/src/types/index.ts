// Core ACM Types
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
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
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
  createdAt: Date;
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
  user_id?: string;
  from_timestamp?: Date;
  to_timestamp?: Date;
  packet_type?: string;
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
}

export interface ConversationsState {
  items: Conversation[];
  loading: boolean;
  error: string | null;
  currentConversation: Conversation | null;
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