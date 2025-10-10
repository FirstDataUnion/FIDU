/**
 * Intelligent Markdown Preprocessor for AI Chat Applications
 * 
 * This module provides smart preprocessing of markdown content to fix common issues
 * that occur in AI-generated text, particularly around list formatting and spacing.
 */

/**
 * Context-aware preprocessing rules for markdown content
 */
export interface MarkdownPreprocessingRules {
  /** Whether to enable smart list detection */
  enableSmartLists: boolean;
  /** Whether to preserve intentional formatting */
  preserveIntentionalFormatting: boolean;
  /** Whether to fix common spacing issues */
  fixSpacingIssues: boolean;
  /** Whether to normalize line breaks */
  normalizeLineBreaks: boolean;
}

/**
 * Default preprocessing rules optimized for AI chat content
 */
export const DEFAULT_RULES: MarkdownPreprocessingRules = {
  enableSmartLists: true,
  preserveIntentionalFormatting: true,
  fixSpacingIssues: true,
  normalizeLineBreaks: true,
};

/**
 * Smart detection of whether a hyphen should be treated as a bullet point
 * Based on context analysis and common patterns in AI-generated content
 */
function shouldTreatAsBulletPoint(text: string, hyphenIndex: number): boolean {
  const beforeHyphen = text.substring(Math.max(0, hyphenIndex - 10), hyphenIndex);
  const afterHyphen = text.substring(hyphenIndex + 1, Math.min(text.length, hyphenIndex + 20));
  
  // Check if it's at the start of a line (after whitespace/newline)
  const isAtLineStart = /^\s*$/.test(beforeHyphen) || beforeHyphen.endsWith('\n');
  
  // Check if there's a space after the hyphen
  const hasSpaceAfter = afterHyphen.startsWith(' ');
  
  // Check if it's followed by content that looks like a list item
  const looksLikeListItem = /^ [A-Za-z0-9]/.test(afterHyphen);
  
  // Check if it's in a context that suggests it's NOT a list (mid-sentence)
  const isMidSentence = /[a-zA-Z0-9]\s*-$/.test(beforeHyphen + '-');
  
  // Check if it's part of a compound word or range
  const isCompoundWord = /[a-zA-Z0-9]-[a-zA-Z0-9]/.test(text.substring(hyphenIndex - 1, hyphenIndex + 2));
  
  // Check if it's a negative number or mathematical expression
  const isNegativeNumber = /^\s*-[0-9]/.test(afterHyphen);
  
  // Check if it's part of a date range or similar
  const isDateRange = /[0-9]{4}-[0-9]{4}/.test(text.substring(hyphenIndex - 4, hyphenIndex + 5));
  
  return (
    isAtLineStart &&
    hasSpaceAfter &&
    looksLikeListItem &&
    !isMidSentence &&
    !isCompoundWord &&
    !isNegativeNumber &&
    !isDateRange
  );
}

/**
 * Preprocess markdown content to fix common AI-generated formatting issues
 */
export function preprocessMarkdown(
  content: string, 
  rules: MarkdownPreprocessingRules = DEFAULT_RULES
): string {
  if (!content) return '';
  
  let processed = content;
  
  
  
  
  // Normalize line breaks first
  if (rules.normalizeLineBreaks) {
    // First, protect code blocks from any modifications
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];
    let tempProcessed = processed.replace(codeBlockRegex, (match) => {
      codeBlocks.push(match);
      return `___CODEBLOCK_${codeBlocks.length - 1}___`;
    });
    
    // Handle different types of line breaks:
    // 1. Replace 3+ consecutive newlines with exactly 2 newlines (paragraph breaks)
    // BUT avoid creating paragraph breaks before lists
    tempProcessed = tempProcessed.replace(/\n{3,}/g, '\n\n');
    
    // 2. Fix paragraph breaks before lists - convert \n\n before lists to single \n
    tempProcessed = tempProcessed.replace(/\n\n(?=\s*[-*+]\s|\s*\d+\.\s)/g, '\n');
    
    // 3. Skip adding hard breaks to single newlines - let ReactMarkdown handle them naturally
    // This prevents excessive spacing in lists and other contexts
    
    // 4. Ensure blank lines (double newlines) remain as paragraph breaks
    // This is already handled by the above regex patterns
    
    // Restore code blocks
    tempProcessed = tempProcessed.replace(/___CODEBLOCK_(\d+)___/g, (_match, index) => {
      return codeBlocks[parseInt(index)];
    });
    
    processed = tempProcessed;
  }
  
  // Smart list processing - only fix obvious issues
  if (rules.enableSmartLists) {
    // Only fix hyphens that are clearly meant to be bullets but are malformed
    // Look for patterns like "text- item" (hyphen without space) and fix them
    processed = processed.replace(/([a-zA-Z0-9])-\s+([A-Za-z])/g, '$1\n- $2');
    
    // Skip adding newlines before numbered lists - this causes spacing issues
    // processed = processed.replace(/(\d+\.\s)/g, '\n$1');
    
    // Skip adding double newlines after headers - this causes spacing issues  
    // processed = processed.replace(/(#{1,6}\s.*?)(\n|$)/g, '$1\n\n');
  }
  
  // Fix spacing issues - be more conservative
  if (rules.fixSpacingIssues) {
    // Only remove spaces and tabs, NOT newlines - preserve paragraph breaks
    processed = processed
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces/tabs on new lines, but preserve newlines
      .replace(/[ \t]+\n/g, '\n'); // Remove trailing spaces/tabs before newlines, but preserve newlines
  }
  
  
  
  return processed;
}

/**
 * Enhanced message content formatter that uses intelligent preprocessing
 */
export function formatMessageContent(content: string): string {
  return preprocessMarkdown(content, DEFAULT_RULES);
}

/**
 * Validate markdown content for common issues
 */
export function validateMarkdownContent(content: string): {
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check for potential bullet point issues
  const hyphenMatches = content.match(/-/g);
  if (hyphenMatches && hyphenMatches.length > 0) {
    const lines = content.split('\n');
    let problematicHyphens = 0;
    
    lines.forEach((line, _index) => {
      const hyphenIndex = line.indexOf('-');
      if (hyphenIndex !== -1) {
        const globalIndex = content.indexOf(line) + hyphenIndex;
        if (!shouldTreatAsBulletPoint(content, globalIndex)) {
          problematicHyphens++;
        }
      }
    });
    
    if (problematicHyphens > 0) {
      issues.push(`Found ${problematicHyphens} hyphens that might be incorrectly rendered as bullet points`);
      suggestions.push('Consider using the preprocessMarkdown function to fix formatting issues');
    }
  }
  
  // Check for excessive line breaks
  const excessiveBreaks = content.match(/\n{3,}/g);
  if (excessiveBreaks) {
    issues.push('Found excessive line breaks that might affect readability');
    suggestions.push('Normalize line breaks to improve formatting');
  }
  
  // Check for malformed code blocks
  const codeBlocks = content.match(/```/g);
  if (codeBlocks && codeBlocks.length % 2 !== 0) {
    issues.push('Found unclosed code block');
    suggestions.push('Ensure all code blocks are properly closed with triple backticks');
  }
  
  return {
    hasIssues: issues.length > 0,
    issues,
    suggestions
  };
}
