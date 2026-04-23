/**
 * OpenRouter Model Service
 * Fetches and caches models from OpenRouter API
 */

import { openRouterAPIClient } from '../api/apiClientOpenRouter';
import type {
  OpenRouterModel,
  OpenRouterModelsResponse,
  OpenRouterZdrEndpointsResponse,
} from '../../types/openRouter';
import type { ModelConfig } from '../../data/models';

/**
 * Keep models that declare text as both an input and output modality.
 * When modality arrays are missing (e.g. stale cache), keep the model unless
 * architecture clearly indicates a non-chat image-only path.
 */
export function openRouterModelHasTextInputAndOutput(
  model: OpenRouterModel
): boolean {
  const { input_modalities: inputs, output_modalities: outputs } =
    model.architecture;
  const hasIn = Array.isArray(inputs) && inputs.length > 0;
  const hasOut = Array.isArray(outputs) && outputs.length > 0;

  if (hasIn && hasOut) {
    return inputs.includes('text') && outputs.includes('text');
  }

  const modality = model.architecture.modality;
  if (modality === 'image') {
    return false;
  }
  return true;
}

/**
 * True if the catalog model is routable under ZDR (zero data retention), per
 * GET /v1/endpoints/zdr `model_id` values.
 *
 * Strict policy: only keep catalog models whose `id` is explicitly present in
 * the ZDR endpoint payload.
 */
export function openRouterCatalogModelAllowedByZdr(
  model: OpenRouterModel,
  zdrModelIds: Set<string>
): boolean {
  return zdrModelIds.has(model.id);
}

/**
 * Subset of models that already passed {@link openRouterModelHasTextInputAndOutput}.
 * Used by {@link OpenRouterModelService.getModelsAsConfig} and tests.
 */
export function filterOpenRouterModelsByZdr(
  afterTextIo: OpenRouterModel[],
  zdrModelIds: Set<string>
): OpenRouterModel[] {
  return afterTextIo.filter(m =>
    openRouterCatalogModelAllowedByZdr(m, zdrModelIds)
  );
}

/**
 * Applies strict ZDR allowlist. If {@link fetchZdrModelIds} yields no ids
 * (empty response, parse miss, etc.), return no models so we do not present
 * non-ZDR options in the picker.
 */
export function applyOpenRouterZdrAllowlist(
  afterTextIo: OpenRouterModel[],
  zdrModelIds: Set<string>
): OpenRouterModel[] {
  if (zdrModelIds.size === 0) {
    console.warn(
      '[OpenRouterModelService] ZDR endpoint returned no model IDs; returning empty model list'
    );
    return [];
  }
  return filterOpenRouterModelsByZdr(afterTextIo, zdrModelIds);
}

// Cache configuration
const MODELS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ZDR_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const CACHE_KEY = 'openrouter_models_cache';
const ZDR_CACHE_KEY = 'openrouter_zdr_model_ids_cache';

interface CachedModels {
  models: OpenRouterModel[];
  timestamp: number;
}

interface CachedZdrModelIds {
  ids: string[];
  timestamp: number;
}

/**
 * OpenRouter Model Service class
 */
class OpenRouterModelService {
  private cache: CachedModels | null = null;
  private fetchPromise: Promise<OpenRouterModelsResponse> | null = null;
  private zdrFetchPromise: Promise<OpenRouterZdrEndpointsResponse> | null =
    null;

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
      if (now - parsed.timestamp < MODELS_CACHE_TTL_MS) {
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

  private getCachedZdrModelIds(): CachedZdrModelIds | null {
    try {
      const cached = localStorage.getItem(ZDR_CACHE_KEY);
      if (!cached) {
        return null;
      }
      const parsed: CachedZdrModelIds = JSON.parse(cached);
      if (Date.now() - parsed.timestamp >= ZDR_CACHE_TTL_MS) {
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn('[OpenRouterModelService] Failed to read ZDR cache:', error);
      return null;
    }
  }

  private saveCachedZdrModelIds(ids: string[]): void {
    try {
      const cached: CachedZdrModelIds = {
        ids,
        timestamp: Date.now(),
      };
      localStorage.setItem(ZDR_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.warn('[OpenRouterModelService] Failed to save ZDR cache:', error);
    }
  }

  /**
   * Unique `model_id` values from GET /v1/endpoints/zdr (ZDR-eligible routes).
   */
  async fetchZdrModelIds(forceRefresh = false): Promise<Set<string>> {
    if (!forceRefresh) {
      const cached = this.getCachedZdrModelIds();
      if (cached) {
        return new Set(cached.ids);
      }
    }

    if (this.zdrFetchPromise) {
      const response = await this.zdrFetchPromise;
      const ids = [
        ...new Set(
          (response.data || [])
            .map(e => e.model_id)
            .filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            )
        ),
      ];
      return new Set(ids);
    }

    this.zdrFetchPromise = openRouterAPIClient.fetchZdrEndpoints();

    try {
      const response = await this.zdrFetchPromise;
      const ids = [
        ...new Set(
          (response.data || [])
            .map(e => e.model_id)
            .filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            )
        ),
      ];
      this.saveCachedZdrModelIds(ids);
      return new Set(ids);
    } catch (error) {
      console.error(
        '[OpenRouterModelService] Failed to fetch ZDR endpoints:',
        error
      );
      throw error;
    } finally {
      this.zdrFetchPromise = null;
    }
  }

  /**
   * Fetch models from OpenRouter API
   */
  async fetchModels(forceRefresh = false): Promise<OpenRouterModel[]> {
    if (!forceRefresh) {
      const cached = this.getCachedModels();
      if (cached) {
        return cached.models;
      }
    }

    // If there's already a fetch in progress, wait for it
    if (this.fetchPromise) {
      const response = await this.fetchPromise;
      return response.data;
    }

    this.fetchPromise = openRouterAPIClient.fetchModels();

    try {
      const response = await this.fetchPromise;
      const models = response.data || [];

      this.cache = {
        models,
        timestamp: Date.now(),
      };
      this.saveCachedModels(models);

      return models;
    } catch (error) {
      console.error('[OpenRouterModelService] Failed to fetch models:', error);

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
        || (openRouterModel.architecture.input_modalities?.length ?? 0) > 1
        || (openRouterModel.architecture.output_modalities?.length ?? 0) > 1
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

    const outputModalities = openRouterModel.architecture.output_modalities
      ? [...openRouterModel.architecture.output_modalities]
      : undefined;
    if (outputModalities?.includes('image')) {
      capabilities.push('image-output');
    }

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
      outputModalities,
    };
  }

  /**
   * OpenRouter catalog as {@link ModelConfig}s plus whether the ZDR endpoint returned any ids.
   */
  async getModelsAsConfig(forceRefresh = false): Promise<{
    models: ModelConfig[];
    zdrAllowlistAvailable: boolean;
  }> {
    const [raw, zdrModelIds] = await Promise.all([
      this.fetchModels(forceRefresh),
      this.fetchZdrModelIds(forceRefresh),
    ]);
    const afterText = raw.filter(openRouterModelHasTextInputAndOutput);
    const zdrAllowlistAvailable = zdrModelIds.size > 0;
    const kept = applyOpenRouterZdrAllowlist(afterText, zdrModelIds);

    return {
      models: kept.map(model => this.transformToModelConfig(model)),
      zdrAllowlistAvailable,
    };
  }

  /**
   * Get models filtered by category
   */
  async getModelsByCategory(
    category: string,
    forceRefresh = false
  ): Promise<ModelConfig[]> {
    const { models } = await this.getModelsAsConfig(forceRefresh);
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
      localStorage.removeItem(ZDR_CACHE_KEY);
      this.cache = null;
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
