import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  Box,
  Divider,
  TextField,
  InputAdornment,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  SmartToy as SmartToyIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Speed as SpeedIcon,
  Category as CategoryIcon,
  AutoAwesome as AutoIcon,
  Star as FavoriteModelIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  Image as ImageGenIcon,
} from '@mui/icons-material';
import {
  getAllModels,
  getModelsForMode,
  getCachedOpenRouterModels,
  getCachedOpenRouterZdrAllowlistAvailable,
  loadOpenRouterModels,
  modelSupportsImageOutput,
  type ModelConfig,
  type ProviderKey,
} from '../../data/models';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import {
  getOpenRouterParams,
  setOpenRouterParams,
  DEFAULT_OPENROUTER_PARAMS,
  OPENROUTER_PARAM_LIMITS,
  type OpenRouterParams,
} from '../../services/api/openRouterParams';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectConversations } from '../../store/selectors/conversationsSelectors';
import { fetchConversations } from '../../store/slices/conversationsSlice';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

interface ModelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onAutoModeToggle?: (modelId: string) => void;
}

type SortOption = 'name' | 'provider' | 'speed' | 'category';
type FilterOption = 'all' | 'fast' | 'medium' | 'slow';
type OutputModalityFilter = {
  text: boolean;
  image: boolean;
};

/** Title-case words for provider labels shown in lists and accordions. */
function formatProviderDisplayName(provider: string | undefined): string {
  const t = provider?.trim();
  if (!t) return 'Other';
  return t
    .split(/\s+/)
    .map(w => {
      if (!w) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

type ProviderModelGroup = {
  key: string;
  displayLabel: string;
  models: ModelConfig[];
};

function groupModelsByProvider(models: ModelConfig[]): ProviderModelGroup[] {
  const map = new Map<string, ModelConfig[]>();
  for (const m of models) {
    const key = m.provider?.trim() || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()]
    .map(([key, models]) => ({
      key,
      displayLabel: formatProviderDisplayName(key),
      models,
    }))
    .sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      })
    );
}

export default function ModelSelectionModal({
  open,
  onClose,
  selectedModel,
  onSelectModel,
  onAutoModeToggle,
}: ModelSelectionModalProps) {
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  /** Direct OpenRouter only: toggle visibility by output modality. */
  const [outputModalityFilter, setOutputModalityFilter] =
    useState<OutputModalityFilter>({
      text: true,
      image: true,
    });
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [useBYOK, setUseBYOK] = useState(() => {
    try {
      const saved = localStorage.getItem('chatlab_byok_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [userProviders, setUserProviders] = useState<ProviderKey[] | null>(
    null
  );
  const isMostUsedModelsEnabled = useFeatureFlag('most_used_models');
  const isDirectOpenRouterEnabled = useFeatureFlag('direct_openrouter');
  const [usedModels, setUsedModels] = useState<
    { modelId: string; count: number }[]
  >([]);
  const conversations = useAppSelector(selectConversations);

  /** Load state for API-only model list when Direct OpenRouter is on (avoids empty list flash). */
  type OpenRouterListFetchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready' }
    | { status: 'error'; error: Error };

  const [openRouterListFetch, setOpenRouterListFetch] =
    useState<OpenRouterListFetchState>({ status: 'idle' });

  useEffect(() => {
    if (!open || !isDirectOpenRouterEnabled) {
      setOpenRouterListFetch({ status: 'idle' });
      return;
    }
    if (getCachedOpenRouterModels().length > 0) {
      setOpenRouterListFetch({ status: 'ready' });
      return;
    }
    setOpenRouterListFetch({ status: 'loading' });
    loadOpenRouterModels(true)
      .then(() => setOpenRouterListFetch({ status: 'ready' }))
      .catch((err: unknown) => {
        setOpenRouterListFetch({
          status: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
  }, [open, isDirectOpenRouterEnabled]);

  const retryLoadOpenRouterModels = React.useCallback(() => {
    setOpenRouterListFetch({ status: 'loading' });
    loadOpenRouterModels()
      .then(() => setOpenRouterListFetch({ status: 'ready' }))
      .catch((err: unknown) => {
        setOpenRouterListFetch({
          status: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
  }, []);

  // OpenRouter request params (only used when direct OpenRouter is enabled)
  const [openRouterParams, setOpenRouterParamsState] =
    useState<OpenRouterParams>(() => getOpenRouterParams());

  const updateOpenRouterParam = <K extends keyof OpenRouterParams>(
    key: K,
    value: OpenRouterParams[K]
  ) => {
    setOpenRouterParamsState(prev => {
      const next = { ...prev, [key]: value };
      setOpenRouterParams(next);
      return next;
    });
  };

  // Sync params from storage when modal opens
  React.useEffect(() => {
    if (open && isDirectOpenRouterEnabled) {
      setOpenRouterParamsState(getOpenRouterParams());
    }
  }, [open, isDirectOpenRouterEnabled]);

  // Get all available models from the centralized configuration
  const availableModels = getAllModels();
  const autoRouterModel = availableModels.find(
    model => model.id === 'auto-router'
  );
  const otherModels = availableModels.filter(
    model => model.id !== 'auto-router'
  );

  React.useEffect(() => {
    try {
      dispatch(
        fetchConversations({
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          },
          page: 1,
          limit: 20,
        })
      );
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      // Add user-friendly error handling here
    }
  }, [dispatch]);

  // Persist BYOK toggle to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('chatlab_byok_enabled', useBYOK ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  }, [useBYOK]);

  // Load user's available providers when BYOK is toggled on
  React.useEffect(() => {
    let cancelled = false;
    const loadProviders = async () => {
      if (!useBYOK) {
        setUserProviders(null);
        return;
      }
      try {
        const storage = getUnifiedStorageService();
        const keys = await storage.getAllAPIKeys();
        if (cancelled) return;
        const providers = (keys || [])
          .map((k: any) => (k.provider as string)?.toLowerCase())
          .filter(Boolean)
          .filter(
            (v: string, i: number, a: string[]) => a.indexOf(v) === i
          ) as ProviderKey[];
        setUserProviders(providers);
      } catch {
        setUserProviders([]);
      }
    };
    loadProviders();
    return () => {
      cancelled = true;
    };
  }, [useBYOK]);

  React.useEffect(() => {
    if (!open) {
      setOutputModalityFilter({
        text: true,
        image: true,
      });
    }
  }, [open]);

  React.useEffect(() => {
    const usedModels = conversations
      .map(conversation => conversation.modelsUsed)
      .flat()
      .filter(model => model !== undefined)
      .reduce(
        (acc, model) => {
          acc[model] = (acc[model] || 0) + 1;
          return acc;
        },
        {} as { [modelId: string]: number }
      );
    const sortedUsedModels = Object.entries(usedModels)
      .sort(([_, aCount], [__, bCount]) => bCount - aCount)
      .map(([modelId, count]) => ({ modelId, count }));
    setUsedModels(sortedUsedModels);
  }, [conversations]);

  // Filter models based on BYOK mode, search and filters
  const filteredModels = useMemo(() => {
    let baseList: ModelConfig[];

    if (useBYOK) {
      baseList = getModelsForMode({
        useBYOK: true,
        userProviders: userProviders || undefined,
      });
    } else if (isDirectOpenRouterEnabled) {
      // Direct OpenRouter: list comes from API only (see getAllModels); auto-router is separate
      baseList = otherModels;
    } else {
      // Normal mode: only show models with openrouter execution path
      baseList = otherModels.filter(m => m.executionPath === 'openrouter');
    }

    const mostUsedModels =
      isMostUsedModelsEnabled && usedModels
        ? usedModels
            .filter(({ modelId }) => baseList.some(m => m.id === modelId))
            .map(({ modelId }) => baseList.find(m => m.id === modelId)!)
            .map(model => ({ ...model, isMostUsed: true }))
            .splice(0, 3)
        : [];

    const remainingModels = baseList
      .filter(model => !mostUsedModels.some(m => m.id === model.id))
      .map(model => ({ ...model, isMostUsed: false }));

    const filtered = [...mostUsedModels, ...remainingModels].filter(model => {
      // Search filter
      const matchesSearch =
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
        || model.provider.toLowerCase().includes(searchQuery.toLowerCase())
        || model.description.toLowerCase().includes(searchQuery.toLowerCase())
        || model.capabilities.some(cap =>
          cap.toLowerCase().includes(searchQuery.toLowerCase())
        )
        || model.category.toLowerCase().includes(searchQuery.toLowerCase());

      const providerKey = model.provider?.trim() || 'Other';
      const matchesProvider =
        providerFilter === 'all' || providerKey === providerFilter;

      // Speed filter
      let matchesFilter = true;
      if (filterBy !== 'all') {
        switch (filterBy) {
          case 'fast':
            matchesFilter = model.speed === 'fast';
            break;
          case 'medium':
            matchesFilter = model.speed === 'medium';
            break;
          case 'slow':
            matchesFilter = model.speed === 'slow';
            break;
        }
      }

      // As most image models support text and images, we filter them in such a way that
      // only selecting "text" will hide and models with image capabilities (even if they also
      // support text) and selecting "image" will hide and models without image capabilities.
      const matchesImageGen =
        !isDirectOpenRouterEnabled
        || (() => {
          const outputModalities = model.outputModalities?.length
            ? model.outputModalities
            : ['text'];
          const hasTextOutput = outputModalities.includes('text');
          const hasImageOutput = outputModalities.includes('image');
          const wantsText = outputModalityFilter.text;
          const wantsImage = outputModalityFilter.image;

          if (!wantsText && !wantsImage) {
            return false;
          }

          if (wantsText && wantsImage) {
            return true;
          }

          if (wantsText) {
            return hasTextOutput && !hasImageOutput;
          }

          return hasImageOutput;
        })();

      return (
        matchesSearch && matchesProvider && matchesFilter && matchesImageGen
      );
    });

    // Sort models
    filtered.sort((a, b) => {
      if (a.isMostUsed && !b.isMostUsed) return -1;
      if (!a.isMostUsed && b.isMostUsed) return 1;
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'provider':
          return a.provider.localeCompare(b.provider, undefined, {
            sensitivity: 'base',
          });
        case 'speed': {
          const speedOrder = { fast: 0, medium: 1, slow: 2 };
          return speedOrder[a.speed] - speedOrder[b.speed];
        }
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    otherModels,
    useBYOK,
    userProviders,
    searchQuery,
    sortBy,
    filterBy,
    providerFilter,
    usedModels,
    isMostUsedModelsEnabled,
    isDirectOpenRouterEnabled,
    outputModalityFilter,
  ]);

  const handleModelSelect = (modelId: string) => {
    onSelectModel(modelId);
    onClose();
  };

  const handleAutoModeToggle = (enabled: boolean) => {
    if (enabled) {
      if (onAutoModeToggle) {
        onAutoModeToggle('auto-router');
      } else {
        onSelectModel('auto-router');
      }
    } else {
      // If disabling auto mode, select the first available model
      const firstModel = filteredModels[0] || otherModels[0];
      if (firstModel) {
        if (onAutoModeToggle) {
          onAutoModeToggle(firstModel.id);
        } else {
          onSelectModel(firstModel.id);
        }
      }
    }
    // Don't close the modal - let user see the change
  };

  const isAutoModeEnabled = selectedModel === 'auto-router';

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'primary';
      case 'anthropic':
        return 'secondary';
      case 'google':
        return 'success';
      case 'meta':
        return 'info';
      case 'mistral':
        return 'warning';
      case 'microsoft':
        return 'error';
      case 'xai':
        return 'default';
      case 'nlp workbench':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getSpeedIcon = (speed: ModelConfig['speed']) => {
    switch (speed) {
      case 'fast':
        return <SpeedIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'medium':
        return <SpeedIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'slow':
        return <SpeedIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      default:
        return <SpeedIcon sx={{ fontSize: 16 }} />;
    }
  };

  /** One entry per distinct provider string (trimmed), with formatted labels. */
  const uniqueProviders = useMemo(() => {
    const seen = new Set<string>();
    const rows: { key: string; label: string }[] = [];
    for (const model of otherModels) {
      const key = model.provider?.trim() || 'Other';
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ key, label: formatProviderDisplayName(model.provider) });
    }
    return rows.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [otherModels]);

  // If the stored filter no longer matches (e.g. casing), snap to a list key or All
  useEffect(() => {
    if (providerFilter === 'all') return;
    const keys = uniqueProviders.map(p => p.key);
    if (keys.includes(providerFilter)) return;
    const match = uniqueProviders.find(
      p => p.key.toLowerCase() === providerFilter.toLowerCase()
    );
    if (match) setProviderFilter(match.key);
    else setProviderFilter('all');
  }, [uniqueProviders, providerFilter]);

  /** Group filtered models by provider (alphabetical by formatted label). */
  const modelsByProvider = useMemo(
    () => groupModelsByProvider(filteredModels),
    [filteredModels]
  );

  /** When using provider accordions, which sections are expanded. */
  const [providerExpanded, setProviderExpanded] = useState<
    Record<string, boolean>
  >({});
  const providerAccordionInitRef = useRef(false);

  useEffect(() => {
    if (!open) {
      providerAccordionInitRef.current = false;
      return;
    }
    if (filteredModels.length === 0) {
      providerAccordionInitRef.current = false;
      return;
    }
    if (providerAccordionInitRef.current) return;
    providerAccordionInitRef.current = true;

    const groups = groupModelsByProvider(filteredModels);
    const next: Record<string, boolean> = {};
    let anySelected = false;
    for (const g of groups) {
      const hasSelected = g.models.some(m => m.id === selectedModel);
      next[g.key] = hasSelected;
      if (hasSelected) anySelected = true;
    }
    if (!anySelected && groups.length > 0) {
      next[groups[0].key] = true;
    }
    setProviderExpanded(next);
  }, [open, filteredModels, selectedModel]);

  const showProviderAccordions =
    providerFilter === 'all' && modelsByProvider.length > 1;

  const renderModelRow = (
    model: ModelConfig & { isMostUsed?: boolean },
    isLastInSection: boolean
  ) => (
    <React.Fragment key={model.id}>
      <ListItem disablePadding>
        <ListItemButton
          onClick={() => handleModelSelect(model.id)}
          selected={selectedModel === model.id}
          disabled={isAutoModeEnabled}
          sx={{
            py: 1.5,
            opacity: isAutoModeEnabled ? 0.6 : 1,
            '&.Mui-selected': {
              backgroundColor: 'primary.light',
              '&:hover': {
                backgroundColor: 'primary.light',
              },
            },
          }}
        >
          <ListItemAvatar>
            <Avatar
              sx={{
                bgcolor: model.isMostUsed ? 'secondary.main' : 'primary.main',
              }}
            >
              {model.isMostUsed ? <FavoriteModelIcon /> : <SmartToyIcon />}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {model.name}
                </Typography>
                {selectedModel === model.id && (
                  <CheckIcon color="primary" fontSize="small" />
                )}
              </Box>
            }
            secondary={
              <Box sx={{ mt: 0.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                  sx={{ mb: 1 }}
                >
                  {model.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    label={formatProviderDisplayName(model.provider)}
                    size="small"
                    color={getProviderColor(model.provider) as any}
                    variant="outlined"
                  />
                  <Chip
                    label={model.category}
                    size="small"
                    variant="outlined"
                    icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    {getSpeedIcon(model.speed)}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="span"
                    >
                      {model.speed}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${model.maxTokens.toLocaleString()} tokens`}
                    size="small"
                    variant="outlined"
                  />
                  {isDirectOpenRouterEnabled
                    && modelSupportsImageOutput(model) && (
                      <Chip
                        icon={
                          <ImageGenIcon sx={{ fontSize: '14px !important' }} />
                        }
                        label="Image output"
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                </Box>
              </Box>
            }
            secondaryTypographyProps={{ component: 'div' }}
          />
        </ListItemButton>
      </ListItem>
      {!isLastInSection && <Divider component="li" />}
    </React.Fragment>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: 'min(92vh, 960px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, flexShrink: 0 }}>
        <Box>
          <Typography
            component="span"
            variant="h6"
            sx={{ fontWeight: 600, display: 'block' }}
          >
            Select AI Model
          </Typography>
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            Choose the AI model for your conversation
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: isMobileView ? 'auto' : 'hidden',
          WebkitOverflowScrolling: isMobileView ? 'touch' : undefined,
        }}
      >
        {/* Auto Router Toggle */}
        {autoRouterModel && (
          <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
            <Paper
              elevation={1}
              sx={{
                p: isMobileView ? 1 : 1.5,
                backgroundColor: isAutoModeEnabled
                  ? 'primary.light'
                  : 'background.paper',
                border: isAutoModeEnabled ? '2px solid' : '1px solid',
                borderColor: isAutoModeEnabled ? 'primary.main' : 'divider',
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'primary.main',
                      width: isMobileView ? 30 : 40,
                      height: isMobileView ? 30 : 40,
                    }}
                  >
                    <AutoIcon />
                  </Avatar>
                  <Box>
                    <Typography
                      variant={isMobileView ? 'subtitle1' : 'h6'}
                      sx={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: isAutoModeEnabled
                          ? 'primary.main'
                          : 'text.primary',
                      }}
                    >
                      {autoRouterModel.name}
                      {isMobileView && (
                        <Tooltip
                          title={autoRouterModel.description}
                          arrow
                          enterTouchDelay={0}
                          leaveTouchDelay={2500}
                        >
                          <IconButton
                            size="small"
                            aria-label="Auto router description"
                            sx={{ p: 0.25 }}
                          >
                            <HelpOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Typography>
                    {!isMobileView && (
                      <Typography variant="body2" color="text.secondary">
                        {autoRouterModel.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isAutoModeEnabled}
                      onChange={e => handleAutoModeToggle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={isMobileView ? 'Auto' : 'Enable Auto Mode'}
                  sx={{
                    ml: 0,
                    mr: 0,
                    '& .MuiFormControlLabel-label': {
                      fontSize: isMobileView ? '0.8rem' : undefined,
                    },
                  }}
                />
              </Box>
            </Paper>
          </Box>
        )}

        {/* OpenRouter request parameters - only when direct OpenRouter is enabled */}
        {isDirectOpenRouterEnabled && (
          <Accordion
            defaultExpanded={false}
            sx={{
              flexShrink: 0,
              '&:before': { display: 'none' },
              boxShadow: 'none',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: 2, py: 0 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Request parameters</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Temperature: {openRouterParams.temperature}
                    </Typography>
                    <Tooltip
                      title="Controls randomness. Lower = more focused and deterministic; higher = more creative and varied."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.temperature}
                    onChange={(_, v) =>
                      updateOpenRouterParam('temperature', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.temperature.min}
                    max={OPENROUTER_PARAM_LIMITS.temperature.max}
                    step={OPENROUTER_PARAM_LIMITS.temperature.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Top P: {openRouterParams.top_p}
                    </Typography>
                    <Tooltip
                      title="Nucleus sampling. Limits choices to the top tokens whose probabilities sum to P. Lower = more predictable."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.top_p}
                    onChange={(_, v) =>
                      updateOpenRouterParam('top_p', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.top_p.min}
                    max={OPENROUTER_PARAM_LIMITS.top_p.max}
                    step={OPENROUTER_PARAM_LIMITS.top_p.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Top K:{' '}
                      {openRouterParams.top_k === 0
                        ? 'Off'
                        : openRouterParams.top_k}
                    </Typography>
                    <Tooltip
                      title="Limits choices to the top K most likely tokens at each step. 0 = disabled."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.top_k}
                    onChange={(_, v) =>
                      updateOpenRouterParam('top_k', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.top_k.min}
                    max={OPENROUTER_PARAM_LIMITS.top_k.max}
                    step={OPENROUTER_PARAM_LIMITS.top_k.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Frequency penalty: {openRouterParams.frequency_penalty}
                    </Typography>
                    <Tooltip
                      title="Reduces repetition based on how often tokens appear in the input. Higher = less repetition."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.frequency_penalty}
                    onChange={(_, v) =>
                      updateOpenRouterParam('frequency_penalty', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.frequency_penalty.min}
                    max={OPENROUTER_PARAM_LIMITS.frequency_penalty.max}
                    step={OPENROUTER_PARAM_LIMITS.frequency_penalty.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Presence penalty: {openRouterParams.presence_penalty}
                    </Typography>
                    <Tooltip
                      title="Penalizes tokens that have already appeared. Higher = encourages new topics."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.presence_penalty}
                    onChange={(_, v) =>
                      updateOpenRouterParam('presence_penalty', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.presence_penalty.min}
                    max={OPENROUTER_PARAM_LIMITS.presence_penalty.max}
                    step={OPENROUTER_PARAM_LIMITS.presence_penalty.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Repetition penalty: {openRouterParams.repetition_penalty}
                    </Typography>
                    <Tooltip
                      title="Reduces repetition of tokens from the input. Higher = less repetition."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Slider
                    value={openRouterParams.repetition_penalty}
                    onChange={(_, v) =>
                      updateOpenRouterParam('repetition_penalty', v as number)
                    }
                    min={OPENROUTER_PARAM_LIMITS.repetition_penalty.min}
                    max={OPENROUTER_PARAM_LIMITS.repetition_penalty.max}
                    step={OPENROUTER_PARAM_LIMITS.repetition_penalty.step}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      label="Max tokens"
                      type="number"
                      size="small"
                      value={openRouterParams.max_tokens}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) {
                          updateOpenRouterParam(
                            'max_tokens',
                            Math.min(Math.max(v, 1), 128000)
                          );
                        }
                      }}
                      inputProps={{
                        min: OPENROUTER_PARAM_LIMITS.max_tokens.min,
                        max: OPENROUTER_PARAM_LIMITS.max_tokens.max,
                      }}
                      sx={{ width: 120 }}
                    />
                    <Tooltip
                      title="Maximum number of tokens the model can generate in its response."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                          mt: 1,
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      label="Min tokens"
                      type="number"
                      size="small"
                      value={openRouterParams.min_tokens}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) {
                          updateOpenRouterParam(
                            'min_tokens',
                            Math.min(Math.max(v, 0), 4096)
                          );
                        }
                      }}
                      inputProps={{
                        min: OPENROUTER_PARAM_LIMITS.min_tokens.min,
                        max: OPENROUTER_PARAM_LIMITS.min_tokens.max,
                      }}
                      sx={{ width: 120 }}
                    />
                    <Tooltip
                      title="Minimum number of tokens the model must generate before it can stop."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                          mt: 1,
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      label="Seed (optional)"
                      type="number"
                      size="small"
                      placeholder="None"
                      value={openRouterParams.seed ?? ''}
                      onChange={e => {
                        const v = e.target.value;
                        updateOpenRouterParam(
                          'seed',
                          v === '' ? null : Math.floor(parseInt(v, 10) || 0)
                        );
                      }}
                      inputProps={{ min: 0 }}
                      sx={{ width: 120 }}
                    />
                    <Tooltip
                      title="For reproducible outputs. Same seed + same input = same output."
                      placement="top"
                      arrow
                    >
                      <HelpOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: 'text.secondary',
                          cursor: 'help',
                          mt: 1,
                        }}
                      />
                    </Tooltip>
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const defaults = { ...DEFAULT_OPENROUTER_PARAMS };
                    setOpenRouterParamsState(defaults);
                    setOpenRouterParams(defaults);
                  }}
                >
                  Reset to defaults
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        <Divider sx={{ flexShrink: 0 }} />

        {/* Search and Filters — compact row to maximize list height */}
        <Box sx={{ px: 2, py: 0.75, flexShrink: 0 }}>
          <Stack spacing={1}>
            {/* BYOK Toggle */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={useBYOK}
                    onChange={e => setUseBYOK(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label="Use my own API keys"
                sx={{
                  m: 0,
                  '& .MuiFormControlLabel-label': { typography: 'caption' },
                }}
              />
              {useBYOK && userProviders?.length === 0 && (
                <Tooltip
                  title="No compatible models found. Add your provider API keys in Settings to enable BYOK."
                  placement="left"
                >
                  <Chip
                    label="No providers configured"
                    color="warning"
                    size="small"
                  />
                </Tooltip>
              )}
            </Box>

            {/* Search + filters on one dense row where possible */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <TextField
                placeholder="Search models..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18 }} color="action" />
                    </InputAdornment>
                  ),
                }}
                size="small"
                sx={{ flex: '1 1 200px', minWidth: 160 }}
              />
              <FormControl
                size="small"
                sx={{ minWidth: 100, flex: '0 1 auto' }}
              >
                <InputLabel id="model-sort-label">Sort</InputLabel>
                <Select
                  labelId="model-sort-label"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  label="Sort"
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="provider">Provider</MenuItem>
                  <MenuItem value="speed">Speed</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                </Select>
              </FormControl>

              <FormControl
                size="small"
                sx={{ minWidth: 100, flex: '0 1 auto' }}
              >
                <InputLabel id="model-speed-label">Speed</InputLabel>
                <Select
                  labelId="model-speed-label"
                  value={filterBy}
                  onChange={e => setFilterBy(e.target.value as FilterOption)}
                  label="Speed"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="fast">Fast Speed</MenuItem>
                  <MenuItem value="medium">Medium Speed</MenuItem>
                  <MenuItem value="slow">Slow Speed</MenuItem>
                </Select>
              </FormControl>

              <FormControl
                size="small"
                sx={{ minWidth: 110, flex: '1 1 120px' }}
              >
                <InputLabel id="model-provider-label">Provider</InputLabel>
                <Select
                  labelId="model-provider-label"
                  value={providerFilter}
                  onChange={e => setProviderFilter(e.target.value)}
                  label="Provider"
                >
                  <MenuItem value="all">All Providers</MenuItem>
                  {uniqueProviders.map(({ key, label }) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {isDirectOpenRouterEnabled && (
                <Box
                  sx={{
                    flex: '1 1 320px',
                    minWidth: 0,
                    m: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Typography variant="body2" component="span">
                    Modalities:
                  </Typography>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={outputModalityFilter.text}
                        onChange={(_, checked) =>
                          setOutputModalityFilter(prev => ({
                            ...prev,
                            text: checked,
                          }))
                        }
                      />
                    }
                    label={<Typography variant="body2">Text</Typography>}
                  />
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={outputModalityFilter.image}
                        onChange={(_, checked) =>
                          setOutputModalityFilter(prev => ({
                            ...prev,
                            image: checked,
                          }))
                        }
                      />
                    }
                    label={<Typography variant="body2">Image</Typography>}
                  />
                </Box>
              )}
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ flexShrink: 0 }} />

        {/* Models list — per-provider accordions when showing all providers */}
        <Box
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: isMobileView ? 'visible' : 'auto',
            py: 0,
          }}
        >
          {isDirectOpenRouterEnabled
          && openRouterListFetch.status === 'loading' ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                px: 2,
                gap: 2,
              }}
            >
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary" align="center">
                Loading models from OpenRouter…
              </Typography>
            </Box>
          ) : isDirectOpenRouterEnabled
            && openRouterListFetch.status === 'error' ? (
            <Box sx={{ p: 2 }}>
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={retryLoadOpenRouterModels}
                  >
                    Retry
                  </Button>
                }
              >
                Could not load models from OpenRouter.{' '}
                {openRouterListFetch.error.message}
              </Alert>
            </Box>
          ) : showProviderAccordions ? (
            modelsByProvider.map(group => (
              <Accordion
                key={group.key}
                disableGutters
                elevation={0}
                square
                expanded={providerExpanded[group.key] ?? false}
                onChange={(_, expanded) => {
                  setProviderExpanded(prev => ({
                    ...prev,
                    [group.key]: expanded,
                  }));
                }}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    minHeight: 44,
                    px: 2,
                    bgcolor: 'action.hover',
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 1,
                      my: 0.75,
                    },
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {group.displayLabel}
                  </Typography>
                  <Chip
                    label={group.models.length}
                    size="small"
                    color={getProviderColor(group.key) as any}
                    variant="outlined"
                  />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List disablePadding component="ul" sx={{ py: 0 }}>
                    {group.models.map((model, idx) =>
                      renderModelRow(model, idx === group.models.length - 1)
                    )}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <List disablePadding component="ul" sx={{ py: 0 }}>
              {filteredModels.map((model, index) =>
                renderModelRow(model, index === filteredModels.length - 1)
              )}
            </List>
          )}
        </Box>

        {filteredModels.length === 0
          && !(
            isDirectOpenRouterEnabled
            && (openRouterListFetch.status === 'loading'
              || openRouterListFetch.status === 'error')
          ) && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {useBYOK
                  ? 'No models available. Add your provider API keys in Settings to enable BYOK.'
                  : 'No models match your search and filters'}
              </Typography>
            </Box>
          )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 1.5,
          pt: 1,
          flexShrink: 0,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent:
            isDirectOpenRouterEnabled && openRouterListFetch.status === 'ready'
              ? 'space-between'
              : 'flex-end',
          gap: 2,
        }}
      >
        {isDirectOpenRouterEnabled
          && openRouterListFetch.status === 'ready' && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                flex: '1 1 240px',
                minWidth: 0,
                lineHeight: 1.5,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {isMobileView ? (
                <>
                  {getCachedOpenRouterZdrAllowlistAvailable()
                    ? 'ZDR enabled for listed models'
                    : 'ZDR route list unavailable'}
                  <Tooltip
                    title={
                      getCachedOpenRouterZdrAllowlistAvailable()
                        ? 'All models provided have a ZDR (Zero Data Retention) policy, meaning none of your data is stored on the provider servers for any period of time.'
                        : 'The ZDR (Zero Data Retention) route list is unavailable, so no direct OpenRouter models are shown. Retry shortly once the route list becomes available.'
                    }
                    arrow
                    enterTouchDelay={0}
                    leaveTouchDelay={2500}
                  >
                    <IconButton
                      size="small"
                      aria-label="ZDR information"
                      sx={{ p: 0.25 }}
                    >
                      <HelpOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </>
              ) : getCachedOpenRouterZdrAllowlistAvailable() ? (
                <>
                  All models provided have a ZDR (Zero Data Retention) policy,
                  meaning none of your data is stored on the provider&apos;s
                  servers for any period of time.
                </>
              ) : (
                <>
                  The ZDR (Zero Data Retention) route list is unavailable, so no
                  direct OpenRouter models are shown. Retry shortly once the
                  route list becomes available.
                </>
              )}
            </Typography>
          )}
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
