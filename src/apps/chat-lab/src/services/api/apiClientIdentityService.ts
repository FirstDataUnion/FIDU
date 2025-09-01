import type { Profile, User } from "../../types";
import { getIdentityServiceUrl } from "../../utils/environment";
import { refreshTokenService } from "./refreshTokenService";

export async function fetchCurrentUser(token?: string) {
  // If no token provided, get it from the refresh token service
  const accessToken = token || refreshTokenService.getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }

  try {
    const res = await fetch(`${getIdentityServiceUrl()}/user`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (res.status === 401) {
      // Token expired, try to refresh
      try {
        await refreshTokenService.refreshAccessToken();
        // Retry with new token
        const newToken = refreshTokenService.getAccessToken();
        if (newToken) {
          const retryRes = await fetch(`${getIdentityServiceUrl()}/user`, {
            headers: { Authorization: `Bearer ${newToken}` }
          });
          if (!retryRes.ok) throw new Error('Failed to fetch user after token refresh');
          
          const externalUser = await retryRes.json();
          return createUserFromResponse(externalUser);
        }
      } catch {
        // Token refresh failed, clear auth data and redirect to login
        refreshTokenService.clearAllAuthTokens();
        window.location.reload();
        throw new Error('Authentication required. Please log in again.');
      }
    }
    
    if (!res.ok) throw new Error('Failed to fetch user');

    // Convert response to User and Profile types
    const externalUser = await res.json();
    return createUserFromResponse(externalUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      throw error;
    }
    throw new Error('Failed to fetch user');
  }
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
  // If no token provided, get it from the refresh token service
  const accessToken = token || refreshTokenService.getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }

  try {
    const res = await fetch(`${getIdentityServiceUrl()}/profiles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'POST',
      body: JSON.stringify({"display_name": display_name })
    });
    
    if (res.status === 401) {
      // Token expired, try to refresh
      try {
        await refreshTokenService.refreshAccessToken();
        // Retry with new token
        const newToken = refreshTokenService.getAccessToken();
        if (newToken) {
          const retryRes = await fetch(`${getIdentityServiceUrl()}/profiles`, {
            headers: { Authorization: `Bearer ${newToken}` },
            method: 'POST',
            body: JSON.stringify({"display_name": display_name })
          });
          if (!retryRes.ok) throw new Error('Failed to create profile after token refresh');
          
          const externalProfile = await retryRes.json();
          return externalProfileToInternalProfile(externalProfile.profile);
        }
      } catch {
        // Token refresh failed, clear auth data and redirect to login
        refreshTokenService.clearAllAuthTokens();
        window.location.reload();
        throw new Error('Authentication required. Please log in again.');
      }
    }
    
    if (!res.ok) throw new Error('Failed to create profile');
    
    const externalProfile = await res.json();
    return externalProfileToInternalProfile(externalProfile.profile);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      throw error;
    }
    throw new Error('Failed to create profile');
  }
}