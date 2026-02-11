/**
 * Cookie-based Settings Service
 * Handles storing and retrieving user settings from HTTP-only cookies
 */

import axios from 'axios';
import { type AxiosInstance, AxiosError } from 'axios';
import type { HistoricalUserSettings, UserSettings } from '../../types';
import {
  getFiduAuthService,
  AuthenticationRequiredError,
  TokenAcquisitionTimeoutError,
} from '../auth/FiduAuthService';
import { detectRuntimeEnvironment } from '../../utils/environment';
import { migrateSyncSettings } from '../../utils/syncSettingsMigration';

interface CookieSettingsResponse {
  settings?: HistoricalUserSettings;
}

export type CookieSettingsMutationResult =
  | { success: true }
  | { success: false; reason: 'auth_unavailable' }
  | { success: false; reason: 'request_failed'; status: number }
  | { success: false; reason: 'unexpected_error'; error: unknown };

export class CookieSettingsService {
  private client: AxiosInstance;
  private environment: string;

  constructor(testHostName?: string) {
    let baseURL;
    if (testHostName && detectRuntimeEnvironment() === 'dev') {
      baseURL = testHostName;
    } else {
      baseURL = window.location.pathname.includes('/fidu-chat-lab')
        ? '/fidu-chat-lab'
        : '';
    }
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
    this.setUpInterceptors();

    // Detect environment based on hostname using shared utility
    this.environment = detectRuntimeEnvironment();
  }

  /**
   * Get environment-specific cookie prefix
   */
  private getEnvironmentPrefix(): string {
    return this.environment !== 'prod' ? `_${this.environment}` : '';
  }

  private setUpInterceptors(): void {
    const authInterceptor = getFiduAuthService().createAuthInterceptor();
    this.client.interceptors.request.use(
      authInterceptor.request,
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );
    this.client.interceptors.response.use(
      authInterceptor.response,
      authInterceptor.error
    );
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error instanceof AxiosError && error.response) {
          return error.response;
        }
        throw error;
      }
    );
  }

  /**
   * Store user settings in HTTP-only cookie
   * Requires authentication for security
   */
  async setSettings(
    settings: UserSettings
  ): Promise<CookieSettingsMutationResult> {
    try {
      console.log(
        `🔄 Storing user settings in HTTP-only cookie for ${this.environment} environment...`
      );

      // Get auth token for secure storage
      const authTokenAvailable = await this.ensureAuthToken();
      if (!authTokenAvailable) {
        console.warn(
          '⚠️ No auth token available - cannot store settings securely'
        );
        return { success: false, reason: 'auth_unavailable' };
      }

      // Add environment information to settings
      const settingsWithEnv = {
        ...settings,
        environment: this.environment,
        environmentPrefix: this.getEnvironmentPrefix(),
      };

      const response = await this.client.post('api/settings/set', {
        settings: settingsWithEnv,
        environment: this.environment,
      });

      if (response.status === 200) {
        console.log('✅ User settings stored in HTTP-only cookie');
        return { success: true };
      } else {
        console.error(
          '❌ Failed to store settings in cookie:',
          response.status
        );
        return {
          success: false,
          reason: 'request_failed',
          status: response.status,
        };
      }
    } catch (error) {
      console.error('❌ Error storing settings in cookie:', error);
      return { success: false, reason: 'unexpected_error', error };
    }
  }

  /**
   * Retrieve user settings from HTTP-only cookie
   * Requires authentication for security
   */
  async getSettings(): Promise<UserSettings | null> {
    try {
      console.log(
        `🔄 Retrieving user settings from HTTP-only cookie for ${this.environment} environment...`
      );

      // Get auth token for secure retrieval
      const hasValidAuthToken = await this.ensureAuthToken();
      if (!hasValidAuthToken) {
        console.warn(
          '⚠️ No auth token available - cannot retrieve settings securely'
        );
        return null;
      }

      const response = await this.client.get(
        `api/settings/get?env=${this.environment}`
      );

      if (response.status === 200) {
        const data: CookieSettingsResponse = response.data;
        if (data.settings) {
          // Validate that settings are for the current environment
          const settingsEnv = (data.settings as any).environment;
          if (settingsEnv && settingsEnv !== this.environment) {
            console.warn(
              `⚠️ Settings found for ${settingsEnv} environment, but current environment is ${this.environment}. Ignoring settings.`
            );
            return null;
          }

          console.log(
            `✅ User settings retrieved from HTTP-only cookie for ${this.environment} environment`
          );
          return {
            ...data.settings,
            syncSettings: migrateSyncSettings(data.settings.syncSettings),
          };
        } else {
          console.log(
            `ℹ️ No settings found in HTTP-only cookie for ${this.environment} environment`
          );
          return null;
        }
      } else {
        console.warn(
          '⚠️ Failed to retrieve settings from cookie:',
          response.status
        );
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error retrieving settings from cookie:', error);
      return null;
    }
  }

  /**
   * Check if we're online and can make requests
   */
  private isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Enhanced settings retrieval with retry logic
   */
  async getSettingsWithRetry(
    maxRetries: number = 2
  ): Promise<UserSettings | null> {
    if (!this.isOnline()) {
      console.log('🔄 Offline - skipping cookie settings retrieval');
      return null;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Settings retrieval attempt ${attempt}/${maxRetries}`);
        const settings = await this.getSettings();

        if (settings) {
          return settings;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`❌ Settings retrieval attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          console.error('❌ All settings retrieval attempts failed');
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Get authentication token for secure requests
   */
  private async ensureAuthToken(): Promise<boolean> {
    try {
      const fiduTokenService = getFiduAuthService();
      await fiduTokenService.ensureAccessToken({
        onWait: () =>
          console.log('🔐 Ensuring FIDU auth before fetching settings...'),
      });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        console.warn('FIDU authentication required before fetching settings');
        return false;
      }
      if (error instanceof TokenAcquisitionTimeoutError) {
        console.warn('Timed out waiting for FIDU auth while fetching settings');
        return false;
      }
      console.warn('Failed to get auth token:', error);
      return false;
    }
    return true;
  }
}

// Singleton instance
let cookieSettingsServiceInstance: CookieSettingsService | null = null;

export function getCookieSettingsService(): CookieSettingsService {
  if (!cookieSettingsServiceInstance) {
    cookieSettingsServiceInstance = new CookieSettingsService();
  }
  return cookieSettingsServiceInstance;
}
