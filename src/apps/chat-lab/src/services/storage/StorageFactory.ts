/**
 * Storage Factory
 * Creates storage adapters based on configuration
 */

import type { StorageAdapter, StorageConfig } from './types';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { CloudStorageAdapter } from './adapters/CloudStorageAdapter';
import { FileSystemStorageAdapter } from './adapters/FileSystemStorageAdapter';

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.mode) {
    case 'local':
      return new LocalStorageAdapter(config);
    case 'cloud':
      return new CloudStorageAdapter(config);
    case 'filesystem':
      return new FileSystemStorageAdapter(config);
    default:
      throw new Error(`Unsupported storage mode: ${config.mode}`);
  }
}
