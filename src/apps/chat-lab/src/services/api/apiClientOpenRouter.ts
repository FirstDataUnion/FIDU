/**
 * OpenRouter API Client
 * Handles direct communication with OpenRouter API via the gateway
 */

import axios, { type AxiosInstance } from 'axios';
import { getGatewayUrl } from '../../utils/environment';
import { getFiduAuthService } from '../auth/FiduAuthService';
import {
  OpenRouterAPIError,
  type OpenRouterChatRequest,
  type OpenRouterChatResponse,
  type OpenRouterStreamChunk,
  type OpenRouterModelsResponse,
  type OpenRouterZdrEndpointsResponse,
  type OpenRouterError,
} from '../../types/openRouter';
import { handleSSEStream } from '../../utils/sseStreamHandling';

// OpenRouter API Configuration
const OPENROUTER_API_CONFIG = {
  timeout: 600000, // 10 minutes timeout for long-running requests
};

/**
 * OpenRouter API Client class
 */
class OpenRouterAPIClient {
  private gatewayUrl: string;
  private client: AxiosInstance;
  private authService: ReturnType<typeof getFiduAuthService>;

  constructor() {
    this.gatewayUrl = getGatewayUrl();
    this.authService = getFiduAuthService();
    this.client = axios.create({
      timeout: OPENROUTER_API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptors();
  }

  /**
   * Get the base URL for OpenRouter API endpoints via gateway
   */
  private getBaseUrl(): string {
    return `${this.gatewayUrl}/api/openrouter/v1`;
  }

  /**
   * Setup axios interceptors for authentication
   */
  private setupInterceptors(): void {
    // Use the FiduAuthService's auth interceptor for consistent behavior
    const authInterceptor = this.authService.createAuthInterceptor();

    // Request interceptor
    this.client.interceptors.request.use(authInterceptor.request, error =>
      Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      authInterceptor.response,
      async error => {
        // Try the auth interceptor's error handler first
        try {
          return await authInterceptor.error(error);
        } catch (authError) {
          // If the auth interceptor throws an authentication-related error,
          // let it propagate (this will trigger logout)
          if (
            authError instanceof Error
            && (authError.message.includes('Authentication required')
              || authError.message.includes('Please log in again'))
          ) {
            throw authError;
          }
          // Otherwise, let the original error propagate
          throw error;
        }
      }
    );
  }

  /**
   * Handle API errors with OpenRouter-specific error handling
   */
  private async handleError(response: Response): Promise<never> {
    let errorData: OpenRouterError | any;

    const status = response.status;
    const statusText = response.statusText;

    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: {
          message: statusText,
          type: 'unknown',
        },
      };
    }

    // Handle OpenRouter-specific errors
    if (status === 402) {
      throw new OpenRouterAPIError(
        'Payment required. Please add credits to your OpenRouter account.',
        status,
        errorData.error?.code,
        errorData.error?.type
      );
    }

    if (status === 429) {
      const headers = response.headers;
      const retryAfter =
        headers.get('retry-after') || headers.get('Retry-After');
      throw new OpenRouterAPIError(
        `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please try again later.'}`,
        status,
        errorData.error?.code,
        errorData.error?.type
      );
    }

    if (errorData.error) {
      throw OpenRouterAPIError.fromResponse(errorData, status);
    }

    throw new OpenRouterAPIError(
      errorData.error?.message || statusText || 'Unknown error',
      status,
      errorData.error?.code,
      errorData.error?.type
    );
  }

  /**
   * Fetch available models from OpenRouter
   */
  async fetchModels(): Promise<OpenRouterModelsResponse> {
    const url = `${this.getBaseUrl()}/models`;

    try {
      const response = await this.client.get<OpenRouterModelsResponse>(url, {
        timeout: 30000, // 30 second timeout
      });

      return response.data;
    } catch (error: any) {
      if (error instanceof OpenRouterAPIError) {
        throw error;
      }

      // Handle axios errors
      if (error.response) {
        return this.handleAxiosError(error);
      } else if (error.request) {
        throw new OpenRouterAPIError(
          'No response received from OpenRouter API',
          0,
          'network_error'
        );
      } else if (
        error.code === 'ECONNABORTED'
        || error.message?.includes('timeout')
      ) {
        throw new OpenRouterAPIError(
          'Request timeout while fetching models',
          408,
          'timeout'
        );
      } else {
        throw new OpenRouterAPIError(
          `Failed to fetch models: ${error.message || 'Unknown error'}`,
          0,
          'network_error'
        );
      }
    }
  }

  /**
   * ZDR (zero data retention) eligible routes for chat-capable models.
   * Same gateway base as {@link fetchModels}: `/v1/endpoints/zdr`.
   */
  async fetchZdrEndpoints(): Promise<OpenRouterZdrEndpointsResponse> {
    const url = `${this.getBaseUrl()}/endpoints/zdr`;

    try {
      const response = await this.client.get<OpenRouterZdrEndpointsResponse>(
        url,
        {
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error: any) {
      if (error instanceof OpenRouterAPIError) {
        throw error;
      }

      if (error.response) {
        return this.handleAxiosError(error);
      } else if (error.request) {
        throw new OpenRouterAPIError(
          'No response received from OpenRouter ZDR endpoints API',
          0,
          'network_error'
        );
      } else if (
        error.code === 'ECONNABORTED'
        || error.message?.includes('timeout')
      ) {
        throw new OpenRouterAPIError(
          'Request timeout while fetching ZDR endpoints',
          408,
          'timeout'
        );
      } else {
        throw new OpenRouterAPIError(
          `Failed to fetch ZDR endpoints: ${error.message || 'Unknown error'}`,
          0,
          'network_error'
        );
      }
    }
  }

  /**
   * Handle axios error responses
   */
  private async handleAxiosError(error: any): Promise<never> {
    const response = error.response;
    if (!response) {
      throw new OpenRouterAPIError(
        error.message || 'Unknown error',
        0,
        'network_error'
      );
    }

    return this.handleError(response);
  }

  /**
   * Non-streaming chat completion (single JSON response).
   * Main Prompt Lab path uses {@link createStreamingChatCompletion} when direct OpenRouter is on.
   */
  async createChatCompletion(
    request: OpenRouterChatRequest,
    abortSignal?: AbortSignal
  ): Promise<OpenRouterChatResponse> {
    const url = `${this.getBaseUrl()}/chat/completions`;

    // Ensure stream is false for non-streaming
    const requestBody = { ...request, stream: false };

    console.log(`[OpenRouter] Creating chat completion:`, {
      model: request.model,
      messageCount: request.messages.length,
      stream: false,
    });

    try {
      const response = await this.client.post<OpenRouterChatResponse>(
        url,
        requestBody,
        {
          signal: abortSignal,
          timeout: OPENROUTER_API_CONFIG.timeout,
        }
      );

      console.log(`[OpenRouter] Chat completion completed:`, {
        model: response.data.model,
        usage: response.data.usage,
      });
      return response.data;
    } catch (error: any) {
      if (error instanceof OpenRouterAPIError) {
        throw error;
      }

      // Handle axios errors
      if (error.response) {
        return this.handleAxiosError(error);
      } else if (error.request) {
        throw new OpenRouterAPIError(
          'No response received from OpenRouter API',
          0,
          'network_error'
        );
      } else if (
        error.code === 'ECONNABORTED'
        || error.message?.includes('timeout')
      ) {
        throw new OpenRouterAPIError('Request timeout', 408, 'timeout');
      } else if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw new OpenRouterAPIError('Request aborted', 499, 'aborted');
      } else {
        throw new OpenRouterAPIError(
          `Failed to create chat completion: ${error.message || 'Unknown error'}`,
          0,
          'network_error'
        );
      }
    }
  }

  /**
   * Create a streaming chat completion
   * Returns an async generator that yields stream chunks
   * Uses fetch for streaming support
   */
  async *createStreamingChatCompletion(
    request: OpenRouterChatRequest,
    abortSignal?: AbortSignal
  ): AsyncGenerator<OpenRouterStreamChunk, void, unknown> {
    const url = `${this.getBaseUrl()}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
    };

    // Ensure stream is true for streaming
    const requestBody = { ...request, stream: true };

    console.log(`[OpenRouter] Creating streaming chat completion:`, {
      model: request.model,
      messageCount: request.messages.length,
      stream: true,
    });

    try {
      const response = await this.authService.authenticatedFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal:
          abortSignal || AbortSignal.timeout(OPENROUTER_API_CONFIG.timeout),
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      if (!response.body) {
        throw new OpenRouterAPIError(
          'Response body is null',
          500,
          'invalid_response'
        );
      }

      yield* handleSSEStream<OpenRouterStreamChunk>(response.body);
    } catch (error) {
      if (error instanceof OpenRouterAPIError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OpenRouterAPIError('Request aborted', 499, 'aborted');
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new OpenRouterAPIError('Request timeout', 408, 'timeout');
      }
      throw new OpenRouterAPIError(
        `Failed to create streaming chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'network_error'
      );
    }
  }
}

// Create and export a default instance
export const openRouterAPIClient = new OpenRouterAPIClient();

// Export a function to create new instances
export const createOpenRouterAPIClient = () => new OpenRouterAPIClient();
