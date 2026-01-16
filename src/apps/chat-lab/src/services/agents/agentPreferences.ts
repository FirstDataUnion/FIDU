/**
 * Shared utilities for managing Background Agent preferences in localStorage
 */

import { BACKGROUND_AGENT_PREFS_KEY } from './agentConstants';

export interface BackgroundAgentPreferences {
  runEveryNTurns: number;
  verbosityThreshold: number;
  contextLastN?: number; // For 'lastNMessages' strategy
  enabled?: boolean; // Optional: allows disabling built-in agents (defaults to true)
  modelId?: string; // Optional: model ID to use for evaluation (defaults to 'gpt-oss-120b')
}

export interface AllAgentPreferences {
  [agentId: string]: BackgroundAgentPreferences;
}

/**
 * Load all agent preferences from localStorage
 */
export const loadAgentPreferences = (): AllAgentPreferences => {
  try {
    const stored = localStorage.getItem(BACKGROUND_AGENT_PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load background agent preferences:', error);
    return {};
  }
};

/**
 * Save all agent preferences to localStorage
 */
export const saveAgentPreferences = (prefs: AllAgentPreferences): void => {
  try {
    localStorage.setItem(BACKGROUND_AGENT_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to save background agent preferences:', error);
  }
};

/**
 * Get preferences for a specific agent
 */
export const getAgentPreference = (
  agentId: string
): BackgroundAgentPreferences | null => {
  const allPrefs = loadAgentPreferences();
  return allPrefs[agentId] || null;
};

/**
 * Set preferences for a specific agent
 */
export const setAgentPreference = (
  agentId: string,
  prefs: Partial<BackgroundAgentPreferences>
): void => {
  const allPrefs = loadAgentPreferences();
  allPrefs[agentId] = {
    ...(allPrefs[agentId] || {}),
    ...prefs,
  } as BackgroundAgentPreferences;
  saveAgentPreferences(allPrefs);
};

/**
 * Delete preferences for a specific agent
 */
export const deleteAgentPreference = (agentId: string): void => {
  const allPrefs = loadAgentPreferences();
  delete allPrefs[agentId];
  saveAgentPreferences(allPrefs);
};

/**
 * Clear all agent preferences
 */
export const clearAllAgentPreferences = (): void => {
  try {
    localStorage.removeItem(BACKGROUND_AGENT_PREFS_KEY);
  } catch (error) {
    console.warn('Failed to clear background agent preferences:', error);
  }
};
