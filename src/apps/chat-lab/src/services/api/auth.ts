import type { 
  User, 
  Profile
} from '../../types';
import { createProfile, deleteProfile, fetchCurrentUser, updateProfile } from './apiClientIdentityService';

export const authApi = {
  /**
   * Get current user information
   */
  getCurrentUser: async (token: string): Promise<User> => {
    const user = await fetchCurrentUser(token);
    return user;
  },

  /**
   * Create a new profile
   */
  createProfile: async (display_name: string, token?: string): Promise<Profile> => {
    const response = await createProfile(display_name, token);
    return response;
  },

  /**
   * Update an existing profile
   */
  updateProfile: async (profile_id: string, display_name: string, token?: string): Promise<Profile> => {
    const response = await updateProfile(profile_id, display_name, token);
    return response;
  },

  /**
   * Delete a profile
   */
  deleteProfile: async (profile_id: string, token?: string): Promise<boolean> => {
    const response = await deleteProfile(profile_id, token);
    return response;
  },

}; 