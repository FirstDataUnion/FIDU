/**
 * OpenRouter Model Service
 * Fetches and caches models from OpenRouter API
 */

import { openRouterAPIClient } from '../api/apiClientOpenRouter';
import type { OpenRouterModel, OpenRouterModelsResponse } from '../../types/openRouter';
import type { ModelConfig } from '../../data/models';

// Cache configuration
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = 'openrouter_models_cache';

interface CachedModels {
  models: OpenRouterModel[];
  timestamp: number;
}

/**
 * OpenRouter Model Service class
 */
class OpenRouterModelService {
  private cache: CachedModels | null = null;
  private fetchPromise: Promise<OpenRouterModelsResponse> | null = null;

  /**
   * Get cached models from localStorage
   */
  private getCachedModels(): CachedModels | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return null;
      }

      const parsed: CachedModels = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - parsed.timestamp < CACHE_TTL_MS) {
        return parsed;
      }

      // Cache expired
      return null;
    } catch (error) {
      console.warn('[OpenRouterModelService] Failed to read cache:', error);
      return null;
    }
  }

  /**
   * Save models to cache
   */
  private saveCachedModels(models: OpenRouterModel[]): void {
    try {
      const cached: CachedModels = {
        models,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.warn('[OpenRouterModelService] Failed to save cache:', error);
    }
  }

  /**
   * Fetch models from OpenRouter API
   */
  async fetchModels(forceRefresh = false): Promise<OpenRouterModel[]> {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getCachedModels();
      if (cached) {
        console.log(
          `[OpenRouterModelService] Using cached models (${cached.models.length} models)`
        );
        return cached.models;
      }
    }

    // If there's already a fetch in progress, wait for it
    if (this.fetchPromise) {
      console.log('[OpenRouterModelService] Waiting for existing fetch...');
      const response = await this.fetchPromise;
      return response.data;
    }

    // Start new fetch
    console.log('[OpenRouterModelService] Fetching models from OpenRouter...');
    this.fetchPromise = openRouterAPIClient.fetchModels();

    try {
      const response = await this.fetchPromise;
      const models = response.data || [];

      // Update cache
      this.cache = {
        models,
        timestamp: Date.now(),
      };
      this.saveCachedModels(models);

      console.log(
        `[OpenRouterModelService] Fetched ${models.length} models from OpenRouter`
      );

      return models;
    } catch (error) {
      console.error('[OpenRouterModelService] Failed to fetch models:', error);

      // If we have cached models, return them even if expired
      const cached = this.getCachedModels();
      if (cached) {
        console.warn(
          '[OpenRouterModelService] Using expired cache due to fetch error'
        );
        return cached.models;
      }

      throw error;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Transform OpenRouter model to ChatLab ModelConfig format
   */
  transformToModelConfig(openRouterModel: OpenRouterModel): ModelConfig {
    // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
    const providerKey = openRouterModel.id.split('/')[0] as any;

    // Determine category based on OpenRouter category or capabilities
    let category: 'general' | 'coding' | 'reasoning' | 'multimodal' | 'search' =
      'general';
    if (openRouterModel.category) {
      if (
        openRouterModel.category.includes('programming')
        || openRouterModel.category.includes('code')
      ) {
        category = 'coding';
      } else if (
        openRouterModel.category.includes('reasoning')
        || openRouterModel.category.includes('math')
      ) {
        category = 'reasoning';
      } else if (
        openRouterModel.category.includes('multimodal')
        || openRouterModel.architecture.modality === 'multimodal'
        || openRouterModel.architecture.modality === 'image'
      ) {
        category = 'multimodal';
      } else if (openRouterModel.capabilities?.web_search) {
        category = 'search';
      }
    }

    // Determine cost tier based on pricing
    let costTier: 'low' | 'medium' | 'high' | 'premium' = 'medium';
    if (openRouterModel.pricing) {
      const promptPrice = parseFloat(openRouterModel.pricing.prompt || '0');
      const completionPrice = parseFloat(
        openRouterModel.pricing.completion || '0'
      );
      const avgPrice = (promptPrice + completionPrice) / 2;

      if (avgPrice < 0.000001) {
        costTier = 'low';
      } else if (avgPrice < 0.00001) {
        costTier = 'medium';
      } else if (avgPrice < 0.0001) {
        costTier = 'high';
      } else {
        costTier = 'premium';
      }
    }

    // Determine speed based on context length and capabilities
    let speed: 'fast' | 'medium' | 'slow' = 'medium';
    if (openRouterModel.context_length < 8000) {
      speed = 'fast';
    } else if (openRouterModel.context_length > 100000) {
      speed = 'slow';
    }

    // Build capabilities array
    const capabilities: string[] = [];
    if (openRouterModel.capabilities?.tools) {
      capabilities.push('tool-calling');
    }
    if (openRouterModel.capabilities?.json_mode) {
      capabilities.push('json-mode');
    }
    if (openRouterModel.capabilities?.structured_outputs) {
      capabilities.push('structured-outputs');
    }
    if (openRouterModel.capabilities?.web_search) {
      capabilities.push('web-search');
    }
    if (openRouterModel.capabilities?.reasoning) {
      capabilities.push('reasoning');
    }
    capabilities.push('text-generation');

    return {
      id: openRouterModel.id, // Use full OpenRouter model ID
      name: openRouterModel.name,
      provider: openRouterModel.id.split('/')[0] || 'OpenRouter',
      agentId: openRouterModel.id, // Use model ID as agent ID for OpenRouter
      maxTokens: openRouterModel.context_length,
      description:
        openRouterModel.description
        || `OpenRouter model: ${openRouterModel.name}`,
      capabilities,
      category,
      costTier,
      speed,
      executionPath: 'openrouter',
      providerKey,
    };
  }

  /**
   * Get all models as ModelConfig array
   */
  async getModelsAsConfig(
    forceRefresh = false
  ): Promise<ModelConfig[]> {
    const models = await this.fetchModels(forceRefresh);
    return models.map(model => this.transformToModelConfig(model));
  }

  /**
   * Get models filtered by category
   */
  async getModelsByCategory(
    category: string,
    forceRefresh = false
  ): Promise<ModelConfig[]> {
    const models = await this.getModelsAsConfig(forceRefresh);
    return models.filter(model => {
      if (category === 'all') {
        return true;
      }
      return model.category === category;
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      this.cache = null;
      console.log('[OpenRouterModelService] Cache cleared');
    } catch (error) {
      console.warn('[OpenRouterModelService] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { cached: boolean; age: number | null } {
    const cached = this.getCachedModels();
    if (!cached) {
      return { cached: false, age: null };
    }

    const age = Date.now() - cached.timestamp;
    return { cached: true, age };
  }
}

// Create and export a default instance
export const openRouterModelService = new OpenRouterModelService();

// Export the class for testing
export { OpenRouterModelService };
