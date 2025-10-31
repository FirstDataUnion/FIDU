/**
 * Service for managing alert history persistence and retrieval
 */

import type { AgentAlert } from './agentAlerts';

const ALERT_HISTORY_STORAGE_KEY = 'fidu-chat-lab-agentAlertHistory';
const MAX_STORED_ALERTS = 500; // Prevent localStorage from growing too large

/**
 * Load all stored alerts from localStorage
 */
export function loadAlertHistory(): AgentAlert[] {
  try {
    const stored = localStorage.getItem(ALERT_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    
    const alerts: AgentAlert[] = JSON.parse(stored);
    // Ensure all alerts have required fields
    return alerts.map(alert => ({
      ...alert,
      read: alert.read ?? false,
      details: alert.details ?? {},
    }));
  } catch (error) {
    console.warn('Failed to load alert history:', error);
    return [];
  }
}

/**
 * Save alerts to localStorage
 */
export function saveAlertHistory(alerts: AgentAlert[]): void {
  try {
    // Limit stored alerts to prevent localStorage bloat
    const alertsToStore = alerts.slice(-MAX_STORED_ALERTS);
    localStorage.setItem(ALERT_HISTORY_STORAGE_KEY, JSON.stringify(alertsToStore));
  } catch (error) {
    console.warn('Failed to save alert history:', error);
  }
}

/**
 * Add a new alert to history
 */
export function addAlertToHistory(alert: AgentAlert): void {
  const history = loadAlertHistory();
  history.push(alert);
  saveAlertHistory(history);
}

/**
 * Mark an alert as read
 */
export function markAlertAsRead(alertId: string): void {
  const history = loadAlertHistory();
  const alert = history.find(a => a.id === alertId);
  if (alert) {
    alert.read = true;
    saveAlertHistory(history);
  }
}

/**
 * Mark all alerts as read
 */
export function markAllAlertsAsRead(): void {
  const history = loadAlertHistory();
  history.forEach(alert => {
    alert.read = true;
  });
  saveAlertHistory(history);
}

/**
 * Delete an alert from history
 */
export function deleteAlert(alertId: string): void {
  const history = loadAlertHistory();
  const filtered = history.filter(a => a.id !== alertId);
  saveAlertHistory(filtered);
}

/**
 * Clear all alert history
 */
export function clearAlertHistory(): void {
  try {
    localStorage.removeItem(ALERT_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear alert history:', error);
  }
}

/**
 * Get count of unread alerts
 */
export function getUnreadAlertCount(): number {
  const history = loadAlertHistory();
  return history.filter(a => !a.read).length;
}

/**
 * Get alerts filtered by various criteria
 */
export function getFilteredAlerts(filters?: {
  unreadOnly?: boolean;
  severity?: AgentAlert['severity'];
  agentId?: string;
  conversationId?: string;
  messageId?: string; // Filter by message ID
  limit?: number;
}): AgentAlert[] {
  let history = loadAlertHistory();
  
  // Sort by most recent first
  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  if (filters?.unreadOnly) {
    history = history.filter(a => !a.read);
  }
  
  if (filters?.severity) {
    history = history.filter(a => a.severity === filters.severity);
  }
  
  if (filters?.agentId) {
    history = history.filter(a => a.agentId === filters.agentId);
  }
  
  if (filters?.conversationId) {
    history = history.filter(a => !a.conversationId || a.conversationId === filters.conversationId);
  }
  
  if (filters?.messageId) {
    history = history.filter(a => a.messageId === filters.messageId);
  }
  
  if (filters?.limit) {
    history = history.slice(0, filters.limit);
  }
  
  return history;
}

