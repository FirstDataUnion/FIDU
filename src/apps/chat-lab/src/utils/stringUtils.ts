/**
 * Truncate a title to a maximum length, adding ellipsis if truncated
 * @param title - The title to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated title with ellipsis if needed
 */
export function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}
