/**
 * Hook to manage user ID synchronization between auth state and storage service
 */

import { useEffect } from 'react';
import { useAppSelector } from './redux';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';

export function useStorageUserId(): void {
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (user?.id) {
      const storageService = getUnifiedStorageService();
      storageService.setUserId(user.id);
    }
  }, [user?.id]);
}
