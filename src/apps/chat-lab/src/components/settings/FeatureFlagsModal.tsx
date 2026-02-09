import {
  Circle as DefaultIcon,
  CheckCircle as EnabledIcon,
  Cancel as DisabledIcon,
  HelpOutline as HelpOutlineIcon,
  Warning as ExperimentalIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useAppSelector } from '../../store';
import {
  combineSystemFlagsWithOverrides,
  resolveFlagEnabled,
  selectSystemFeatureFlags,
  selectUserFeatureFlagOverrides,
} from '../../store/selectors/featureFlagsSelectors';
import { setUserOverride } from '../../store/slices/userFeatureFlagsSlice';
import type {
  FeatureFlagDefinition,
  FeatureFlagKey,
} from '../../types/featureFlags';
import { useAppDispatch } from '../../hooks/redux';
import ContextHelpModal from '../help/ContextHelpModal';
import SystemPromptHelpModal from '../help/SystemPromptHelpModal';

interface FeatureFlagsModalProps {
  open: boolean;
  onClose: () => void;
}

export const FeatureFlagsModal: React.FC<FeatureFlagsModalProps> = ({
  open,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const systemFlags = useAppSelector(state => selectSystemFeatureFlags(state));
  const userFlags = useAppSelector(state =>
    selectUserFeatureFlagOverrides(state)
  );
  const configurableFlags = useMemo(() => {
    if (systemFlags === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(systemFlags).filter(
        ([_, value]) => value.enabled && value.user_configurable
      )
    ) as Partial<Record<FeatureFlagKey, FeatureFlagDefinition>>;
  }, [systemFlags]);

  const names = useMemo(() => {
    return {
      shared_workspaces: 'Shared Workspaces',
      context: 'Contexts',
      system_prompts: 'System Prompts',
      system_prompt_librarian: 'System Prompt Librarian',
      documents: 'Documents',
      background_agents: 'Background Agents',
      model_selection: 'Model Selection',
      prompt_wizard: 'Prompt Wizard',
      view_copy_full_prompt: 'View/Copy Full Prompt',
      recent_conversations_in_chat_page: 'Recent Conversations in Chat Page',
    };
  }, []);

  // Iterate over names to use that order (and filter) but return configurable flags
  const flagsToDisplay = useMemo(
    () =>
      Object.keys(names)
        .filter(key => key in configurableFlags)
        .map(key => [key, configurableFlags[key as keyof typeof names]]),
    [configurableFlags, names]
  ) as [FeatureFlagKey, FeatureFlagDefinition][];

  const helpModals = {
    context: ContextHelpModal,
    system_prompts: SystemPromptHelpModal,
  };

  const [helpModalOpen, setHelpModalOpen] = useState<
    keyof typeof helpModals | null
  >(null);

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
    const dispatchValue =
      value === 'null' ? null : value === 'true' ? true : false;
    dispatch(setUserOverride({ key, value: dispatchValue }));
  }

  function canFlagBeEnabled(key: FeatureFlagKey): boolean {
    const ifItWereEnabled = { ...userFlags, [key]: true };
    const combined = combineSystemFlagsWithOverrides(
      systemFlags,
      ifItWereEnabled
    );
    if (!combined) {
      return false;
    }
    return resolveFlagEnabled(combined, key);
  }

  function displayFeatureFlagToggles(
    mapKey: FeatureFlagKey,
    mapValue: FeatureFlagDefinition
  ) {
    const key = mapKey as keyof typeof configurableFlags;
    const value = mapValue as FeatureFlagDefinition;
    const canBeEnabled = canFlagBeEnabled(key);
    return (
      <Box key={key} sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {names[key as keyof typeof names]}
        </Typography>
        {key in helpModals && (
          <>
            <Link
              component="button"
              variant="body2"
              onClick={() =>
                handleHelpModalOpen(key as keyof typeof helpModals)
              }
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 1,
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.875rem' }}
          >
            Default:
          </Typography>
          {value.default_enabled ? (
            <EnabledIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
          ) : (
            <DisabledIcon
              sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }}
            />
          )}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.875rem', ml: 2 }}
          >
            Your choice:
          </Typography>
          <ToggleButtonGroup
            disabled={!canBeEnabled}
            exclusive
            value={`${canBeEnabled ? (userFlags[key] ?? 'null') : 'false'}`}
            onChange={(_, value) => handleToggleButtonChange(key, value)}
            size="small"
          >
            <ToggleButton value={'false'}>
              <DisabledIcon
                sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }}
              />
            </ToggleButton>
            <ToggleButton value={'null'}>
              <DefaultIcon
                sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }}
              />
            </ToggleButton>
            <ToggleButton value={'true'}>
              <EnabledIcon
                sx={{ fontSize: '1.2rem', verticalAlign: 'middle' }}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExperimentalIcon
            sx={{
              fontSize: '1.5rem',
              color: 'warning.main',
            }}
          />
          Customise Features
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This dialog lets you change which features are enabled throughout
            the rest of the ChatLab. However, the changes only affect the UI
            (the way you see the app), not the actual functionality. For
            example, if you enable a Background Agent to write to a Document and
            then turn off the Background Agent and Document features, the agent
            will still run on each prompt and write to the document, but you
            won't be able to see either of them!
          </Typography>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mt: 2,
            }}
          >
            Optional features:
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enable or disable optional features to customize your experience.
            The "default" value is what we recommend for new users. Leaving your
            choice in the middle state will track our recommended default value.
            Set the toggle to:
          </Typography>
          <Box component="ul" sx={{ listStyleType: 'none', pl: 0, mb: 2 }}>
            <Box
              component="li"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <DisabledIcon sx={{ fontSize: '1.2rem' }} />
              <Typography variant="body2">to disable the feature</Typography>
            </Box>
            <Box
              component="li"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <DefaultIcon sx={{ fontSize: '1.2rem' }} />
              <Typography variant="body2">to use the default value</Typography>
            </Box>
            <Box
              component="li"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <EnabledIcon sx={{ fontSize: '1.2rem' }} />
              <Typography variant="body2">to enable the feature</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {configurableFlags
              && flagsToDisplay
                .filter(([_, value]) => value.default_enabled)
                .map(([mapKey, mapValue]) =>
                  displayFeatureFlagToggles(mapKey, mapValue)
                )}
          </Box>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mt: 2,
            }}
          >
            <Box
              component="span"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ExperimentalIcon
                sx={{
                  fontSize: '1.5rem',
                  color: 'warning.main',
                }}
              />
              Experimental features:
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This section is doubly experimental in that changing features is
            experimental and these features themselves are also experimental.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {configurableFlags
              && flagsToDisplay
                .filter(([_, value]) => !value.default_enabled)
                .map(([mapKey, mapValue]) =>
                  displayFeatureFlagToggles(mapKey, mapValue)
                )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
