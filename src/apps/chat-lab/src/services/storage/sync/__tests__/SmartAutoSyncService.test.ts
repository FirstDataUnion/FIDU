/**
 * Tests for SmartAutoSyncService
 * Covers exponential backoff, sync health tracking, token refresh, and infinite retry behavior
 */

import { SmartAutoSyncService } from '../SmartAutoSyncService';
import { SyncService } from '../SyncService';
import { GoogleDriveAuthService } from '../../../auth/GoogleDriveAuth';
import { unsyncedDataManager } from '../../UnsyncedDataManager';
import { getFiduAuthService } from '../../../auth/FiduAuthService';

// Mock dependencies
jest.mock('../SyncService');
jest.mock('../../UnsyncedDataManager', () => ({
  unsyncedDataManager: {
    hasUnsynced: jest.fn().mockReturnValue(false),
    markAsSynced: jest.fn(),
    addListener: jest.fn().mockReturnValue(() => {}),
  },
}));
jest.mock('../../../auth/FiduAuthService', () => ({
  getFiduAuthService: jest.fn(),
}));

describe('SmartAutoSyncService', () => {
  let mockSyncService: jest.Mocked<SyncService>;
  let mockAuthService: jest.Mocked<GoogleDriveAuthService>;
  let mockFiduAuthService: any;

  // Helper to create a SmartAutoSyncService
  function createService(
    config: Partial<{
      delayMinutes: number;
      retryDelayMinutes: number;
      maxRetryDelayMinutes: number;
    }> = {},
    workspaceId: string = 'default'
  ): SmartAutoSyncService {
    return new SmartAutoSyncService(mockSyncService, config, workspaceId);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();

    // Setup mock GoogleDriveAuthService
    mockAuthService = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      restoreFromCookies: jest.fn().mockResolvedValue(true),
      getCachedUser: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<GoogleDriveAuthService>;

    // Setup mock SyncService
    mockSyncService = {
      syncToDrive: jest.fn().mockResolvedValue(undefined),
      getAuthService: jest.fn().mockReturnValue(mockAuthService),
    } as unknown as jest.Mocked<SyncService>;

    // Setup mock FIDU auth service
    mockFiduAuthService = {
      ensureAccessToken: jest.fn().mockResolvedValue('mock-token'),
    };
    (getFiduAuthService as jest.Mock).mockReturnValue(mockFiduAuthService);

    // Reset mock unsyncedDataManager (already mocked at module level)
    (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(false);
    (unsyncedDataManager.markAsSynced as jest.Mock).mockReturnValue(undefined);
    (unsyncedDataManager.addListener as jest.Mock).mockReturnValue(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const service = createService();
      const status = service.getStatus();

      expect(status.config.delayMinutes).toBe(5);
      expect(status.config.retryDelayMinutes).toBe(10);
      expect(status.config.maxRetryDelayMinutes).toBe(60);
    });

    it('should use provided config values', () => {
      const service = createService({
        delayMinutes: 10,
        retryDelayMinutes: 20,
        maxRetryDelayMinutes: 120,
      });
      const status = service.getStatus();

      expect(status.config.delayMinutes).toBe(10);
      expect(status.config.retryDelayMinutes).toBe(20);
      expect(status.config.maxRetryDelayMinutes).toBe(120);
    });

    it('should initialize with healthy state', () => {
      const service = createService();
      const status = service.getStatus();

      expect(status.syncHealth).toBe('healthy');
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastSuccessfulSync).toBeNull();
      expect(status.lastError).toBeNull();
    });
  });

  describe('Sync Health State', () => {
    it('should return healthy when no failures', () => {
      const service = createService();
      expect(service.getSyncHealth()).toBe('healthy');
    });

    it('should return degraded after 1-2 failures', () => {
      const service = createService();

      // Simulate failures by directly accessing private state (via any)
      // In real code, failures happen through handleSyncFailure()
      (service as any).healthState.consecutiveFailures = 1;
      expect(service.getSyncHealth()).toBe('degraded');

      (service as any).healthState.consecutiveFailures = 2;
      expect(service.getSyncHealth()).toBe('degraded');
    });

    it('should return failing after 3+ failures', () => {
      const service = createService();

      (service as any).healthState.consecutiveFailures = 3;
      expect(service.getSyncHealth()).toBe('failing');

      (service as any).healthState.consecutiveFailures = 10;
      expect(service.getSyncHealth()).toBe('failing');
    });

    it('should update status object with health information', () => {
      const service = createService();
      (service as any).healthState.consecutiveFailures = 1;

      const status = service.getStatus();
      expect(status.syncHealth).toBe('degraded');
      expect(status.consecutiveFailures).toBe(1);
    });
  });

  describe('Exponential Backoff', () => {
    beforeEach(() => {
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);
    });

    it('should calculate correct delays: 10min, 20min, 40min, then cap at 60min', () => {
      const service = createService({
        retryDelayMinutes: 10,
        maxRetryDelayMinutes: 60,
      });

      // handleSyncFailure increments consecutiveFailures, so we start from 0
      // First failure (becomes 1 after increment)
      (service as any).healthState.consecutiveFailures = 0;
      (service as any).handleSyncFailure();

      let status = service.getStatus();
      expect(status.consecutiveFailures).toBe(1);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      if (status.nextSyncScheduledFor) {
        const delayMs = status.nextSyncScheduledFor.getTime() - Date.now();
        const delayMinutes = delayMs / (60 * 1000);
        expect(delayMinutes).toBeCloseTo(10, 0); // 10 * 2^(1-1) = 10
      }

      // Second failure (becomes 2 after increment)
      (service as any).healthState.consecutiveFailures = 1;
      (service as any).handleSyncFailure();

      status = service.getStatus();
      expect(status.consecutiveFailures).toBe(2);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      if (status.nextSyncScheduledFor) {
        const delayMs = status.nextSyncScheduledFor.getTime() - Date.now();
        const delayMinutes = delayMs / (60 * 1000);
        expect(delayMinutes).toBeCloseTo(20, 0); // 10 * 2^(2-1) = 20
      }

      // Third failure (becomes 3 after increment)
      (service as any).healthState.consecutiveFailures = 2;
      (service as any).handleSyncFailure();

      status = service.getStatus();
      expect(status.consecutiveFailures).toBe(3);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      if (status.nextSyncScheduledFor) {
        const delayMs = status.nextSyncScheduledFor.getTime() - Date.now();
        const delayMinutes = delayMs / (60 * 1000);
        expect(delayMinutes).toBeCloseTo(40, 0); // 10 * 2^(3-1) = 40
      }

      // Fourth failure - should cap at 60 minutes (becomes 4 after increment)
      (service as any).healthState.consecutiveFailures = 3;
      (service as any).handleSyncFailure();

      status = service.getStatus();
      expect(status.consecutiveFailures).toBe(4);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      if (status.nextSyncScheduledFor) {
        const delayMs = status.nextSyncScheduledFor.getTime() - Date.now();
        const delayMinutes = delayMs / (60 * 1000);
        expect(delayMinutes).toBeCloseTo(60, 0); // min(10 * 2^(4-1) = 80, 60) = 60
      }

      // Fifth failure - should still cap at 60 minutes (becomes 5 after increment)
      (service as any).healthState.consecutiveFailures = 4;
      (service as any).handleSyncFailure();

      status = service.getStatus();
      expect(status.consecutiveFailures).toBe(5);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      if (status.nextSyncScheduledFor) {
        const delayMs = status.nextSyncScheduledFor.getTime() - Date.now();
        const delayMinutes = delayMs / (60 * 1000);
        expect(delayMinutes).toBeCloseTo(60, 0); // Still capped at 60
      }
    });

    it('should never stop retrying (no max retries)', () => {
      const service = createService();

      // Simulate many failures - the service should always schedule a retry
      // handleSyncFailure increments, so we set to i-1 before calling it
      for (let i = 1; i <= 20; i++) {
        (service as any).healthState.consecutiveFailures = i - 1;
        (service as any).handleSyncFailure();

        const status = service.getStatus();
        expect(status.consecutiveFailures).toBe(i);
        expect(status.nextSyncScheduledFor).toBeTruthy(); // Should always have next retry scheduled

        // Verify it never stops (no "giving up" behavior)
        const healthStatus = service.getSyncHealth();
        expect(['degraded', 'failing']).toContain(healthStatus); // Should be in a retry state
      }

      // Even after 20 failures, should still be scheduling retries
      const finalStatus = service.getStatus();
      expect(finalStatus.consecutiveFailures).toBe(20);
      expect(finalStatus.nextSyncScheduledFor).toBeTruthy(); // Still retrying
    });
  });

  describe('Token Refresh on Retries', () => {
    beforeEach(() => {
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);
    });

    it('should refresh tokens proactively when consecutiveFailures > 0', async () => {
      const service = createService();
      service.enable();

      // First failure
      mockSyncService.syncToDrive.mockRejectedValueOnce(
        new Error('Sync failed')
      );
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Second attempt (retry) - should call token refresh
      mockSyncService.syncToDrive.mockRejectedValueOnce(
        new Error('Sync failed again')
      );
      jest.advanceTimersByTime(10 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Verify token refresh was called (check that getAuthService was called)
      expect(mockSyncService.getAuthService).toHaveBeenCalled();
    });

    it('should continue with sync even if token refresh fails', async () => {
      const service = createService();
      service.enable();

      // Make token refresh fail
      mockFiduAuthService.ensureAccessToken.mockRejectedValueOnce(
        new Error('Token refresh failed')
      );

      // First failure
      mockSyncService.syncToDrive.mockRejectedValueOnce(
        new Error('Sync failed')
      );
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Second attempt should still proceed
      mockSyncService.syncToDrive.mockRejectedValueOnce(
        new Error('Sync failed again')
      );
      jest.advanceTimersByTime(10 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Sync should still have been attempted
      expect(mockSyncService.syncToDrive).toHaveBeenCalledTimes(2);
    });
  });

  describe('localStorage Persistence', () => {
    it('should save lastSuccessfulSync to localStorage', async () => {
      const service = createService({}, 'test-workspace');
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);
      service.enable();

      // Successful sync
      mockSyncService.syncToDrive.mockResolvedValueOnce(undefined);
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runAllTimersAsync();

      // Check localStorage
      const stored = localStorage.getItem('fidu_sync_health_test-workspace');
      expect(stored).toBeTruthy();

      const data = JSON.parse(stored!);
      expect(data.lastSuccessfulSync).toBeTruthy();
      expect(new Date(data.lastSuccessfulSync)).toBeInstanceOf(Date);
    });

    it('should load lastSuccessfulSync from localStorage on initialization', () => {
      const savedTime = new Date('2024-01-01T12:00:00Z');
      localStorage.setItem(
        'fidu_sync_health_test-workspace',
        JSON.stringify({
          lastSuccessfulSync: savedTime.toISOString(),
        })
      );

      const service = createService({}, 'test-workspace');
      const status = service.getStatus();

      expect(status.lastSuccessfulSync).toBeTruthy();
      if (status.lastSuccessfulSync) {
        expect(status.lastSuccessfulSync.getTime()).toBe(savedTime.getTime());
      }
    });

    it('should use workspace-specific storage keys', () => {
      localStorage.setItem(
        'fidu_sync_health_workspace-1',
        JSON.stringify({
          lastSuccessfulSync: new Date('2024-01-01T12:00:00Z').toISOString(),
        })
      );
      localStorage.setItem(
        'fidu_sync_health_workspace-2',
        JSON.stringify({
          lastSuccessfulSync: new Date('2024-01-02T12:00:00Z').toISOString(),
        })
      );

      const service1 = createService({}, 'workspace-1');
      const service2 = createService({}, 'workspace-2');

      const status1 = service1.getStatus();
      const status2 = service2.getStatus();

      expect(status1.lastSuccessfulSync?.getTime()).toBe(
        new Date('2024-01-01T12:00:00Z').getTime()
      );
      expect(status2.lastSuccessfulSync?.getTime()).toBe(
        new Date('2024-01-02T12:00:00Z').getTime()
      );
    });

    it('should not persist consecutiveFailures (resets on page load)', () => {
      // Simulate saved state with consecutive failures (which shouldn't be saved)
      const service = createService({}, 'test-workspace');
      (service as any).healthState.consecutiveFailures = 5;

      // Create new service instance (simulating page reload)
      const newService = createService({}, 'test-workspace');
      const status = newService.getStatus();

      // Should start fresh
      expect(status.consecutiveFailures).toBe(0);
    });
  });

  describe('Force Sync', () => {
    it('should reset consecutiveFailures on successful force sync', async () => {
      const service = createService();
      (service as any).healthState.consecutiveFailures = 3;
      (service as any).healthState.lastError = 'Previous error';

      mockSyncService.syncToDrive.mockResolvedValueOnce(undefined);

      await service.forceSync();

      const status = service.getStatus();
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastError).toBeNull();
      expect(status.lastSuccessfulSync).toBeTruthy();
    });

    it('should update lastSuccessfulSync on successful force sync', async () => {
      const service = createService();
      const beforeTime = new Date();

      mockSyncService.syncToDrive.mockResolvedValueOnce(undefined);
      await service.forceSync();

      const status = service.getStatus();
      expect(status.lastSuccessfulSync).toBeTruthy();
      if (status.lastSuccessfulSync) {
        expect(status.lastSuccessfulSync.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
      }
    });

    it('should update lastError on failed force sync but not reset counter', async () => {
      const service = createService();
      (service as any).healthState.consecutiveFailures = 2;

      const error = new Error('Force sync failed');
      mockSyncService.syncToDrive.mockRejectedValueOnce(error);

      await expect(service.forceSync()).rejects.toThrow('Force sync failed');

      const status = service.getStatus();
      expect(status.lastError).toBe('Force sync failed');
      expect(status.consecutiveFailures).toBe(2); // Should not increment for manual sync
    });
  });

  describe('Status Reporting', () => {
    it('should include all health fields in status', () => {
      const service = createService();
      const status = service.getStatus();

      expect(status).toHaveProperty('syncHealth');
      expect(status).toHaveProperty('consecutiveFailures');
      expect(status).toHaveProperty('lastSuccessfulSync');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('hasUnsyncedData');
      expect(status).toHaveProperty('nextSyncScheduled');
      expect(status).toHaveProperty('countdownSeconds');
    });

    it('should report correct countdown when sync is scheduled', () => {
      const service = createService();
      (unsyncedDataManager.hasUnsynced as jest.Mock).mockReturnValue(true);
      service.enable();

      const status = service.getStatus();
      expect(status.nextSyncScheduled).toBe(true);
      expect(status.nextSyncScheduledFor).toBeTruthy();
      expect(status.countdownSeconds).toBeGreaterThan(0);
      expect(status.countdownSeconds).toBeLessThanOrEqual(5 * 60); // Should be around 5 minutes
    });
  });
});
