/**
 * Utilities for transforming and managing Background Agents
 */

import type { BackgroundAgent } from '../api/backgroundAgents';
import type { AllAgentPreferences } from './agentPreferences';
import { BUILT_IN_BACKGROUND_AGENTS } from '../../data/backgroundAgents';

/**
 * Transform built-in agent templates to BackgroundAgent format,
 * merging with user preferences from localStorage
 */
export function transformBuiltInAgentsWithPreferences(
  preferences: AllAgentPreferences
): BackgroundAgent[] {
  return BUILT_IN_BACKGROUND_AGENTS.map(template => {
    const agentId = generateBuiltInAgentId(template.name);
    const userPrefs = preferences[agentId];

    // Merge context params with user preferences if strategy is 'lastNMessages'
    const contextParams =
      template.contextWindowStrategy === 'lastNMessages'
      && userPrefs?.contextLastN !== undefined
        ? { ...template.contextParams, lastN: userPrefs.contextLastN }
        : template.contextParams;

    return {
      id: agentId,
      name: template.name,
      description: template.description,
      enabled: userPrefs?.enabled ?? true, // Default to enabled, but allow user to disable
      actionType: template.actionType,
      promptTemplate: template.promptTemplate,
      runEveryNTurns: userPrefs?.runEveryNTurns ?? template.runEveryNTurns,
      verbosityThreshold:
        userPrefs?.verbosityThreshold ?? template.verbosityThreshold,
      contextWindowStrategy: template.contextWindowStrategy,
      contextParams: contextParams,
      outputSchemaName: template.outputSchemaName,
      customOutputSchema: template.customOutputSchema,
      notifyChannel: template.notifyChannel,
      modelId: userPrefs?.modelId ?? template.modelId ?? 'gpt-oss-120b', // Use preference, then template default, then fallback
      isSystem: true,
      categories: template.categories || [],
      version: template.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as BackgroundAgent;
  });
}

/**
 * Generate a consistent ID for a built-in agent from its name
 */
export function generateBuiltInAgentId(name: string): string {
  return `built-in-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Check if an agent is a built-in agent based on its ID
 */
export function isBuiltInAgent(agentId: string): boolean {
  return agentId.startsWith('built-in-');
}

/**
 * Get the display name for an agent's context strategy
 */
export function getContextStrategyDisplayName(
  strategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall'
): string {
  switch (strategy) {
    case 'lastNMessages':
      return 'Last N Messages';
    case 'summarizeThenEvaluate':
      return 'Summarize Then Evaluate';
    case 'fullThreadIfSmall':
      return 'Full Thread (if small)';
    default:
      return strategy;
  }
}

/**
 * Get a human-readable description of the context strategy
 */
export function getContextStrategyDescription(
  strategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall',
  params?: { lastN?: number; tokenLimit?: number }
): string {
  switch (strategy) {
    case 'lastNMessages':
      return `Analyzes the last ${params?.lastN || 6} messages`;
    case 'summarizeThenEvaluate':
      return 'Summarizes the conversation first, then evaluates';
    case 'fullThreadIfSmall':
      return `Uses full thread if under ${params?.tokenLimit || 4000} tokens`;
    default:
      return 'Custom context strategy';
  }
}
