import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ErrorResponse } from './apiClients';
import { getGatewayUrl } from '../../utils/environment';
import { refreshTokenService } from './refreshTokenService';

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
      // Request interceptor to add auth token
      this.client.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
          // Get auth token from refresh token service
          const token = refreshTokenService.getAccessToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error: AxiosError) => {
          return Promise.reject(error);
        }
      );

      // Response interceptor
      this.client.interceptors.response.use(
        (response: AxiosResponse) => response,
        (error: AxiosError<ErrorResponse>) => {
          if (error.response) {
            // Handle authentication errors with refresh token logic
            if (error.response.status === 401) {
              return this.handleUnauthorizedWithRefresh(error);
            }
            
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
      );
    }

    /**
     * Handle 401 errors with automatic token refresh and retry
     */
    private async handleUnauthorizedWithRefresh(error: AxiosError<ErrorResponse>): Promise<never> {
      try {
        // Attempt to refresh the token
        await refreshTokenService.refreshAccessToken();
        
        // Token refreshed successfully, but we can't retry the original request here
        // The user will need to retry their action manually
        throw new ApiError(
          401,
          'Token expired and refreshed. Please retry your request.',
          error.response?.data
        );
      } catch {
        // Token refresh failed, clear auth data and redirect to login
        this.clearAllAuthTokens();
        
        throw new ApiError(
          401,
          'Authentication required. Please log in again.',
          error.response?.data
        );
      }
    }

    /**
     * Clear all authentication tokens and data
     */
    private clearAllAuthTokens(): void {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('fiduRefreshToken');
      localStorage.removeItem('token_expires_in');
      localStorage.removeItem('user');
      localStorage.removeItem('current_profile');
      localStorage.removeItem('fiduToken');
      
      // Clear cookies
      document.cookie = 'auth_token=; path=/; max-age=0; samesite=lax';
      document.cookie = 'refresh_token=; path=/; max-age=0; samesite=lax';
      document.cookie = 'fiduRefreshToken=; path=/; max-age=0; samesite=lax';
      
      // Reload the page to trigger auth flow
      window.location.reload();
    }
  
    /**
     * Execute an ChatGPT General chat Agent with input text
     */
    async executeChatGPTGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1751898508584306066/execute`,
        { input }
      );
      return response.data;
    }

    /**
     * Execute an ChatGPT 3.5 Turbo General chat Agent with input text
     */
    async executeChatGPT35TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755007425582490606/execute`,
        { input }
      );
      return response.data;
    }
  
    /**
     * Execute an ChatGPT 4.0 Turbo General chat Agent with input text
     */
    async executeChatGPT40TurboGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755007458371087422/execute`,
        { input }
      );
      return response.data;
    }
  
    /**
     * Execute an ChatGPT 4o General chat Agent with input text
     */
    async executeChatGPT4oGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755008314136173601/execute`,
        { input }
      );
      return response.data;
    }

    /**
     * Execute an Claude 3 Opus General chat Agent with input text
     */
    async executeClaude3OpusGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755008341384405976/execute`,
        { input }
      );
      return response.data;
    }
  
    /**
     * Execute an Claude 3 Sonnet General chat Agent with input text
     */
    async executeClaude3SonnetGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755008385886004593/execute`,
        { input }
      );
      return response.data;
    }

    /**
     * Execute an Claude 3 Haiku General chat Agent with input text
     */
    async executeClaude3HaikuGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        `${this.getBaseUrl()}/api/public/agents/agent-1755008467359243995/execute`,
        { input }
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
  