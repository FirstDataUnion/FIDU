/**
 * Get the color associated with a platform
 */
export const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'chatgpt':
      return '#00A67E';
    case 'claude':
      return '#FF6B35';
    case 'gemini':
      return '#4285F4';
    default:
      return '#666';
  }
};

/**
 * Get the color associated with a role
 */
export const getRoleColor = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'user':
      return '#1976d2';
    case 'assistant':
      return '#388e3c';
    case 'system':
      return '#f57c00';
    default:
      return '#666';
  }
};

/**
 * Get the icon for a role
 */
export const getRoleIcon = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'user':
      return '👤';
    case 'assistant':
      return '🤖';
    case 'system':
      return '⚙️';
    default:
      return '💬';
  }
};

/**
 * Get a color for a tag (generates consistent colors based on tag name)
 */
export const getTagColor = (tagName: string): string => {
  const colors = [
    '#f44336',
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#03a9f4',
    '#00bcd4',
    '#009688',
    '#4caf50',
    '#8bc34a',
    '#cddc39',
    '#ffeb3b',
    '#ffc107',
    '#ff9800',
    '#ff5722',
    '#795548',
    '#9e9e9e',
    '#607d8b',
  ];

  // Generate a hash from the tag name to get consistent colors
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    const char = tagName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
};

/**
 * Format a date for display
 */
export const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minutes ago`;
    }
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Format a timestamp for display
 */
export const formatTimestamp = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Convert a model ID to a human-readable display name
 */
export const getModelDisplayName = (modelId: string): string => {
  if (!modelId || modelId === 'unknown' || modelId === 'other') {
    return 'Unknown';
  }

  const modelLower = modelId.toLowerCase();

  // Handle OpenRouter/AutoRouter
  if (modelLower.includes('autorouter') || modelLower.includes('openrouter')) {
    return 'AutoRouter';
  }

  // Handle OpenAI models
  if (modelLower.includes('gpt-4o')) {
    return 'GPT-4o';
  }
  if (modelLower.includes('gpt-4-turbo')) {
    return 'GPT-4 Turbo';
  }
  if (modelLower.includes('gpt-4')) {
    return 'GPT-4';
  }
  if (modelLower.includes('gpt-3.5')) {
    return 'GPT-3.5';
  }
  if (modelLower.includes('gpt-5')) {
    return 'GPT-5';
  }
  if (modelLower.includes('chatgpt')) {
    return 'ChatGPT';
  }

  // Handle Anthropic models
  // Check for 3.5 (dot) or 3-5 (hyphen) variants first - must come before claude-3-sonnet check
  if (
    modelLower.includes('claude-3.5-sonnet')
    || modelLower.includes('claude-3-5-sonnet')
  ) {
    return 'Claude 3.5 Sonnet';
  }
  if (modelLower.includes('claude-3-opus')) {
    return 'Claude 3 Opus';
  }
  if (modelLower.includes('claude-3-sonnet')) {
    return 'Claude 3 Sonnet';
  }
  if (modelLower.includes('claude-3-haiku')) {
    return 'Claude 3 Haiku';
  }
  if (modelLower.includes('claude')) {
    return 'Claude';
  }

  // Handle Google models
  if (modelLower.includes('gemini-flash')) {
    return 'Gemini Flash';
  }
  if (modelLower.includes('gemini-pro')) {
    return 'Gemini Pro';
  }
  if (modelLower.includes('gemini')) {
    return 'Gemini';
  }

  // Return capitalized version if no specific match
  return modelId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const PROVIDER_DISPLAY_OVERRIDES: Record<string, string> = {
  openai: 'OpenAI',
  mistralai: 'Mistral AI',
  mistral: 'Mistral',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
  microsoft: 'Microsoft',
  xai: 'xAI',
  perplexity: 'Perplexity',
  meta: 'Meta',
  'meta-llama': 'Meta Llama',
  amazon: 'Amazon',
  bedrock: 'Amazon Bedrock',
  alephalpha: 'Aleph Alpha',
  cohere: 'Cohere',
};

const formatActualModelSegment = (segment: string): string => {
  const tokens = segment.split(/[-_]/).filter(Boolean);
  if (tokens.length === 0) {
    return segment;
  }

  return tokens
    .map(token => {
      if (!token) {
        return token;
      }

      if (/^[a-z]+$/.test(token) && token.length <= 3) {
        return token.toUpperCase();
      }

      if (/^[a-z0-9]+$/i.test(token)) {
        if (token.length <= 3 || /^[0-9]/.test(token)) {
          return token.toUpperCase();
        }

        return token.charAt(0).toUpperCase() + token.slice(1);
      }

      return token;
    })
    .join(' ');
};

export interface ActualModelInfo {
  raw: string;
  providerRaw: string;
  modelRaw: string;
  providerDisplay: string;
  modelDisplay: string;
}

export const parseActualModelInfo = (
  actualModel?: string | null
): ActualModelInfo | null => {
  if (!actualModel || typeof actualModel !== 'string') {
    return null;
  }

  const trimmedValue = actualModel.trim();
  if (!trimmedValue) {
    return null;
  }

  const parts = trimmedValue
    .split('/')
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const [providerRaw, ...modelParts] = parts;
  const modelRaw = modelParts.join('/');

  if (!providerRaw || !modelRaw) {
    return null;
  }

  const providerDisplay =
    PROVIDER_DISPLAY_OVERRIDES[providerRaw.toLowerCase()]
    ?? formatActualModelSegment(providerRaw);

  const formattedModelDisplay = (() => {
    const display = getModelDisplayName(modelRaw);
    if (display && display !== 'Unknown') {
      return display;
    }
    return formatActualModelSegment(modelRaw);
  })();

  return {
    raw: trimmedValue,
    providerRaw,
    modelRaw,
    providerDisplay,
    modelDisplay: formattedModelDisplay,
  };
};

/**
 * Calculate primary models display string from message models
 * @param models Array of model IDs from messages
 * @returns Display string: single model, "Model1/Model2", or "Multiple Models"
 */
export const calculatePrimaryModelsDisplay = (models: string[]): string => {
  // Filter out invalid/unknown models
  const validModels = models.filter(
    m => m && m !== 'unknown' && m !== 'other' && m.trim() !== ''
  );

  if (validModels.length === 0) {
    return 'Unknown';
  }

  // Get unique models
  const uniqueModels = Array.from(new Set(validModels));

  if (uniqueModels.length === 1) {
    return getModelDisplayName(uniqueModels[0]);
  }

  if (uniqueModels.length === 2) {
    return `${getModelDisplayName(uniqueModels[0])}/${getModelDisplayName(uniqueModels[1])}`;
  }

  return 'Multiple Models';
};

/**
 * Calculate primary models display from interactions array (data packet format)
 */
export const calculatePrimaryModelsFromInteractions = (
  interactions: Array<{ actor?: string; model?: string }>
): string => {
  // Extract models from assistant/bot messages only
  const assistantModels = interactions
    .filter(interaction => {
      const actor = (interaction.actor || '').toLowerCase();
      return actor === 'assistant' || actor === 'bot';
    })
    .map(interaction => interaction.model || '')
    .filter(model => model && model !== 'unknown' && model !== 'other');

  return calculatePrimaryModelsDisplay(assistantModels);
};

/**
 * Calculate primary models display from Message array (frontend format)
 */
export const calculatePrimaryModelsFromMessages = (
  messages: Array<{ role: string; platform?: string }>
): string => {
  // Extract models from assistant messages only
  const assistantModels = messages
    .filter(message => message.role === 'assistant' || message.role === 'bot')
    .map(message => message.platform || '')
    .filter(
      platform => platform && platform !== 'unknown' && platform !== 'other'
    );

  return calculatePrimaryModelsDisplay(assistantModels);
};

/**
 * Extract unique models from messages/interactions
 * Returns array of unique model IDs (e.g., ["autorouter", "gpt-4o"])
 */
export const extractUniqueModels = (
  messagesOrInteractions: Array<{
    role?: string;
    actor?: string;
    platform?: string;
    model?: string;
  }>
): string[] => {
  const models: string[] = [];

  for (const item of messagesOrInteractions) {
    // Determine if this is an assistant/bot message
    const isAssistant =
      item.role === 'assistant'
      || item.role === 'bot'
      || (item.actor
        && (item.actor.toLowerCase() === 'assistant'
          || item.actor.toLowerCase() === 'bot'));

    if (!isAssistant) continue;

    // Get model from either 'platform' (Message format) or 'model' (interaction format)
    const model = item.platform || item.model || '';

    // Filter out invalid models
    if (
      model
      && model !== 'unknown'
      && model !== 'other'
      && model.trim() !== ''
    ) {
      models.push(model);
    }
  }

  // Return unique models only
  return [...new Set(models)];
};
