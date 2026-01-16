/**
 * Logout Coordinator
 *
 * Prevents multiple simultaneous logout operations and provides automatic timeout recovery.
 * This prevents infinite logout loops by ensuring stale logout states are automatically cleared.
 */

export type LogoutSource = 'manual' | 'auto';

interface LogoutState {
  inProgress: boolean;
  source: LogoutSource | null;
  startTime: number | null;
  timeoutId: number | null;
}

const LOGOUT_TIMEOUT_MS = 10000; // 10 second timeout for logout operations

const state: LogoutState = {
  inProgress: false,
  source: null,
  startTime: null,
  timeoutId: null,
};

/**
 * Begin a logout operation
 *
 * @param source - The source of the logout (manual or auto)
 * @returns true if logout can proceed, false if already in progress
 */
export function beginLogout(source: LogoutSource): boolean {
  // If logout is already in progress, check for timeout
  if (state.inProgress) {
    const now = Date.now();
    const isTimedOut =
      state.startTime && now - state.startTime > LOGOUT_TIMEOUT_MS;

    if (isTimedOut) {
      console.warn(
        '⚠️ [LogoutCoordinator] Previous logout timed out after 10s, forcing reset'
      );
      forceResetLogoutState();
    } else {
      console.log(
        `🔁 [LogoutCoordinator] Logout already in progress (${state.source}), rejecting new ${source} logout`
      );
      return false;
    }
  }

  // Start new logout operation
  state.inProgress = true;
  state.source = source;
  state.startTime = Date.now();

  // Set timeout to auto-reset if logout gets stuck
  state.timeoutId = window.setTimeout(() => {
    console.error(
      '❌ [LogoutCoordinator] Logout timeout reached - forcing reset to prevent infinite loop'
    );
    forceResetLogoutState();
  }, LOGOUT_TIMEOUT_MS);

  console.log(`🚀 [LogoutCoordinator] Starting ${source} logout`);
  return true;
}

/**
 * Complete the logout operation successfully
 * Clears the timeout and resets state
 */
export function completeLogout(): void {
  console.log(
    `✅ [LogoutCoordinator] Logout completed successfully (source: ${state.source})`
  );

  if (state.timeoutId !== null) {
    window.clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  state.inProgress = false;
  state.source = null;
  state.startTime = null;
}

/**
 * Check if logout is currently in progress
 */
export function isLogoutInProgress(): boolean {
  return state.inProgress;
}

/**
 * Get the current logout source
 */
export function currentLogoutSource(): LogoutSource | null {
  return state.source;
}

/**
 * Mark user as authenticated (used after successful login)
 * Clears any stale logout state
 */
export function markAuthenticated(): void {
  console.log(
    '✅ [LogoutCoordinator] User authenticated - clearing logout state'
  );
  forceResetLogoutState();
}

/**
 * Reset logout state (graceful)
 * Used when logout completes normally
 */
export function resetLogoutState(): void {
  completeLogout();
}

/**
 * Force reset logout state (emergency)
 * Used when logout times out or gets stuck
 */
function forceResetLogoutState(): void {
  if (state.timeoutId !== null) {
    window.clearTimeout(state.timeoutId);
  }

  state.inProgress = false;
  state.source = null;
  state.startTime = null;
  state.timeoutId = null;
}
