import reducer, {
  UserFeatureFlagsState,
  setUserOverride,
  clearAllUserOverrides,
  loadUserOverrides,
  clearUserFeatureFlagError,
} from '../userFeatureFlagsSlice';
import type { FeatureFlagKey } from '../../../types/featureFlags';
import type { RootState } from '../../index';
import { selectUserFeatureFlagsState } from '../../selectors/featureFlagsSelectors';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('userFeatureFlagsSlice', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return the initial state', () => {
    const state = reducer(undefined, { type: 'unknown' });
    expect(state).toEqual({
      userOverrides: {},
      loading: false,
      error: null,
    });
  });

  it('should load user overrides from localStorage on initialization', () => {
    localStorageMock.setItem(
      'fidu-chat-lab-feature-flag-overrides',
      JSON.stringify({ context: false })
    );
    const state = reducer(undefined, { type: 'unknown' });
    expect(state.userOverrides).toEqual({ context: false });
  });

  it('should handle setUserOverride to set an override', () => {
    const state = reducer(
      undefined,
      setUserOverride({ key: 'context' as FeatureFlagKey, value: false })
    );
    expect(state.userOverrides).toEqual({ context: false });
    expect(
      localStorageMock.getItem('fidu-chat-lab-feature-flag-overrides')
    ).toBe(JSON.stringify({ context: false }));
  });

  it('should handle setUserOverride to clear an override', () => {
    const initialState: UserFeatureFlagsState = {
      userOverrides: { context: false, documents: false },
      loading: false,
      error: null,
    };
    const state = reducer(
      initialState,
      setUserOverride({ key: 'context' as FeatureFlagKey, value: null })
    );
    expect(state.userOverrides).toEqual({ documents: false });
  });

  it('should handle clearAllUserOverrides', () => {
    const initialState: UserFeatureFlagsState = {
      userOverrides: { context: false, documents: false },
      loading: false,
      error: null,
    };
    const state = reducer(initialState, clearAllUserOverrides());
    expect(state.userOverrides).toEqual({});
    expect(
      localStorageMock.getItem('fidu-chat-lab-feature-flag-overrides')
    ).toBe(JSON.stringify({}));
  });

  it('should handle loadUserOverrides', () => {
    const overrides = { context: false, documents: false };
    const state = reducer(undefined, loadUserOverrides(overrides));
    expect(state.userOverrides).toEqual(overrides);
    expect(
      localStorageMock.getItem('fidu-chat-lab-feature-flag-overrides')
    ).toBe(JSON.stringify(overrides));
  });

  it('should handle clearUserFeatureFlagError', () => {
    const initialState: UserFeatureFlagsState = {
      userOverrides: {},
      loading: false,
      error: 'Some error',
    };
    const state = reducer(initialState, clearUserFeatureFlagError());
    expect(state.error).toBeNull();
  });

  it('selectUserFeatureFlagsState exposes raw slice state', () => {
    const state: RootState = {
      userFeatureFlags: {
        userOverrides: { context: false },
        loading: true,
        error: null,
      },
      systemFeatureFlags: {
        flags: null,
        loading: false,
        error: null,
        lastFetchedAt: null,
      },
    } as RootState;
    expect(selectUserFeatureFlagsState(state).loading).toBe(true);
    expect(selectUserFeatureFlagsState(state).userOverrides).toEqual({
      context: false,
    });
  });
});
