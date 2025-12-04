import type { RootState } from '../../index';
import type { FeatureFlagsMap, FeatureFlagKey } from '../../../types/featureFlags';
import {
  resolveFlagEnabled,
  combineSystemFlagsWithOverrides,
  selectIsFeatureFlagEnabled,
  selectSystemFeatureFlags,
  selectUserFeatureFlagOverrides,
  selectFeatureFlags,
} from '../featureFlagsSelectors';
import featureFlagsFixture from '../../../../public/feature_flags.json';

const baseFlags = featureFlagsFixture as FeatureFlagsMap;

const cloneFlags = (): FeatureFlagsMap =>
  JSON.parse(JSON.stringify(baseFlags));

const buildState = (
  systemFlags: FeatureFlagsMap | null = null,
  userOverrides: Record<string, boolean> = {}
): RootState =>
  ({
    systemFeatureFlags: {
      flags: systemFlags,
      loading: false,
      error: null,
      lastFetchedAt: null,
    },
    userFeatureFlags: {
      userOverrides,
      loading: false,
      error: null,
    },
  } as RootState);

describe('resolveFlagEnabled', () => {
  it('returns false when flag is not enabled', () => {
    const flags = cloneFlags();
    flags.context.enabled = false;
    expect(resolveFlagEnabled(flags, 'context')).toBe(false);
  });

  it('returns true when flag is enabled and has no dependencies', () => {
    const flags = cloneFlags();
    flags.context.enabled = true;
    flags.context.depends_on = undefined;
    expect(resolveFlagEnabled(flags, 'context')).toBe(true);
  });

  it('returns true when flag and all dependencies are enabled', () => {
    const flags = cloneFlags();
    expect(resolveFlagEnabled(flags, 'background_agent_to_document')).toBe(true);
  });

  it('returns false when a dependency is disabled', () => {
    const flags = cloneFlags();
    flags.background_agents.enabled = false;
    expect(resolveFlagEnabled(flags, 'background_agent_to_document')).toBe(false);
  });

  it('handles circular dependencies by disabling the flag', () => {
    const flags = cloneFlags();
    flags.context.depends_on = ['documents'];
    flags.documents.depends_on = ['context'];
    expect(resolveFlagEnabled(flags, 'context')).toBe(false);
    expect(resolveFlagEnabled(flags, 'documents')).toBe(false);
  });
});

describe('combineSystemFlagsWithOverrides', () => {
  it('returns null when system flags are null', () => {
    expect(combineSystemFlagsWithOverrides(null, {})).toBeNull();
  });

  it('returns system flags when no overrides', () => {
    const systemFlags = cloneFlags();
    const combined = combineSystemFlagsWithOverrides(systemFlags, {});
    expect(combined).toEqual(systemFlags);
  });

  it('disables flags that are overridden to false', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    const combined = combineSystemFlagsWithOverrides(systemFlags, { context: false });
    expect(combined?.context.enabled).toBe(false);
    expect(combined?.context.depends_on).toEqual(systemFlags.context.depends_on);
  });

  it('preserves enabled flags when override is true (but should not happen)', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    const combined = combineSystemFlagsWithOverrides(systemFlags, { context: true });
    // Override to true doesn't enable disabled flags, but if already enabled, stays enabled
    expect(combined?.context.enabled).toBe(true);
  });

  it('preserves depends_on relationships', () => {
    const systemFlags = cloneFlags();
    const combined = combineSystemFlagsWithOverrides(systemFlags, {
      background_agent_to_document: false,
    });
    expect(combined?.background_agent_to_document.depends_on).toEqual(
      systemFlags.background_agent_to_document.depends_on
    );
  });

  it('handles multiple overrides', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    systemFlags.documents.enabled = true;
    const combined = combineSystemFlagsWithOverrides(systemFlags, {
      context: false,
      documents: false,
    });
    expect(combined?.context.enabled).toBe(false);
    expect(combined?.documents.enabled).toBe(false);
  });
});

describe('selectIsFeatureFlagEnabled', () => {
  it('returns false when system flags are not loaded', () => {
    const state = buildState(null, {});
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(false);
  });

  it('returns system flag value when no override', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    const state = buildState(systemFlags, {});
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(true);
  });

  it('returns false when user override disables flag', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    const state = buildState(systemFlags, { context: false });
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(false);
  });

  it('respects dependencies with overrides', () => {
    const systemFlags = cloneFlags();
    systemFlags.background_agents.enabled = true;
    systemFlags.documents.enabled = true;
    systemFlags.background_agent_to_document.enabled = true;
    // Override a dependency to false
    const state = buildState(systemFlags, { background_agents: false });
    // The dependent flag should be disabled
    expect(selectIsFeatureFlagEnabled(state, 'background_agent_to_document')).toBe(false);
  });

  it('handles circular dependencies with overrides', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    systemFlags.documents.enabled = true;
    systemFlags.context.depends_on = ['documents'];
    systemFlags.documents.depends_on = ['context'];
    const state = buildState(systemFlags, {});
    // Circular dependencies should disable both
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(false);
    expect(selectIsFeatureFlagEnabled(state, 'documents')).toBe(false);
  });
});

describe('selectSystemFeatureFlags', () => {
  it('returns system flags from state', () => {
    const systemFlags = cloneFlags();
    const state = buildState(systemFlags, {});
    expect(selectSystemFeatureFlags(state)).toEqual(systemFlags);
  });
});

describe('selectUserFeatureFlagOverrides', () => {
  it('returns user overrides from state', () => {
    const overrides = { context: false, documents: false };
    const state = buildState(null, overrides);
    expect(selectUserFeatureFlagOverrides(state)).toEqual(overrides);
  });
});

describe('selectFeatureFlags', () => {
  it('returns null when system flags are null', () => {
    const state = buildState(null, {});
    expect(selectFeatureFlags(state)).toBeNull();
  });

  it('returns combined flags', () => {
    const systemFlags = cloneFlags();
    systemFlags.context.enabled = true;
    const state = buildState(systemFlags, { context: false });
    const flags = selectFeatureFlags(state);
    expect(flags?.context.enabled).toBe(false);
  });
});

