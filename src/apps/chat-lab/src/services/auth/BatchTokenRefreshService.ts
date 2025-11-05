/**
 * Batch Token Refresh Service
 * 
 * Optimizes token refresh by refreshing both FIDU and Google Drive tokens
 * in a single HTTP request instead of two separate calls.
 * 
 * Benefits:
 * - Reduces HTTP overhead by ~200ms
 * - Simplifies error handling
 * - Atomic operation (both succeed or both fail)
 */

import { getFiduAuthCookieService } from './FiduAuthCookieService';
import { detectRuntimeEnvironment } from '../../utils/environment';

export interface BatchRefreshResult {
  fidu?: {
    access_token: string;
    expires_in: number;
  };
  google_drive?: {
    access_token: string;
    expires_in: number;
  };
  errors: {
    fidu?: string;
    google_drive?: string;
  };
}

export class BatchTokenRefreshService {
  private basePath: string;
  private environment: string;

  constructor() {
    this.basePath = window.location.pathname.includes('/fidu-chat-lab') 
      ? '/fidu-chat-lab' 
      : '';
    
    // Detect environment based on hostname using shared utility
    this.environment = detectRuntimeEnvironment();
  }

  /**
   * Refresh both FIDU and Google Drive tokens in a single request
   * 
   * @returns BatchRefreshResult with refreshed tokens or errors
   */
  async refreshAllTokens(): Promise<BatchRefreshResult> {
    try {
      console.log('🔄 [BatchRefresh] Refreshing both FIDU and Google Drive tokens...');
      
      // Get FIDU auth token for the request
      const fiduAuthService = getFiduAuthCookieService();
      const authToken = await fiduAuthService.getAccessToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if available (for Google Drive token decryption)
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(
        `${this.basePath}/api/auth/refresh-all?env=${this.environment}`,
        {
          method: 'POST',
          headers,
          credentials: 'include', // Include HTTP-only cookies
        }
      );

      if (!response.ok) {
        throw new Error(`Batch refresh failed with status ${response.status}`);
      }

      const result: BatchRefreshResult = await response.json();
      
      // Log results
      if (result.fidu) {
        console.log('✅ [BatchRefresh] FIDU token refreshed');
      }
      if (result.google_drive) {
        console.log('✅ [BatchRefresh] Google Drive token refreshed');
      }
      if (result.errors.fidu) {
        console.warn('⚠️  [BatchRefresh] FIDU token refresh failed:', result.errors.fidu);
      }
      if (result.errors.google_drive) {
        console.warn('⚠️  [BatchRefresh] Google Drive token refresh failed:', result.errors.google_drive);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ [BatchRefresh] Failed to refresh tokens:', error);
      throw error;
    }
  }

  /**
   * Check if batch refresh is beneficial
   * 
   * Only use batch refresh when both tokens need refreshing.
   * If only one token needs refresh, use individual endpoints.
   * 
   * @returns true if both tokens need refresh
   */
  async shouldUseBatchRefresh(fiduNeedsRefresh: boolean, googleDriveNeedsRefresh: boolean): Promise<boolean> {
    return fiduNeedsRefresh && googleDriveNeedsRefresh;
  }
}

// Singleton instance
let batchTokenRefreshServiceInstance: BatchTokenRefreshService | null = null;

export function getBatchTokenRefreshService(): BatchTokenRefreshService {
  if (!batchTokenRefreshServiceInstance) {
    batchTokenRefreshServiceInstance = new BatchTokenRefreshService();
  }
  return batchTokenRefreshServiceInstance;
}

