/**
 * Centralized Authentication Manager
 * 
 * This service coordinates all authentication operations for FIDU Chat Lab.
 * It manages both FIDU and Google Drive authentication in a single place,
 * preventing race conditions and duplicate operations.
 * 
 * Key responsibilities:
 * - Single initialization flow (no duplicate auth attempts)
 * - Coordinated token refresh and restoration
 * - Event-driven architecture (subscribers notified of auth changes)
 * - Automatic Redux state synchronization
 * - Handles visibility changes and app lifecycle
 */

import type { AppDispatch } from '../../store';
import { GoogleDriveAuthService } from './GoogleDriveAuth';
import { getFiduAuthService } from './FiduAuthService';
import { 
  markStorageConfigured,
  setGoogleDriveAuthState 
} from '../../store/slices/unifiedStorageSlice';

export interface AuthStatus {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  error: string | null;
}

type AuthEventType = 'auth-changed' | 'auth-lost' | 'auth-restored';
type AuthEventCallback = (status: AuthStatus) => void;

/**
 * Centralized Authentication Manager
 * Singleton pattern - use getAuthManager() to access
 */
export class AuthManager {
  private googleDriveAuthService: GoogleDriveAuthService | null = null;
  private fiduAuthService: ReturnType<typeof getFiduAuthService>;
  private dispatch: AppDispatch;
  
  // State tracking
  private isInitializing: boolean = false;
  private isRestoring: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private lastAuthCheck: number = 0;
  
  // Event subscribers
  private subscribers: Map<string, Set<AuthEventCallback>> = new Map([
    ['auth-changed', new Set()],
    ['auth-lost', new Set()],
    ['auth-restored', new Set()],
  ]);

  constructor(dispatch: AppDispatch) {
    this.dispatch = dispatch;
    this.fiduAuthService = getFiduAuthService();
  }

  /**
   * Set the Google Drive auth service (lazy initialization)
   */
  setGoogleDriveAuthService(service: GoogleDriveAuthService): void {
    this.googleDriveAuthService = service;
  }

  /**
   * Initialize authentication
   * This is the ONLY method that should be called on app startup
   * All other entry points should use checkAndRestore() instead
   */
  async initialize(): Promise<void> {
    // If already initializing, return the existing promise
    if (this.initializationPromise) {
      console.log('⏳ [AuthManager] Already initializing, waiting for completion...');
      return this.initializationPromise;
    }

    // If already initialized recently, skip
    const now = Date.now();
    if (this.lastAuthCheck && now - this.lastAuthCheck < 2000) {
      console.log('⏭️  [AuthManager] Skipping initialization (too soon since last check)');
      return;
    }

    console.log('🚀 [AuthManager] Starting centralized authentication initialization...');
    this.isInitializing = true;
    this.lastAuthCheck = now;

    this.initializationPromise = this._doInitialize();
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Internal initialization logic
   */
  private async _doInitialize(): Promise<void> {
    try {
      // Step 1: Check FIDU authentication
      const fiduTokens = await this.fiduAuthService.getTokens();
      const hasFiduAuth = !!fiduTokens?.access_token;
      
      if (!hasFiduAuth) {
        console.log('ℹ️  [AuthManager] No FIDU authentication - user needs to log in');
        this.notifySubscribers('auth-lost', this.getAuthStatus());
        await this.syncToRedux();
        return;
      }

      console.log('✅ [AuthManager] FIDU authentication validated');

      // Step 2: Initialize Google Drive auth service if not set
      if (!this.googleDriveAuthService) {
        console.log('⏳ [AuthManager] Waiting for Google Drive auth service...');
        // This will be set by the storage layer
        return;
      }

      // Step 3: Try to restore Google Drive authentication from cookies
      console.log('🔄 [AuthManager] Attempting Google Drive authentication restoration...');
      const restored = await this.googleDriveAuthService.restoreFromCookies();

      if (restored) {
        console.log('✅ [AuthManager] Google Drive authentication restored from cookies');
        this.notifySubscribers('auth-restored', this.getAuthStatus());
        await this.syncToRedux();
        return;
      }

      // Step 4: Check if we have tokens in memory (from the auth service's loadStoredTokens)
      const isAuthenticated = this.googleDriveAuthService.isAuthenticated();
      
      if (isAuthenticated) {
        console.log('✅ [AuthManager] Google Drive authentication valid in memory');
        this.notifySubscribers('auth-changed', this.getAuthStatus());
        await this.syncToRedux();
        return;
      }

      // Step 5: No valid Google Drive auth found
      console.log('ℹ️  [AuthManager] No Google Drive authentication - user needs to connect');
      this.notifySubscribers('auth-lost', this.getAuthStatus());
      await this.syncToRedux();

    } catch (error) {
      console.error('❌ [AuthManager] Initialization failed:', error);
      this.notifySubscribers('auth-lost', this.getAuthStatus());
      await this.syncToRedux();
      throw error;
    }
  }

  /**
   * Check and restore authentication
   * Use this for visibility changes, periodic checks, etc.
   * It's safe to call this multiple times - it will debounce
   */
  async checkAndRestore(): Promise<boolean> {
    // Don't check if already initializing or restoring
    if (this.isInitializing || this.isRestoring) {
      console.log('⏳ [AuthManager] Operation already in progress, skipping check');
      return false;
    }

    // Debounce rapid checks
    const now = Date.now();
    if (now - this.lastAuthCheck < 2000) {
      console.log('⏭️  [AuthManager] Skipping check (too soon since last check)');
      return false;
    }

    this.isRestoring = true;
    this.lastAuthCheck = now;

    try {
      console.log('🔄 [AuthManager] Checking authentication status...');

      // Check if we have a Google Drive auth service
      if (!this.googleDriveAuthService) {
        console.log('ℹ️  [AuthManager] Google Drive auth service not ready');
        return false;
      }

      // Use ensureAuthenticated() which attempts restoration
      const authenticated = await this.googleDriveAuthService.ensureAuthenticated();

      if (authenticated) {
        console.log('✅ [AuthManager] Authentication valid');
        this.notifySubscribers('auth-restored', this.getAuthStatus());
        await this.syncToRedux();
        return true;
      }

      console.log('ℹ️  [AuthManager] Could not restore authentication');
      this.notifySubscribers('auth-lost', this.getAuthStatus());
      await this.syncToRedux();
      return false;

    } catch (error) {
      console.error('❌ [AuthManager] Check and restore failed:', error);
      return false;
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Manually trigger a full re-authentication
   * Use this after successful OAuth callback
   */
  async reAuthenticate(): Promise<void> {
    console.log('🔄 [AuthManager] Manual re-authentication triggered');
    
    // Reset state
    this.lastAuthCheck = 0;
    this.isInitializing = false;
    this.isRestoring = false;
    this.initializationPromise = null;

    // Re-initialize
    await this.initialize();
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): AuthStatus {
    if (!this.googleDriveAuthService) {
      return {
        isAuthenticated: false,
        isLoading: this.isInitializing || this.isRestoring,
        user: null,
        error: null,
      };
    }

    const isAuthenticated = this.googleDriveAuthService.isAuthenticated();
    // Get user synchronously from the service's cached user (don't fetch it)
    // The service maintains this.user which is set after authentication
    const user = this.googleDriveAuthService.getCachedUser ? 
      this.googleDriveAuthService.getCachedUser() : 
      null;

    return {
      isAuthenticated,
      isLoading: this.isInitializing || this.isRestoring,
      user,
      error: null,
    };
  }

  /**
   * Check if authentication is currently being initialized or restored
   */
  isOperationInProgress(): boolean {
    return this.isInitializing || this.isRestoring;
  }

  /**
   * Sync current auth state to Redux
   * This method marks storage as configured and updates the Google Drive auth state in Redux
   */
  private async syncToRedux(): Promise<void> {
    if (!this.googleDriveAuthService) {
      console.log('⏭️  [AuthManager] Skipping Redux sync (service not ready)');
      return;
    }

    const status = this.getAuthStatus();

    if (status.isAuthenticated && status.user) {
      console.log('✅ [AuthManager] Authentication verified - marking storage as configured with auth state');
      
      // Update Google Drive auth state in Redux
      this.dispatch(setGoogleDriveAuthState({ 
        isAuthenticated: true, 
        user: status.user 
      }));
      
      // Mark storage as configured
      this.dispatch(markStorageConfigured());
    } else {
      console.log('ℹ️  [AuthManager] No authentication state to sync');
    }
  }

  /**
   * Subscribe to authentication events
   */
  subscribe(event: AuthEventType, callback: AuthEventCallback): () => void {
    const eventSubscribers = this.subscribers.get(event);
    if (!eventSubscribers) {
      throw new Error(`Unknown event type: ${event}`);
    }

    eventSubscribers.add(callback);
    console.log(`📡 [AuthManager] New subscriber for '${event}' (total: ${eventSubscribers.size})`);

    // Return unsubscribe function
    return () => {
      eventSubscribers.delete(callback);
      console.log(`📡 [AuthManager] Unsubscribed from '${event}' (remaining: ${eventSubscribers.size})`);
    };
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(event: AuthEventType, status: AuthStatus): void {
    const eventSubscribers = this.subscribers.get(event);
    if (!eventSubscribers || eventSubscribers.size === 0) {
      return;
    }

    console.log(`📢 [AuthManager] Notifying ${eventSubscribers.size} subscribers of '${event}'`);
    eventSubscribers.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error(`❌ [AuthManager] Subscriber callback error for '${event}':`, error);
      }
    });
  }

  /**
   * Clear all authentication state
   * Use this on logout
   */
  async clearAuth(): Promise<void> {
    console.log('🧹 [AuthManager] Clearing all authentication state');

    if (this.googleDriveAuthService) {
      await this.googleDriveAuthService.logout();
    }

    await this.fiduAuthService.clearTokens();

    this.notifySubscribers('auth-lost', this.getAuthStatus());
    await this.syncToRedux();
  }

  /**
   * Reset the manager state
   * Use this for testing or when you need to force a fresh initialization
   */
  reset(): void {
    console.log('🔄 [AuthManager] Resetting manager state');
    this.isInitializing = false;
    this.isRestoring = false;
    this.initializationPromise = null;
    this.lastAuthCheck = 0;
  }
}

// Singleton instance
let authManagerInstance: AuthManager | null = null;

/**
 * Get the singleton AuthManager instance
 * Must be called with dispatch on first use
 */
export function getAuthManager(dispatch?: AppDispatch): AuthManager {
  if (!authManagerInstance) {
    if (!dispatch) {
      throw new Error('AuthManager must be initialized with dispatch on first use');
    }
    console.log('🏗️  [AuthManager] Creating singleton instance');
    authManagerInstance = new AuthManager(dispatch);
  }
  return authManagerInstance;
}

/**
 * Reset the singleton instance
 * Use this for testing only
 */
export function resetAuthManager(): void {
  console.log('🧹 [AuthManager] Destroying singleton instance');
  authManagerInstance = null;
}

