import featureFlagsFixture from '../../../public/feature_flags.json';
import {
  KNOWN_FEATURE_FLAG_KEYS,
  validateFeatureFlagsPayload,
} from '../featureFlags';

const clonePayload = () => JSON.parse(JSON.stringify(featureFlagsFixture));

describe('validateFeatureFlagsPayload', () => {
  it('accepts the checked-in feature flags payload', () => {
    expect(validateFeatureFlagsPayload(clonePayload())).toEqual(
      featureFlagsFixture
    );
  });

  it('defaults missing known flags to { enabled: false }', () => {
    const payload = clonePayload();
    const missingKey = KNOWN_FEATURE_FLAG_KEYS[0];
    delete payload[missingKey];

    const validated = validateFeatureFlagsPayload(payload);
    expect(validated[missingKey]).toEqual({ enabled: false });
  });

  it('ignores unknown flags in the payload', () => {
    const payload = clonePayload();
    payload.unknown_flag = { enabled: true };

    const validated = validateFeatureFlagsPayload(payload);
    expect('unknown_flag' in validated).toBe(false);
    // All known flags should still be present in the result
    for (const key of KNOWN_FEATURE_FLAG_KEYS) {
      expect(validated).toHaveProperty(key);
    }
  });

  it('unknown dependencies in depends_on cause the flag to be disabled', () => {
    const payload = clonePayload();
    payload.context.depends_on = ['non-existent'];
    const validated = validateFeatureFlagsPayload(payload);
    expect(validated.context.enabled).toBe(false);
  });
});
