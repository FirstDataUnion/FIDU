/**
 * Mock for FeatureFlagsService
 * Used in Jest tests to avoid import.meta issues
 */

import { FeatureFlagsMap, KNOWN_FEATURE_FLAG_KEYS} from "../../../types/featureFlags";

export const FEATURE_FLAGS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export const getFeatureFlags = async (): Promise<FeatureFlagsMap> => {
  return Object.fromEntries(KNOWN_FEATURE_FLAG_KEYS.map(f => [f, { enabled: true }])) as FeatureFlagsMap;
};
