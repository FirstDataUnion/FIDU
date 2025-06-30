import { apiClient } from './apiClients';
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  User, 
  Profile, 
  CreateProfileRequest 
} from '../../types';

export const authApi = {
  /**
   * Login a user
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/users/login', credentials);
    return response.data;
  },

  /**
   * Register a new user
   */
  register: async (userData: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/users', userData);
    return response.data;
  },

  /**
   * Get current user information
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/current');
    return response.data;
  },

  /**
   * Get all profiles for the current user
   */
  getProfiles: async (): Promise<Profile[]> => {
    const response = await apiClient.get<Profile[]>('/profiles');
    return response.data;
  },

  /**
   * Create a new profile
   */
  createProfile: async (profileData: CreateProfileRequest): Promise<Profile> => {
    const response = await apiClient.post<Profile>('/profiles', profileData);
    return response.data;
  },

  /**
   * Get a specific profile by ID
   */
  getProfile: async (profileId: string): Promise<Profile> => {
    const response = await apiClient.get<Profile>(`/profiles/${profileId}`);
    return response.data;
  },
}; 