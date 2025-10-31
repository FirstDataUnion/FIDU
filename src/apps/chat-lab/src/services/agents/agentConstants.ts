/**
 * Constants for Background Agent configuration
 */

export const DEFAULT_AGENT_CONFIG = {
  /** Default cadence: run every N turns */
  RUN_EVERY_N_TURNS: 6,
  
  /** Default verbosity threshold (0-100, alerts when rating ≤ threshold) */
  VERBOSITY_THRESHOLD: 40,
  
  /** Default number of messages to include in context window */
  CONTEXT_LAST_N_MESSAGES: 6,
  
  /** Minimum allowed turns value */
  MIN_TURNS: 1,
  
  /** Maximum allowed turns value */
  MAX_TURNS: 100,
  
  /** Minimum threshold value */
  MIN_THRESHOLD: 0,
  
  /** Maximum threshold value */
  MAX_THRESHOLD: 100,
  
  /** Minimum context messages value */
  MIN_CONTEXT_MESSAGES: 1,
  
  /** Maximum context messages value */
  MAX_CONTEXT_MESSAGES: 100,
} as const;

/**
 * Threshold presets for common use cases
 */
export const THRESHOLD_PRESETS = {
  CRITICAL_ONLY: 20,
  IMPORTANT: 40,
  BALANCED: 60,
  SENSITIVE: 80,
  ALL_ISSUES: 100,
} as const;

/**
 * Alert auto-hide duration in milliseconds
 */
export const ALERT_AUTO_HIDE_DURATION = 5000;

/**
 * LocalStorage key for background agent preferences
 */
export const BACKGROUND_AGENT_PREFS_KEY = 'fidu-chat-lab-backgroundAgentPrefs';

/**
 * Debounce delay for preference saves (milliseconds)
 */
export const PREFERENCE_SAVE_DEBOUNCE_MS = 300;

