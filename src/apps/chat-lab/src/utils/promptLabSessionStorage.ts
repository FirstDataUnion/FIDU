/** Scope for Prompt Lab sessionStorage before auth.currentProfile is resolved. */
export const PROMPTLAB_SESSION_PENDING_SCOPE = '__pending__';

const LEGACY_KEYS = [
  'promptlab_messages',
  'promptlab_conversation',
  'promptlab_context',
  'promptlab_system_prompts',
] as const;

export function getPromptLabSessionScope(
  profileId: string | undefined | null
): string {
  if (profileId != null && profileId !== '') return profileId;
  return PROMPTLAB_SESSION_PENDING_SCOPE;
}

export function getPromptLabSessionStorageKeys(scope: string) {
  return {
    messages: `promptlab_messages_${scope}`,
    conversation: `promptlab_conversation_${scope}`,
    context: `promptlab_context_${scope}`,
    systemPrompts: `promptlab_system_prompts_${scope}`,
  } as const;
}

/** Remove pre-scoped keys so another account cannot read the previous user's snapshot. */
export function clearLegacyPromptLabSessionStorageKeys(): void {
  try {
    LEGACY_KEYS.forEach(key => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}
