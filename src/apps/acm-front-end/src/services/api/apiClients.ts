import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Configuration
const API_CONFIG = {
  baseURL: 'http://127.0.0.1:4000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Response type wrapper
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

// Error response type
interface ErrorResponse {
  message?: string;
  [key: string]: any;
}

// Base API client class
export class ApiClient {
  private client: AxiosInstance;

  constructor(config: AxiosRequestConfig = {}) {
    this.client = axios.create({
      ...API_CONFIG,
      ...config,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // You can add auth token here
        const token = localStorage.getItem('auth_token');
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
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          
          // Handle authentication errors
          if (error.response.status === 401) {
            // Clear auth data and redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            localStorage.removeItem('current_profile');
            // Reload the page to trigger auth flow
            window.location.reload();
            return Promise.reject(new ApiError(
              error.response.status,
              'Authentication required. Please log in.',
              error.response.data
            ));
          }
          
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

// Create and export a default instance
export const apiClient = new ApiClient();

// Export a function to create new instances with custom config
export const createApiClient = (config: AxiosRequestConfig) => new ApiClient(config);
