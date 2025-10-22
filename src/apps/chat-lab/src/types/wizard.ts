// TypeScript type definitions for wizard functionality

export interface WizardMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface WizardConfig {
  id: string;
  title: string;
  systemPromptId: string;
  modelId: string;
  initialMessage: string;
}

export interface WizardWindowProps {
  open: boolean;
  onClose: () => void;
  onMinimize: () => void;
  title: string;
  messages: WizardMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onCopyResult: (content: string) => void;
  onClearConversation?: () => void;
  initialMessage?: string;
  modelName?: string;
  // System Prompt Suggestor specific props
  onAddSystemPrompt?: (promptId: string) => void;
  systemPrompts?: any[]; // SystemPrompt[] - avoiding circular import
  showCopyButton?: boolean; // Control whether to show copy button
  icon?: React.ReactNode; // Custom icon for the wizard
}
