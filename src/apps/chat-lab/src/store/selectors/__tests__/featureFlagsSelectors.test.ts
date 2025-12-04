import type { RootState } from '../../index';
import type { FeatureFlagDefinition, FeatureFlagKey, FeatureFlagsMap } from '../../../types/featureFlags';
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

const allTrueFlags = (): FeatureFlagsMap =>
  Object.fromEntries(
    Object.keys(baseFlags).map((flag) => ([flag, {
      "enabled": true,
      "user_configurable": true,
      "default_enabled": true
    } satisfies FeatureFlagDefinition]))
  ) as FeatureFlagsMap;

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
    const flags = allTrueFlags();
    flags.context.enabled = false;
    expect(resolveFlagEnabled(flags, 'context')).toBe(false);
  });

  it('returns true when flag is enabled and has no dependencies', () => {
    const flags = allTrueFlags();
    expect(resolveFlagEnabled(flags, 'context')).toBe(true);
  });

  it('returns true when flag and all dependencies are enabled', () => {
    const flags = allTrueFlags();
    flags.background_agent_to_document.depends_on = ['background_agents', 'documents'];
    expect(resolveFlagEnabled(flags, 'background_agent_to_document')).toBe(true);
  });

  it('returns false when a dependency is disabled', () => {
    const flags = allTrueFlags();
    flags.background_agent_to_document.depends_on = ['background_agents', 'documents'];
    flags.background_agents.enabled = false;
    expect(resolveFlagEnabled(flags, 'background_agent_to_document')).toBe(false);
  });

  it('handles circular dependencies by disabling the flag', () => {
    const flags = allTrueFlags();
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

  it('disables flags that are overridden to false', () => {
    const systemFlags = allTrueFlags();
    const combined = combineSystemFlagsWithOverrides(systemFlags, { context: false });
    expect(combined?.context.enabled).toBe(false);
  });

  it('enables flags that are overridden to true', () => {
    const systemFlags = allTrueFlags();
    systemFlags.context.default_enabled = false;
    const combined = combineSystemFlagsWithOverrides(systemFlags, { context: true });
    expect(combined?.context.enabled).toBe(true);
  });

  it('does not enable a flag that is globally disabled, even if overridden to true', () => {
    const systemFlags = allTrueFlags();
    systemFlags.context.enabled = false;
    // user tries to force-enable a globally disabled flag
    const combined = combineSystemFlagsWithOverrides(systemFlags, { context: true });
    expect(combined?.context.enabled).toBe(false);
  });

  it('does not enable a flag that is not user_configurable, even if overridden', () => {
    const systemFlags = allTrueFlags();
    systemFlags.context.user_configurable = false;
    // user tries to override a non-configurable flag
    const combinedFalse = combineSystemFlagsWithOverrides(systemFlags, { context: false });
    expect(combinedFalse?.context.enabled).toBe(true);

    const combinedTrue = combineSystemFlagsWithOverrides(systemFlags, { context: true });
    expect(combinedTrue?.context.enabled).toBe(true);
  });

  it('ignores user override for a non-existent flag', () => {
    const systemFlags = allTrueFlags();
    // Try to override a flag that doesn't exist in systemFlags
    // Should not throw, and combined flags should be unaffected
    expect(() => {
      const not_a_flag = 'not_a_flag' as FeatureFlagKey;
      const combined = combineSystemFlagsWithOverrides(systemFlags, { [not_a_flag]: true });
      expect(combined).toBeDefined();
      expect(combined?.[not_a_flag]).toBeUndefined();
    }).not.toThrow();
  });

  it('preserves depends_on relationships', () => {
    const systemFlags = allTrueFlags();
    systemFlags.background_agent_to_document.depends_on = ['background_agents', 'documents'];
    const combined = combineSystemFlagsWithOverrides(systemFlags, {
      background_agent_to_document: false,
    });
    expect(combined?.background_agent_to_document.depends_on).toEqual(
      systemFlags.background_agent_to_document.depends_on
    );
  });

  it('handles multiple overrides', () => {
    const systemFlags = allTrueFlags();
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
    const systemFlags = allTrueFlags();
    const state = buildState(systemFlags, {});
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(true);
  });

  it('returns false when user override disables flag', () => {
    const systemFlags = allTrueFlags();
    const state = buildState(systemFlags, { context: false });
    expect(selectIsFeatureFlagEnabled(state, 'context')).toBe(false);
  });

  it('respects dependencies with overrides', () => {
    const systemFlags = allTrueFlags();
    systemFlags.background_agent_to_document.depends_on = ['background_agents', 'documents'];
    const state = buildState(systemFlags, { background_agents: false });
    expect(selectIsFeatureFlagEnabled(state, 'background_agent_to_document')).toBe(false);
  });

  it('handles circular dependencies', () => {
    const systemFlags = allTrueFlags();
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
    const systemFlags = allTrueFlags();
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
    const systemFlags = allTrueFlags();
    const state = buildState(systemFlags, { context: false });
    const flags = selectFeatureFlags(state);
    expect(flags?.context.enabled).toBe(false);
  });
});
