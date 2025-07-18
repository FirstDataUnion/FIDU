import { createContext, useContext } from 'react';
import type { User, Profile } from '../../types';

interface ProfileContextValue {
  user: User | null;
  profiles: Profile[];
  selectedProfile: Profile | null;
  setSelectedProfile: (profile: Profile) => void;
}

export const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const useProfileContext = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfileContext must be used within a ProfileProvider');
  return ctx;
};

export const ProfileProvider = ProfileContext.Provider; 