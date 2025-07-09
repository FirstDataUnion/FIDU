import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ErrorResponse } from './apiClients';

// NLP Workbench API Configuration
const NLP_WORKBENCH_API_CONFIG = {
    baseURL: '/api/nlp-workbench',
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
    private apiKey: string;
  
    constructor(apiKey?: string) {
      this.apiKey = apiKey || import.meta.env.VITE_NLP_WORKBENCH_AGENT_API_KEY || '';
      
      if (!this.apiKey) {
        console.warn('NLP Workbench API key not provided. Please set VITE_NLP_WORKBENCH_AGENT_API_KEY environment variable.');
      }
  
      this.client = axios.create({
        ...NLP_WORKBENCH_API_CONFIG,
      });
  
      this.setupInterceptors();
    }
  
    private setupInterceptors(): void {
      this.client.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
          // No need to add API key here as it's handled by the Vite proxy
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
     * Execute an ChatGPT General chat Agent with input text
     */
    async executeChatGPTGeneralAgent(input: string): Promise<NLPWorkbenchExecuteResponse> {
      const response = await this.client.post<NLPWorkbenchExecuteResponse>(
        '/agents/agent-1751898508584306066/execute',
        { input }
      );
      return response.data;
    }
  
    /**
     * Get execution status by ID
     */
    async getExecutionStatus(executionId: string): Promise<NLPWorkbenchExecutionStatus> {
      const response = await this.client.get<NLPWorkbenchExecutionStatus>(
        `/executions/${executionId}`
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
  
  // Export a function to create new instances with custom API key
  export const createNLPWorkbenchAPIClient = (apiKey: string) => new NLPWorkbenchAPIClient(apiKey);
  