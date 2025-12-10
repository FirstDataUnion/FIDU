import reducer, {
  SystemFeatureFlagsState,
  fetchSystemFeatureFlags,
  hydrateSystemFeatureFlags,
  clearSystemFeatureFlagError,
} from '../systemFeatureFlagsSlice';
import type { FeatureFlagsMap } from '../../../types/featureFlags';
import featureFlagsFixture from '../../../../public/feature_flags.json';

const baseFlags = featureFlagsFixture as FeatureFlagsMap;

const cloneFlags = (): FeatureFlagsMap =>
  JSON.parse(JSON.stringify(baseFlags));

describe('systemFeatureFlagsSlice', () => {
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

  it('should handle fetchSystemFeatureFlags.pending', () => {
    const state = reducer(undefined, fetchSystemFeatureFlags.pending('', undefined));
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should handle fetchSystemFeatureFlags.fulfilled', () => {
    const payload = cloneFlags();
    const state = reducer(
      undefined,
      fetchSystemFeatureFlags.fulfilled(payload, '', undefined)
    );

    expect(state.loading).toBe(false);
    expect(state.flags).toEqual(payload);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBe(1700000000000);
  });

  it('should handle fetchSystemFeatureFlags.rejected', () => {
    const state = reducer(
      undefined,
      fetchSystemFeatureFlags.rejected(null, '', undefined, 'network error')
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe('network error');
  });

  it('should handle hydrateSystemFeatureFlags', () => {
    const payload = cloneFlags();
    const state = reducer(undefined, hydrateSystemFeatureFlags(payload));

    expect(state.loading).toBe(false);
    expect(state.flags).toEqual(payload);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBe(1700000000000);
  });

  it('should handle clearSystemFeatureFlagError', () => {
    const initialState: SystemFeatureFlagsState = {
      flags: null,
      loading: false,
      error: 'Some error',
      lastFetchedAt: null,
    };
    const state = reducer(initialState, clearSystemFeatureFlagError());
    expect(state.error).toBeNull();
  });
});

