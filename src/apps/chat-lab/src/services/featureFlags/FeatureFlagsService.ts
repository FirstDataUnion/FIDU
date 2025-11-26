import {
  type FeatureFlagsMap,
  FeatureFlagValidationError,
  validateFeatureFlagsPayload,
} from '../../types/featureFlags';

const FEATURE_FLAGS_ENDPOINT = 'feature_flags.json';
export const FEATURE_FLAGS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const resolveBasePath = (): string => {
  return import.meta.env.BASE_URL || '/fidu-chat-lab/';
};

const buildRequestUrl = (): string => {
  const basePath = resolveBasePath();
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost';
  const url = new URL(`${basePath}${FEATURE_FLAGS_ENDPOINT}`, origin);
  return url.toString();
};

export const getFeatureFlags = async (): Promise<FeatureFlagsMap> => {
  const response = await fetch(buildRequestUrl());

  if (!response.ok) {
    throw new Error(`Failed to load feature flags (status ${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Received invalid JSON while loading feature flags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    return validateFeatureFlagsPayload(payload);
  } catch (error) {
    if (error instanceof FeatureFlagValidationError) {
      throw error;
    }
    throw new Error(`Failed to validate feature flags payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

