import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import { ApiError, type ErrorResponse } from './apiClients';
import { getGatewayUrl } from '../../utils/environment';
import { refreshTokenService } from './refreshTokenService';
import { apiKeyService, type SupportedProvider } from './apiKeyService';

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
     * Enhance request data with API key for the specified provider
     * @param input The input text
     * @param provider The provider name
     * @returns Enhanced request data with API key if available
     */
    private async enhanceRequestWithAPIKey(input: string, provider: SupportedProvider): Promise<{ input: string; [key: string]: string }> {
      const requestData: { input: string; [key: string]: string } = { input };
      
      try {
        const apiKey = await apiKeyService.getAPIKeyForProvider(provider);
        if (apiKey) {
          const fieldName = apiKeyService.getAPIKeyFieldName(provider);
          requestData[fieldName] = apiKey;
          console.log(`Added ${fieldName} to request for provider: ${provider}`);
        } else {
          console.warn(`No API key available for provider: ${provider}`);
        }
      } catch (error) {
        console.error(`Error fetching API key for provider ${provider}:`, error);
      }
      
      return requestData;
    }

    /**
     * Execute a Gemini Flash General chat Agent with input text
     */
    async executeGeminiFlashGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'google');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247513434443545/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a Gemini Pro General chat Agent with input text
     */
    async executeGeminiProGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'google');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247536134017642/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a Claude Haiku General chat Agent with input text
     */
    async executeClaudeHaikuGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'anthropic');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247576782610310/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a Claude Sonnet General chat Agent with input text
     */
    async executeClaudeSonnetGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'anthropic');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247595523653178/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a Claude Opus 4.1 General chat Agent with input text
     */
    async executeClaudeOpus41GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'anthropic');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1758124239529968489/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 3.5 Turbo General chat Agent with input text
     */
    async executeChatGPT35TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247699977175946/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 4.0 General chat Agent with input text
     */
    async executeChatGPT40GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247730785641201/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 4.0 Turbo General chat Agent with input text
     */
    async executeChatGPT40TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247792142471669/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 4.0 Mini chat Agent with input text
     */
    async executeChatGPT40MiniGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247819944085397/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 5.0 General chat Agent with input text
     */
    async executeChatGPT50GeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247842543346249/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 5.0 Mini General chat Agent with input text
     */
    async executeChatGPT50MiniGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247909361890725/execute`,
        requestData
      );
      return response.data;
    }

    /**
     * Execute a chat GPT 5.0 Nano General chat Agent with input text
     */
    async executeChatGPT50NanoGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const requestData = await this.enhanceRequestWithAPIKey(input, 'openai');
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1757247941934986576/execute`,
        requestData
      );
      return response.data;
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
  