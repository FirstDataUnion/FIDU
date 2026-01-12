import {
    Circle as DefaultIcon,
    CheckCircle as EnabledIcon,
    Cancel as DisabledIcon,
    HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { Box, Link, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useAppSelector } from '../store';
import { combineSystemFlagsWithOverrides, resolveFlagEnabled, selectSystemFeatureFlags, selectUserFeatureFlagOverrides } from '../store/selectors/featureFlagsSelectors';
import { setUserOverride } from '../store/slices/userFeatureFlagsSlice';
import type { FeatureFlagDefinition, FeatureFlagKey } from '../types/featureFlags';
import { useAppDispatch } from '../hooks/redux';
import ContextHelpModal from '../components/help/ContextHelpModal';
import SystemPromptHelpModal from '../components/help/SystemPromptHelpModal';

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

  const names = useMemo(() => {
    return {
        "shared_workspaces": "Shared Workspaces",
        "context": "Contexts",
        "system_prompts": "System Prompts",
        "system_prompt_librarian": "System Prompt Librarian",
        "documents": "Documents",
        "background_agents": "Background Agents",
        "model_selection": "Model Selection",
        "prompt_wizard": "Prompt Wizard",
        "view_copy_full_prompt": "View/Copy Full Prompt",
        "recent_conversations_in_chat_page": "Recent Conversations in Chat Page",
    };}, []
  );

  // Iterate over names to use that order (and filter) but return configurable flags
  const flagsToDisplay = useMemo(() =>
    Object.keys(names)
    .filter((key) => key in configurableFlags)
    .map(key => [key, configurableFlags[key as keyof typeof names]])
  , [configurableFlags, names]) as [FeatureFlagKey, FeatureFlagDefinition][];

  const helpModals = {
    "context": ContextHelpModal,
    "system_prompts": SystemPromptHelpModal,
  };

  const [helpModalOpen, setHelpModalOpen] = useState<keyof typeof helpModals | null>(null);

  function handleHelpModalOpen(key: keyof typeof helpModals) {
    setHelpModalOpen(key);
  }

  function handleHelpModalClose() {
    setHelpModalOpen(null);
  }

  function handleToggleButtonChange(key: FeatureFlagKey, value: string) {
    if (value === null) {
        return;
    }
    const dispatchValue = value === "null" ? null : value === "true" ? true : false;
    dispatch(setUserOverride({ key, value: dispatchValue }));
  }

  function canFlagBeEnabled(key: FeatureFlagKey): boolean {
    const ifItWereEnabled = {...userFlags, [key]: true};
    const combined = combineSystemFlagsWithOverrides(systemFlags, ifItWereEnabled);
    if (!combined) {
      return false;
    }
    return resolveFlagEnabled(combined, key);
  }

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
            {configurableFlags && flagsToDisplay.map(([mapKey, mapValue]) => {
                const key = mapKey as keyof typeof configurableFlags;
                const value = mapValue as FeatureFlagDefinition;
                const canBeEnabled = canFlagBeEnabled(key);
                return (
                    <Box key={key}>
                        <Typography variant="h5">{names[key as keyof typeof names]}</Typography>
                        {key in helpModals && (
                            <>
                            <Link
                                component="button"
                                variant="body2"
                                onClick={() => handleHelpModalOpen(key as keyof typeof helpModals)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                }}
                            >
                                <HelpOutlineIcon fontSize="small" />
                                What are "{names[key as keyof typeof names]}"?
                            </Link>
                            {helpModals[key as keyof typeof helpModals]({
                                open: helpModalOpen === key,
                                onClose: handleHelpModalClose,
                            })}
                            </>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Default:</Typography>
                            {
                                value.default_enabled
                                ? <EnabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
                                : <DisabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
                            }
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Your choice:</Typography>
                            <ToggleButtonGroup
                                disabled={!canBeEnabled}
                                exclusive
                                value={`${canBeEnabled ? userFlags[key] ?? "null" : "false"}`}
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
