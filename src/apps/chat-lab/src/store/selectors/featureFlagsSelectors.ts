import type { RootState } from '../index';
import type {
  FeatureFlagKey,
  FeatureFlagsMap,
} from '../../types/featureFlags';

const resolveFlagEnabled = (
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

export const selectFeatureFlagsState = (state: RootState) => state.featureFlags;

export const selectFeatureFlags = (state: RootState) =>
  state.featureFlags.flags;

export const selectIsFeatureFlagEnabled = (
  state: RootState,
  key: FeatureFlagKey
): boolean => {
  const flags = state.featureFlags.flags;
  if (!flags) {
    return false;
  }

  return resolveFlagEnabled(flags, key);
};

