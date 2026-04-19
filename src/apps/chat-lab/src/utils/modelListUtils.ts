import type { ModelConfig } from '../data/models';

/** Title-case words for provider labels shown in lists and accordions. */
export function formatProviderDisplayName(
  provider: string | undefined
): string {
  const t = provider?.trim();
  if (!t) return 'Other';
  return t
    .split(/\s+/)
    .map(w => {
      if (!w) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export type ProviderModelGroup = {
  key: string;
  displayLabel: string;
  models: ModelConfig[];
};

export function groupModelsByProvider(
  models: ModelConfig[]
): ProviderModelGroup[] {
  const map = new Map<string, ModelConfig[]>();
  for (const m of models) {
    const key = m.provider?.trim() || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()]
    .map(([key, groupModels]) => ({
      key,
      displayLabel: formatProviderDisplayName(key),
      models: groupModels,
    }))
    .sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      })
    );
}

export function getProviderColor(provider: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return 'primary' as const;
    case 'anthropic':
      return 'secondary' as const;
    case 'google':
      return 'success' as const;
    case 'meta':
      return 'info' as const;
    case 'mistral':
      return 'warning' as const;
    case 'microsoft':
      return 'error' as const;
    case 'xai':
      return 'default' as const;
    case 'nlp workbench':
      return 'primary' as const;
    default:
      return 'default' as const;
  }
}

export function modelMatchesSearchQuery(
  model: ModelConfig,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    model.name.toLowerCase().includes(q)
    || model.provider.toLowerCase().includes(q)
    || model.description.toLowerCase().includes(q)
    || model.capabilities.some(cap => cap.toLowerCase().includes(q))
    || model.category.toLowerCase().includes(q)
  );
}
