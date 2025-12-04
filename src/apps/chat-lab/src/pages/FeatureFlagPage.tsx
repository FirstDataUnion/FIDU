import {
    Circle as DefaultIcon,
    CheckCircle as EnabledIcon,
    Cancel as DisabledIcon,
} from '@mui/icons-material';
import { Box, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useAppSelector } from '../store';
import { selectSystemFeatureFlags, selectUserFeatureFlagOverrides } from '../store/selectors/featureFlagsSelectors';
import { setUserOverride } from '../store/slices/userFeatureFlagsSlice';
import type { FeatureFlagDefinition, FeatureFlagKey } from '../types/featureFlags';
import { useAppDispatch } from '../hooks/redux';

export default function FeatureFlagPage(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const systemFlags = useAppSelector((state) => selectSystemFeatureFlags(state));
  const userFlags = useAppSelector((state) => selectUserFeatureFlagOverrides(state));
  const configurableFlags = useMemo(() => {
    if (systemFlags === null) {
      return {};
    }
    return Object.fromEntries(
        Object.entries(systemFlags)
        .filter(([_, value]) => value.enabled && value.user_configurable)
    ) as Partial<Record<FeatureFlagKey, FeatureFlagDefinition>>;
  }, [systemFlags]);

  const names = {
    "context": "Context",
    "system_prompts": "System Prompts",
    "documents": "Documents",
    "background_agents": "Background Agents",
    "model_selection": "Model Selection",
    "prompt_wizard": "Prompt Wizard",
    "system_prompt_librarian": "System Prompt Librarian",
    "view_copy_full_prompt": "View Copy Full Prompt",
  };

  console.log(userFlags);
  console.log(configurableFlags);

  function handleToggleButtonChange(key: FeatureFlagKey, value: string) {
    if (value === null) {
        console.log(`Ignored: ${key} set to null`);
        return;
    }
    const dispatch_value = value === "null" ? null : value === "true" ? true : false;
    dispatch(setUserOverride({ key, value: dispatch_value }));
    console.log(`Set: ${key} to ${dispatch_value} (raw value: ${value} of type ${typeof value})`);
  }

  // TODO: This does not handle dependencies. If a user turns off a feature that is depended on by another feature, the other feature should be turned off and disabled.

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 5 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
            Optional features:
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Enable or disable optional features to customize your experience.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' }}}>
            Optional features are not required for the core functionality of the app, but can be enabled to help you make the most of FIDU Chat Lab.
            The "default" value is what we recommend for new users. Leaving your choice in the middle state will track our recommended default value.
            Set the toggle to:
        </Typography>
        <ul style={{ listStyleType: 'none', paddingLeft: '10px', marginTop: '0' }}>
            <li><DisabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /> to disable the feature</li>
            <li><DefaultIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /> to use the default value</li>
            <li><EnabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /> to enable the feature</li>
        </ul>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {configurableFlags && Object.entries(configurableFlags).filter(([key, _]) => key in names).map(([mapKey, mapValue]) => {
                const key = mapKey as keyof typeof configurableFlags;
                const value = mapValue as FeatureFlagDefinition;
                console.log(key, value);
                console.log(`${userFlags[key] ?? "null"}`);
                return (
                    <Box key={key}>
                        <Typography variant="h5">{names[key as keyof typeof names]}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Default:</Typography>
                            {
                                value.default_enabled
                                ? <EnabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
                                : <DisabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
                            }
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Your choice:</Typography>
                            <ToggleButtonGroup
                                exclusive
                                value={`${userFlags[key] ?? "null"}`}
                                onChange={(_, value) => handleToggleButtonChange(key, value)}
                            >
                                <ToggleButton value={"false"}><DisabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /></ToggleButton>
                                <ToggleButton value={"null"}><DefaultIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /></ToggleButton>
                                <ToggleButton value={"true"}><EnabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} /></ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    </Box>
    );
}
