/**
 * App Version Utility
 * 
 * Central source of truth for the application version.
 * Reads from package.json at build time via Vite's define plugin.
 * 
 * Usage:
 *   import { APP_VERSION, getVersionDisplay } from './utils/version';
 */

// Read version from Vite's injected environment variable
// This is set at build time from package.json via vite.config.ts
const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.7';

// Export the version constant
export const APP_VERSION = appVersion;

// Export a helper to format version for display
export const getVersionDisplay = (): string => {
  return `v${APP_VERSION}`;
};

// Export a helper to check if version matches a pattern
export const isVersionAtLeast = (minVersion: string): boolean => {
  const [major, minor, patch] = APP_VERSION.split('.').map(Number);
  const [minMajor, minMinor, minPatch] = minVersion.split('.').map(Number);
  
  if (major > minMajor) return true;
  if (major < minMajor) return false;
  if (minor > minMinor) return true;
  if (minor < minMinor) return false;
  return patch >= minPatch;
};


