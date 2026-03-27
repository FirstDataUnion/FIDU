import {
  parseParams,
  DEFAULT_OPENROUTER_PARAMS,
  OPENROUTER_PARAM_LIMITS,
} from '../openRouterParams';

describe('parseParams (OpenRouter persisted settings)', () => {
  it('returns defaults for non-object input', () => {
    expect(parseParams(null)).toEqual(DEFAULT_OPENROUTER_PARAMS);
    expect(parseParams(undefined)).toEqual(DEFAULT_OPENROUTER_PARAMS);
    expect(parseParams('x')).toEqual(DEFAULT_OPENROUTER_PARAMS);
  });

  it('preserves temperature 0 (valid OpenRouter value)', () => {
    const out = parseParams({ temperature: 0 });
    expect(out.temperature).toBe(0);
  });

  it('preserves seed 0', () => {
    const out = parseParams({ seed: 0 });
    expect(out.seed).toBe(0);
  });

  it('clamps out-of-range values', () => {
    const out = parseParams({
      temperature: 99,
      top_p: -1,
      max_tokens: 999999999,
    });
    expect(out.temperature).toBe(OPENROUTER_PARAM_LIMITS.temperature.max);
    expect(out.top_p).toBe(OPENROUTER_PARAM_LIMITS.top_p.min);
    expect(out.max_tokens).toBe(OPENROUTER_PARAM_LIMITS.max_tokens.max);
  });

  it('uses defaults when numeric fields are NaN or missing', () => {
    const out = parseParams({
      temperature: 'not-a-number',
      top_p: Number.NaN,
    });
    expect(out.temperature).toBe(DEFAULT_OPENROUTER_PARAMS.temperature);
    expect(out.top_p).toBe(DEFAULT_OPENROUTER_PARAMS.top_p);
  });

  it('sets seed to null when unset', () => {
    expect(parseParams({ seed: null }).seed).toBeNull();
    expect(parseParams({}).seed).toBeNull();
  });
});
