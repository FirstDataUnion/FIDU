/**
 * OpenRouter request parameters - user-configurable settings for chat completions.
 * Persisted to localStorage and used when direct OpenRouter mode is enabled.
 * See OpenRouter API docs: https://openrouter.ai/docs/api-reference
 */

const STORAGE_KEY = 'chatlab_openrouter_params';

export interface OpenRouterParams {
  temperature: number; // 0–2, default 0.7 (lower = more deterministic)
  top_p: number; // 0–1, default 1 (nucleus sampling)
  top_k: number; // 0–100, default 0 (0 = disabled)
  frequency_penalty: number; // -2 to 2, default 0
  presence_penalty: number; // -2 to 2, default 0
  repetition_penalty: number; // 0–2, default 1
  max_tokens: number; // 1–128000, default 4096
  min_tokens: number; // 0–4096, default 0
  seed: number | null; // optional, for reproducibility
}

export const DEFAULT_OPENROUTER_PARAMS: OpenRouterParams = {
  temperature: 0.7,
  top_p: 1,
  top_k: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  max_tokens: 4096,
  min_tokens: 0,
  seed: null,
};

export const OPENROUTER_PARAM_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  top_p: { min: 0, max: 1, step: 0.05 },
  top_k: { min: 0, max: 100, step: 1 },
  frequency_penalty: { min: -2, max: 2, step: 0.1 },
  presence_penalty: { min: -2, max: 2, step: 0.1 },
  repetition_penalty: { min: 0, max: 2, step: 0.1 },
  max_tokens: { min: 1, max: 128000 },
  min_tokens: { min: 0, max: 4096 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Parse a number, treating NaN/Infinity as missing so callers can apply defaults. */
function finiteNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse and validate persisted or merged params (exported for tests). */
export function parseParams(raw: unknown): OpenRouterParams {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_OPENROUTER_PARAMS };
  }

  const obj = raw as Record<string, unknown>;
  const limits = OPENROUTER_PARAM_LIMITS;
  const d = DEFAULT_OPENROUTER_PARAMS;

  return {
    temperature: clamp(
      finiteNumber(obj.temperature) ?? d.temperature,
      limits.temperature.min,
      limits.temperature.max
    ),
    top_p: clamp(
      finiteNumber(obj.top_p) ?? d.top_p,
      limits.top_p.min,
      limits.top_p.max
    ),
    top_k: clamp(
      finiteNumber(obj.top_k) ?? d.top_k,
      limits.top_k.min,
      limits.top_k.max
    ),
    frequency_penalty: clamp(
      finiteNumber(obj.frequency_penalty) ?? d.frequency_penalty,
      limits.frequency_penalty.min,
      limits.frequency_penalty.max
    ),
    presence_penalty: clamp(
      finiteNumber(obj.presence_penalty) ?? d.presence_penalty,
      limits.presence_penalty.min,
      limits.presence_penalty.max
    ),
    repetition_penalty: clamp(
      finiteNumber(obj.repetition_penalty) ?? d.repetition_penalty,
      limits.repetition_penalty.min,
      limits.repetition_penalty.max
    ),
    max_tokens: clamp(
      finiteNumber(obj.max_tokens) ?? d.max_tokens,
      limits.max_tokens.min,
      limits.max_tokens.max
    ),
    min_tokens: clamp(
      finiteNumber(obj.min_tokens) ?? d.min_tokens,
      limits.min_tokens.min,
      limits.min_tokens.max
    ),
    seed:
      obj.seed === null || obj.seed === undefined
        ? null
        : (() => {
            const n = Math.floor(Number(obj.seed));
            return Number.isFinite(n) ? n : null;
          })(),
  };
}

export function getOpenRouterParams(): OpenRouterParams {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_OPENROUTER_PARAMS };
    const parsed = JSON.parse(stored) as unknown;
    return parseParams(parsed);
  } catch {
    return { ...DEFAULT_OPENROUTER_PARAMS };
  }
}

export function setOpenRouterParams(params: Partial<OpenRouterParams>): void {
  try {
    const current = getOpenRouterParams();
    const merged = { ...current, ...params };
    const validated = parseParams(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch (error) {
    console.warn('[OpenRouterParams] Failed to save params:', error);
  }
}

export function resetOpenRouterParams(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
