import {
  migrateSyncSettings,
  getEffectiveSyncDelayMinutes,
  CURRENT_SYNC_DEFAULT_VERSION,
  DEFAULT_SYNC_DELAY_MINUTES,
} from '../syncSettingsMigration';

describe('syncSettingsMigration', () => {
  describe('migrateSyncSettings', () => {
    it('clears delay when version 1 and delay is 5 (old default)', () => {
      const result = migrateSyncSettings({
        syncDefaultVersion: 1,
        autoSyncDelayMinutes: 5,
      });
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBeUndefined();
    });

    it('clears delay when version is missing and delay is 5', () => {
      const result = migrateSyncSettings({ autoSyncDelayMinutes: 5 });
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBeUndefined();
    });

    it('clears delay when version 1 and delay is 1 or 2', () => {
      expect(
        migrateSyncSettings({
          syncDefaultVersion: 1,
          autoSyncDelayMinutes: 1,
        })
      ).toEqual({
        syncDefaultVersion: CURRENT_SYNC_DEFAULT_VERSION,
      });
      expect(
        migrateSyncSettings({
          syncDefaultVersion: 1,
          autoSyncDelayMinutes: 2,
        })
      ).toEqual({
        syncDefaultVersion: CURRENT_SYNC_DEFAULT_VERSION,
      });
    });

    it('keeps delay when version 1 and delay is greater than 5 (10, 15, 30)', () => {
      const result10 = migrateSyncSettings({
        syncDefaultVersion: 1,
        autoSyncDelayMinutes: 10,
      });
      expect(result10.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result10.autoSyncDelayMinutes).toBe(10);

      const result15 = migrateSyncSettings({
        syncDefaultVersion: 1,
        autoSyncDelayMinutes: 15,
      });
      expect(result15.autoSyncDelayMinutes).toBe(15);

      const result30 = migrateSyncSettings({
        syncDefaultVersion: 1,
        autoSyncDelayMinutes: 30,
      });
      expect(result30.autoSyncDelayMinutes).toBe(30);
    });

    it('missing version + delay 10 keeps delay and sets version 2', () => {
      const result = migrateSyncSettings({ autoSyncDelayMinutes: 10 });
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBe(10);
    });

    it('leaves unchanged when version is current and delay is 5', () => {
      const result = migrateSyncSettings({
        syncDefaultVersion: CURRENT_SYNC_DEFAULT_VERSION,
        autoSyncDelayMinutes: 5,
      });
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBe(5);
    });

    it('leaves unchanged when version is current and delay is 1', () => {
      const result = migrateSyncSettings({
        syncDefaultVersion: CURRENT_SYNC_DEFAULT_VERSION,
        autoSyncDelayMinutes: 1,
      });
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBe(1);
    });

    it('handles empty partial with no version (treated as v1, bumps to current)', () => {
      const result = migrateSyncSettings({});
      expect(result.syncDefaultVersion).toBe(CURRENT_SYNC_DEFAULT_VERSION);
      expect(result.autoSyncDelayMinutes).toBeUndefined();
    });
  });

  describe('getEffectiveSyncDelayMinutes', () => {
    it('returns default when syncSettings is undefined', () => {
      expect(getEffectiveSyncDelayMinutes(undefined)).toBe(
        DEFAULT_SYNC_DELAY_MINUTES
      );
    });

    it('returns default when autoSyncDelayMinutes is undefined', () => {
      expect(getEffectiveSyncDelayMinutes({ syncDefaultVersion: 2 })).toBe(
        DEFAULT_SYNC_DELAY_MINUTES
      );
    });

    it('returns stored value when set', () => {
      expect(
        getEffectiveSyncDelayMinutes({
          syncDefaultVersion: 2,
          autoSyncDelayMinutes: 5,
        })
      ).toBe(5);
    });
  });
});
