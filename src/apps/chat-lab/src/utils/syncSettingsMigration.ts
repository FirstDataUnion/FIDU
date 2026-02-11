/**
 * Sync settings default versioning and migration.
 * One-time migration from version 1 (or missing): set version = 2 and clear
 * delay to "use default" unless the stored value was > 5 minutes (user wanted
 * longer than the previous default). Future default changes need no migration—
 * just update DEFAULT_SYNC_DELAY_MINUTES; users on "use default" get the new value.
 */

export const CURRENT_SYNC_DEFAULT_VERSION = 2;
export const DEFAULT_SYNC_DELAY_MINUTES = 1;

interface SyncSettingsV0 {
  autoSyncDelayMinutes: number;
}

interface SyncSettingsV1 {
  syncDefaultVersion: 1;
  autoSyncDelayMinutes: number;
}

export interface SyncSettings {
  syncDefaultVersion: 2;
  autoSyncDelayMinutes?: number;
}

export type HistoricalSyncSettings =
  | SyncSettingsV0
  | SyncSettingsV1
  | SyncSettings;
type SyncSettingsAbove0 = SyncSettingsV1 | SyncSettings;
type SyncSettingsAbove1 = SyncSettings;

/**
 * Migrates sync settings from storage. Only runs when syncDefaultVersion is 1 or
 * missing: sets version = 2 and autoSyncDelayMinutes to undefined (use default)
 * unless the current value is > 5 (keep explicit longer delay).
 */
export function migrateSyncSettings(
  settings: HistoricalSyncSettings
): SyncSettings {
  const v1 = migrateToV1(settings);
  const v2 = migrateToV2(v1);

  if (v2.syncDefaultVersion !== CURRENT_SYNC_DEFAULT_VERSION) {
    console.warn(
      '🔍 [migrateSyncSettings] Sync settings version mismatch. You may need to add a migration block.',
      {
        expected: CURRENT_SYNC_DEFAULT_VERSION,
        actual: v2.syncDefaultVersion,
      }
    );
  }

  return v2;
}

function migrateToV1(settings: HistoricalSyncSettings): SyncSettingsAbove0 {
  if (!('syncDefaultVersion' in settings)) {
    return {
      ...settings,
      syncDefaultVersion: 1,
      autoSyncDelayMinutes:
        settings.autoSyncDelayMinutes ?? DEFAULT_SYNC_DELAY_MINUTES,
    };
  }
  return settings;
}

function migrateToV2(settings: SyncSettingsAbove0): SyncSettingsAbove1 {
  if (settings.syncDefaultVersion === 1) {
    if (settings.autoSyncDelayMinutes && settings.autoSyncDelayMinutes <= 5) {
      return {
        ...settings,
        autoSyncDelayMinutes: undefined,
        syncDefaultVersion: 2,
      };
    } else {
      return { ...settings, syncDefaultVersion: 2 };
    }
  }
  return settings;
}

/**
 * Returns the effective sync delay in minutes (user choice or app default).
 */
export function getEffectiveSyncDelayMinutes(
  syncSettings: Partial<SyncSettings> | undefined
): number {
  return syncSettings?.autoSyncDelayMinutes ?? DEFAULT_SYNC_DELAY_MINUTES;
}
