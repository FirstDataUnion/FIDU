/**
 * Simple Unsynced Data Manager
 * Manages a single boolean state for unsynced data without causing re-renders
 */

type UnsyncedStateChangeListener = (hasUnsynced: boolean) => void;

class UnsyncedDataManager {
  private hasUnsyncedData = false;
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;
  private listeners: Set<UnsyncedStateChangeListener> = new Set();

  constructor() {
    this.setupBeforeUnloadWarning();
  }

  /**
   * Check if there is unsynced data
   */
  hasUnsynced(): boolean {
    return this.hasUnsyncedData;
  }

  /**
   * Mark that we have unsynced data (called when creating new data)
   */
  markAsUnsynced(): void {
    if (!this.hasUnsyncedData) {
      this.hasUnsyncedData = true;
      this.notifyListeners();
    }
  }

  /**
   * Mark that all data is synced (called after successful sync)
   */
  markAsSynced(): void {
    if (this.hasUnsyncedData) {
      this.hasUnsyncedData = false;
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to unsynced state changes
   */
  addListener(listener: UnsyncedStateChangeListener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.hasUnsyncedData);
      } catch (error) {
        console.warn('Error in unsynced state listener:', error);
      }
    });
  }

  /**
   * Setup beforeunload warning to prevent data loss
   */
  private setupBeforeUnloadWarning(): void {
    this.beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (this.hasUnsyncedData) {
        // Modern browsers ignore custom messages, but we can still show a warning
        const message = 'You have unsaved changes that will be lost if you leave this page.';
        
        // Set returnValue for older browsers
        event.returnValue = message;
        
        // Return the message for modern browsers
        return message;
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const unsyncedDataManager = new UnsyncedDataManager();
