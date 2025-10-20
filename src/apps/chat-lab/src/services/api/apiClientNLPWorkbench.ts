import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import { ApiError, type ErrorResponse } from './apiClients';
import { getGatewayUrl } from '../../utils/environment';
import { refreshTokenService } from './refreshTokenService';
import { apiKeyService, type SupportedProvider } from './apiKeyService';
import { getModelConfig, getModelAgentUrl, convertLegacyModelId, MODEL_CONFIGS } from '../../data/models';

// NLP Workbench API Configuration
const NLP_WORKBENCH_API_CONFIG = {
    timeout: 90000, // 90 seconds timeout for NLP processing
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // NLP Workbench API response types
  export interface NLPWorkbenchExecuteResponse {
    Status: string;
    executionId: string;
  }
  
  export interface NLPWorkbenchExecutionStatus {
    Status: string;
    Result?: any;
    Error?: string;
    [key: string]: any;
  }
  
  // NLP Workbench API client class
  export class NLPWorkbenchAPIClient {
    private client: AxiosInstance;

    constructor() {
      this.client = axios.create({
        ...NLP_WORKBENCH_API_CONFIG,
      });
  
      this.setupInterceptors();
    }

    private getBaseUrl(): string {
      const gatewayUrl = getGatewayUrl();
      return `${gatewayUrl}/api/nlp-workbench`;
    }
  
    private setupInterceptors(): void {
      // Use the refresh token service's auth interceptor for consistent behavior
      const authInterceptor = refreshTokenService.createAuthInterceptor();
      
      // Request interceptor
      this.client.interceptors.request.use(
        authInterceptor.request,
        (error: AxiosError) => {
          return Promise.reject(error);
        }
      );

      // Response interceptor
      this.client.interceptors.response.use(
        authInterceptor.response,
        async (error: AxiosError<ErrorResponse>) => {
          // Try the auth interceptor's error handler first
          try {
            return await authInterceptor.error(error);
          } catch (authError) {
            // If the auth interceptor throws an authentication-related error,
            // let it propagate (this will trigger logout)
            if (authError instanceof Error && 
                (authError.message.includes('Authentication required') || 
                 authError.message.includes('Please log in again'))) {
              throw authError;
            }
            
            // If auth interceptor doesn't handle it, handle other errors
            if (error.response) {
              throw new ApiError(
                error.response.status,
                error.response.data?.message || 'NLP Workbench API error',
                error.response.data
              );
            } else if (error.request) {
              throw new ApiError(
                0,
                'No response received from NLP Workbench API',
                error.request
              );
            } else {
              throw new ApiError(
                0,
                'Error setting up NLP Workbench API request',
                error.message
              );
            }
          }
        }
      );
    }



    /**
     * Enhance request data with all available API keys using the new llm_api_keys format
     * @param input The input text
     * @returns Enhanced request data with llm_api_keys object
     */
    private async enhanceRequestWithAPIKeys(input: string): Promise<{ input: string; llm_api_keys?: Record<string, string> }> {
      const requestData: { input: string; llm_api_keys?: Record<string, string> } = { input };
      
      try {
        console.log(`🔍 [NLPWorkbench] Fetching all available API keys`);
        
        // Fetch all available API keys
        const llmApiKeys: Record<string, string> = {};
        const providers = ['openai', 'anthropic', 'google', 'openrouter'] as SupportedProvider[];
        
        for (const provider of providers) {
          const apiKey = await apiKeyService.getAPIKeyForProvider(provider);
          if (apiKey) {
            llmApiKeys[provider] = apiKey;
            const keyPreview = apiKey.substring(0, 10) + '...';
            console.log(`✅ [NLPWorkbench] Found API key for ${provider}, preview: ${keyPreview}`);
          }
        }
        
        // Only add llm_api_keys if we have at least one key
        if (Object.keys(llmApiKeys).length > 0) {
          requestData.llm_api_keys = llmApiKeys;
          console.log(`✅ [NLPWorkbench] Added llm_api_keys with ${Object.keys(llmApiKeys).length} provider(s):`, Object.keys(llmApiKeys));
        } else {
          console.warn(`⚠️ [NLPWorkbench] No API keys available for any provider`);
        }
      } catch (error) {
        console.error(`❌ [NLPWorkbench] Error fetching API keys:`, error);
      }
      
      console.log(`📤 [NLPWorkbench] Request data structure:`, {
        input: input.substring(0, 50) + '...',
        llm_api_keys: requestData.llm_api_keys ? Object.keys(requestData.llm_api_keys) : 'none'
      });
      
      return requestData;
    }

    /**
     * Execute any model agent with input text using the centralized model configuration
     * @param modelId The model ID to execute (supports both new and legacy model IDs)
     * @param input The input text to process
     * @returns Promise<NLPWorkbenchExecuteResponse>
     */
    async executeModelAgent(modelId: string, input: string): Promise<NLPWorkbenchExecuteResponse> {
      // Convert legacy model ID to new model ID if needed
      const actualModelId = convertLegacyModelId(modelId);
      
      // Get model configuration
      const modelConfig = getModelConfig(actualModelId);
      if (!modelConfig) {
        throw new ApiError(
          400,
          `Model '${modelId}' not found. Available models: ${Object.keys(MODEL_CONFIGS).join(', ')}`,
          { modelId, actualModelId }
        );
      }

      // Get the agent URL for this model
      const agentUrl = getModelAgentUrl(actualModelId);
      
      console.log(`🚀 [NLPWorkbench] Executing model: ${modelConfig.name} (${actualModelId})`);
      console.log(`🔗 [NLPWorkbench] Agent URL: ${agentUrl}`);
      
      const requestData = await this.enhanceRequestWithAPIKeys(input);
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        agentUrl,
        requestData
      );
      return response.data;
    }

    // Legacy method wrappers for backward compatibility
    /**
     * @deprecated Use executeModelAgent('gemini-2.0-flash', input) instead
     */
    async executeGeminiFlashGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gemini-flash', input);
    }

    /**
     * @deprecated Use executeModelAgent('gemini-2.5-pro', input) instead
     */
    async executeGeminiProGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gemini-pro', input);
    }

    /**
     * @deprecated Use executeModelAgent('claude-haiku-3', input) instead
     */
    async executeClaudeHaikuGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('claude-haiku', input);
    }

    /**
     * @deprecated Use executeModelAgent('claude-sonnet-4', input) instead
     */
    async executeClaudeSonnetGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('claude-sonnet', input);
    }

    /**
     * @deprecated Use executeModelAgent('claude-opus-4.1', input) instead
     */
    async executeClaudeOpus41GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('claude-opus-41', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-3.5-turbo', input) instead
     */
    async executeChatGPT35TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-3.5-turbo', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-4', input) instead
     */
    async executeChatGPT40GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-4.0', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-4-turbo', input) instead
     */
    async executeChatGPT40TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-4.0-turbo', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-4o-mini', input) instead
     */
    async executeChatGPT40MiniGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-4.0-mini', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-5', input) instead
     */
    async executeChatGPT50GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-5.0', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-5-mini', input) instead
     */
    async executeChatGPT50MiniGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-5.0-mini', input);
    }

    /**
     * @deprecated Use executeModelAgent('gpt-5-nano', input) instead
     */
    async executeChatGPT50NanoGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      return this.executeModelAgent('gpt-5.0-nano', input);
    }
    
    /**
     * Get execution status by ID
     */
    async getExecutionStatus(executionId: string): Promise<NLPWorkbenchExecutionStatus> {
      const response = await this.client.get<NLPWorkbenchExecutionStatus>(
        `${this.getBaseUrl()}/api/public/executions/${executionId}`
      );
      return response.data;
    }
  
    /**
     * Execute a specific agent call and wait for completion with polling
     */
    async executeAgentAndWait(
      input: string, 
      agentCallback: (input: string) => Promise<NLPWorkbenchExecuteResponse>,
      maxWaitTime: number = 90000, // 90 seconds default
      pollInterval: number = 2000  // 2 seconds default
    ): Promise<NLPWorkbenchExecutionStatus> {
      // Start the execution
      const executeResponse = await agentCallback(input);
      const { executionId } = executeResponse;
  
      const startTime = Date.now();
      let pollCount = 0;
      let lastKnownStatus = null;
      const pollingErrors: any[] = [];
      
      console.log('Starting NLP Workbench execution polling:', {
        executionId,
        maxWaitTime,
        pollInterval,
        startTime: new Date(startTime).toISOString()
      });
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
            const executionStatus = await this.getExecutionStatus(executionId);
            pollCount++;
            lastKnownStatus = executionStatus;

            // Log status updates every 10 polls (20 seconds with 2s interval)
            if (pollCount % 10 === 0) {
              console.log(`NLP Workbench polling update (${pollCount} polls, ${Math.round((Date.now() - startTime) / 1000)}s elapsed):`, {
                executionId,
                status: executionStatus.status,
                pollCount,
                elapsedMs: Date.now() - startTime,
                remainingMs: maxWaitTime - (Date.now() - startTime)
              });
            }

            // Check if execution is complete
            if (executionStatus.status === 'completed' || executionStatus.status === 'failed') {
                const totalTime = Date.now() - startTime;
                console.log('NLP Workbench execution completed:', {
                  executionId,
                  status: executionStatus.status,
                  totalTimeMs: totalTime,
                  totalPolls: pollCount,
                  finalStatus: executionStatus
                });
                return executionStatus;
            }
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            pollCount++;
            pollingErrors.push({
              pollCount,
              error: error,
              timestamp: Date.now(),
              elapsedMs: Date.now() - startTime
            });
            
            console.error(`Error polling execution status (poll ${pollCount}):`, {
              executionId,
              pollCount,
              elapsedMs: Date.now() - startTime,
              error: error
            });
            
            // Continue polling even if there's an error
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
      
      // Timeout occurred - gather comprehensive debug info
      const totalTime = Date.now() - startTime;
      const debugInfo = {
        executionId,
        maxWaitTime,
        actualWaitTime: totalTime,
        pollInterval,
        totalPolls: pollCount,
        lastKnownStatus,
        pollingErrors: pollingErrors,
        timeoutReason: totalTime >= maxWaitTime ? 'Maximum wait time exceeded' : 'Unexpected timeout',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        inputLength: input.length,
        inputPreview: input.substring(0, 100) + (input.length > 100 ? '...' : '')
      };
      
      console.error('NLP Workbench execution timed out - comprehensive debug info:', debugInfo);
      
      throw new ApiError(
        408,
        'NLP Workbench execution timed out',
        debugInfo
      );
    }
  }
  
  // Create and export a default instance for NLP Workbench API
  export const nlpWorkbenchAPIClient = new NLPWorkbenchAPIClient();
  
  // Export a function to create new instances (kept for backward compatibility)
  export const createNLPWorkbenchAPIClient = () => new NLPWorkbenchAPIClient();
  
  // Export a function to create new instances with settings-based API key provider (kept for backward compatibility)
  export const createNLPWorkbenchAPIClientWithSettings = () => new NLPWorkbenchAPIClient();
  