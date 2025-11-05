/**
 * Cookie-based Settings Service
 * Handles storing and retrieving user settings from HTTP-only cookies
 */

import type { UserSettings } from '../../types';
import { getFiduAuthCookieService } from '../auth/FiduAuthCookieService';
import { detectRuntimeEnvironment } from '../../utils/environment';

export interface CookieSettingsResponse {
  settings?: UserSettings;
}

export class CookieSettingsService {
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
   * Get environment-specific cookie prefix
   */
  private getEnvironmentPrefix(): string {
    return this.environment !== 'prod' ? `_${this.environment}` : '';
  }

  /**
   * Store user settings in HTTP-only cookie
   * Requires authentication for security
   */
  async setSettings(settings: UserSettings): Promise<boolean> {
    try {
      console.log(`🔄 Storing user settings in HTTP-only cookie for ${this.environment} environment...`);
      
      // Get auth token for secure storage
      const authToken = await this.getAuthToken();
      if (!authToken) {
        console.warn('⚠️ No auth token available - cannot store settings securely');
        return false;
      }
      
      // Add environment information to settings
      const settingsWithEnv = {
        ...settings,
        environment: this.environment,
        environmentPrefix: this.getEnvironmentPrefix(),
      };
      
      const response = await fetch(`${this.basePath}/api/settings/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include', // Include HTTP-only cookies
        body: JSON.stringify({ 
          settings: settingsWithEnv,
          environment: this.environment,
        }),
      });

      if (response.ok) {
        console.log('✅ User settings stored in HTTP-only cookie');
        return true;
      } else {
        console.error('❌ Failed to store settings in cookie:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error storing settings in cookie:', error);
      return false;
    }
  }

  /**
   * Retrieve user settings from HTTP-only cookie
   * Requires authentication for security
   */
  async getSettings(): Promise<UserSettings | null> {
    try {
      console.log(`🔄 Retrieving user settings from HTTP-only cookie for ${this.environment} environment...`);
      
      // Get auth token for secure retrieval
      const authToken = await this.getAuthToken();
      if (!authToken) {
        console.warn('⚠️ No auth token available - cannot retrieve settings securely');
        return null;
      }
      
      const response = await fetch(`${this.basePath}/api/settings/get?env=${this.environment}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include', // Include HTTP-only cookies
      });

      if (response.ok) {
        const data: CookieSettingsResponse = await response.json();
        if (data.settings) {
          // Validate that settings are for the current environment
          const settingsEnv = (data.settings as any).environment;
          if (settingsEnv && settingsEnv !== this.environment) {
            console.warn(`⚠️ Settings found for ${settingsEnv} environment, but current environment is ${this.environment}. Ignoring settings.`);
            return null;
          }
          
          console.log(`✅ User settings retrieved from HTTP-only cookie for ${this.environment} environment`);
          return data.settings;
        } else {
          console.log(`ℹ️ No settings found in HTTP-only cookie for ${this.environment} environment`);
          return null;
        }
      } else {
        console.warn('⚠️ Failed to retrieve settings from cookie:', response.status);
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
  async getSettingsWithRetry(maxRetries: number = 2): Promise<UserSettings | null> {
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
  private async getAuthToken(): Promise<string | null> {
    try {
      const fiduAuthService = getFiduAuthCookieService();
      return await fiduAuthService.getAccessToken();
    } catch (error) {
      console.warn('Failed to get auth token:', error);
      return null;
    }
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
