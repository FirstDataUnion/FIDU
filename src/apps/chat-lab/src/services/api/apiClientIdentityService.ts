import type { Profile, User } from "../../types";
import { getIdentityServiceUrl } from "../../utils/environment";

export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${getIdentityServiceUrl()}/user`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user');

  // Convert response to User and Profile types
  const externalUser = await res.json();
  const user: User = {
    id: externalUser.user.id,
    email: externalUser.user.email,
    name: externalUser.user.name,
    create_timestamp: externalUser.user.created_at,
    update_timestamp: externalUser.user.updated_at,
    profiles: externalUser.user.profiles.map(externalProfileToInternalProfile)
  };

  return user;
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

export async function createProfile(token: string, display_name: string) {
  const res = await fetch(`${getIdentityServiceUrl()}/profiles`, {
    headers: { Authorization: `Bearer ${token}` },
    method: 'POST',
    body: JSON.stringify({"display_name": display_name })
  });
  if (!res.ok) throw new Error('Failed to create profile');
  const externalProfile = await res.json();
  return externalProfileToInternalProfile(externalProfile.profile);
}