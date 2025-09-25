/**
 * Storage module exports
 * Provides a unified interface for storage operations in Chat Lab
 */

// Types
export * from './types';

// Storage service
export { storageService } from './StorageService';

// Unified storage service (main interface)
export { unifiedStorageService } from './UnifiedStorageService';

// Storage factory
export { storageFactory } from './StorageFactory';

// Adapters
export { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
export { CloudStorageAdapter } from './adapters/CloudStorageAdapter';
