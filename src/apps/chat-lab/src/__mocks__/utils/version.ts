/**
 * Mock version utility for Jest tests
 */
export const APP_VERSION = '0.1.7';

export const getVersionDisplay = (): string => {
  return `v${APP_VERSION}`;
};

export const isVersionAtLeast = (minVersion: string): boolean => {
  const [major, minor, patch] = APP_VERSION.split('.').map(Number);
  const [minMajor, minMinor, minPatch] = minVersion.split('.').map(Number);

  if (major > minMajor) return true;
  if (major < minMajor) return false;
  if (minor > minMinor) return true;
  if (minor < minMinor) return false;
  return patch >= minPatch;
};
