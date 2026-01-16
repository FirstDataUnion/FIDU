/**
 * Unit tests for logout coordinator
 *
 * Tests the critical timeout and state management logic that prevents infinite logout loops
 */

import {
  beginLogout,
  completeLogout,
  isLogoutInProgress,
  currentLogoutSource,
  markAuthenticated,
  resetLogoutState,
} from '../logoutCoordinator';

describe('logoutCoordinator', () => {
  beforeEach(() => {
    // Reset state before each test
    jest.clearAllTimers();
    jest.useFakeTimers();
    // Force reset by marking as authenticated
    markAuthenticated();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('beginLogout', () => {
    it('should allow logout when not in progress', () => {
      const result = beginLogout('manual');
      expect(result).toBe(true);
      expect(isLogoutInProgress()).toBe(true);
      expect(currentLogoutSource()).toBe('manual');
    });

    it('should prevent duplicate logout when already in progress', () => {
      beginLogout('manual');
      const result = beginLogout('auto');

      expect(result).toBe(false);
      expect(currentLogoutSource()).toBe('manual'); // Should still be manual
    });

    it('should set up automatic timeout', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      beginLogout('manual');
      expect(isLogoutInProgress()).toBe(true);

      // Fast-forward 10 seconds
      jest.advanceTimersByTime(10000);

      // Should have timed out and reset
      expect(isLogoutInProgress()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout timeout reached')
      );

      consoleSpy.mockRestore();
    });

    it('should allow new logout after timeout', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Start first logout
      beginLogout('manual');

      // Fast-forward past timeout
      jest.advanceTimersByTime(10000);

      // Should allow new logout
      const result = beginLogout('auto');
      expect(result).toBe(true);
      expect(currentLogoutSource()).toBe('auto');

      consoleSpy.mockRestore();
    });

    it('should force reset if previous logout timed out', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Start logout but don't complete it
      beginLogout('manual');
      expect(isLogoutInProgress()).toBe(true);

      // Fast-forward past timeout (this triggers automatic reset via timeout callback)
      jest.advanceTimersByTime(10000);

      // Should have been reset by timeout
      expect(isLogoutInProgress()).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout timeout reached')
      );

      // Now starting another logout should work without warning
      const result = beginLogout('auto');
      expect(result).toBe(true);
      expect(currentLogoutSource()).toBe('auto');

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('completeLogout', () => {
    it('should clear logout state and cancel timeout', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      beginLogout('manual');
      expect(isLogoutInProgress()).toBe(true);

      completeLogout();

      expect(isLogoutInProgress()).toBe(false);
      expect(currentLogoutSource()).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout completed successfully')
      );

      // Timeout should be cancelled - fast forward shouldn't trigger it
      jest.advanceTimersByTime(10000);
      expect(isLogoutInProgress()).toBe(false);

      consoleLogSpy.mockRestore();
    });

    it('should be safe to call even when not in progress', () => {
      expect(() => completeLogout()).not.toThrow();
      expect(isLogoutInProgress()).toBe(false);
    });
  });

  describe('markAuthenticated', () => {
    it('should clear logout state when user authenticates', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      beginLogout('auto');
      expect(isLogoutInProgress()).toBe(true);

      markAuthenticated();

      expect(isLogoutInProgress()).toBe(false);
      expect(currentLogoutSource()).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User authenticated')
      );

      consoleLogSpy.mockRestore();
    });

    it('should cancel any pending timeouts', () => {
      beginLogout('manual');
      markAuthenticated();

      // Fast-forward - timeout should not fire
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.advanceTimersByTime(10000);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(isLogoutInProgress()).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('resetLogoutState', () => {
    it('should call completeLogout', () => {
      beginLogout('manual');
      resetLogoutState();

      expect(isLogoutInProgress()).toBe(false);
      expect(currentLogoutSource()).toBe(null);
    });
  });

  describe('state queries', () => {
    it('isLogoutInProgress should return correct state', () => {
      expect(isLogoutInProgress()).toBe(false);

      beginLogout('manual');
      expect(isLogoutInProgress()).toBe(true);

      completeLogout();
      expect(isLogoutInProgress()).toBe(false);
    });

    it('currentLogoutSource should return correct source', () => {
      expect(currentLogoutSource()).toBe(null);

      beginLogout('manual');
      expect(currentLogoutSource()).toBe('manual');

      completeLogout();
      expect(currentLogoutSource()).toBe(null);
    });
  });

  describe('timeout edge cases', () => {
    it('should handle rapid logout attempts within timeout window', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      beginLogout('manual');

      // Try multiple times within the timeout
      jest.advanceTimersByTime(1000);
      expect(beginLogout('auto')).toBe(false);

      jest.advanceTimersByTime(1000);
      expect(beginLogout('manual')).toBe(false);

      // All should be rejected
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout already in progress')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle completeLogout called multiple times', () => {
      beginLogout('manual');
      completeLogout();

      // Should not throw
      expect(() => completeLogout()).not.toThrow();
      expect(() => completeLogout()).not.toThrow();
    });

    it('should handle logout sequence: begin -> complete -> begin', () => {
      // First logout
      expect(beginLogout('manual')).toBe(true);
      completeLogout();

      // Second logout should work
      expect(beginLogout('auto')).toBe(true);
      expect(currentLogoutSource()).toBe('auto');
      completeLogout();

      expect(isLogoutInProgress()).toBe(false);
    });
  });

  describe('timeout recovery', () => {
    it('should prevent infinite loops by forcing reset after 10 seconds', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Start logout but never complete it (simulates a stuck logout)
      beginLogout('manual');
      expect(isLogoutInProgress()).toBe(true);

      // Try to start another logout - should be blocked
      expect(beginLogout('auto')).toBe(false);

      // Fast-forward to just before timeout
      jest.advanceTimersByTime(9999);
      expect(isLogoutInProgress()).toBe(true);

      // Fast-forward past timeout
      jest.advanceTimersByTime(2);

      // Should be reset now
      expect(isLogoutInProgress()).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout timeout reached')
      );

      // New logout should work
      expect(beginLogout('auto')).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });
});
