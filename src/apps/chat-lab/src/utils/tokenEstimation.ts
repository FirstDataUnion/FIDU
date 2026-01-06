/**
 * Simple token estimation utilities
 * Uses a rough approximation: ~4 characters per token for English text
 * This is a basic estimation and may not be accurate for all languages or content types
 */

/**
 * Estimate token count from text
 * Uses approximation: ~4 characters per token
 * For more accuracy, we could use word count * 1.3, but character-based is simpler
 * 
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  
  // Simple approximation: ~4 characters per token
  // This is a rough estimate that works reasonably well for English text
  // Actual tokenization can vary, but this gives users a ballpark figure
  return Math.ceil(text.trim().length / 4);
}

/**
 * Estimate tokens for a context object
 * Includes both title and body in the calculation
 * 
 * @param context - Context object with title and body
 * @returns Estimated token count
 */
export function estimateContextTokens(context: { title?: string; body?: string }): number {
  const title = context.title || '';
  const body = context.body || '';
  const combined = `${title} ${body}`.trim();
  
  return estimateTokens(combined);
}

/**
 * Get display token count for a context
 * Returns the stored tokenCount if available and > 0, otherwise estimates it
 * 
 * @param context - Context object with optional tokenCount, title, and body
 * @returns Token count for display
 */
export function getContextTokenCount(context: { tokenCount?: number; title?: string; body?: string }): number {
  // Use stored token count if available and non-zero
  if (context.tokenCount && context.tokenCount > 0) {
    return context.tokenCount;
  }
  
  // Otherwise estimate from content
  return estimateContextTokens(context);
}

