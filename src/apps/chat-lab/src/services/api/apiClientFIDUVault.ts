import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ApiResponse, type ErrorResponse } from './apiClients';
import { refreshTokenService } from './refreshTokenService';

// FIDU Vault API Configuration
const FIDU_VAULT_API_CONFIG = {
  baseURL: 'http://127.0.0.1:4000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// FIDU Vault API client class
export class FiduVaultAPIClient {
  private client: AxiosInstance;

  // Helper function to clear all auth tokens consistently
  private clearAllAuthTokens() {
    refreshTokenService.clearAllAuthTokens();
  }

  constructor(config: AxiosRequestConfig = {}) {
    this.client = axios.create({
      ...FIDU_VAULT_API_CONFIG,
      ...config,
    });

    this.setupInterceptors();
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
          // If auth interceptor doesn't handle it, handle other errors
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            throw new ApiError(
              error.response.status,
              error.response.data?.message || 'An error occurred',
              error.response.data
            );
          } else if (error.request) {
            // The request was made but no response was received
            throw new ApiError(
              0,
              'No response received from server',
              error.request
            );
          } else {
            // Something happened in setting up the request that triggered an Error
            throw new ApiError(
              0,
              'Error setting up request',
              error.message
            );
          }
        }
      }
    );
  }


  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<T>(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<T>(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }
}

// Create and export a default instance for FIDU Vault API
export const fiduVaultAPIClient = new FiduVaultAPIClient();

// Export a function to create new instances with custom config
export const createFiduVaultAPIClient = (config: AxiosRequestConfig) => new FiduVaultAPIClient(config);