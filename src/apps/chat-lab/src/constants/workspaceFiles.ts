/**
 * Constants for workspace file names used in Google Drive
 * These are the standard file names used for shared workspace data storage
 */

// Database file names (with version suffix)
export const CONVERSATIONS_DB_FILENAME = 'fidu_conversations_v1.db';
export const METADATA_JSON_FILENAME = 'workspace-metadata.json';

// File name prefixes (for pattern matching)
export const CONVERSATIONS_DB_PREFIX = 'fidu_conversations_v';
export const API_KEYS_DB_PREFIX = 'fidu_api_keys_v';
export const METADATA_JSON_PREFIX = 'fidu_metadata_v';

/**
 * Get the conversations database filename for a specific version
 */
export function getConversationsDbFilename(version: string = '1'): string {
  return `fidu_conversations_v${version}.db`;
}

/**
 * Get the API keys database filename for a specific version
 */
export function getApiKeysDbFilename(version: string = '1'): string {
  return `fidu_api_keys_v${version}.db`;
}

/**
 * Get the metadata JSON filename for a specific version
 */
export function getMetadataJsonFilename(version: string = '1'): string {
  return `fidu_metadata_v${version}.json`;
}
