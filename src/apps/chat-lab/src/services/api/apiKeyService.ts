import { fiduVaultAPIClient } from './apiClientFIDUVault';
import { ApiError } from './apiClients';
import { getUnifiedStorageService } from '../storage/UnifiedStorageService';
import { getEnvironmentInfo } from '../../utils/environment';

// API Key response types from FIDU Vault
export interface APIKeyWithValue {
  id: string;
  provider: string;
  api_key: string;
  user_id: string;
  create_timestamp: string;
  update_timestamp: string;
}

// Provider mapping for API key field names
export const PROVIDER_API_KEY_FIELDS = {
  'openai': 'openai_api_key',
  'anthropic': 'anthropic_api_key',
  'google': 'google_api_key',
  'openrouter': 'openrouter_api_key',
} as const;

export type SupportedProvider = keyof typeof PROVIDER_API_KEY_FIELDS;

/**
 * Service for managing API keys from FIDU Vault
 */
export class APIKeyService {
  private cache: Map<string, APIKeyWithValue> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get API key for a specific provider
   * @param provider The provider name (openai, anthropic, google)
   * @returns The API key value or null if not found
   */
  async getAPIKeyForProvider(provider: SupportedProvider): Promise<string | null> {
    try {
      // Check the storage mode to determine where to fetch from
      const envInfo = getEnvironmentInfo();
      const isCloudMode = envInfo.storageMode === 'cloud';

      console.log(`🔑 [APIKeyService] Environment info - storageMode: ${envInfo.storageMode}, isCloudMode: ${isCloudMode}`);

      if (isCloudMode) {
        // Use cloud storage (UnifiedStorageService)
        console.log(`🔑 [APIKeyService] Using cloud storage for provider: ${provider}`);
        const storage = getUnifiedStorageService();
        const apiKey = await storage.getAPIKey(provider);
        if (apiKey) {
          const keyPreview = apiKey.substring(0, 10) + '...';
          console.log(`🔑 [APIKeyService] Retrieved API key from cloud storage for provider: ${provider}, preview: ${keyPreview}`);
        } else {
          console.log(`🔑 [APIKeyService] No API key found in cloud storage for provider: ${provider}`);
        }
        return apiKey;
      } else {
        // Use FIDU Vault API (original behavior)
        console.log(`🔑 [APIKeyService] Using FIDU Vault API for provider: ${provider}`);
        
        // Check cache first
        const cached = this.getCachedAPIKey(provider);
        if (cached) {
          console.log(`🔑 [APIKeyService] Using cached API key for provider: ${provider}`);
          return cached.api_key;
        }

        // Fetch from FIDU Vault API
        const response = await fiduVaultAPIClient.get<APIKeyWithValue>(
          `/api-keys/provider/${provider}/value`
        );

        if (response.data) {
          // Cache the result
          this.setCachedAPIKey(provider, response.data);
          console.log(`🔑 [APIKeyService] Retrieved API key from FIDU Vault for provider: ${provider}`);
          return response.data.api_key;
        }

        console.log(`🔑 [APIKeyService] No API key found in FIDU Vault for provider: ${provider}`);
        return null;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // API key not found for this provider - this is expected and normal
        console.log(`🔑 [APIKeyService] API key not found (404) for provider: ${provider}`);
        return null;
      }
      
      console.error(`🚨 [APIKeyService] Unexpected error fetching API key for provider ${provider}:`, error);
      return null;
    }
  }

  /**
   * Get API key field name for a provider
   * @param provider The provider name
   * @returns The field name to use in NLPWorkbench requests
   */
  getAPIKeyFieldName(provider: SupportedProvider): string {
    return PROVIDER_API_KEY_FIELDS[provider];
  }

  /**
   * Get cached API key if still valid
   */
  private getCachedAPIKey(provider: string): APIKeyWithValue | null {
    const cached = this.cache.get(provider);
    const expiry = this.cacheExpiry.get(provider);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    // Clear expired cache
    if (expiry && Date.now() >= expiry) {
      this.cache.delete(provider);
      this.cacheExpiry.delete(provider);
    }
    
    return null;
  }

  /**
   * Cache an API key with expiry
   */
  private setCachedAPIKey(provider: string, apiKey: APIKeyWithValue): void {
    this.cache.set(provider, apiKey);
    this.cacheExpiry.set(provider, Date.now() + this.CACHE_DURATION);
  }

  /**
   * Clear cache for a specific provider
   */
  clearCache(provider?: SupportedProvider): void {
    if (provider) {
      this.cache.delete(provider);
      this.cacheExpiry.delete(provider);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Check if API key is available for a provider
   */
  async isAPIKeyAvailable(provider: SupportedProvider): Promise<boolean> {
    try {
      // Check the storage mode to determine where to check from
      const envInfo = getEnvironmentInfo();
      const isCloudMode = envInfo.storageMode === 'cloud';

      if (isCloudMode) {
        // Use cloud storage (UnifiedStorageService) - more efficient without fetching the full key
        const storage = getUnifiedStorageService();
        const available = await storage.isAPIKeyAvailable(provider);
        return available;
      } else {
        // Use existing logic for local mode
        const apiKey = await this.getAPIKeyForProvider(provider);
        return apiKey !== null;
      }
    } catch (error) {
      console.error(`Error checking API key availability for provider ${provider}:`, error);
      return false;
    }
  }
}

// Create and export a default instance
export const apiKeyService = new APIKeyService();
