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

  // Get effective profile ID using the same logic as fetchConversations
  // Try to get effective profile ID from workspace first, fallback to legacy profile
  let currentProfileId: string | undefined;
  if (state.auth.currentWorkspace) {
    // Use workspace to get effective profile ID
    if (state.auth.currentWorkspace.type === 'personal') {
      currentProfileId = state.auth.currentWorkspace.profileId;
    } else {
      // Shared workspace: use virtual profile ID format
      currentProfileId = `workspace-${state.auth.currentWorkspace.id}-default`;
    }
  } else if (state.auth.currentProfile) {
    // Fallback to legacy profile
    currentProfileId = state.auth.currentProfile.id;
  }

  if (!currentProfileId) {
    return;
  }

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
