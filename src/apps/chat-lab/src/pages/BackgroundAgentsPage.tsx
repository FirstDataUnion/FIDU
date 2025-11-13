import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Paper,
  InputAdornment,
  CircularProgress,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Tab,
  Tabs,
  Tooltip,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  HelpOutline as HelpOutlineIcon,
  SmartToy as SmartToyIcon,
  FileUpload as ExportIcon,
  FileDownload as ImportIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { useAppSelector } from '../hooks/redux';
import { useAppSelector as useAppSelectorFull } from '../store';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { useFilesystemDirectoryRequired } from '../hooks/useFilesystemDirectoryRequired';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { FloatingExportActions } from '../components/resourceExport/FloatingExportActions';
import { getResourceExportService } from '../services/resourceExport/resourceExportService';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';
import type { ExportSelection } from '../services/resourceExport/types';
import type { BackgroundAgent, AgentActionType } from '../services/api/backgroundAgents';
import {
  loadAgentPreferences,
  setAgentPreference,
} from '../services/agents/agentPreferences';
import { transformBuiltInAgentsWithPreferences } from '../services/agents/agentTransformers';
import { DEFAULT_AGENT_CONFIG, THRESHOLD_PRESETS } from '../services/agents/agentConstants';
import { RESOURCE_TITLE_MAX_LENGTH } from '../constants/resourceLimits';

// Extracted BackgroundAgentCard component for better performance
const BackgroundAgentCard = React.memo<{
  agent: BackgroundAgent;
  onViewEdit: (agent: BackgroundAgent) => void;
  onToggleEnabled: (agent: BackgroundAgent) => void;
  onUpdatePreferences?: (agentId: string, prefs: { runEveryNTurns: number; verbosityThreshold: number; contextLastN?: number }) => void;
  onUpdateAgent?: (agent: BackgroundAgent) => Promise<void>;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}>(({ agent, onViewEdit, onToggleEnabled, onUpdatePreferences, onUpdateAgent, isSelectionMode = false, isSelected = false, onToggleSelection, onEnterSelectionMode }) => {
  const [localRunEveryNTurns, setLocalRunEveryNTurns] = useState(agent.runEveryNTurns);
  const [localVerbosityThreshold, setLocalVerbosityThreshold] = useState(agent.verbosityThreshold);
  const [localContextLastN, setLocalContextLastN] = useState(agent.contextParams?.lastN || DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES);
  const [runEveryNTurnsInput, setRunEveryNTurnsInput] = useState(() => String(agent.runEveryNTurns));
  const [contextLastNInput, setContextLastNInput] = useState(() =>
    agent.contextWindowStrategy === 'lastNMessages'
      ? String(agent.contextParams?.lastN ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES)
      : ''
  );

  // Update local state when agent changes
  useEffect(() => {
    setLocalRunEveryNTurns(agent.runEveryNTurns);
    setLocalVerbosityThreshold(agent.verbosityThreshold);
    setLocalContextLastN(agent.contextParams?.lastN || DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES);
    setRunEveryNTurnsInput(String(agent.runEveryNTurns));
    setContextLastNInput(
      agent.contextWindowStrategy === 'lastNMessages'
        ? String(agent.contextParams?.lastN ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES)
        : ''
    );
  }, [agent.contextParams?.lastN, agent.contextWindowStrategy, agent.runEveryNTurns, agent.verbosityThreshold]);

  const handleViewEdit = useCallback(() => {
    if (!isSelectionMode) {
      onViewEdit(agent);
    }
  }, [agent, onViewEdit, isSelectionMode]);

  const handleCardClick = useCallback(() => {
    if (isSelectionMode && onToggleSelection && !agent.isSystem) {
      onToggleSelection(agent.id);
    }
  }, [isSelectionMode, onToggleSelection, agent.id, agent.isSystem]);

  const handleExportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterSelectionMode) {
      onEnterSelectionMode();
      if (onToggleSelection && !agent.isSystem) {
        onToggleSelection(agent.id);
      }
    }
  }, [onEnterSelectionMode, onToggleSelection, agent.id, agent.isSystem]);

  const handleToggleEnabled = useCallback(() => {
    onToggleEnabled(agent);
  }, [agent, onToggleEnabled]);

  const handleRunEveryNTurnsChange = useCallback(async (value: number) => {
    const clampedValue = Math.max(DEFAULT_AGENT_CONFIG.MIN_TURNS, Math.min(DEFAULT_AGENT_CONFIG.MAX_TURNS, value));
    setLocalRunEveryNTurns(clampedValue);
    setRunEveryNTurnsInput(String(clampedValue));
    
    if (agent.isSystem && onUpdatePreferences) {
      // Built-in agents: save to localStorage
      onUpdatePreferences(agent.id, {
        runEveryNTurns: clampedValue,
        verbosityThreshold: localVerbosityThreshold,
        contextLastN: agent.contextWindowStrategy === 'lastNMessages' ? localContextLastN : undefined,
      });
    } else if (!agent.isSystem && onUpdateAgent) {
      // Custom agents: save to storage
      const updatedAgent = { 
        ...agent, 
        runEveryNTurns: clampedValue,
        contextParams: agent.contextWindowStrategy === 'lastNMessages' 
          ? { ...agent.contextParams, lastN: localContextLastN }
          : agent.contextParams,
        updatedAt: new Date().toISOString() 
      };
      await onUpdateAgent(updatedAgent);
    }
  }, [agent, localVerbosityThreshold, localContextLastN, onUpdatePreferences, onUpdateAgent]);

  const handleVerbosityThresholdChange = useCallback(async (value: number) => {
    const clampedValue = Math.max(DEFAULT_AGENT_CONFIG.MIN_THRESHOLD, Math.min(DEFAULT_AGENT_CONFIG.MAX_THRESHOLD, value));
    setLocalVerbosityThreshold(clampedValue);
    
    if (agent.isSystem && onUpdatePreferences) {
      // Built-in agents: save to localStorage
      onUpdatePreferences(agent.id, {
        runEveryNTurns: localRunEveryNTurns,
        verbosityThreshold: clampedValue,
        contextLastN: agent.contextWindowStrategy === 'lastNMessages' ? localContextLastN : undefined,
      });
    } else if (!agent.isSystem && onUpdateAgent) {
      // Custom agents: save to storage
      const updatedAgent = { 
        ...agent, 
        verbosityThreshold: clampedValue,
        contextParams: agent.contextWindowStrategy === 'lastNMessages' 
          ? { ...agent.contextParams, lastN: localContextLastN }
          : agent.contextParams,
        updatedAt: new Date().toISOString() 
      };
      await onUpdateAgent(updatedAgent);
    }
  }, [agent, localRunEveryNTurns, localContextLastN, onUpdatePreferences, onUpdateAgent]);

  const handleContextLastNChange = useCallback(async (value: number) => {
    const clampedValue = Math.max(DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES, Math.min(DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES, value));
    setLocalContextLastN(clampedValue);
    setContextLastNInput(String(clampedValue));
    
    // Only apply if strategy is 'lastNMessages'
    if (agent.contextWindowStrategy !== 'lastNMessages') {
      return;
    }
    
    if (agent.isSystem && onUpdatePreferences) {
      // Built-in agents: save to localStorage
      onUpdatePreferences(agent.id, {
        runEveryNTurns: localRunEveryNTurns,
        verbosityThreshold: localVerbosityThreshold,
        contextLastN: clampedValue,
      });
    } else if (!agent.isSystem && onUpdateAgent) {
      // Custom agents: save to storage
      const updatedAgent = { 
        ...agent, 
        contextParams: { ...agent.contextParams, lastN: clampedValue },
        updatedAt: new Date().toISOString() 
      };
      await onUpdateAgent(updatedAgent);
    }
  }, [agent, localRunEveryNTurns, localVerbosityThreshold, onUpdatePreferences, onUpdateAgent]);

  const commitRunEveryNTurns = useCallback(async () => {
    if (runEveryNTurnsInput.trim() === '') {
      setRunEveryNTurnsInput(String(localRunEveryNTurns));
      return;
    }

    const parsed = Number.parseInt(runEveryNTurnsInput, 10);
    if (Number.isNaN(parsed)) {
      setRunEveryNTurnsInput(String(localRunEveryNTurns));
      return;
    }

    if (parsed === localRunEveryNTurns) {
      setRunEveryNTurnsInput(String(localRunEveryNTurns));
      return;
    }

    await handleRunEveryNTurnsChange(parsed);
  }, [handleRunEveryNTurnsChange, localRunEveryNTurns, runEveryNTurnsInput]);

  const commitContextLastN = useCallback(async () => {
    if (agent.contextWindowStrategy !== 'lastNMessages') {
      return;
    }

    if (contextLastNInput.trim() === '') {
      setContextLastNInput(String(localContextLastN));
      return;
    }

    const parsed = Number.parseInt(contextLastNInput, 10);
    if (Number.isNaN(parsed)) {
      setContextLastNInput(String(localContextLastN));
      return;
    }

    if (parsed === localContextLastN) {
      setContextLastNInput(String(localContextLastN));
      return;
    }

    await handleContextLastNChange(parsed);
  }, [agent.contextWindowStrategy, contextLastNInput, handleContextLastNChange, localContextLastN]);

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isSelectionMode && !agent.isSystem ? 'pointer' : 'default',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected ? 'action.selected' : 'background.paper',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && !agent.isSystem && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 3,
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection?.(agent.id);
            }}
            sx={{
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {isSelected ? (
              <CheckCircleIcon color="primary" />
            ) : (
              <RadioButtonUncheckedIcon />
            )}
          </IconButton>
        </Box>
      )}

      {/* Export button */}
      {!isSelectionMode && !agent.isSystem && (
        <IconButton
          size="small"
          onClick={handleExportClick}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 3,
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            width: 28,
            height: 28,
          }}
          aria-label="Export this agent"
        >
          <ExportIcon fontSize="small" />
        </IconButton>
      )}

      {/* Built-in indicator */}
      {agent.isSystem && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 2
          }}
        >
          Built-in
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1, pt: agent.isSystem ? 4 : 2 }}>
        {/* Enabled toggle and indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, pt: !isSelectionMode && !agent.isSystem ? 3 : 0, pr: 0 }}>
          <Chip
            label={agent.enabled ? 'Enabled' : 'Disabled'}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              backgroundColor: agent.enabled ? 'success.light' : 'grey.100',
              color: agent.enabled ? 'success.dark' : 'grey.600',
              borderColor: agent.enabled ? 'success.main' : 'grey.400'
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={agent.enabled}
              onChange={handleToggleEnabled}
              disabled={agent.isSystem}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'success.main',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'success.main',
                },
              }}
            />
          </Box>
        </Box>

        {/* Name */}
        <Typography variant="h6" sx={{
          mb: 1,
          fontWeight: 600,
          lineHeight: 1.2,
          fontSize: { xs: '1rem', sm: '1.25rem' },
          pr: isSelectionMode && !agent.isSystem ? 5 : (!isSelectionMode && !agent.isSystem ? 8 : 0),
          pl: isSelectionMode && !agent.isSystem ? 5 : 0,
        }}>
          {agent.name}
        </Typography>

        {/* Description */}
        {agent.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              fontStyle: 'normal',
              backgroundColor: 'rgba(0,0,0,0.02)',
              p: { xs: 0.75, sm: 1 },
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              lineHeight: { xs: 1.4, sm: 1.5 }
            }}
          >
            {agent.description}
          </Typography>
        )}

        {/* Configuration details */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mb: 1,
          fontSize: { xs: '0.7rem', sm: '0.8rem' },
          color: 'text.secondary'
        }}>
          {/* Editable fields for all agents */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, minWidth: 'fit-content' }}>
                Runs every:
              </Typography>
              <Tooltip
                title="How often this agent evaluates conversations. A value of N means the agent runs every N turns (message pairs). Lower values = more frequent evaluations (more timely alerts but more resource usage). Higher values = less frequent evaluations (less timely but more efficient)."
                arrow
                placement="top"
              >
                <HelpOutlineIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </Box>
            <TextField
              type="number"
              value={runEveryNTurnsInput}
              onChange={(e) => setRunEveryNTurnsInput(e.target.value)}
              onBlur={commitRunEveryNTurns}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRunEveryNTurns();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setRunEveryNTurnsInput(String(localRunEveryNTurns));
                  e.currentTarget.blur();
                }
              }}
              size="small"
              variant="outlined"
              inputProps={{ 
                min: DEFAULT_AGENT_CONFIG.MIN_TURNS, 
                max: DEFAULT_AGENT_CONFIG.MAX_TURNS,
                style: { 
                  padding: '2px 4px',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  width: '45px'
                }
              }}
              sx={{
                width: '60px',
                '& .MuiOutlinedInput-root': {
                  height: '26px',
                  fontSize: '0.75rem',
                  '& input': {
                    padding: '2px 4px',
                  }
                }
              }}
            />
            <Typography component="span" sx={{ fontSize: 'inherit' }}>turns</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, minWidth: 'fit-content' }}>
                Threshold:
              </Typography>
              <Tooltip
                title="Rating represents quality/health (0-100, higher is better). Alerts are shown when rating ≤ threshold. Lower threshold = alerts only for very low ratings (fewer alerts). Higher threshold = alerts for more ratings (more alerts)."
                arrow
                placement="top"
              >
                <HelpOutlineIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: { xs: '160px', sm: '200px' }, maxWidth: 280 }}>
              <Slider
                value={localVerbosityThreshold}
                onChange={(_, value) => {
                  if (typeof value === 'number') {
                    setLocalVerbosityThreshold(value);
                  }
                }}
                onChangeCommitted={(_, value) => {
                  if (typeof value === 'number') {
                    void handleVerbosityThresholdChange(value);
                  }
                }}
                min={DEFAULT_AGENT_CONFIG.MIN_THRESHOLD}
                max={DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}
                step={1}
                valueLabelDisplay="auto"
                aria-label="Verbosity threshold"
                sx={{ flexGrow: 1 }}
              />
              <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, minWidth: 'fit-content' }}>
                {localVerbosityThreshold}/100
              </Typography>
            </Box>
          </Box>
          {agent.contextWindowStrategy === 'lastNMessages' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600, minWidth: 'fit-content' }}>
                  Context:
                </Typography>
                <Tooltip
                  title="Number of recent messages to include when evaluating. The agent analyzes only the last N messages from the conversation. Lower values = less context (faster, may miss earlier context). Higher values = more context (slower, more comprehensive analysis)."
                  arrow
                  placement="top"
                >
                  <HelpOutlineIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
              </Box>
              <TextField
                type="number"
                value={contextLastNInput}
                onChange={(e) => setContextLastNInput(e.target.value)}
                onBlur={commitContextLastN}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitContextLastN();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setContextLastNInput(String(localContextLastN));
                    e.currentTarget.blur();
                  }
                }}
                size="small"
                variant="outlined"
                inputProps={{ 
                  min: DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES, 
                  max: DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES,
                  style: { 
                    padding: '2px 4px',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    width: '45px'
                  }
                }}
                sx={{
                  width: '60px',
                  '& .MuiOutlinedInput-root': {
                    height: '26px',
                    fontSize: '0.75rem',
                    '& input': {
                      padding: '2px 4px',
                    }
                  }
                }}
              />
              <Typography component="span" sx={{ fontSize: 'inherit' }}>messages</Typography>
            </Box>
          )}
          {agent.contextWindowStrategy && agent.contextWindowStrategy !== 'lastNMessages' && (
            <Box>
              <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 600 }}>
                Context:
              </Typography>{' '}
              <Typography component="span" sx={{ fontSize: 'inherit' }}>
                {agent.contextWindowStrategy === 'summarizeThenEvaluate'
                  ? 'Summarized'
                  : 'Full thread'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Categories */}
        {agent.categories && agent.categories.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {agent.categories.slice(0, 3).map((cat) => (
              <Chip
                key={cat}
                label={cat}
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  backgroundColor: 'secondary.main',
                  color: 'white'
                }}
              />
            ))}
            {agent.categories.length > 3 && (
              <Chip
                label={`+${agent.categories.length - 3}`}
                size="small"
                sx={{
                  fontSize: '0.7rem'
                }}
              />
            )}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{
        pt: 0,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }
      }}>
        <Typography variant="caption" color="text.secondary" sx={{
          flex: 1,
          minWidth: 'fit-content',
          fontSize: { xs: '0.7rem', sm: '0.75rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          {!agent.isSystem && agent.updatedAt && `Updated ${new Date(agent.updatedAt).toLocaleDateString()}`}
        </Typography>
        <Box sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          width: { xs: '100%', sm: 'auto' },
          justifyContent: { xs: 'center', sm: 'flex-end' }
        }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleViewEdit}
            sx={{
              color: 'primary.dark',
              borderColor: 'primary.dark',
              backgroundColor: 'background.paper',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              px: { xs: 2, sm: 1.5 },
              py: { xs: 1, sm: 0.5 },
              minWidth: { xs: '120px', sm: 'auto' },
              '&:hover': {
                backgroundColor: 'primary.light',
                borderColor: 'primary.main'
              }
            }}
          >
            {agent.isSystem ? 'View' : 'View/Edit'}
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
});

BackgroundAgentCard.displayName = 'BackgroundAgentCard';

// Optimized Grid Component
const OptimizedBackgroundAgentsGrid = React.memo<{
  agents: BackgroundAgent[];
  onViewEdit: (agent: BackgroundAgent) => void;
  onToggleEnabled: (agent: BackgroundAgent) => void;
  onUpdatePreferences?: (agentId: string, prefs: { runEveryNTurns: number; verbosityThreshold: number; contextLastN?: number }) => void;
  onUpdateAgent?: (agent: BackgroundAgent) => Promise<void>;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}>(({ agents, onViewEdit, onToggleEnabled, onUpdatePreferences, onUpdateAgent, isSelectionMode = false, selectedIds, onToggleSelection, onEnterSelectionMode }) => {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)'
      },
      gap: 3
    }}>
      {agents.map((agent) => (
        <BackgroundAgentCard
          key={agent.id}
          agent={agent}
          onViewEdit={onViewEdit}
          onToggleEnabled={onToggleEnabled}
          onUpdatePreferences={onUpdatePreferences}
          onUpdateAgent={onUpdateAgent}
          isSelectionMode={isSelectionMode}
          isSelected={selectedIds?.has(agent.id) || false}
          onToggleSelection={onToggleSelection}
          onEnterSelectionMode={onEnterSelectionMode}
        />
      ))}
    </Box>
  );
});

OptimizedBackgroundAgentsGrid.displayName = 'OptimizedBackgroundAgentsGrid';

export default function BackgroundAgentsPage(): React.JSX.Element {
  const [agents, setAgents] = useState<BackgroundAgent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Built-in, 2: Custom
  const [prefsVersion, setPrefsVersion] = useState(0); // Track preference changes to trigger re-renders
  const currentProfile = useAppSelector((state) => state.auth.currentProfile);
  const { user } = useAppSelectorFull((state) => state.auth);
  const unifiedStorage = useUnifiedStorage();
  const isDirectoryRequired = useFilesystemDirectoryRequired();

  // Multi-select export state
  const multiSelect = useMultiSelect();
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);


  // Dialog states
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BackgroundAgent | null>(null);
  const [viewEditForm, setViewEditForm] = useState<{
    name: string;
    description: string;
    enabled: boolean;
    actionType: AgentActionType;
    promptTemplate: string;
    runEveryNTurns: number;
    verbosityThreshold: number;
    contextWindowStrategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall';
    contextParams: { lastN?: number; tokenLimit?: number };
    notifyChannel: 'inline' | 'toast' | 'panel' | 'all';
  }>({
    name: '',
    description: '',
    enabled: true,
    actionType: 'alert',
    promptTemplate: '',
    runEveryNTurns: DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS,
    verbosityThreshold: DEFAULT_AGENT_CONFIG.VERBOSITY_THRESHOLD,
    contextWindowStrategy: 'lastNMessages',
    contextParams: { lastN: DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES },
    notifyChannel: 'inline',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const storage = getUnifiedStorageService();
        const profileId = currentProfile?.id;
        if (!profileId) {
          throw new Error('No active profile. Please select or create a profile.');
        }
        const { backgroundAgents } = await storage.getBackgroundAgents(undefined, 1, 20, profileId);
        // Only store custom agents (never store built-in ones)
        const customAgents = (backgroundAgents || []).filter((a: BackgroundAgent) => !a.isSystem);
        setAgents(customAgents);
      } catch (e: any) {
        setError(e?.message || 'Failed to load background agents');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentProfile?.id]);

  // Transform built-in agents from data file to BackgroundAgent format, merging stored preferences
  const transformedBuiltInAgents = useMemo(() => {
    const storedPrefs = loadAgentPreferences();
    return transformBuiltInAgentsWithPreferences(storedPrefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsVersion]); // Re-compute when preferences change

  // Combine built-in agents with custom agents for display
  const allAgents = useMemo(() => {
    return [...transformedBuiltInAgents, ...agents];
  }, [transformedBuiltInAgents, agents]);

  // Separate built-in and custom agents
  const { builtInAgents, customAgents } = useMemo(() => {
    const builtIn = transformedBuiltInAgents;
    const custom = agents;
    return { builtInAgents: builtIn, customAgents: custom };
  }, [transformedBuiltInAgents, agents]);

  // Get current tab's agents
  const currentTabAgents = useMemo(() => {
    switch (activeTab) {
      case 1: return builtInAgents;
      case 2: return customAgents;
      default: return allAgents;
    }
  }, [activeTab, builtInAgents, customAgents, allAgents]);

  // Debounced search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    let filtered = currentTabAgents;
    
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        (agent.description && agent.description.toLowerCase().includes(query)) ||
        (agent.categories && agent.categories.some(cat => cat.toLowerCase().includes(query)))
      );
    }
    
    return filtered;
  }, [currentTabAgents, debouncedSearchQuery]);

  // Dialog states for creating new agents
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    description: string;
    enabled: boolean;
    actionType: AgentActionType;
    promptTemplate: string;
    runEveryNTurns: number;
    verbosityThreshold: number;
    contextWindowStrategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall';
    contextParams: { lastN?: number; tokenLimit?: number };
    notifyChannel: 'inline' | 'toast' | 'panel' | 'all';
  }>({
    name: '',
    description: '',
    enabled: true,
    actionType: 'alert',
    promptTemplate: '',
    runEveryNTurns: DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS,
    verbosityThreshold: DEFAULT_AGENT_CONFIG.VERBOSITY_THRESHOLD,
    contextWindowStrategy: 'lastNMessages',
    contextParams: { lastN: DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES },
    notifyChannel: 'inline',
  });

  const handleCreateAgent = useCallback(() => {
    setCreateForm({
      name: '',
      description: '',
      enabled: true,
      actionType: 'alert',
      promptTemplate: '',
      runEveryNTurns: DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS,
      verbosityThreshold: DEFAULT_AGENT_CONFIG.VERBOSITY_THRESHOLD,
      contextWindowStrategy: 'lastNMessages',
      contextParams: { lastN: DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES },
      notifyChannel: 'inline',
    });
    setCreateDialogOpen(true);
  }, []);

  const handleCreateAgentSubmit = useCallback(async () => {
    // Validate required fields
    if (!currentProfile?.id) {
      setError('No active profile. Please select or create a profile.');
      return;
    }
    if (!createForm.name.trim()) {
      setError('Agent name is required.');
      return;
    }
    if (!createForm.promptTemplate.trim()) {
      setError('Prompt template is required.');
      return;
    }
    
    // Validate numeric fields
    if (createForm.runEveryNTurns < DEFAULT_AGENT_CONFIG.MIN_TURNS || createForm.runEveryNTurns > DEFAULT_AGENT_CONFIG.MAX_TURNS) {
      setError(`Run every N turns must be between ${DEFAULT_AGENT_CONFIG.MIN_TURNS} and ${DEFAULT_AGENT_CONFIG.MAX_TURNS}.`);
      return;
    }
    if (!createForm.actionType || createForm.actionType.trim() === '') {
      setError('Action Type is required. Please select an action type.');
      return;
    }
    if (createForm.verbosityThreshold < DEFAULT_AGENT_CONFIG.MIN_THRESHOLD || createForm.verbosityThreshold > DEFAULT_AGENT_CONFIG.MAX_THRESHOLD) {
      setError(`Verbosity threshold must be between ${DEFAULT_AGENT_CONFIG.MIN_THRESHOLD} and ${DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}.`);
      return;
    }
    if (createForm.contextWindowStrategy === 'lastNMessages' && createForm.contextParams.lastN) {
      const lastN = createForm.contextParams.lastN;
      if (lastN < DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES || lastN > DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES) {
        setError(`Context messages must be between ${DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES} and ${DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES}.`);
        return;
      }
    }
    
    try {
      setError(null);
      const storage = getUnifiedStorageService();
      const profileId = currentProfile?.id;
      if (!profileId) throw new Error('No active profile.');
      
      // Ensure actionType is set (default to 'alert' if somehow missing)
      const actionType: AgentActionType = createForm.actionType || 'alert';
      
      const newAgent: BackgroundAgent = {
        id: crypto.randomUUID(),
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        enabled: createForm.enabled,
        actionType: actionType,
        promptTemplate: createForm.promptTemplate.trim(),
        runEveryNTurns: createForm.runEveryNTurns,
        verbosityThreshold: createForm.verbosityThreshold,
        contextWindowStrategy: createForm.contextWindowStrategy,
        contextParams: createForm.contextParams,
        outputSchemaName: 'default',
        customOutputSchema: null,
        notifyChannel: createForm.notifyChannel,
        isSystem: false,
        categories: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await storage.createBackgroundAgent(newAgent, profileId);
      setAgents((prev) => [saved, ...prev]);
      setCreateDialogOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to create agent');
    }
  }, [createForm, currentProfile?.id]);

  const handleToggleEnabled = async (agent: BackgroundAgent) => {
    // Built-in agents cannot be toggled
    if (agent.isSystem) {
      return;
    }
    try {
      const storage = getUnifiedStorageService();
      const profileId = currentProfile?.id;
      if (!profileId) throw new Error('No active profile.');
      const updated = { ...agent, enabled: !agent.enabled, updatedAt: new Date().toISOString() };
      const saved = await storage.updateBackgroundAgent(updated, profileId);
      setAgents((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update agent');
    }
  };

  const handleUpdateAgent = async (updatedAgent: BackgroundAgent) => {
    try {
      const storage = getUnifiedStorageService();
      const profileId = currentProfile?.id;
      if (!profileId) throw new Error('No active profile.');
      const saved = await storage.updateBackgroundAgent(updatedAgent, profileId);
      setAgents((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update agent');
    }
  };

  const handleUpdatePreferences = useCallback((agentId: string, prefs: { runEveryNTurns: number; verbosityThreshold: number; contextLastN?: number }) => {
    // Save to localStorage
    setAgentPreference(agentId, prefs);
    // Trigger re-computation of built-in agents with new preferences
    setPrefsVersion((prev) => prev + 1);
  }, []);

  const handleExportSelected = useCallback(async () => {
    if (!currentProfile?.id || multiSelect.selectionCount === 0) return;
    setIsExporting(true);
    try {
      const exportService = getResourceExportService();
      const selection: ExportSelection = {
        backgroundAgentIds: Array.from(multiSelect.selectedIds),
      };
      const exportData = await exportService.exportResources(
        selection,
        currentProfile.id,
        user?.email
      );
      exportService.downloadExport(exportData);
      multiSelect.exitSelectionMode();
    } catch (error) {
      console.error('Export failed:', error);
      // Could add error snackbar here
    } finally {
      setIsExporting(false);
    }
  }, [currentProfile?.id, multiSelect, user?.email]);

  const handleCancelExport = useCallback(() => {
    multiSelect.exitSelectionMode();
  }, [multiSelect]);

  const handleViewEditAgent = useCallback((agent: BackgroundAgent) => {
    setSelectedAgent(agent);
    setViewEditForm({
      name: agent.name,
      description: agent.description,
      enabled: agent.enabled,
      actionType: agent.actionType,
      promptTemplate: agent.promptTemplate,
      runEveryNTurns: agent.runEveryNTurns,
      verbosityThreshold: agent.verbosityThreshold,
      contextWindowStrategy: agent.contextWindowStrategy,
      contextParams: agent.contextParams || { lastN: DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES },
      notifyChannel: agent.notifyChannel,
    });
    setViewEditDialogOpen(true);
  }, []);

  const handleViewEditSubmit = useCallback(async () => {
    if (!selectedAgent) return;
    
    // Validate required fields for custom agents
    if (!selectedAgent.isSystem) {
      if (!viewEditForm.name.trim()) {
        setError('Agent name is required.');
        return;
      }
      if (!viewEditForm.promptTemplate.trim()) {
        setError('Prompt template is required.');
        return;
      }
    }
    
    // Validate actionType is required
    if (!viewEditForm.actionType || viewEditForm.actionType.trim() === '') {
      setError('Action Type is required. Please select an action type.');
      return;
    }
    
    // Validate numeric fields
    if (viewEditForm.runEveryNTurns < DEFAULT_AGENT_CONFIG.MIN_TURNS || viewEditForm.runEveryNTurns > DEFAULT_AGENT_CONFIG.MAX_TURNS) {
      setError(`Run every N turns must be between ${DEFAULT_AGENT_CONFIG.MIN_TURNS} and ${DEFAULT_AGENT_CONFIG.MAX_TURNS}.`);
      return;
    }
    if (viewEditForm.verbosityThreshold < DEFAULT_AGENT_CONFIG.MIN_THRESHOLD || viewEditForm.verbosityThreshold > DEFAULT_AGENT_CONFIG.MAX_THRESHOLD) {
      setError(`Verbosity threshold must be between ${DEFAULT_AGENT_CONFIG.MIN_THRESHOLD} and ${DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}.`);
      return;
    }
    if (viewEditForm.contextWindowStrategy === 'lastNMessages' && viewEditForm.contextParams.lastN) {
      const lastN = viewEditForm.contextParams.lastN;
      if (lastN < DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES || lastN > DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES) {
        setError(`Context messages must be between ${DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES} and ${DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES}.`);
        return;
      }
    }
    
    try {
      // If it's a built-in agent, only save preferences to localStorage
      if (selectedAgent.isSystem) {
        setAgentPreference(selectedAgent.id, {
          runEveryNTurns: viewEditForm.runEveryNTurns,
          verbosityThreshold: viewEditForm.verbosityThreshold,
          contextLastN: viewEditForm.contextWindowStrategy === 'lastNMessages' ? viewEditForm.contextParams.lastN : undefined,
        });
        // Trigger re-computation of built-in agents with new preferences
        setPrefsVersion((prev) => prev + 1);
        setViewEditDialogOpen(false);
        setSelectedAgent(null);
        return;
      }
      
      // For custom agents, update in storage
      if (!currentProfile?.id) {
        setError('No active profile. Please select or create a profile.');
        return;
      }
      
      const storage = getUnifiedStorageService();
      // Ensure actionType is set (default to 'alert' if somehow missing)
      const actionType: AgentActionType = viewEditForm.actionType || 'alert';
      
      const updated: BackgroundAgent = {
        ...selectedAgent,
        ...viewEditForm,
        actionType: actionType, // Override with validated actionType
        updatedAt: new Date().toISOString()
      };
      const saved = await storage.updateBackgroundAgent(updated, currentProfile.id);
      setAgents((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
      setViewEditDialogOpen(false);
      setSelectedAgent(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to update agent');
    }
  }, [selectedAgent, viewEditForm, currentProfile?.id]);

  const handleDeleteAgent = useCallback(async () => {
    if (!selectedAgent || selectedAgent.isSystem) return;
    
    try {
      const storage = getUnifiedStorageService();
      await storage.deleteBackgroundAgent(selectedAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id));
      setDeleteDialogOpen(false);
      setViewEditDialogOpen(false);
      setSelectedAgent(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete agent');
    }
  }, [selectedAgent]);

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Storage Directory Banner */}
      <StorageDirectoryBanner pageType="background-agents" />

      {/* Scrollable Content Area */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        p: { xs: 2, sm: 3 },
        minHeight: 0
      }}>
        {/* Header */}
        <Box sx={{
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', lg: 'flex-start' },
          gap: { xs: 3, lg: 0 }
        }}>
          <Box sx={{
            flex: { xs: 'none', lg: '0 0 60%' },
            maxWidth: { xs: '100%', lg: '60%' },
            width: { xs: '100%', lg: 'auto' }
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
              flexWrap: 'wrap'
            }}>
              <Typography variant="h4" sx={{ fontWeight: 600, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
                Background Agents
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              Configure agents that analyze your conversations asynchronously and surface notifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              Background agents monitor conversations in real-time, analyze content, and provide insights or warnings based on your configured criteria.
            </Typography>
          </Box>
          {unifiedStorage.status === 'configured' && (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: { xs: 'none', lg: '0 0 37%' },
              minWidth: { xs: '100%', lg: '300px' },
              width: { xs: '100%', lg: 'auto' }
            }}>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateAgent}
                  disabled={isDirectoryRequired}
                  sx={{
                    borderRadius: 2,
                    flex: 1,
                    minWidth: { xs: '100%', sm: '200px' },
                    py: { xs: 1.5, sm: 1 },
                    fontSize: { xs: '0.875rem', sm: '0.875rem' }
                  }}
                >
                  Create New Agent
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ImportIcon />}
                  onClick={() => setShowImportDialog(true)}
                  disabled={isDirectoryRequired}
                  sx={{
                    borderRadius: 2,
                    flex: 1,
                    minWidth: { xs: '100%', sm: '200px' },
                    py: { xs: 1.5, sm: 1 },
                    fontSize: { xs: '0.875rem', sm: '0.875rem' }
                  }}
                >
                  Import
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* Search and Filter Bar */}
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search background agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }
            }}
          />
        </Paper>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                minHeight: { xs: 48, sm: 48 },
                px: { xs: 1, sm: 2 }
              }
            }}
          >
            <Tab
              label={`All (${allAgents.length})`}
              icon={<SmartToyIcon />}
              iconPosition="start"
              sx={{
                '& .MuiTab-iconWrapper': {
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }
              }}
            />
            <Tab
              label={`Built-in (${builtInAgents.length})`}
              icon={<SettingsIcon />}
              iconPosition="start"
              sx={{
                '& .MuiTab-iconWrapper': {
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }
              }}
            />
            <Tab
              label={`Custom (${customAgents.length})`}
              icon={<CodeIcon />}
              iconPosition="start"
              sx={{
                '& .MuiTab-iconWrapper': {
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }
              }}
            />
          </Tabs>
        </Paper>

        {/* Error Display */}
        {error && (
          <Box sx={{
            backgroundColor: '#fdecea',
            border: '1px solid #f5c2c7',
            color: '#5f2120',
            padding: 2,
            borderRadius: 2,
            mb: 3
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{error}</span>
              <Button onClick={() => setError(null)} size="small">Dismiss</Button>
            </Box>
          </Box>
        )}

        {/* Agents Grid */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={60} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              Loading background agents...
            </Typography>
          </Box>
        ) : filteredAgents.length > 0 ? (
          <OptimizedBackgroundAgentsGrid
            agents={filteredAgents}
            onViewEdit={handleViewEditAgent}
            onToggleEnabled={handleToggleEnabled}
            onUpdatePreferences={handleUpdatePreferences}
            onUpdateAgent={handleUpdateAgent}
            isSelectionMode={multiSelect.isSelectionMode}
            selectedIds={multiSelect.selectedIds}
            onToggleSelection={multiSelect.toggleSelection}
            onEnterSelectionMode={multiSelect.enterSelectionMode}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SmartToyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {searchQuery ? 'No agents match your search' :
                activeTab === 2 ? 'No custom agents yet' :
                  activeTab === 1 ? 'No built-in agents' :
                    'No background agents available'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {activeTab === 2 ? 'Create a new background agent from scratch to get started' :
                'Try adjusting your search or switching to a different tab'}
            </Typography>
            {activeTab === 2 && unifiedStorage.status === 'configured' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateAgent}
                disabled={isDirectoryRequired}
              >
                Create New Agent
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* View/Edit Dialog */}
      <Dialog
        open={viewEditDialogOpen}
        onClose={() => setViewEditDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 },
            height: { xs: '100vh', sm: 'auto' },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {selectedAgent?.isSystem ? 'View Background Agent Settings' : 'View/Edit Background Agent'}
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
            {selectedAgent?.name}
            {selectedAgent?.isSystem && (
              <Typography component="span" variant="caption" sx={{ ml: 1, fontStyle: 'italic' }}>
                (Built-in template - only settings can be customized)
              </Typography>
            )}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Agent Name"
                value={viewEditForm.name}
                onChange={(e) => setViewEditForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={selectedAgent?.isSystem}
                slotProps={{ htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH } }}
                helperText={`${viewEditForm.name.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
              <TextField
                fullWidth
                label="Description"
                value={viewEditForm.description}
                onChange={(e) => setViewEditForm(prev => ({ ...prev, description: e.target.value }))}
                disabled={selectedAgent?.isSystem}
                multiline
                rows={2}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
              <FormControl fullWidth disabled={selectedAgent?.isSystem} required>
                <InputLabel id="view-edit-action-type-label">Action Type *</InputLabel>
                <Select
                  labelId="view-edit-action-type-label"
                  value={viewEditForm.actionType || 'alert'}
                  label="Action Type *"
                  required
                  onChange={(e) => setViewEditForm(prev => ({ ...prev, actionType: e.target.value as AgentActionType }))}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                >
                  <MenuItem value="alert">
                    <Box>
                      <Typography variant="body1">Alert</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Creates alerts and notifications based on analysis
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              {!selectedAgent?.isSystem && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={viewEditForm.enabled}
                      onChange={(e) => setViewEditForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                  }
                  label="Enabled"
                />
              )}
              <Divider />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="Run Every N Turns"
                  type="number"
                  value={viewEditForm.runEveryNTurns}
                  onChange={(e) => setViewEditForm(prev => ({ ...prev, runEveryNTurns: parseInt(e.target.value) || DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS }))}
                  helperText={"a 'turn' is a message pair (user message + assistant message)"}
                  inputProps={{ min: DEFAULT_AGENT_CONFIG.MIN_TURNS, max: DEFAULT_AGENT_CONFIG.MAX_TURNS }}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                />
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Alert Sensitivity
                    <Tooltip
                      title="Alerts appear when the agent's rating is at or below this threshold. Higher values = more sensitive (more alerts). Lower values = less sensitive (fewer alerts, only critical issues)."
                      arrow
                      placement="top"
                    >
                      <HelpOutlineIcon sx={{ fontSize: '1rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                  </Typography>
                  <Box sx={{ px: 1, pt: 1 }}>
                    <Slider
                      value={viewEditForm.verbosityThreshold}
                      onChange={(_, value) => setViewEditForm(prev => ({ ...prev, verbosityThreshold: value as number }))}
                      min={DEFAULT_AGENT_CONFIG.MIN_THRESHOLD}
                      max={DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}
                      step={5}
                      marks={[
                        { value: THRESHOLD_PRESETS.CRITICAL_ONLY, label: 'Critical' },
                        { value: THRESHOLD_PRESETS.BALANCED, label: 'Balanced' },
                        { value: THRESHOLD_PRESETS.ALL_ISSUES, label: 'All' },
                      ]}
                      valueLabelDisplay="on"
                      valueLabelFormat={(value) => `${value}/100`}
                      sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: '0.75rem',
                        },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {`Alerts when rating ≤ ${viewEditForm.verbosityThreshold}`}
                  </Typography>
                </Box>
              </Box>
              {viewEditForm.contextWindowStrategy === 'lastNMessages' && (
                <TextField
                  fullWidth
                  label="Context Messages"
                  type="number"
                  value={viewEditForm.contextParams.lastN || DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES}
                  onChange={(e) => setViewEditForm(prev => ({
                    ...prev,
                    contextParams: {
                      ...prev.contextParams,
                      lastN: parseInt(e.target.value) || DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
                    }
                  }))}
                  helperText={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography component="span" variant="caption">
                        Number of recent messages to include when evaluating
                      </Typography>
                      <Tooltip
                        title="Number of recent messages to include when evaluating. The agent analyzes only the last N messages from the conversation. Lower values = less context (faster, may miss earlier context). Higher values = more context (slower, more comprehensive analysis)."
                        arrow
                        placement="top"
                      >
                        <HelpOutlineIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                      </Tooltip>
                    </Box>
                  }
                  inputProps={{ 
                    min: DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES, 
                    max: DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES 
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                />
              )}
              <TextField
                fullWidth
                label="Prompt Template"
                value={viewEditForm.promptTemplate}
                onChange={(e) => setViewEditForm(prev => ({ ...prev, promptTemplate: e.target.value }))}
                disabled={selectedAgent?.isSystem}
                multiline
                rows={12}
                sx={{
                  fontFamily: 'monospace',
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    minHeight: { xs: '300px', sm: '250px' }
                  }
                }}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ order: { xs: 2, sm: 1 } }}>
            {!selectedAgent?.isSystem && (
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                color="error"
                variant="outlined"
                size="small"
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: { xs: 1.5, sm: 0.5 }
                }}
              >
                Delete
              </Button>
            )}
          </Box>
          <Box sx={{
            display: 'flex',
            gap: 1,
            order: { xs: 1, sm: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <Button
              onClick={() => setViewEditDialogOpen(false)}
              sx={{
                color: 'primary.dark',
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1.5, sm: 1 }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleViewEditSubmit}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1.5, sm: 1 }
              }}
            >
              {selectedAgent?.isSystem ? 'Save Settings' : 'Save Changes'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 2, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Delete Background Agent
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <DialogContentText sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Are you sure you want to delete "{selectedAgent?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAgent}
            color="error"
            variant="contained"
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Agent Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 },
            height: { xs: '100vh', sm: 'auto' },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Create New Background Agent
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Agent Name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                required
                slotProps={{ htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH } }}
                helperText={`${createForm.name.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
              <TextField
                fullWidth
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
              <FormControl fullWidth required>
                <InputLabel id="create-action-type-label">Action Type *</InputLabel>
                <Select
                  labelId="create-action-type-label"
                  value={createForm.actionType || 'alert'}
                  label="Action Type *"
                  required
                  onChange={(e) => setCreateForm(prev => ({ ...prev, actionType: e.target.value as AgentActionType }))}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                >
                  <MenuItem value="alert">
                    <Box>
                      <Typography variant="body1">Alert</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Creates alerts and notifications based on analysis
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.enabled}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                }
                label="Enabled"
              />
              <Divider />
              <TextField
                fullWidth
                label="Run Every N Turns"
                type="number"
                value={createForm.runEveryNTurns}
                onChange={(e) => setCreateForm(prev => ({ ...prev, runEveryNTurns: parseInt(e.target.value) || DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS }))}
                inputProps={{ min: DEFAULT_AGENT_CONFIG.MIN_TURNS, max: DEFAULT_AGENT_CONFIG.MAX_TURNS }}
                helperText="How often the agent should run (every N conversation turns)"
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Alert Sensitivity
                  <Tooltip
                    title="Alerts appear when the agent's rating is at or below this threshold. Higher values = more sensitive (more alerts). Lower values = less sensitive (fewer alerts, only critical issues)."
                    arrow
                    placement="top"
                  >
                    <HelpOutlineIcon sx={{ fontSize: '1rem', color: 'text.secondary', cursor: 'help' }} />
                  </Tooltip>
                </Typography>
                <Box sx={{ px: 1, pt: 1 }}>
                  <Slider
                    value={createForm.verbosityThreshold}
                    onChange={(_, value) => setCreateForm(prev => ({ ...prev, verbosityThreshold: value as number }))}
                    min={DEFAULT_AGENT_CONFIG.MIN_THRESHOLD}
                    max={DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}
                    step={5}
                    marks={[
                      { value: THRESHOLD_PRESETS.CRITICAL_ONLY, label: 'Critical' },
                      { value: THRESHOLD_PRESETS.BALANCED, label: 'Balanced' },
                      { value: THRESHOLD_PRESETS.ALL_ISSUES, label: 'All' },
                    ]}
                    valueLabelDisplay="on"
                    valueLabelFormat={(value) => `${value}/100`}
                    sx={{
                      '& .MuiSlider-markLabel': {
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Current: {createForm.verbosityThreshold}/100 - Alerts when rating ≤ {createForm.verbosityThreshold}
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="Prompt Template"
                value={createForm.promptTemplate}
                onChange={(e) => setCreateForm(prev => ({ ...prev, promptTemplate: e.target.value }))}
                required
                multiline
                rows={12}
                placeholder="Enter the prompt template for your background agent..."
                sx={{
                  fontFamily: 'monospace',
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    minHeight: { xs: '300px', sm: '250px' }
                  }
                }}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ order: { xs: 2, sm: 1 } }} />
          <Box sx={{
            display: 'flex',
            gap: 1,
            order: { xs: 1, sm: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <Button
              onClick={() => setCreateDialogOpen(false)}
              sx={{
                color: 'primary.dark',
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1.5, sm: 1 }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateAgentSubmit}
              disabled={!createForm.name.trim() || !createForm.promptTemplate.trim()}
              sx={{
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1.5, sm: 1 }
              }}
            >
              Create Agent
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Floating Export Actions */}
      {multiSelect.isSelectionMode && (
        <FloatingExportActions
          selectionCount={multiSelect.selectionCount}
          onExport={handleExportSelected}
          onCancel={handleCancelExport}
          disabled={isExporting}
        />
      )}

      {/* Resource Import Dialog */}
      <ResourceImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          // Refresh background agents after import
          if (currentProfile?.id) {
            const load = async () => {
              try {
                const storage = getUnifiedStorageService();
                const { backgroundAgents } = await storage.getBackgroundAgents(undefined, 1, 20, currentProfile.id);
                const customAgents = (backgroundAgents || []).filter((a: BackgroundAgent) => !a.isSystem);
                setAgents(customAgents);
              } catch (e: any) {
                setError(e?.message || 'Failed to load background agents');
              }
            };
            void load();
          }
        }}
      />
    </Box>
  );
}
