import {
  loadAlertHistory,
  addAlertToHistory,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  clearAlertHistory,
  getUnreadAlertCount,
  getFilteredAlerts,
} from '../agentAlertHistory';
import type { AgentAlert } from '../agentAlerts';

const ALERT_HISTORY_STORAGE_KEY = 'fidu-chat-lab-agentAlertHistory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('agentAlertHistory', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  const createMockAlert = (overrides?: Partial<AgentAlert>): AgentAlert => ({
    id: `alert-${Date.now()}-${Math.random()}`,
    agentId: 'agent-1',
    createdAt: new Date().toISOString(),
    rating: 50,
    severity: 'warn',
    message: 'Test alert',
    read: false,
    conversationId: 'conv-1',
    messageId: 'msg-1',
    ...overrides,
  });

  describe('loadAlertHistory', () => {
    it('should return empty array when localStorage is empty', () => {
      const history = loadAlertHistory();
      expect(history).toEqual([]);
    });

    it('should load alerts from localStorage', () => {
      const alerts: AgentAlert[] = [
        createMockAlert({ id: 'alert-1' }),
        createMockAlert({ id: 'alert-2' }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      const history = loadAlertHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('alert-1');
    });

    it('should ensure all alerts have required fields', () => {
      const alerts = [
        {
          id: 'alert-1',
          agentId: 'agent-1',
          createdAt: '2024-01-01',
          rating: 50,
          severity: 'warn',
          message: 'test',
        },
        {
          id: 'alert-2',
          agentId: 'agent-2',
          createdAt: '2024-01-02',
          rating: 60,
          severity: 'info',
          message: 'test',
          read: true,
        },
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      const history = loadAlertHistory();
      expect(history[0].read).toBe(false);
      expect(history[0].details).toEqual({});
      expect(history[1].read).toBe(true);
      expect(history[1].details).toEqual({});
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorageMock.setItem(ALERT_HISTORY_STORAGE_KEY, 'invalid json{');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const history = loadAlertHistory();

      expect(history).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('addAlertToHistory', () => {
    it('should add alert to empty history', () => {
      const alert = createMockAlert({ id: 'alert-1' });
      addAlertToHistory(alert);

      const history = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('alert-1');
    });

    it('should append alert to existing history', () => {
      const existing = [createMockAlert({ id: 'alert-1' })];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(existing)
      );

      const newAlert = createMockAlert({ id: 'alert-2' });
      addAlertToHistory(newAlert);

      const history = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(history).toHaveLength(2);
      expect(history[1].id).toBe('alert-2');
    });

    it('should limit stored alerts to MAX_STORED_ALERTS (500)', () => {
      // Create 600 alerts
      const alerts = Array.from({ length: 600 }, (_, i) =>
        createMockAlert({ id: `alert-${i}` })
      );
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      // Add one more
      addAlertToHistory(createMockAlert({ id: 'alert-600' }));

      const stored = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(stored).toHaveLength(500);
      expect(stored[0].id).toBe('alert-101'); // Oldest removed
      expect(stored[499].id).toBe('alert-600'); // Newest added
    });
  });

  describe('markAlertAsRead', () => {
    it('should mark specific alert as read', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', read: false }),
        createMockAlert({ id: 'alert-2', read: false }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      markAlertAsRead('alert-1');

      const history = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(history.find((a: AgentAlert) => a.id === 'alert-1')?.read).toBe(
        true
      );
      expect(history.find((a: AgentAlert) => a.id === 'alert-2')?.read).toBe(
        false
      );
    });

    it('should handle non-existent alert gracefully', () => {
      const alerts = [createMockAlert({ id: 'alert-1' })];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      markAlertAsRead('non-existent');
      // Should not throw
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('markAllAlertsAsRead', () => {
    it('should mark all alerts as read', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', read: false }),
        createMockAlert({ id: 'alert-2', read: false }),
        createMockAlert({ id: 'alert-3', read: true }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      markAllAlertsAsRead();

      const history = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(history.every((a: AgentAlert) => a.read)).toBe(true);
    });
  });

  describe('deleteAlert', () => {
    it('should remove alert from history', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1' }),
        createMockAlert({ id: 'alert-2' }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      deleteAlert('alert-1');

      const history = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('alert-2');
    });

    it('should handle deleting non-existent alert gracefully', () => {
      const alerts = [createMockAlert({ id: 'alert-1' })];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      deleteAlert('non-existent');

      const history = JSON.parse(
        localStorageMock.setItem.mock.calls[
          localStorageMock.setItem.mock.calls.length - 1
        ][1]
      );
      expect(history).toHaveLength(1);
    });
  });

  describe('clearAlertHistory', () => {
    it('should remove all alerts from localStorage', () => {
      const alerts = [createMockAlert({ id: 'alert-1' })];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      clearAlertHistory();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        ALERT_HISTORY_STORAGE_KEY
      );
    });

    it('should handle errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      clearAlertHistory();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getUnreadAlertCount', () => {
    it('should return count of unread alerts', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', read: false }),
        createMockAlert({ id: 'alert-2', read: false }),
        createMockAlert({ id: 'alert-3', read: true }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      const count = getUnreadAlertCount();
      expect(count).toBe(2);
    });

    it('should return 0 when all alerts are read', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', read: true }),
        createMockAlert({ id: 'alert-2', read: true }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      const count = getUnreadAlertCount();
      expect(count).toBe(0);
    });
  });

  describe('getFilteredAlerts', () => {
    beforeEach(() => {
      const alerts: AgentAlert[] = [
        createMockAlert({
          id: 'alert-1',
          agentId: 'agent-1',
          severity: 'error',
          read: false,
          conversationId: 'conv-1',
          messageId: 'msg-1',
          createdAt: '2024-01-03T00:00:00Z',
        }),
        createMockAlert({
          id: 'alert-2',
          agentId: 'agent-1',
          severity: 'warn',
          read: false,
          conversationId: 'conv-1',
          messageId: 'msg-2',
          createdAt: '2024-01-02T00:00:00Z',
        }),
        createMockAlert({
          id: 'alert-3',
          agentId: 'agent-2',
          severity: 'error',
          read: true,
          conversationId: 'conv-2',
          messageId: 'msg-3',
          createdAt: '2024-01-01T00:00:00Z',
        }),
        createMockAlert({
          id: 'alert-4',
          agentId: 'agent-1',
          severity: 'info',
          read: false,
          conversationId: 'conv-1',
          messageId: 'msg-1',
          createdAt: '2024-01-04T00:00:00Z',
        }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );
    });

    it('should return all alerts when no filters applied', () => {
      const filtered = getFilteredAlerts();
      expect(filtered).toHaveLength(4);
      // Should be sorted by most recent first
      expect(filtered[0].id).toBe('alert-4');
      expect(filtered[3].id).toBe('alert-3');
    });

    it('should filter by unreadOnly', () => {
      const filtered = getFilteredAlerts({ unreadOnly: true });
      expect(filtered).toHaveLength(3);
      expect(filtered.every(a => !a.read)).toBe(true);
    });

    it('should filter by severity', () => {
      const filtered = getFilteredAlerts({ severity: 'error' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.severity === 'error')).toBe(true);
    });

    it('should filter by agentId', () => {
      const filtered = getFilteredAlerts({ agentId: 'agent-1' });
      expect(filtered).toHaveLength(3);
      expect(filtered.every(a => a.agentId === 'agent-1')).toBe(true);
    });

    it('should filter by conversationId', () => {
      const filtered = getFilteredAlerts({ conversationId: 'conv-1' });
      expect(filtered).toHaveLength(3);
      expect(filtered.every(a => a.conversationId === 'conv-1')).toBe(true);
    });

    it('should filter by messageId', () => {
      const filtered = getFilteredAlerts({ messageId: 'msg-1' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.messageId === 'msg-1')).toBe(true);
    });

    it('should apply limit', () => {
      const filtered = getFilteredAlerts({ limit: 2 });
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('alert-4'); // Most recent
    });

    it('should combine multiple filters', () => {
      const filtered = getFilteredAlerts({
        agentId: 'agent-1',
        severity: 'error',
        unreadOnly: true,
        limit: 1,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].agentId).toBe('agent-1');
      expect(filtered[0].severity).toBe('error');
      expect(filtered[0].read).toBe(false);
    });

    it('should handle missing conversationId gracefully', () => {
      const alerts = [
        createMockAlert({ id: 'alert-1', conversationId: undefined }),
        createMockAlert({ id: 'alert-2', conversationId: 'conv-1' }),
      ];
      localStorageMock.setItem(
        ALERT_HISTORY_STORAGE_KEY,
        JSON.stringify(alerts)
      );

      const filtered = getFilteredAlerts({ conversationId: 'conv-1' });
      // Filter logic: a.conversationId === filters.conversationId
      // Only alerts with matching conversationId are included (excludes legacy alerts without conversationId)
      expect(filtered.length).toBe(1);
      // Should only include alert-2 (exact match)
      expect(filtered.some(a => a.id === 'alert-1')).toBe(false);
      expect(filtered.some(a => a.id === 'alert-2')).toBe(true);
    });

    it('should sort by most recent first', () => {
      const filtered = getFilteredAlerts();
      const dates = filtered.map(a => new Date(a.createdAt).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(dates[1]).toBeGreaterThan(dates[2]);
      expect(dates[2]).toBeGreaterThan(dates[3]);
    });
  });
});
