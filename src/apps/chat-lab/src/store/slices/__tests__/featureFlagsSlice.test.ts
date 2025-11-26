import reducer, {
  FeatureFlagsState,
  fetchFeatureFlags,
} from '../featureFlagsSlice';
import type { FeatureFlagsMap, FeatureFlagKey } from '../../../types/featureFlags';
import type { RootState } from '../../index';
import {
  selectFeatureFlagsState,
  selectIsFeatureFlagEnabled,
} from '../../selectors/featureFlagsSelectors';
import featureFlagsFixture from '../../../../public/feature_flags.json';

const baseFlags = featureFlagsFixture as FeatureFlagsMap;

const cloneFlags = (): FeatureFlagsMap =>
  JSON.parse(JSON.stringify(baseFlags));

const buildState = (
  overrides: Partial<FeatureFlagsState> = {}
): RootState =>
  ({
    featureFlags: {
      flags: null,
      loading: false,
      error: null,
      lastFetchedAt: null,
      ...overrides,
    },
  } as RootState);

describe('featureFlagsSlice', () => {
  const nowSpy = jest.spyOn(Date, 'now');

  beforeEach(() => {
    nowSpy.mockReturnValue(1700000000000);
  });

  afterAll(() => {
    nowSpy.mockRestore();
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      flags: null,
      loading: false,
      error: null,
      lastFetchedAt: null,
    });
  });

  it('should handle fetchFeatureFlags.pending', () => {
    const state = reducer(undefined, fetchFeatureFlags.pending('', undefined));
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should handle fetchFeatureFlags.fulfilled', () => {
    const payload = cloneFlags();
    const state = reducer(
      undefined,
      fetchFeatureFlags.fulfilled(payload, '', undefined)
    );

    expect(state.loading).toBe(false);
    expect(state.flags).toEqual(payload);
    expect(state.lastFetchedAt).toBe(1700000000000);
  });

  it('should handle fetchFeatureFlags.rejected', () => {
    const state = reducer(
      undefined,
      fetchFeatureFlags.rejected(null, '', undefined, 'network error')
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe('network error');
  });
});

describe('feature flag selectors', () => {
  const expectFlag = (
    flags: FeatureFlagsMap | null,
    key: FeatureFlagKey
  ): boolean => selectIsFeatureFlagEnabled(buildState({ flags }), key);

  it('returns false when flags are not loaded', () => {
    expect(expectFlag(null, 'context')).toBe(false);
  });

  it('returns true when flag and dependencies are enabled', () => {
    const flags = cloneFlags();
    expect(expectFlag(flags, 'background_agent_to_document')).toBe(true);
  });

  it('returns false when a dependency is disabled', () => {
    const flags = cloneFlags();
    flags.background_agents.enabled = false;

    expect(expectFlag(flags, 'background_agent_to_document')).toBe(false);
  });

  it('handles circular dependencies by disabling the flag', () => {
    const flags = cloneFlags();
    flags.context.depends_on = ['documents'];
    flags.documents.depends_on = ['context'];

    expect(expectFlag(flags, 'context')).toBe(false);
    expect(expectFlag(flags, 'documents')).toBe(false);
  });

  it('selectFeatureFlagsState exposes raw slice state', () => {
    const state = buildState({ loading: true });
    expect(selectFeatureFlagsState(state).loading).toBe(true);
  });
});

