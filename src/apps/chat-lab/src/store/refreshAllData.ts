/**
 * Utility to refresh all Redux state from storage after sync operations
 * This ensures Redux state stays in sync with the database
 */

import { store } from './index';
import { fetchContexts } from './slices/contextsSlice';
import { fetchConversations } from './slices/conversationsSlice';
import { fetchDocuments } from './slices/documentsSlice';
import { fetchSystemPrompts } from './slices/systemPromptsSlice';
import { fetchSettings } from './slices/settingsSlice';

/**
 * Refreshes all data from storage after sync operations
 * This ensures Redux state stays in sync with the database
 *
 * Uses Promise.allSettled to ensure all fetches are attempted even if some fail
 */
export async function refreshAllDataFromStorage(): Promise<void> {
  const state = store.getState();
  const currentProfileId = state.auth.currentProfile?.id;

  await Promise.allSettled([
    currentProfileId
      ? store.dispatch(fetchContexts(currentProfileId))
      : Promise.resolve(),

    store.dispatch(
      fetchConversations({
        filters: { sortBy: 'updatedAt', sortOrder: 'desc' },
        page: 1,
        limit: 20,
      })
    ),

    currentProfileId
      ? store.dispatch(fetchDocuments(currentProfileId))
      : Promise.resolve(),

    currentProfileId
      ? store.dispatch(fetchSystemPrompts(currentProfileId))
      : Promise.resolve(),

    store.dispatch(fetchSettings()),
  ]);
}
