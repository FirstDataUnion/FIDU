import {
  loadAgentPreferences,
  saveAgentPreferences,
  getAgentPreference,
  setAgentPreference,
  deleteAgentPreference,
  clearAllAgentPreferences,
  type AllAgentPreferences,
} from '../agentPreferences';
import { BACKGROUND_AGENT_PREFS_KEY } from '../agentConstants';

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

describe('agentPreferences', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('loadAgentPreferences', () => {
    it('should return empty object when localStorage is empty', () => {
      const prefs = loadAgentPreferences();
      expect(prefs).toEqual({});
      expect(localStorageMock.getItem).toHaveBeenCalledWith(BACKGROUND_AGENT_PREFS_KEY);
    });

    it('should load preferences from localStorage', () => {
      const stored: AllAgentPreferences = {
        'agent-1': {
          runEveryNTurns: 5,
          verbosityThreshold: 30,
          contextLastN: 10,
        },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(stored));
      
      const prefs = loadAgentPreferences();
      expect(prefs).toEqual(stored);
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, 'invalid json{');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const prefs = loadAgentPreferences();
      
      expect(prefs).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return empty object on parse error', () => {
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, 'not-json');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const prefs = loadAgentPreferences();
      
      expect(prefs).toEqual({});
      consoleSpy.mockRestore();
    });
  });

  describe('saveAgentPreferences', () => {
    it('should save preferences to localStorage', () => {
      const prefs: AllAgentPreferences = {
        'agent-1': {
          runEveryNTurns: 5,
          verbosityThreshold: 30,
        },
      };
      
      saveAgentPreferences(prefs);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        BACKGROUND_AGENT_PREFS_KEY,
        JSON.stringify(prefs)
      );
    });

    it('should handle save errors gracefully', () => {
      const prefs: AllAgentPreferences = {
        'agent-1': { runEveryNTurns: 5, verbosityThreshold: 30 },
      };
      
      // Simulate quota exceeded error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      saveAgentPreferences(prefs);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getAgentPreference', () => {
    it('should return null for non-existent agent', () => {
      const pref = getAgentPreference('non-existent');
      expect(pref).toBeNull();
    });

    it('should return preferences for existing agent', () => {
      const stored: AllAgentPreferences = {
        'agent-1': {
          runEveryNTurns: 5,
          verbosityThreshold: 30,
          contextLastN: 10,
        },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(stored));
      
      const pref = getAgentPreference('agent-1');
      expect(pref).toEqual(stored['agent-1']);
    });
  });

  describe('setAgentPreference', () => {
    it('should create new preference for agent', () => {
      setAgentPreference('agent-1', {
        runEveryNTurns: 5,
        verbosityThreshold: 30,
      });
      
      const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(stored['agent-1']).toEqual({
        runEveryNTurns: 5,
        verbosityThreshold: 30,
      });
    });

    it('should merge with existing preferences', () => {
      const existing: AllAgentPreferences = {
        'agent-1': {
          runEveryNTurns: 5,
          verbosityThreshold: 30,
        },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(existing));
      
      setAgentPreference('agent-1', {
        verbosityThreshold: 40, // Update only this field
      });
      
      const stored = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]);
      expect(stored['agent-1']).toEqual({
        runEveryNTurns: 5, // Preserved
        verbosityThreshold: 40, // Updated
      });
    });

    it('should set contextLastN when provided', () => {
      setAgentPreference('agent-1', {
        runEveryNTurns: 5,
        verbosityThreshold: 30,
        contextLastN: 12,
      });
      
      const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(stored['agent-1'].contextLastN).toBe(12);
    });

    it('should preserve other agents when updating one', () => {
      const existing: AllAgentPreferences = {
        'agent-1': { runEveryNTurns: 5, verbosityThreshold: 30 },
        'agent-2': { runEveryNTurns: 10, verbosityThreshold: 50 },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(existing));
      
      setAgentPreference('agent-1', {
        runEveryNTurns: 6,
        verbosityThreshold: 35,
      });
      
      const stored = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]);
      expect(stored['agent-1'].runEveryNTurns).toBe(6);
      expect(stored['agent-2']).toEqual(existing['agent-2']); // Preserved
    });
  });

  describe('deleteAgentPreference', () => {
    it('should remove preference for agent', () => {
      const existing: AllAgentPreferences = {
        'agent-1': { runEveryNTurns: 5, verbosityThreshold: 30 },
        'agent-2': { runEveryNTurns: 10, verbosityThreshold: 50 },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(existing));
      
      deleteAgentPreference('agent-1');
      
      const stored = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]);
      expect(stored['agent-1']).toBeUndefined();
      expect(stored['agent-2']).toEqual(existing['agent-2']); // Preserved
    });

    it('should handle deleting non-existent preference gracefully', () => {
      deleteAgentPreference('non-existent');
      // Should not throw
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('clearAllAgentPreferences', () => {
    it('should remove all preferences from localStorage', () => {
      const existing: AllAgentPreferences = {
        'agent-1': { runEveryNTurns: 5, verbosityThreshold: 30 },
        'agent-2': { runEveryNTurns: 10, verbosityThreshold: 50 },
      };
      localStorageMock.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(existing));
      
      clearAllAgentPreferences();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(BACKGROUND_AGENT_PREFS_KEY);
    });

    it('should handle errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      clearAllAgentPreferences();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

