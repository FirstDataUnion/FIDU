export const DEFAULT_BACKGROUND_AGENT_MODEL_ID = 'openai/gpt-oss-20b';

const LEGACY_TO_OPENROUTER_MODEL_ID: Record<string, string> = {
  'gpt-oss-20b': 'openai/gpt-oss-20b',
  'gpt-oss-120b': 'openai/gpt-oss-120b',
};

const OPENROUTER_TO_LEGACY_MODEL_ID: Record<string, string> = {
  'openai/gpt-oss-20b': 'gpt-oss-20b',
  'openai/gpt-oss-120b': 'gpt-oss-120b',
};

export function normalizeBackgroundAgentModelId(modelId?: string): string {
  if (!modelId) {
    return DEFAULT_BACKGROUND_AGENT_MODEL_ID;
  }
  return LEGACY_TO_OPENROUTER_MODEL_ID[modelId] || modelId;
}

export function resolveOpenRouterModelId(modelId?: string): string {
  const normalizedModelId = normalizeBackgroundAgentModelId(modelId);
  if (normalizedModelId === 'auto-router') {
    return 'openrouter/auto';
  }
  return normalizedModelId;
}

export function resolveNlpWorkbenchModelId(modelId?: string): string {
  const normalizedModelId = normalizeBackgroundAgentModelId(modelId);
  return OPENROUTER_TO_LEGACY_MODEL_ID[normalizedModelId] || normalizedModelId;
}

export function getBackgroundAgentCompatibleModels<
  T extends { outputModalities?: string[] },
>(models: T[]): T[] {
  return models.filter(
    model => !(model.outputModalities ?? []).includes('image')
  );
}
