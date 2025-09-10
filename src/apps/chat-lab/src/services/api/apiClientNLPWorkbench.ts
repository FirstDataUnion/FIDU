import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import { ApiError, type ErrorResponse } from './apiClients';
import { getGatewayUrl } from '../../utils/environment';
import { refreshTokenService } from './refreshTokenService';
import { apiKeyService, type SupportedProvider } from './apiKeyService';

// NLP Workbench API Configuration
const NLP_WORKBENCH_API_CONFIG = {
    timeout: 30000, // Longer timeout for NLP processing
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
          } catch {
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
      maxWaitTime: number = 60000, // 60 seconds default
      pollInterval: number = 2000  // 2 seconds default
    ): Promise<NLPWorkbenchExecutionStatus> {
      // Start the execution
      const executeResponse = await agentCallback(input);
      const { executionId } = executeResponse;
  
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
            const executionStatus = await this.getExecutionStatus(executionId);

            // Check if execution is complete
            if (executionStatus.status === 'completed' || executionStatus.status === 'failed') {
                return executionStatus;
            }
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (error) {
            console.error('Error polling execution status:', error);
            // Continue polling even if there's an error
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
      
      throw new ApiError(
        408,
        'NLP Workbench execution timed out',
        { executionId, maxWaitTime }
      );
    }
  }
  
  // Create and export a default instance for NLP Workbench API
  export const nlpWorkbenchAPIClient = new NLPWorkbenchAPIClient();
  
  // Export a function to create new instances (kept for backward compatibility)
  export const createNLPWorkbenchAPIClient = () => new NLPWorkbenchAPIClient();
  
  // Export a function to create new instances with settings-based API key provider (kept for backward compatibility)
  export const createNLPWorkbenchAPIClientWithSettings = () => new NLPWorkbenchAPIClient();
  