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
  createProfile: async (display_name: string, token?: string): Promise<Profile> => {
    const response = await createProfile(display_name, token);
    return response;
  },

}; 