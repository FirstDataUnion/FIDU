import type { RootState } from '../index';
import type {
  FeatureFlagKey,
  FeatureFlagsMap,
  UserFeatureFlagOverrides,
} from '../../types/featureFlags';

export const resolveFlagEnabled = (
  flags: FeatureFlagsMap,
  key: FeatureFlagKey,
  visited: Set<FeatureFlagKey> = new Set(),
): boolean => {
  if (visited.has(key)) {
    return false; // Prevent circular dependency loops
  }

  const flag = flags[key];
  if (!flag || !flag.enabled) {
    return false;
  }

  if (!flag.depends_on || flag.depends_on.length === 0) {
    return true;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(key);

  return flag.depends_on.every((dependency) =>
    resolveFlagEnabled(flags, dependency, nextVisited)
  );
};

export const combineSystemFlagsWithOverrides = (
  systemFlags: FeatureFlagsMap | null,
  userOverrides: UserFeatureFlagOverrides
): FeatureFlagsMap | null => {
  if (!systemFlags) {
    return null;
  }

  // Create a deep copy of system flags
  const combined: FeatureFlagsMap = {} as FeatureFlagsMap;

  for (const key in systemFlags) {
    const typedKey = key as FeatureFlagKey;
    const systemFlag = systemFlags[typedKey];
    const userOverride = userOverrides[typedKey];

    let enabled = systemFlag.enabled;
    if (systemFlag.enabled && systemFlag.user_configurable) {
      enabled = userOverride ?? systemFlag.default_enabled ?? false;
    }
    combined[typedKey] = {
      enabled,
      depends_on: systemFlag.depends_on ? [...systemFlag.depends_on] : undefined,
    };
  }

  return combined;
};

export const selectUserFeatureFlagsState = (state: RootState) => state.userFeatureFlags;

export const selectSystemFeatureFlags = (state: RootState) =>
  state.systemFeatureFlags.flags;

export const selectUserFeatureFlagOverrides = (state: RootState) =>
  state.userFeatureFlags.userOverrides;

export const selectFeatureFlags = (state: RootState): FeatureFlagsMap | null => {
  const systemFlags = state.systemFeatureFlags.flags;
  const userOverrides = state.userFeatureFlags.userOverrides;
  return combineSystemFlagsWithOverrides(systemFlags, userOverrides);
};

export const selectIsFeatureFlagEnabled = (
  state: RootState,
  key: FeatureFlagKey
): boolean => {
  const flags = selectFeatureFlags(state);
  if (!flags) {
    return false;
  }

  return resolveFlagEnabled(flags, key);
};

