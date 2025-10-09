/**
 * Smart Auto-Sync Service
 * Implements intelligent auto-sync with activity awareness and 5-minute delay
 */

import { unsyncedDataManager } from '../UnsyncedDataManager';
import { SyncService } from './SyncService';

export interface SmartAutoSyncConfig {
  delayMinutes: number;           // Delay before sync (default: 5 minutes)
  maxRetries: number;            // Max retry attempts (default: 3)
  retryDelayMinutes: number;     // Delay between retries (default: 10 minutes)
}

export interface ActivityState {
  lastActivity: Date;
  lastSyncAttempt: Date | null;
  retryCount: number;
  nextSyncScheduledFor: Date | null;
}

export class SmartAutoSyncService {
  private syncService: SyncService;
  private config: SmartAutoSyncConfig;
  private activityState: ActivityState;
  private syncTimer: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;
  private unsubscribeListener: (() => void) | null = null;

  constructor(syncService: SyncService, config: Partial<SmartAutoSyncConfig> = {}) {
    this.syncService = syncService;
    this.config = {
      delayMinutes: 5,
      maxRetries: 3,
      retryDelayMinutes: 10,
      ...config
    };
    
    this.activityState = {
      lastActivity: new Date(),
      lastSyncAttempt: null,
      retryCount: 0,
      nextSyncScheduledFor: null
    };

    // Subscribe to unsynced data changes
    this.unsubscribeListener = unsyncedDataManager.addListener((hasUnsynced) => {
      if (hasUnsynced && this.isEnabled) {
        this.checkForPendingSync();
      }
    });
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

    try {
      await this.syncService.syncToDrive({ forceUpload: true });
      
      // Reset retry count on success
      this.activityState.retryCount = 0;
      
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
      console.error('❌ Auto-sync failed:', error);
      this.handleSyncFailure();
    }
  }

  /**
   * Handle sync failure with retry logic
   */
  private handleSyncFailure(): void {
    this.activityState.retryCount++;
    
    if (this.activityState.retryCount < this.config.maxRetries) {
      const retryDelayMs = this.config.retryDelayMinutes * 60 * 1000;
      const retryTime = new Date(Date.now() + retryDelayMs);
      
      this.activityState.nextSyncScheduledFor = retryTime;
      console.log(`🔄 Auto-sync failed, retrying in ${this.config.retryDelayMinutes} minutes (attempt ${this.activityState.retryCount + 1}/${this.config.maxRetries}) at ${retryTime.toLocaleTimeString()}`);
      
      this.syncTimer = setTimeout(async () => {
        await this.performScheduledSync();
      }, retryDelayMs);
    } else {
      console.error('❌ Auto-sync failed after maximum retries, giving up');
      this.activityState.retryCount = 0; // Reset for next time
      this.activityState.nextSyncScheduledFor = null;
    }
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
   * Get current sync status
   */
  getStatus(): {
    enabled: boolean;
    hasUnsyncedData: boolean;
    lastSyncAttempt: Date | null;
    retryCount: number;
    nextSyncScheduled: boolean;
    nextSyncScheduledFor: Date | null;
    countdownSeconds: number;
    config: SmartAutoSyncConfig;
  } {
    const now = new Date();
    const countdownSeconds = this.activityState.nextSyncScheduledFor 
      ? Math.max(0, Math.floor((this.activityState.nextSyncScheduledFor.getTime() - now.getTime()) / 1000))
      : 0;

    return {
      enabled: this.isEnabled,
      hasUnsyncedData: unsyncedDataManager.hasUnsynced(),
      lastSyncAttempt: this.activityState.lastSyncAttempt,
      retryCount: this.activityState.retryCount,
      nextSyncScheduled: this.syncTimer !== null,
      nextSyncScheduledFor: this.activityState.nextSyncScheduledFor,
      countdownSeconds,
      config: this.config
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
      unsyncedDataManager.markAsSynced();
      console.log('✅ Force sync completed');
    } catch (error) {
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
