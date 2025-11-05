/**
 * Utility functions for detecting potentially long-running requests
 * and providing appropriate user feedback
 */

import { getModelConfigs } from '../data/models';

export interface LongRequestAnalysis {
  isLikelyLongRunning: boolean;
  estimatedDuration: 'short' | 'medium' | 'long';
  reasons: string[];
  modelSpeed: 'fast' | 'medium' | 'slow';
  promptLength: number;
  hasLargeContext: boolean;
}

/**
 * Analyze a request to determine if it's likely to take a long time
 */
export function analyzeRequestDuration(
  prompt: string,
  modelId: string,
  contextLength: number = 0,
  conversationLength: number = 0
): LongRequestAnalysis {
  const modelConfig = getModelConfigs()[modelId];
  const promptLength = prompt.length;
  
  const reasons: string[] = [];
  let estimatedDuration: 'short' | 'medium' | 'long' = 'short';
  
  // Check model speed
  const modelSpeed = modelConfig?.speed || 'medium';
  
  // Analyze prompt length
  const hasLargePrompt = promptLength > 2000;
  const hasVeryLargePrompt = promptLength > 5000;
  
  // Analyze context and conversation length
  const hasLargeContext = contextLength > 1000 || conversationLength > 2000;
  const hasVeryLargeContext = contextLength > 5000 || conversationLength > 10000;
  
  // Determine if likely long-running
  let isLikelyLongRunning = false;
  
  // Slow models are always potentially long-running
  if (modelSpeed === 'slow') {
    isLikelyLongRunning = true;
    reasons.push('Using a slow model');
    estimatedDuration = 'long';
  }
  
  // Medium models with large inputs
  if (modelSpeed === 'medium' && (hasLargePrompt || hasLargeContext)) {
    isLikelyLongRunning = true;
    reasons.push('Medium-speed model with large input');
    estimatedDuration = 'long';
  }
  
  // Fast models with very large inputs
  if (modelSpeed === 'fast' && (hasVeryLargePrompt || hasVeryLargeContext)) {
    isLikelyLongRunning = true;
    reasons.push('Large input size');
    estimatedDuration = 'medium';
  }
  
  // Very large inputs regardless of model speed
  if (hasVeryLargePrompt && hasVeryLargeContext) {
    isLikelyLongRunning = true;
    reasons.push('Very large prompt and context');
    estimatedDuration = 'long';
  }
  
  // Add specific reasons
  if (hasLargePrompt) {
    reasons.push(`Large prompt (${promptLength.toLocaleString()} characters)`);
  }
  
  if (hasLargeContext) {
    reasons.push(`Large context (${(contextLength + conversationLength).toLocaleString()} characters)`);
  }
  
  return {
    isLikelyLongRunning,
    estimatedDuration,
    reasons,
    modelSpeed,
    promptLength,
    hasLargeContext
  };
}

/**
 * Get user-friendly message explaining why a request might take long
 */
export function getLongRequestMessage(analysis: LongRequestAnalysis): string {
  if (!analysis.isLikelyLongRunning) {
    return '';
  }
  
  const durationText = analysis.estimatedDuration === 'long' 
    ? 'several minutes' 
    : analysis.estimatedDuration === 'medium' 
    ? '1-2 minutes' 
    : '30-60 seconds';
  
  const reasonsText = analysis.reasons.length > 1 
    ? analysis.reasons.slice(0, -1).join(', ') + ', and ' + analysis.reasons[analysis.reasons.length - 1]
    : analysis.reasons[0];
  
  return `This request may take ${durationText} to process due to ${reasonsText.toLowerCase()}. We'll wait up to 10 minutes for the model to respond.`;
}

/**
 * Check if we should show the long request warning
 */
export function shouldShowLongRequestWarning(analysis: LongRequestAnalysis): boolean {
  return analysis.isLikelyLongRunning;
}

