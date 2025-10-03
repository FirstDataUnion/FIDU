/**
 * Protected tags that cannot be deleted from conversations
 * These tags are essential for proper conversation identification and filtering
 */
export const PROTECTED_TAGS = [
  'Chat-Bot-Conversation',
  'FIDU-CHAT-LAB-Conversation'
] as const;

export type ProtectedTag = typeof PROTECTED_TAGS[number];

/**
 * Check if a tag is protected and cannot be deleted
 */
export const isProtectedTag = (tag: string): tag is ProtectedTag => {
  return PROTECTED_TAGS.includes(tag as ProtectedTag);
};

/**
 * Filter out protected tags from a list of tags
 * Used when allowing users to manage only non-protected tags
 */
export const getManageableTags = (tags: string[]): string[] => {
  return tags.filter(tag => !isProtectedTag(tag));
};

/**
 * Ensure protected tags are always included in a conversation's tags
 * Used when updating conversation tags to prevent accidental removal
 */
export const ensureProtectedTags = (tags: string[]): string[] => {
  const manageableTags = getManageableTags(tags);
  return [...PROTECTED_TAGS, ...manageableTags];
};
