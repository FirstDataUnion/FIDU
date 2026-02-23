/**
 * Storage Factory
 * Creates storage adapters based on configuration
 */

import type { StorageAdapter, StorageConfig } from './types';
import { CloudStorageAdapter } from './adapters/CloudStorageAdapter';

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.mode) {
    case 'cloud':
      return new CloudStorageAdapter(config);
    default:
      throw new Error(`Unsupported storage mode: ${config.mode}`);
  }
}
