import featureFlagsReference from '../../public/feature_flags.json';

export type FeatureFlagKey = keyof typeof featureFlagsReference;

export interface FeatureFlagDefinition {
  enabled: boolean;
  depends_on?: FeatureFlagKey[];
}

export type FeatureFlagsMap = {
  [K in FeatureFlagKey]: FeatureFlagDefinition;
};

const featureFlagKeySet = new Set(
  Object.keys(featureFlagsReference) as FeatureFlagKey[]
);

export const KNOWN_FEATURE_FLAG_KEYS = Array.from(featureFlagKeySet) as FeatureFlagKey[];

export const isFeatureFlagKey = (value: unknown): value is FeatureFlagKey => {
  return typeof value === 'string' && featureFlagKeySet.has(value as FeatureFlagKey);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export class FeatureFlagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureFlagValidationError';
  }
}

export const validateFeatureFlagsPayload = (
  payload: unknown
): FeatureFlagsMap => {
  if (!isPlainObject(payload)) {
    // TODO should this be a warning and return an all-flags-disabled map?
    throw new FeatureFlagValidationError('Feature flags payload must be an object.');
  }

  const parsedFlags: Partial<Record<FeatureFlagKey, FeatureFlagDefinition>> = {};
  const validationErrors: [string, string, string?][] = [];

  for (const [rawKey, rawValue] of Object.entries(payload)) {
    if (!isFeatureFlagKey(rawKey)) {
      validationErrors.push(['Unknown feature flag key', rawKey]);
      continue;
    }

    if (!isPlainObject(rawValue)) {
      validationErrors.push(['Invalid feature flag definition', rawKey]);
      continue;
    }

    const enabled = rawValue.enabled;
    if (typeof enabled !== 'boolean') {
      validationErrors.push(['Invalid enabled flag', rawKey]);
      continue;
    }

    let dependsOn: FeatureFlagKey[] | undefined;
    if ('depends_on' in rawValue && rawValue.depends_on !== undefined) {
      if (!Array.isArray(rawValue.depends_on)) {
        validationErrors.push(['Invalid depends_on array', rawKey]);
        continue;
      }

      const deduped = new Set<FeatureFlagKey>();
      let validDeps = true;
      for (const dependency of rawValue.depends_on) {
        if (!isFeatureFlagKey(dependency)) {
          validationErrors.push(['Invalid dependency', rawKey, dependency]);
          validDeps = false;
          break;
        }
        if (dependency === rawKey) {
          validationErrors.push(['Self-dependency', rawKey, dependency]);
          validDeps = false;
          break;
        }
        deduped.add(dependency);
      }

      if (!validDeps) {
        // Ignore, fallback to default below.
        continue;
      }

      dependsOn = Array.from(deduped);
    }

    parsedFlags[rawKey] = dependsOn ? { enabled, depends_on: dependsOn } : { enabled };
  }

  // Ensure all known keys present, default to { enabled: false }
  for (const key of KNOWN_FEATURE_FLAG_KEYS) {
    if (!parsedFlags[key]) {
      parsedFlags[key] = { enabled: false };
    }
  }

  if (validationErrors.length > 0) {
    console.warn(
      "🏳️ [FeatureFlags] Ignored unknown feature flag keys in payload:", validationErrors
    );
  }

  return parsedFlags as FeatureFlagsMap;
};

