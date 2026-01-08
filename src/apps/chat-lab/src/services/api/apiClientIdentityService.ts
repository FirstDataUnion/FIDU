import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { Profile, User } from "../../types";
import { getIdentityServiceUrl } from "../../utils/environment";
import { getFiduAuthService } from "../auth/FiduAuthService";
import { ApiError, type ErrorResponse } from './apiClients';


export interface EncryptionKeyData {
  id: string;
  key: string;
  algorithm: string;
  created_at: string;
  version: number;
}

export interface EncryptionKeyResponse {
  encryption_key: EncryptionKeyData;
}

export interface WrappedWorkspaceKeyResponse {
  wrapped_key: string;
  algorithm: string;
}

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
    // Use the FiduAuthService's auth interceptor for consistent behavior
    const authInterceptor = getFiduAuthService().createAuthInterceptor();
    
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
              error.response.data?.error || error.response.data?.message || 'Identity Service API error',
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

  async updateProfile(profile_id: string, display_name: string): Promise<Profile> {
    const response = await this.client.put(`/profiles/${profile_id}`, { display_name });
    return externalProfileToInternalProfile(response.data.profile);
  }

  async deleteProfile(profile_id: string): Promise<boolean> {
    await this.client.delete(`/profiles/${profile_id}`);
    return true;
  }

  async getEncryptionKey(): Promise<string> {
    try {
    const response = await this.client.get(`/encryption/key`);
    const data: EncryptionKeyResponse = response.data;
    if (!data.encryption_key || !data.encryption_key.key || typeof data.encryption_key.key !== 'string') {
      console.error('❌ [IdentityServiceClient] Invalid key format:', data);
      throw new Error('Invalid encryption key format received from server');
    }
    return data.encryption_key.key;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return await this.createEncryptionKey();
      }
      throw error;
    }
  }

  async createEncryptionKey(): Promise<string> {
    const response = await this.client.post(`/encryption/key`);
    const data: EncryptionKeyResponse = response.data;
    if (!data.encryption_key || !data.encryption_key.key || typeof data.encryption_key.key !== 'string') {
      console.error('❌ [IdentityServiceClient] Invalid key format:', data);
      throw new Error('Invalid encryption key format received from server');
    }
    return data.encryption_key.key;
  }

  async deleteEncryptionKey(): Promise<void> {
    await this.client.delete(`/encryption/key`);
  }

  // Workspace API methods

  /**
   * Create a new workspace
   * @param name - Workspace name
   * @param driveFolderId - Google Drive folder ID
   * @param memberEmails - Optional array of FIDU email addresses to invite as members
   * @returns Workspace details and members array with both FIDU and Google emails
   */
  async createWorkspace(
    name: string, 
    driveFolderId: string, 
    memberEmails?: string[]
  ): Promise<{ 
    workspace: { 
      id: string; 
      name: string; 
      drive_folder_id: string;
      owner_email: string;
      owner_user_id: string;
      created_at: string;
      updated_at: string;
    }; 
    members: Array<{
      id: string;
      workspace_id: string;
      fidu_email: string;
      google_email: string | null;
      user_id: string | null;
      role: 'owner' | 'member';
      status: 'accepted' | 'pending';
      invited_at: string;
      accepted_at: string | null;
    }>;
  }> {
    const requestBody: {
      name: string;
      drive_folder_id: string;
      member_emails?: string[];
    } = {
      name,
      drive_folder_id: driveFolderId,
    };
    
    if (memberEmails && memberEmails.length > 0) {
      requestBody.member_emails = memberEmails;
    }
    
    const response = await this.client.post('/workspaces', requestBody);
    return response.data;
  }

  /**
   * List user's workspaces
   * The API returns all workspaces the user has access to, with the user's role included
   */
  async listWorkspaces(role?: 'owner' | 'member'): Promise<{ 
    workspaces: Array<{ 
      id: string; 
      name: string; 
      role: 'owner' | 'member';  // Current user's role in this workspace
      status: 'accepted' | 'pending';
      drive_folder_id: string; 
      owner_user_id?: string;  // Only present for member role
      user_role?: 'owner' | 'member';  // Duplicate of role field
      member_count: number;
      created_at: string; 
      updated_at?: string;
    }> 
  }> {
    const params = role ? { role } : {};
    const response = await this.client.get('/workspaces', { params });
    return response.data;
  }

  /**
   * Get user's pending workspace invitations
   */
  async getPendingInvitations(): Promise<{ 
    invitations: Array<{ 
      workspace_id: string; 
      workspace_name: string; 
      drive_folder_id: string;
      owner_email: string;
      owner_name: string;
      invited_at: string;
    }> 
  }> {
    const response = await this.client.get('/workspaces/invitations');
    return response.data;
  }

  /**
   * Accept a workspace invitation
   */
  async acceptInvitation(workspaceId: string, googleEmail: string): Promise<{ member: { id: string; user_id: string; role: 'owner' | 'member'; google_email?: string; accepted_at?: string } }> {
    const response = await this.client.post(`/workspaces/${workspaceId}/accept`, {
      google_email: googleEmail,
    });
    return response.data;
  }

  /**
   * Add members to a workspace
   */
  async addMembers(workspaceId: string, emails: string[], _role: 'member' = 'member'): Promise<{ members: Array<{ id: string; user_id: string; role: 'owner' | 'member'; google_email?: string }> }> {
    const response = await this.client.post(`/workspaces/${workspaceId}/members`, {
      member_emails: emails,
    });
    return response.data;
  }

  /**
   * Get workspace files
   * Response format: { files: { drive_folder_id: string, conversations_db_id: string, metadata_json_id: string } }
   */
  async getWorkspaceFiles(workspaceId: string): Promise<{ 
    files: { 
      drive_folder_id: string;
      conversations_db_id: string; 
      metadata_json_id: string;
    } 
  }> {
    const response = await this.client.get(`/workspaces/${workspaceId}/files`);
    return response.data;
  }

  /**
   * Register workspace files with the identity service
   * This should be called after creating the workspace files in Google Drive
   */
  async registerWorkspaceFiles(
    workspaceId: string,
    folderId: string,
    conversationsDbId: string,
    metadataJsonId: string
  ): Promise<{ files: { folder_id: string, conversations_db_id: string; metadata_json_id: string } }> {
    const response = await this.client.post(`/workspaces/${workspaceId}/files`, {
      folder_id: folderId,
      conversations_db_id: conversationsDbId,
      metadata_json_id: metadataJsonId,
    });
    return response.data;
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(workspaceId: string): Promise<{ 
    members: Array<{
      id: string;
      workspace_id: string;
      fidu_email: string;
      google_email: string | null;
      user_id: string | null;
      role: 'owner' | 'member';
      status: 'accepted' | 'pending';
      invited_at: string;
      accepted_at: string | null;
    }> 
  }> {
    const response = await this.client.get(`/workspaces/${workspaceId}/members`);
    return response.data;
  }

  /**
   * Remove a member from a workspace (owner only)
   * Note: Backend uses email, not userId
   */
  async removeMember(workspaceId: string, email: string): Promise<void> {
    await this.client.delete(`/workspaces/${workspaceId}/members/${encodeURIComponent(email)}`);
  }

  /**
   * Delete a workspace (owner only)
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.client.delete(`/workspaces/${workspaceId}`);
  }

  /**
   * Get wrapped encryption key for workspace
   */
  async getWrappedWorkspaceEncryptionKey(workspaceId: string): Promise<string> {
    const response = await this.client.get(`/workspaces/${workspaceId}/encryption-key`);
    const data: WrappedWorkspaceKeyResponse = response.data;
    if (!data.wrapped_key || typeof data.wrapped_key !== 'string') {
      console.error('❌ [IdentityServiceClient] Invalid wrapped key format:', data);
      throw new Error('Invalid wrapped encryption key format received from server');
    }
    if (data.algorithm !== 'AES-256-GCM') {
      console.warn(`⚠️ [IdentityServiceClient] Unexpected algorithm: ${data.algorithm}, expected AES-256-GCM`);
    }
    return data.wrapped_key;
  }

  /**
   * Update user's Google email address
   */
  async updateGoogleEmail(googleEmail: string): Promise<{ message: string; user: { id: string; email: string; google_email: string; google_email_updated_at: string } }> {
    const response = await this.client.put('/user/google-email', {
      google_email: googleEmail,
    });
    return response.data;
  }
}

// Create and export a singleton instance
export const identityServiceAPIClient = new IdentityServiceAPIClient();

export async function fetchCurrentUser() {
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

export async function createProfile(display_name: string) {
  return await identityServiceAPIClient.createProfile(display_name);
}

export async function updateProfile(profile_id: string, display_name: string) {
  return await identityServiceAPIClient.updateProfile(profile_id, display_name);
}

export async function deleteProfile(profile_id: string) {
  return await identityServiceAPIClient.deleteProfile(profile_id);
}

export async function getEncryptionKey() {
  return await identityServiceAPIClient.getEncryptionKey();
}

export async function createEncryptionKey() {
  return await identityServiceAPIClient.createEncryptionKey();
}

export async function deleteEncryptionKey() {
  return await identityServiceAPIClient.deleteEncryptionKey();
}

export async function getWrappedWorkspaceKey(workspaceId: string) {
  return await identityServiceAPIClient.getWrappedWorkspaceEncryptionKey(workspaceId);
}
