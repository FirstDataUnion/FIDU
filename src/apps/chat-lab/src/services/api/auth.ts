import type { 
  User, 
  Profile
} from '../../types';
import { createProfile, deleteProfile, fetchCurrentUser, updateProfile } from './apiClientIdentityService';

export const authApi = {
  /**
   * Get current user information
   */
  getCurrentUser: async (): Promise<User> => {
    const user = await fetchCurrentUser();
    return user;
  },

  /**
   * Create a new profile
   */
  createProfile: async (display_name: string): Promise<Profile> => {
    const response = await createProfile(display_name);
    return response;
  },

  /**
   * Update an existing profile
   */
  updateProfile: async (profile_id: string, display_name: string): Promise<Profile> => {
    const response = await updateProfile(profile_id, display_name);
    return response;
  },

  /**
   * Delete a profile
   */
  deleteProfile: async (profile_id: string): Promise<boolean> => {
    const response = await deleteProfile(profile_id);
    return response;
  },

}; 