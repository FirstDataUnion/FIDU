import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { Profile, User } from "../../types";
import { getIdentityServiceUrl } from "../../utils/environment";
import { refreshTokenService } from "./refreshTokenService";
import { ApiError, type ErrorResponse } from './apiClients';

// Identity Service API Configuration
const IDENTITY_SERVICE_API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Identity Service API client class
class IdentityServiceAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      ...IDENTITY_SERVICE_API_CONFIG,
      baseURL: getIdentityServiceUrl(),
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
            throw new ApiError(
              error.response.status,
              error.response.data?.message || 'Identity Service API error',
              error.response.data
            );
          } else if (error.request) {
            throw new ApiError(
              0,
              'No response received from Identity Service API',
              error.request
            );
          } else {
            throw new ApiError(
              0,
              'Error setting up Identity Service API request',
              error.message
            );
          }
        }
      }
    );
  }

  async fetchCurrentUser(): Promise<User> {
    const response = await this.client.get('/user');
    return createUserFromResponse(response.data);
  }

  async createProfile(display_name: string): Promise<Profile> {
    const response = await this.client.post('/profiles', { display_name });
    return externalProfileToInternalProfile(response.data.profile);
  }
}

// Create and export a singleton instance
export const identityServiceAPIClient = new IdentityServiceAPIClient();

export async function fetchCurrentUser(token?: string) {
  // If a specific token is provided, temporarily set it for this request
  if (token) {
    const originalToken = refreshTokenService.getAccessToken();
    localStorage.setItem('auth_token', token);
    try {
      return await identityServiceAPIClient.fetchCurrentUser();
    } finally {
      // Restore original token
      if (originalToken) {
        localStorage.setItem('auth_token', originalToken);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }
  
  return await identityServiceAPIClient.fetchCurrentUser();
}

function createUserFromResponse(externalUser: any): User {
  return {
    id: externalUser.user.id,
    email: externalUser.user.email,
    name: externalUser.user.name,
    create_timestamp: externalUser.user.created_at,
    update_timestamp: externalUser.user.updated_at,
    profiles: externalUser.user.profiles.map(externalProfileToInternalProfile)
  };
}

export function externalProfileToInternalProfile(externalProfile: any): Profile {
  return {
    id: externalProfile.id,
    user_id: externalProfile.user_id,
    name: externalProfile.display_name,
    create_timestamp: externalProfile.created_at,
    update_timestamp: externalProfile.updated_at
  };
}

export async function createProfile(display_name: string, token?: string) {
  // If a specific token is provided, temporarily set it for this request
  if (token) {
    const originalToken = refreshTokenService.getAccessToken();
    localStorage.setItem('auth_token', token);
    try {
      return await identityServiceAPIClient.createProfile(display_name);
    } finally {
      // Restore original token
      if (originalToken) {
        localStorage.setItem('auth_token', originalToken);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }
  
  return await identityServiceAPIClient.createProfile(display_name);
}