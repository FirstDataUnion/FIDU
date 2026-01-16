import { useAppSelector } from './redux';
import { selectIsFeatureFlagEnabled } from '../store/selectors/featureFlagsSelectors';
import type { FeatureFlagKey } from '../types/featureFlags';

export const useFeatureFlag = (key: FeatureFlagKey): boolean => {
  return useAppSelector(state => selectIsFeatureFlagEnabled(state, key));
};
