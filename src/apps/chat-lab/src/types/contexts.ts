export interface ContextFormData {
  title: string;
  body: string;
  tags: string[];
}

export interface ViewEditFormData {
  title: string;
  body: string;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  tags: string[];
  platform: string;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}
