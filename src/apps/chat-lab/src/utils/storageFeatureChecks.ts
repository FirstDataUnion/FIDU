import type { StorageAdapter } from '../services/storage/types';

/**
 * Check if the adapter supports document operations
 */
export function supportsDocuments(adapter: StorageAdapter): boolean {
  return ['getDocuments', 'createDocument', 'updateDocument', 'deleteDocument']
    .every(method => hasFeature(adapter, method));
}

/**
 * Check if the adapter supports background agent operations
 */
export function supportsBackgroundAgents(adapter: StorageAdapter): boolean {
  return ['getBackgroundAgents', 'createBackgroundAgent', 'updateBackgroundAgent', 'deleteBackgroundAgent']
    .every(method => hasFeature(adapter, method));
}

/**
 * Generic feature check helper
 */
export function hasFeature(adapter: StorageAdapter, methodName: string): boolean {
  return typeof (adapter as any)[methodName] === 'function';
}

