import type { 
  User, 
  Profile
} from '../../types';
import { createProfile, fetchCurrentUser } from './apiClientIdentityService';

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
  createProfile: async (token: string, display_name: string): Promise<Profile> => {
    const response = await createProfile(token, display_name);
    return response;
  },

}; 