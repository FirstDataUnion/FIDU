/**
 * Smart Auto-Sync Service
 * Implements intelligent auto-sync with activity awareness, exponential backoff,
 * and sync health tracking. Never gives up - keeps retrying indefinitely.
 */

import { unsyncedDataManager } from '../UnsyncedDataManager';
import { SyncService } from './SyncService';
import { getFiduAuthService } from '../../auth/FiduAuthService';

export type SyncHealth = 'healthy' | 'degraded' | 'failing';

export interface SmartAutoSyncConfig {
  delayMinutes: number;           // Delay before sync (default: 5 minutes)
  retryDelayMinutes: number;      // Base delay between retries (default: 10 minutes)
  maxRetryDelayMinutes: number;   // Cap for exponential backoff (default: 60 minutes)
}

export interface ActivityState {
  lastActivity: Date;
  lastSyncAttempt: Date | null;
  nextSyncScheduledFor: Date | null;
}

export interface SyncHealthState {
  consecutiveFailures: number;
  lastSuccessfulSync: Date | null;
  lastError: string | null;
}

export class SmartAutoSyncService {
  private syncService: SyncService;
  private config: SmartAutoSyncConfig;
  private activityState: ActivityState;
  private healthState: SyncHealthState;
  private syncTimer: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;
  private unsubscribeListener: (() => void) | null = null;
  private workspaceId: string;

  constructor(syncService: SyncService, config: Partial<SmartAutoSyncConfig> = {}, workspaceId: string = 'default') {
    this.syncService = syncService;
    this.workspaceId = workspaceId;
    this.config = {
      delayMinutes: 5,
      retryDelayMinutes: 10,
      maxRetryDelayMinutes: 60,
      ...config
    };
    
    this.activityState = {
      lastActivity: new Date(),
      lastSyncAttempt: null,
      nextSyncScheduledFor: null
    };

    this.healthState = {
      consecutiveFailures: 0,
      lastSuccessfulSync: null,
      lastError: null
    };

    // Load persisted sync health from localStorage
    this.loadSyncHealth();

    // Subscribe to unsynced data changes
    this.unsubscribeListener = unsyncedDataManager.addListener((hasUnsynced) => {
      if (hasUnsynced && this.isEnabled) {
        this.checkForPendingSync();
      }
    });
  }

  /**
   * Get localStorage key for this workspace's sync health
   */
  private getStorageKey(): string {
    return `fidu_sync_health_${this.workspaceId}`;
  }

  /**
   * Load persisted sync health from localStorage
   */
  private loadSyncHealth(): void {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const data = JSON.parse(stored);
        this.healthState.lastSuccessfulSync = data.lastSuccessfulSync 
          ? new Date(data.lastSuccessfulSync) 
          : null;
        // Don't persist consecutiveFailures - start fresh on page load
        // This prevents showing stale failure state after browser restart
      }
    } catch (error) {
      console.warn('Failed to load sync health from localStorage:', error);
    }
  }

  /**
   * Save sync health to localStorage
   */
  private saveSyncHealth(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify({
        lastSuccessfulSync: this.healthState.lastSuccessfulSync?.toISOString() || null
      }));
    } catch (error) {
      console.warn('Failed to save sync health to localStorage:', error);
    }
  }

  /**
   * Get the current sync health status based on consecutive failures
   */
  getSyncHealth(): SyncHealth {
    if (this.healthState.consecutiveFailures === 0) {
      return 'healthy';
    } else if (this.healthState.consecutiveFailures <= 2) {
      return 'degraded';
    } else {
      return 'failing';
    }
  }

  /**
   * Enable smart auto-sync
   */
  enable(): void {
    if (this.isEnabled) {
      console.log('🔄 Smart auto-sync already enabled');
      return;
    }

    this.isEnabled = true;
    console.log('🚀 Smart auto-sync enabled');
    
    // Check if we need to sync immediately
    this.checkForPendingSync();
  }

  /**
   * Disable smart auto-sync
   */
  disable(): void {
    this.isEnabled = false;
    this.clearSyncTimer();
    
    // Unsubscribe from unsynced data changes
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
    
    console.log('⏹️ Smart auto-sync disabled');
  }

  /**
   * Check if there's unsynced data and schedule sync if needed
   */
  private checkForPendingSync(): void {
    
    if (!this.isEnabled) {
      return;
    }

    const hasUnsyncedData = unsyncedDataManager.hasUnsynced();
    
    if (hasUnsyncedData) {
      this.scheduleSync();
    } 
  }

  /**
   * Schedule a sync with countdown tracking
   */
  private scheduleSync(): void {
    
    // Clear any existing timer
    this.clearSyncTimer();

    // Schedule sync after delay
    const delayMs = this.config.delayMinutes * 60 * 1000;
    const scheduledTime = new Date(Date.now() + delayMs);
    
    this.activityState.nextSyncScheduledFor = scheduledTime;
    
    this.syncTimer = setTimeout(async () => {
      await this.performScheduledSync();
    }, delayMs);
    
  }

  /**
   * Proactively refresh authentication tokens before attempting sync
   * This helps recover from expired tokens without failing the sync
   */
  private async refreshTokensProactively(): Promise<boolean> {
    try {
      console.log('🔑 Proactively refreshing authentication tokens before sync...');
      
      // Try to refresh FIDU auth token
      const fiduAuthService = getFiduAuthService();
      await fiduAuthService.ensureAccessToken({ forceRefresh: true });
      
      // Try to refresh Google Drive token if not authenticated
      const authService = this.syncService.getAuthService();
      if (!authService.isAuthenticated()) {
        console.log('🔑 Google Drive token expired, attempting to restore...');
        const restored = await authService.restoreFromCookies();
        if (!restored) {
          console.warn('⚠️ Could not restore Google Drive authentication');
          return false;
        }
      }
      
      console.log('✅ Authentication tokens refreshed successfully');
      return true;
    } catch (error) {
      console.warn('⚠️ Proactive token refresh failed:', error);
      return false;
    }
  }

  /**
   * Perform the scheduled sync
   */
  private async performScheduledSync(): Promise<void> {
    
    if (!this.isEnabled) {
      return;
    }

    // Double-check if we still have unsynced data
    const hasUnsyncedData = unsyncedDataManager.hasUnsynced();
    
    if (!hasUnsyncedData) {
      this.activityState.nextSyncScheduledFor = null;
      return;
    }

    this.activityState.lastSyncAttempt = new Date();
    this.activityState.nextSyncScheduledFor = null;

    // Proactively refresh tokens before sync attempt (especially important for retries)
    if (this.healthState.consecutiveFailures > 0) {
      await this.refreshTokensProactively();
    }

    try {
      await this.syncService.syncToDrive({ forceUpload: true });
      
      // Success! Reset failure tracking and update last successful sync
      this.healthState.consecutiveFailures = 0;
      this.healthState.lastSuccessfulSync = new Date();
      this.healthState.lastError = null;
      this.saveSyncHealth();
      
      console.log('✅ Auto-sync completed successfully');
      
      // Mark as synced
      unsyncedDataManager.markAsSynced();
      
      // Double-check that unsynced state was cleared
      setTimeout(() => {
        const stillUnsynced = unsyncedDataManager.hasUnsynced();
        if (stillUnsynced) {
          unsyncedDataManager.markAsSynced();
        }
      }, 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Auto-sync failed:', errorMessage);
      this.healthState.lastError = errorMessage;
      this.handleSyncFailure();
    }
  }

  /**
   * Handle sync failure with exponential backoff (no maximum retries)
   * The system will keep trying indefinitely with a capped delay
   */
  private handleSyncFailure(): void {
    this.healthState.consecutiveFailures++;
    
    // Calculate retry delay with exponential backoff, capped at maxRetryDelayMinutes
    // Formula: min(baseDelay * 2^(failures-1), maxDelay)
    const baseDelayMinutes = this.config.retryDelayMinutes;
    const exponentialDelay = baseDelayMinutes * Math.pow(2, this.healthState.consecutiveFailures - 1);
    const cappedDelayMinutes = Math.min(exponentialDelay, this.config.maxRetryDelayMinutes);
    const retryDelayMs = cappedDelayMinutes * 60 * 1000;
    
    const retryTime = new Date(Date.now() + retryDelayMs);
    this.activityState.nextSyncScheduledFor = retryTime;
    
    const healthStatus = this.getSyncHealth();
    const healthEmoji = healthStatus === 'degraded' ? '⚠️' : '🔴';
    
    console.log(
      `${healthEmoji} Auto-sync failed (attempt ${this.healthState.consecutiveFailures}, status: ${healthStatus}), ` +
      `retrying in ${cappedDelayMinutes} minutes at ${retryTime.toLocaleTimeString()}`
    );
    
    this.syncTimer = setTimeout(async () => {
      await this.performScheduledSync();
    }, retryDelayMs);
  }

  /**
   * Update configuration (for settings changes)
   */
  updateConfig(newConfig: Partial<SmartAutoSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If delay changed and we have a scheduled sync, reschedule it
    if (this.syncTimer && this.activityState.nextSyncScheduledFor) {
      this.scheduleSync();
    }
  }

  /**
   * Clear sync timer
   */
  private clearSyncTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get current sync status including health information
   */
  getStatus(): {
    enabled: boolean;
    hasUnsyncedData: boolean;
    lastSyncAttempt: Date | null;
    nextSyncScheduled: boolean;
    nextSyncScheduledFor: Date | null;
    countdownSeconds: number;
    config: SmartAutoSyncConfig;
    // New health-related fields
    syncHealth: SyncHealth;
    consecutiveFailures: number;
    lastSuccessfulSync: Date | null;
    lastError: string | null;
  } {
    const now = new Date();
    const countdownSeconds = this.activityState.nextSyncScheduledFor 
      ? Math.max(0, Math.floor((this.activityState.nextSyncScheduledFor.getTime() - now.getTime()) / 1000))
      : 0;

    return {
      enabled: this.isEnabled,
      hasUnsyncedData: unsyncedDataManager.hasUnsynced(),
      lastSyncAttempt: this.activityState.lastSyncAttempt,
      nextSyncScheduled: this.syncTimer !== null,
      nextSyncScheduledFor: this.activityState.nextSyncScheduledFor,
      countdownSeconds,
      config: this.config,
      // Health information
      syncHealth: this.getSyncHealth(),
      consecutiveFailures: this.healthState.consecutiveFailures,
      lastSuccessfulSync: this.healthState.lastSuccessfulSync,
      lastError: this.healthState.lastError
    };
  }

  /**
   * Force immediate sync (bypasses smart timing)
   */
  async forceSync(): Promise<void> {
    console.log('🚀 Force sync requested');
    this.clearSyncTimer();
    this.activityState.nextSyncScheduledFor = null;
    
    try {
      await this.syncService.syncToDrive({ forceUpload: true });
      
      // Update health state on success
      this.healthState.consecutiveFailures = 0;
      this.healthState.lastSuccessfulSync = new Date();
      this.healthState.lastError = null;
      this.saveSyncHealth();
      
      unsyncedDataManager.markAsSynced();
      console.log('✅ Force sync completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.healthState.lastError = errorMessage;
      console.error('❌ Force sync failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disable();
    
    // Ensure listener is cleaned up
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
  }
}
