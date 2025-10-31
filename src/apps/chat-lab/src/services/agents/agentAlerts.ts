import { addAlertToHistory } from './agentAlertHistory';

export type AgentAlert = {
  id: string;
  agentId: string;
  createdAt: string;
  rating: number;
  severity: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, any>;
  read: boolean;
  conversationId?: string; // Optional: link alert to specific conversation
  messageId?: string; // Optional: link alert to specific message that triggered it
};

export type AgentAlertListener = (alert: AgentAlert) => void;

const listeners = new Set<AgentAlertListener>();

export function subscribeToAgentAlerts(listener: AgentAlertListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addAgentAlert(alert: AgentAlert): void {
  // Persist to history
  addAlertToHistory(alert);
  
  // Notify listeners (e.g., toaster, UI components)
  for (const listener of Array.from(listeners)) {
    try {
      listener(alert);
    } catch {
      // ignore listener errors
    }
  }
}

// Export history functions for convenience
export {
  loadAlertHistory,
  saveAlertHistory,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  clearAlertHistory,
  getUnreadAlertCount,
  getFilteredAlerts,
} from './agentAlertHistory';
