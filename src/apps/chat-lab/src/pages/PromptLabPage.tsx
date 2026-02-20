import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type JSX,
} from 'react';
import { EnhancedMarkdown } from '../components/common/EnhancedMarkdown';
import {
  Box,
  Typography,
  TextField,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Paper,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Link,
  Badge,
  Slider,
  useTheme,
} from '@mui/material';
import { CategoryFilter } from '../components/common/CategoryFilter';
import {
  ContentCopy as ContentCopyIcon,
  Add as AddIcon,
  Chat as ChatIcon,
  SmartToy as ModelIcon,
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  ChatBubbleOutline as ChatBubbleIcon,
  ExpandMore as ExpandMoreIcon,
  RestartAlt as RestartAltIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
  ExpandLess as ExpandLessIcon,
  HelpOutline as HelpOutlineIcon,
  AutoFixHigh as WizardIcon,
  MenuBook as MenuBookIcon,
  CheckCircle as CheckCircleIcon,
  SmartToy as SmartToyIcon,
  ArrowUpward as ArrowUpwardIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchContexts, createContext } from '../store/slices/contextsSlice';
import { updateLastUsedModel } from '../store/slices/settingsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import {
  deleteConversation,
  updateConversationWithMessages,
} from '../store/slices/conversationsSlice';
import {
  setCurrentPrompt,
  clearCurrentPrompt,
} from '../store/slices/promptLabSlice';
import { conversationsService } from '../services/conversationsService';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { BUILT_IN_BACKGROUND_AGENTS } from '../data/backgroundAgents';
import type { BackgroundAgent } from '../services/api/backgroundAgents';
import { useMobile, useResponsiveSpacing } from '../hooks/useMobile';
import { ApiError } from '../services/api/apiClients';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { promptsApi, buildCompletePrompt } from '../services/api/prompts';
import ModelSelectionModal from '../components/prompts/ModelSelectionModal';
import { WizardWindow } from '../components/wizards/WizardWindow';
import { LongRequestWarning } from '../components/common/LongRequestWarning';
import ContextHelpModal from '../components/help/ContextHelpModal';
import SystemPromptHelpModal from '../components/help/SystemPromptHelpModal';
import {
  subscribeToAgentAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
} from '../services/agents/agentAlerts';
import { getFilteredAlerts } from '../services/agents/agentAlertHistory';
import AlertTimelineModal from '../components/alerts/AlertTimelineModal';
import {
  analyzeRequestDuration,
  type LongRequestAnalysis,
} from '../utils/longRequestDetection';
import { wizardSystemPrompts } from '../data/prompts/wizardSystemPrompts';
import HistoryIcon from '../assets/HistoryIcon.png';
import HistoryIconBlack from '../assets/HistoryIconBlack.png';
import type { Conversation, Message, Context, SystemPrompt } from '../types';
import type { WizardMessage } from '../types/wizard';
import {
  parseActualModelInfo,
  type ActualModelInfo,
} from '../utils/conversationUtils';
import { getModelColor } from '../utils/themeColors';
import { DEFAULT_AGENT_CONFIG } from '../services/agents/agentConstants';
import { useAlertClick } from '../contexts/AlertClickContext';

// Safely import MetricsService - it may not be available in all environments (e.g., local dev)
import { MetricsService } from '../services/metrics/MetricsService';
import { RESOURCE_TITLE_MAX_LENGTH } from '../constants/resourceLimits';
import { truncateTitle } from '../utils/stringUtils';
import { getContextTokenCount } from '../utils/tokenEstimation';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

// Helper function to safely record metrics - gracefully handles if MetricsService is unavailable
const safeRecordMessageSent = (
  model: string,
  status: 'success' | 'error'
): void => {
  try {
    if (
      typeof MetricsService !== 'undefined'
      && MetricsService?.recordMessageSent
    ) {
      MetricsService.recordMessageSent(model, status);
    }
  } catch (error) {
    // Silently ignore metrics errors - they should never block the chat flow
    console.debug('Metrics recording failed (non-blocking):', error);
  }
};

// LocalStorage key for background agent preferences (reuse from BackgroundAgentsPage)
const BACKGROUND_AGENT_PREFS_KEY = 'fidu-chat-lab-backgroundAgentPrefs';

interface BackgroundAgentPreferences {
  runEveryNTurns: number;
  verbosityThreshold: number;
  contextLastN?: number; // For 'lastNMessages' strategy
  enabled?: boolean; // Optional: allows disabling built-in agents (defaults to true)
  modelId?: string; // Optional: model ID to use for evaluation (defaults to 'gpt-oss-120b')
}

interface AllAgentPreferences {
  [agentId: string]: BackgroundAgentPreferences;
}

// Helper functions for localStorage preferences
const loadAgentPreferences = (): AllAgentPreferences => {
  try {
    const stored = localStorage.getItem(BACKGROUND_AGENT_PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load background agent preferences:', error);
    return {};
  }
};

const setAgentPreference = (
  agentId: string,
  prefs: Partial<BackgroundAgentPreferences>
): void => {
  const allPrefs = loadAgentPreferences();
  const existingPrefs = allPrefs[agentId] || {};
  // Merge preferences, ensuring required fields are preserved
  // Always use the new value if provided, otherwise fall back to existing, then default
  const mergedPrefs: BackgroundAgentPreferences = {
    runEveryNTurns:
      prefs.runEveryNTurns !== undefined
        ? prefs.runEveryNTurns
        : (existingPrefs.runEveryNTurns
          ?? DEFAULT_AGENT_CONFIG.RUN_EVERY_N_TURNS),
    verbosityThreshold:
      prefs.verbosityThreshold !== undefined
        ? prefs.verbosityThreshold
        : (existingPrefs.verbosityThreshold
          ?? DEFAULT_AGENT_CONFIG.VERBOSITY_THRESHOLD),
  };

  // Add optional fields if they exist in either new or existing prefs
  if (
    prefs.contextLastN !== undefined
    || existingPrefs.contextLastN !== undefined
  ) {
    mergedPrefs.contextLastN =
      prefs.contextLastN !== undefined
        ? prefs.contextLastN
        : existingPrefs.contextLastN;
  }
  if (prefs.enabled !== undefined || existingPrefs.enabled !== undefined) {
    mergedPrefs.enabled =
      prefs.enabled !== undefined ? prefs.enabled : existingPrefs.enabled;
  }
  if (prefs.modelId !== undefined || existingPrefs.modelId !== undefined) {
    mergedPrefs.modelId =
      prefs.modelId !== undefined ? prefs.modelId : existingPrefs.modelId;
  }

  allPrefs[agentId] = mergedPrefs;
  try {
    const serialized = JSON.stringify(allPrefs);
    localStorage.setItem(BACKGROUND_AGENT_PREFS_KEY, serialized);
    // Verify the save worked
    const verify = localStorage.getItem(BACKGROUND_AGENT_PREFS_KEY);
    if (verify) {
      const parsed = JSON.parse(verify);
      if (
        parsed[agentId]?.verbosityThreshold !== mergedPrefs.verbosityThreshold
      ) {
        console.warn(
          `Failed to save verbosityThreshold for ${agentId}. Expected ${mergedPrefs.verbosityThreshold}, got ${parsed[agentId]?.verbosityThreshold}`
        );
      }
    }
  } catch (error) {
    console.warn('Failed to save background agent preferences:', error);
  }
};

// Simple time ago formatter
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Component for individual agent card in dialog
function BackgroundAgentDialogCard({
  agent,
  onUpdatePreference,
  alerts = [],
  autoExpand: _autoExpand = false,
  alertIdToExpand,
  onAlertsChanged,
  onJumpToMessage,
  onAlertExpanded,
}: {
  agent: BackgroundAgent & { outputDocumentName?: string };
  onUpdatePreference: (
    agentId: string,
    prefs: {
      runEveryNTurns: number;
      verbosityThreshold?: number;
      contextLastN?: number;
      outputDocumentId?: string;
    }
  ) => void;
  alerts?: Array<{
    id: string;
    createdAt: string;
    rating: number;
    severity: 'info' | 'warn' | 'error';
    message: string;
    shortMessage?: string;
    description?: string;
    details?: Record<string, any>;
    rawModelOutput?: string;
    read: boolean;
    messageId?: string; // ID of the message that triggered this alert
  }>;
  autoExpand?: boolean;
  alertIdToExpand?: string; // Specific alert ID to expand
  onAlertsChanged?: () => void;
  onJumpToMessage?: (messageId: string) => void; // Callback to scroll to message and close modal
  onAlertExpanded?: () => void; // Callback when alert has been expanded and scrolled to
}) {
  const [localRunEveryNTurns, setLocalRunEveryNTurns] = useState(
    agent.runEveryNTurns
  );
  const [localVerbosityThreshold, setLocalVerbosityThreshold] = useState(
    agent.verbosityThreshold
  );
  const [localContextLastN, setLocalContextLastN] = useState(
    agent.contextParams?.lastN ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
  );
  const [runEveryNTurnsInput, setRunEveryNTurnsInput] = useState(() =>
    String(agent.runEveryNTurns)
  );
  const [contextLastNInput, setContextLastNInput] = useState(() =>
    agent.contextWindowStrategy === 'lastNMessages'
      ? String(
          agent.contextParams?.lastN
            ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
        )
      : ''
  );
  const [alertsExpanded, setAlertsExpanded] = useState(_autoExpand || false); // Start expanded if autoExpand is true
  const [expandedRawOutput, setExpandedRawOutput] = useState<Set<string>>(
    new Set()
  );
  const [expandedExecStatus, setExpandedExecStatus] = useState<Set<string>>(
    new Set()
  );

  // Auto-expand the specific alert if alertIdToExpand is provided
  useEffect(() => {
    if (alertIdToExpand && alerts.some(alert => alert.id === alertIdToExpand)) {
      setAlertsExpanded(true);
      // Also expand the raw output for this specific alert
      setExpandedRawOutput(prev => new Set(prev).add(alertIdToExpand));
      // Scroll the alert into view after a short delay to ensure DOM is updated
      // Use requestAnimationFrame to ensure DOM is ready, then scroll without blocking
      requestAnimationFrame(() => {
        setTimeout(() => {
          const alertElement = document.getElementById(
            `alert-${alertIdToExpand}`
          );
          if (alertElement) {
            // Use scrollIntoView with smooth behavior, but don't block
            alertElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
            // Notify parent that scroll has started so it can clear the state and release scroll lock
            // Use a timeout to ensure scroll animation has started before releasing
            setTimeout(() => {
              onAlertExpanded?.();
            }, 500);
          } else {
            // If element not found, notify immediately
            onAlertExpanded?.();
          }
        }, 150);
      });
    }
  }, [alertIdToExpand, alerts, onAlertExpanded]);

  const unreadCount = alerts.filter(a => !a.read).length;
  const recentAlerts = alerts.slice(0, 5); // Show last 5 alerts

  // Track the original agent values to detect actual changes
  const originalVerbosityThreshold = useRef(agent.verbosityThreshold);
  const originalRunEveryNTurns = useRef(agent.runEveryNTurns);
  const originalContextLastN = useRef(
    agent.contextParams?.lastN ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
  );

  // Update local state when agent changes
  useEffect(() => {
    setLocalRunEveryNTurns(agent.runEveryNTurns);
    setLocalVerbosityThreshold(agent.verbosityThreshold);
    setLocalContextLastN(
      agent.contextParams?.lastN ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
    );
    setRunEveryNTurnsInput(String(agent.runEveryNTurns));
    setContextLastNInput(
      agent.contextWindowStrategy === 'lastNMessages'
        ? String(
            agent.contextParams?.lastN
              ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES
          )
        : ''
    );
    // Update refs to track original values
    originalVerbosityThreshold.current = agent.verbosityThreshold;
    originalRunEveryNTurns.current = agent.runEveryNTurns;
    originalContextLastN.current =
      agent.contextParams?.lastN
      ?? DEFAULT_AGENT_CONFIG.CONTEXT_LAST_N_MESSAGES;
  }, [
    agent.contextParams?.lastN,
    agent.contextWindowStrategy,
    agent.runEveryNTurns,
    agent.verbosityThreshold,
  ]);

  const applyRunEveryNTurns = useCallback(
    (value: number) => {
      const clamped = Math.max(
        DEFAULT_AGENT_CONFIG.MIN_TURNS,
        Math.min(DEFAULT_AGENT_CONFIG.MAX_TURNS, value)
      );
      setRunEveryNTurnsInput(String(clamped));
      if (clamped === localRunEveryNTurns) {
        return;
      }
      setLocalRunEveryNTurns(clamped);
      onUpdatePreference(agent.id, {
        runEveryNTurns: clamped,
        verbosityThreshold: localVerbosityThreshold,
        contextLastN:
          agent.contextWindowStrategy === 'lastNMessages'
            ? localContextLastN
            : undefined,
        outputDocumentId: agent.outputDocumentId,
      });
    },
    [
      agent.contextWindowStrategy,
      agent.id,
      agent.outputDocumentId,
      localContextLastN,
      localRunEveryNTurns,
      localVerbosityThreshold,
      onUpdatePreference,
    ]
  );

  const commitRunEveryNTurns = useCallback(() => {
    if (runEveryNTurnsInput.trim() === '') {
      setRunEveryNTurnsInput(String(localRunEveryNTurns));
      return;
    }

    const parsed = Number.parseInt(runEveryNTurnsInput, 10);
    if (Number.isNaN(parsed)) {
      setRunEveryNTurnsInput(String(localRunEveryNTurns));
      return;
    }

    applyRunEveryNTurns(parsed);
  }, [applyRunEveryNTurns, localRunEveryNTurns, runEveryNTurnsInput]);

  const applyVerbosityThreshold = useCallback(
    (value: number) => {
      const clamped = Math.max(
        DEFAULT_AGENT_CONFIG.MIN_THRESHOLD,
        Math.min(DEFAULT_AGENT_CONFIG.MAX_THRESHOLD, value)
      );
      // Check if value actually changed from the original (not the local state which may have been updated by onChange)
      if (clamped === originalVerbosityThreshold.current) {
        return;
      }
      setLocalVerbosityThreshold(clamped);
      originalVerbosityThreshold.current = clamped; // Update the ref to track the new value
      onUpdatePreference(agent.id, {
        runEveryNTurns: localRunEveryNTurns,
        verbosityThreshold: clamped,
        contextLastN:
          agent.contextWindowStrategy === 'lastNMessages'
            ? localContextLastN
            : undefined,
      });
    },
    [
      agent.contextWindowStrategy,
      agent.id,
      localContextLastN,
      localRunEveryNTurns,
      onUpdatePreference,
    ]
  );

  const applyContextLastN = useCallback(
    (value: number) => {
      if (agent.contextWindowStrategy !== 'lastNMessages') {
        return;
      }

      const clamped = Math.max(
        DEFAULT_AGENT_CONFIG.MIN_CONTEXT_MESSAGES,
        Math.min(DEFAULT_AGENT_CONFIG.MAX_CONTEXT_MESSAGES, value)
      );
      setContextLastNInput(String(clamped));
      if (clamped === localContextLastN) {
        return;
      }
      setLocalContextLastN(clamped);
      onUpdatePreference(agent.id, {
        runEveryNTurns: localRunEveryNTurns,
        verbosityThreshold: localVerbosityThreshold,
        contextLastN: clamped,
      });
    },
    [
      agent.contextWindowStrategy,
      agent.id,
      localContextLastN,
      localRunEveryNTurns,
      localVerbosityThreshold,
      onUpdatePreference,
    ]
  );

  const commitContextLastN = useCallback(() => {
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

    applyContextLastN(parsed);
  }, [
    agent.contextWindowStrategy,
    applyContextLastN,
    contextLastNInput,
    localContextLastN,
  ]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          bg: 'error.main',
          border: 'error.main',
          text: 'error.contrastText',
          chip: 'error',
        };
      case 'warn':
        return {
          bg: 'warning.main',
          border: 'warning.main',
          text: 'warning.contrastText',
          chip: 'warning',
        };
      default:
        return {
          bg: 'info.main',
          border: 'info.main',
          text: 'info.contrastText',
          chip: 'info',
        };
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: unreadCount > 0 ? 'error.main' : 'divider',
        borderRadius: 2,
        borderWidth: unreadCount > 0 ? 2 : 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1.5,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {agent.name}
            </Typography>
            {unreadCount > 0 && (
              <Badge
                badgeContent={unreadCount}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.7rem',
                    minWidth: 18,
                    height: 18,
                    ml: 1, // Additional left margin for spacing
                  },
                }}
              />
            )}
            {agent.isSystem && (
              <Chip
                label="Built-in"
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
          </Box>
          {agent.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: '0.875rem' }}
            >
              {agent.description}
            </Typography>
          )}
        </Box>
        {recentAlerts.length > 0 && (
          <IconButton
            size="small"
            onClick={() => {
              const willExpand = !alertsExpanded;
              setAlertsExpanded(willExpand);

              // Mark all unread alerts as read when expanding
              if (willExpand && unreadCount > 0) {
                alerts
                  .filter(a => !a.read)
                  .forEach(alert => {
                    markAlertAsRead(alert.id);
                  });
                // Notify parent to refresh counts
                if (onAlertsChanged) {
                  setTimeout(() => {
                    onAlertsChanged();
                  }, 100);
                }
              }
            }}
            sx={{ ml: 1 }}
          >
            {alertsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>

      <Stack spacing={2}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="body2"
            sx={{ minWidth: 'fit-content', fontWeight: 500 }}
          >
            Runs every:
          </Typography>
          <TextField
            type="number"
            value={runEveryNTurnsInput}
            onChange={e => setRunEveryNTurnsInput(e.target.value)}
            onBlur={commitRunEveryNTurns}
            onKeyDown={e => {
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
            }}
            sx={{
              width: '80px',
              '& .MuiOutlinedInput-root': {
                height: '32px',
                fontSize: '0.875rem',
              },
            }}
          />
          <Typography variant="body2">turns</Typography>
        </Box>
        {agent.contextWindowStrategy === 'lastNMessages' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: 'fit-content', fontWeight: 500 }}
              >
                Context messages:
              </Typography>
              <Tooltip
                title="Number of recent messages to include when evaluating. The agent analyzes only the last N messages from the conversation."
                arrow
                placement="top"
              >
                <HelpOutlineIcon
                  sx={{
                    fontSize: '1rem',
                    color: 'text.secondary',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <TextField
              type="number"
              value={contextLastNInput}
              onChange={e => setContextLastNInput(e.target.value)}
              onBlur={commitContextLastN}
              onKeyDown={e => {
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
              }}
              sx={{
                width: '80px',
                '& .MuiOutlinedInput-root': {
                  height: '32px',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Typography variant="body2">messages</Typography>
          </Box>
        )}
        {agent.actionType === 'alert' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: 'fit-content', fontWeight: 500 }}
              >
                Verbosity threshold:
              </Typography>
              <Tooltip
                title="Rating represents quality/health (0-100, higher is better). Alerts are shown when rating ≤ threshold. Lower threshold = alerts only for very low ratings (fewer alerts). Higher threshold = alerts for more ratings (more alerts)."
                arrow
                placement="top"
              >
                <HelpOutlineIcon
                  sx={{
                    fontSize: '1rem',
                    color: 'text.secondary',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexGrow: 1,
                minWidth: { xs: '160px', sm: '220px' },
                maxWidth: 320,
              }}
            >
              <Slider
                value={localVerbosityThreshold}
                onChange={(_, value) => {
                  if (typeof value === 'number') {
                    setLocalVerbosityThreshold(value);
                  }
                }}
                onChangeCommitted={(_, value) => {
                  if (typeof value === 'number') {
                    applyVerbosityThreshold(value);
                  }
                }}
                min={DEFAULT_AGENT_CONFIG.MIN_THRESHOLD}
                max={DEFAULT_AGENT_CONFIG.MAX_THRESHOLD}
                step={1}
                valueLabelDisplay="auto"
                aria-label="Verbosity threshold"
                sx={{ flexGrow: 1 }}
              />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, minWidth: 'fit-content' }}
              >
                {localVerbosityThreshold}/100
              </Typography>
            </Box>
          </Box>
        )}
        {agent.actionType === 'update_document' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: 'fit-content', fontWeight: 500 }}
              >
                Output Document:
              </Typography>
              <Tooltip
                title="The document to update with the agent's output. Go to Background Agents to select a different document."
                arrow
                placement="top"
              >
                <HelpOutlineIcon
                  sx={{
                    fontSize: '1rem',
                    color: 'text.secondary',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <TextField
              value={agent.outputDocumentName || agent.outputDocumentId}
              disabled
              size="small"
              variant="outlined"
              sx={{ flexGrow: 1 }}
            />
          </Box>
        )}
      </Stack>

      {/* Expandable Alerts Section */}
      {recentAlerts.length > 0 && (
        <Collapse in={alertsExpanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Recent Alerts ({alerts.length} total)
            </Typography>
            <Stack spacing={1}>
              {recentAlerts.map(alert => {
                const colors = getSeverityColor(alert.severity);
                const parseError = alert.details?.parseError;
                const hasParseError = !!parseError;
                const showRawOutput = expandedRawOutput.has(alert.id);
                const showExecStatus = expandedExecStatus.has(alert.id);

                const isExpandedAlert = alert.id === alertIdToExpand;

                return (
                  <Paper
                    key={alert.id}
                    id={`alert-${alert.id}`}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: colors.bg,
                      borderColor: hasParseError ? 'error.main' : colors.border,
                      borderWidth: isExpandedAlert ? 3 : alert.read ? 1 : 2,
                      opacity: alert.read ? 0.7 : 1,
                      ...(isExpandedAlert && {
                        boxShadow: 4,
                        borderColor: colors.border,
                      }),
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 0.5,
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Chip
                          label={alert.severity.toUpperCase()}
                          size="small"
                          color={colors.chip as any}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Chip
                          label={`Rating: ${alert.rating}/100`}
                          size="small"
                          color={colors.chip as any}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {hasParseError && (
                          <Chip
                            label="Parse Error"
                            size="small"
                            color="error"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color={colors.text}>
                        {formatTimeAgo(new Date(alert.createdAt))}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: colors.text,
                        mt: 0.5,
                        mb: hasParseError ? 1 : 0,
                      }}
                    >
                      {alert.shortMessage
                        || alert.message
                        || 'Background agent alert'}
                    </Typography>
                    {alert.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: colors.text,
                          mt: 0.5,
                          fontSize: '0.875rem',
                        }}
                      >
                        {alert.description}
                      </Typography>
                    )}

                    {/* Action Buttons */}
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      {alert.messageId && onJumpToMessage && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<ArrowUpwardIcon />}
                          onClick={() => onJumpToMessage(alert.messageId!)}
                          sx={{
                            fontSize: '0.75rem',
                            backgroundColor: 'background.paper',
                            '&:hover': {
                              backgroundColor: 'primary.light', 
                              borderColor: 'primary.main', 
                            },
                          }}
                        >
                          Jump to Message
                        </Button>
                      )}
                    </Stack>

                    {/* Parse Error Debugging Section */}
                    {hasParseError && (
                      <Box
                        sx={{
                          mt: 1.5,
                          pt: 1.5,
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Alert severity="error" sx={{ mb: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, mb: 0.5 }}
                          >
                            Parse Error: {parseError.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            The model response could not be parsed. This may be
                            a transient error.
                          </Typography>
                        </Alert>
                        <Stack spacing={1} direction="row" sx={{ mb: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const newSet = new Set(expandedRawOutput);
                              if (showRawOutput) {
                                newSet.delete(alert.id);
                              } else {
                                newSet.add(alert.id);
                              }
                              setExpandedRawOutput(newSet);
                            }}
                            startIcon={
                              showRawOutput ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )
                            }
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {showRawOutput ? 'Hide' : 'Show'} Raw Output
                          </Button>
                          {parseError.execStatus && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const newSet = new Set(expandedExecStatus);
                                if (showExecStatus) {
                                  newSet.delete(alert.id);
                                } else {
                                  newSet.add(alert.id);
                                }
                                setExpandedExecStatus(newSet);
                              }}
                              startIcon={
                                showExecStatus ? (
                                  <ExpandLessIcon />
                                ) : (
                                  <ExpandMoreIcon />
                                )
                              }
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {showExecStatus ? 'Hide' : 'Show'} Execution
                              Status
                            </Button>
                          )}
                        </Stack>
                        <Collapse in={showRawOutput}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1,
                              backgroundColor: 'background.default',
                              mt: 1,
                              maxHeight: '200px',
                              overflow: 'auto',
                            }}
                          >
                            <Typography
                              variant="caption"
                              component="pre"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                m: 0,
                              }}
                            >
                              {parseError.rawOutput
                                || alert.rawModelOutput
                                || '(no output)'}
                            </Typography>
                          </Paper>
                        </Collapse>
                        {parseError.execStatus && (
                          <Collapse in={showExecStatus}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1,
                                backgroundColor: 'background.default',
                                mt: 1,
                                maxHeight: '300px',
                                overflow: 'auto',
                              }}
                            >
                              <Typography
                                variant="caption"
                                component="pre"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                  m: 0,
                                }}
                              >
                                {JSON.stringify(parseError.execStatus, null, 2)}
                              </Typography>
                            </Paper>
                          </Collapse>
                        )}
                      </Box>
                    )}
                  </Paper>
                );
              })}
              {alerts.length > 5 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mt: 0.5 }}
                >
                  Showing 5 of {alerts.length} alerts
                </Typography>
              )}
            </Stack>
          </Box>
        </Collapse>
      )}

      {recentAlerts.length === 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontStyle: 'italic', fontSize: '0.875rem' }}
          >
            No recent alerts
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// Helper function to generate user-friendly error messages and debug info
const getErrorMessage = (
  error: unknown,
  selectedModel?: string
): { userMessage: string; debugInfo: any } => {
  const debugInfo: any = {
    error: error,
    errorType: error?.constructor?.name,
    selectedModel,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof ApiError) {
    debugInfo.statusCode = error.status;
    debugInfo.errorData = error.data;

    // Handle specific HTTP status codes
    switch (error.status) {
      case 408: {
        // Timeout error handling with detailed debug info
        const timeoutData = error.data || {};
        const actualWaitTime =
          timeoutData.actualWaitTime || timeoutData.maxWaitTime || 'unknown';
        const pollCount = timeoutData.totalPolls || 'unknown';
        const lastStatus = timeoutData.lastKnownStatus?.status || 'unknown';
        const inputLength = timeoutData.inputLength || 'unknown';

        return {
          userMessage:
            'The request timed out. The model is taking longer than expected. Please try again with a shorter message.',
          debugInfo: {
            ...debugInfo,
            cause: 'Request timeout',
            timeoutDetails: {
              executionId: timeoutData.executionId,
              actualWaitTimeMs: actualWaitTime,
              maxWaitTimeMs: timeoutData.maxWaitTime,
              pollCount: pollCount,
              lastKnownStatus: lastStatus,
              inputLength: inputLength,
              inputPreview: timeoutData.inputPreview,
              pollingErrors: timeoutData.pollingErrors?.length || 0,
              timeoutReason: timeoutData.timeoutReason,
              startTime: timeoutData.startTime,
              endTime: timeoutData.endTime,
            },
          },
        };
      }
      case 401:
        return {
          userMessage:
            'Authentication failed. Please refresh the page and try again.',
          debugInfo: { ...debugInfo, cause: 'Authentication error' },
        };
      case 403: {
        // Check if this is the PAID_MEMBERSHIP_REQUIRED error from the gateway
        const errorData = error.data || {};
        if (errorData.error_code === 'PAID_MEMBERSHIP_REQUIRED') {
          return {
            userMessage:
              'You need a paid membership or a valid API key to use our models. Please upgrade your membership here: https://identity.firstdataunion.org/ or set your own AI provider API Key in the settings page.',
            debugInfo: {
              ...debugInfo,
              cause: 'Paid membership required',
              errorCode: errorData.error_code,
            },
          };
        }
        // Generic 403 for other access denied scenarios
        return {
          userMessage:
            "Access denied. You don't have permission to use this model. Please contact support.",
          debugInfo: { ...debugInfo, cause: 'Access denied' },
        };
      }
      case 404:
        return {
          userMessage:
            'The requested service is not available. Please try a different model or contact support.',
          debugInfo: { ...debugInfo, cause: 'Service not found' },
        };
      case 429:
        return {
          userMessage: 'Too many requests. Please wait a moment and try again.',
          debugInfo: { ...debugInfo, cause: 'Rate limit exceeded' },
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          userMessage:
            'Server error occurred. Please try again in a few moments.',
          debugInfo: { ...debugInfo, cause: 'Server error' },
        };
      default:
        return {
          userMessage: `API error (${error.status}). Please try again or contact support if the problem persists.`,
          debugInfo: { ...debugInfo, cause: 'API error' },
        };
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Handle specific error patterns
    if (message.includes('timeout') || message.includes('timed out')) {
      // Try to extract timeout details from the error message
      const timeoutMatch = message.match(/(\d+)s|(\d+)ms/);
      const timeoutValue = timeoutMatch
        ? timeoutMatch[1] || timeoutMatch[2]
        : 'unknown';

      return {
        userMessage:
          'The request timed out. Please try again with a shorter message or check your connection.',
        debugInfo: {
          ...debugInfo,
          cause: 'Timeout error',
          extractedTimeout: timeoutValue,
        },
      };
    }

    if (message.includes('network') || message.includes('connection')) {
      return {
        userMessage:
          'Network connection issue. Please check your internet connection and try again.',
        debugInfo: { ...debugInfo, cause: 'Network error' },
      };
    }

    if (
      message.includes('authentication')
      || message.includes('unauthorized')
    ) {
      return {
        userMessage:
          'Authentication failed. Please refresh the page and log in again.',
        debugInfo: { ...debugInfo, cause: 'Authentication error' },
      };
    }

    if (message.includes('unsupported model')) {
      return {
        userMessage: `The model "${selectedModel}" is not supported. Please select a different model.`,
        debugInfo: { ...debugInfo, cause: 'Unsupported model' },
      };
    }

    if (message.includes('profile id is required')) {
      return {
        userMessage:
          'Profile configuration error. Please refresh the page and try again.',
        debugInfo: { ...debugInfo, cause: 'Missing profile' },
      };
    }

    if (message.includes('no response received')) {
      return {
        userMessage:
          'No response from server. Please check your connection and try again.',
        debugInfo: { ...debugInfo, cause: 'No response' },
      };
    }

    // For known error messages, return them as-is
    if (
      message.includes('failed to complete')
      || message.includes('try again shortly')
    ) {
      return {
        userMessage: error.message,
        debugInfo: { ...debugInfo, cause: 'Model execution failed' },
      };
    }

    // Default for other errors
    return {
      userMessage:
        'An unexpected error occurred. Please try again or contact support if the problem persists.',
      debugInfo: { ...debugInfo, cause: 'Unknown error' },
    };
  }

  // Fallback for non-Error objects
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    debugInfo: { ...debugInfo, cause: 'Non-Error object' },
  };
};

// Modal Components
interface ContextSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onAddContext: (context: Context) => void;
  onRemoveContext: (contextId: string) => void;
  contexts: Context[];
  selectedContexts: Context[];
  loading: boolean;
  error: string | null;
  onCreateNewContext: () => void;
  onClearAllContexts?: () => void;
}

function ContextSelectionModal({
  open,
  onClose,
  onAddContext,
  onRemoveContext,
  contexts,
  selectedContexts,
  loading,
  error,
  onCreateNewContext,
  onClearAllContexts,
}: ContextSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'recent-desc' | 'recent-asc' | 'alpha-asc' | 'alpha-desc'
  >('recent-desc');
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const isContextSelected = (contextId: string) => {
    return selectedContexts.some(ctx => ctx.id === contextId);
  };

  const filteredAndSortedContexts = contexts
    .filter(
      context =>
        (context.title?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        || (context.body?.toLowerCase() || '').includes(
          searchQuery.toLowerCase()
        )
    )
    .sort((a, b) => {
      if (sortBy.startsWith('alpha')) {
        const comparison = (a.title || '').localeCompare(b.title || '');
        return sortBy === 'alpha-desc' ? -comparison : comparison;
      } else {
        // Sort by date (updatedAt takes precedence, fallback to createdAt)
        const aDate = new Date(a.updatedAt || a.createdAt);
        const bDate = new Date(b.updatedAt || b.createdAt);
        const comparison = bDate.getTime() - aDate.getTime();
        return sortBy === 'recent-asc' ? -comparison : comparison;
      }
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="span">
            Select Context
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={() => setHelpModalOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            <HelpOutlineIcon fontSize="small" />
            What are "Contexts"?
          </Link>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Currently Selected Contexts */}
          {selectedContexts.length > 0 && (
            <Box
              sx={{
                backgroundColor: 'primary.light',
                borderRadius: 2,
                p: 2,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: 'primary.dark',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CheckCircleIcon fontSize="small" />
                Currently Selected ({selectedContexts.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedContexts.map(context => (
                  <Box
                    key={context.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'background.paper',
                      borderRadius: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, mb: 0.5 }}
                      >
                        {truncateTitle(
                          context.title || 'Untitled Context',
                          RESOURCE_TITLE_MAX_LENGTH
                        )}
                      </Typography>
                      {context.body && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {context.body.length > 100
                            ? `${context.body.substring(0, 100)}...`
                            : context.body}
                        </Typography>
                      )}
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          mt: 0.5,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Chip
                          label={`${getContextTokenCount(context)} tokens`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => onRemoveContext(context.id)}
                      sx={{
                        minWidth: 'auto',
                        px: 1,
                        py: 0.5,
                        fontSize: '0.7rem',
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems="center"
          >
            <TextField
              fullWidth
              placeholder="Search contexts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 250 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                onChange={e =>
                  setSortBy(
                    e.target.value as
                      | 'recent-desc'
                      | 'recent-asc'
                      | 'alpha-asc'
                      | 'alpha-desc'
                  )
                }
                label="Sort by"
              >
                <MenuItem value="recent-desc">
                  Most Recent (Newest First)
                </MenuItem>
                <MenuItem value="recent-asc">Oldest First</MenuItem>
                <MenuItem value="alpha-asc">Alphabetical (A-Z)</MenuItem>
                <MenuItem value="alpha-desc">Alphabetical (Z-A)</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && filteredAndSortedContexts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery
                  ? 'No contexts match your search'
                  : 'No contexts available'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredAndSortedContexts.length > 0 && (
            <List>
              {filteredAndSortedContexts.map(context => {
                const isSelected = isContextSelected(context.id);
                return (
                  <ListItemButton
                    key={context.id}
                    divider
                    onClick={() => {
                      if (isSelected) {
                        onRemoveContext(context.id);
                      } else {
                        onAddContext(context);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 1,
                      mb: 1,
                      backgroundColor: isSelected
                        ? 'primary.light'
                        : 'transparent',
                      border: isSelected ? '1px solid' : 'none',
                      borderColor: isSelected ? 'primary.main' : 'transparent',
                      '&:hover': {
                        backgroundColor: isSelected
                          ? 'primary.light'
                          : 'action.hover',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        flexGrow: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {isSelected && (
                        <CheckCircleIcon color="primary" fontSize="small" />
                      )}
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography
                          variant="body1"
                          component="div"
                          sx={{ fontWeight: 500, mb: 1 }}
                          title={context.title || 'Untitled Context'}
                        >
                          {truncateTitle(
                            context.title || 'Untitled Context',
                            RESOURCE_TITLE_MAX_LENGTH
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          {context.body
                            ? context.body.length > 150
                              ? `${context.body.substring(0, 150)}...`
                              : context.body
                            : 'No content available'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`${getContextTokenCount(context)} tokens`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={new Date(
                              context.updatedAt || context.createdAt
                            ).toLocaleDateString()}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        </Box>
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      variant={isSelected ? 'outlined' : 'contained'}
                      onClick={e => {
                        e.stopPropagation();
                        if (isSelected) {
                          onRemoveContext(context.id);
                        } else {
                          onAddContext(context);
                        }
                      }}
                    >
                      {isSelected ? 'Remove' : 'Add'}
                    </Button>
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onCreateNewContext}
            sx={{
              '&:hover': {
                backgroundColor: 'primary.main', // ✅ Fills on hover
                color: 'primary.contrastText', // ✅ Use contrastText instead of 'white'
                borderColor: 'primary.dark',
              },
            }}
          >
            Create New Context
          </Button>
          {onClearAllContexts && selectedContexts.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={() => {
                onClearAllContexts();
              }}
              sx={{
                borderColor: 'error.main',
                color: 'error.main',
                '&:hover': {
                  backgroundColor: 'error.light',
                  color: 'white',
                  borderColor: 'error.dark',
                },
              }}
            >
              Clear All Contexts
            </Button>
          )}
        </Box>
        <Button onClick={onClose} color="primary">
          Done
        </Button>
      </DialogActions>

      {/* Help Modal */}
      <ContextHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </Dialog>
  );
}

interface SystemPromptSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSystemPrompt: (systemPrompt: SystemPrompt) => void;
  systemPrompts: SystemPrompt[];
  selectedSystemPrompts: SystemPrompt[];
  onRemoveSystemPrompt: (promptId: string) => void;
  onOpenLibrarianWizard: () => void;
  loading: boolean;
  error: string | null;
  title?: string;
}

function SystemPromptSelectionModal({
  open,
  onClose,
  onSelectSystemPrompt,
  systemPrompts,
  selectedSystemPrompts,
  onRemoveSystemPrompt,
  onOpenLibrarianWizard,
  loading,
  error,
  title = 'Add System Prompt',
}: SystemPromptSelectionModalProps) {
  const { isMobile } = useMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const filteredSystemPrompts = systemPrompts.filter(sp => {
    // Text search filter
    const matchesText =
      sp.name.toLowerCase().includes(searchQuery.toLowerCase())
      || (sp.description
        && sp.description.toLowerCase().includes(searchQuery.toLowerCase()))
      || (sp.categories
        && sp.categories.some(cat =>
          cat.toLowerCase().includes(searchQuery.toLowerCase())
        ));

    // Category filter
    const matchesCategory =
      selectedCategories.length === 0
      || (sp.categories
        && sp.categories.some(cat => selectedCategories.includes(cat)));

    return matchesText && matchesCategory;
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="span">
            {title}
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={() => setHelpModalOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            <HelpOutlineIcon fontSize="small" />
            What are "System Prompts"?
          </Link>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Librarian Button - Only show on mobile */}
          {isMobile && (
            <Button
              variant="outlined"
              startIcon={<MenuBookIcon />}
              onClick={onOpenLibrarianWizard}
              sx={{
                borderRadius: 2,
                py: 1.5,
                fontSize: '0.875rem',
                backgroundColor: 'background.paper',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText',
                },
              }}
            >
              Ask the System Prompt Librarian
            </Button>
          )}

          {/* Currently Selected System Prompts */}
          {selectedSystemPrompts.length > 0 && (
            <Box
              sx={{
                backgroundColor: 'primary.light',
                borderRadius: 2,
                p: 2,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  mb: 1.5,
                  color: 'primary.dark',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CheckCircleIcon fontSize="small" />
                Currently Selected ({selectedSystemPrompts.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedSystemPrompts.map(prompt => (
                  <Box
                    key={prompt.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'background.paper',
                      borderRadius: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, mb: 0.5 }}
                      >
                        {prompt.name}
                      </Typography>
                      {prompt.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {prompt.description}
                        </Typography>
                      )}
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          mt: 0.5,
                          flexWrap: 'wrap',
                        }}
                      >
                        {prompt.categories && prompt.categories.length > 0 && (
                          <Chip
                            label={prompt.categories.join(', ')}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                        <Chip
                          label={`${prompt.tokenCount} tokens`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => onRemoveSystemPrompt(prompt.id)}
                      sx={{
                        minWidth: 'auto',
                        px: 1,
                        py: 0.5,
                        fontSize: '0.7rem',
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            placeholder="Search system prompts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <CategoryFilter
            systemPrompts={systemPrompts}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            placeholder="Filter by category"
            size="small"
            fullWidth
          />

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && filteredSystemPrompts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery
                  ? 'No system prompts match your search'
                  : 'No system prompts available'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredSystemPrompts.length > 0 && (
            <List>
              {filteredSystemPrompts.map(systemPrompt => (
                <ListItemButton
                  key={systemPrompt.id}
                  divider
                  onClick={() => onSelectSystemPrompt(systemPrompt)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="body1"
                        component="div"
                        sx={{ fontWeight: 500 }}
                      >
                        {systemPrompt.name}
                      </Typography>
                      {systemPrompt.isDefault && (
                        <Chip label="Default" size="small" color="primary" />
                      )}
                    </Box>
                    {systemPrompt.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {systemPrompt.description}
                      </Typography>
                    )}
                    <Box
                      sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}
                    >
                      {systemPrompt.categories
                        && systemPrompt.categories.length > 0 && (
                          <Chip
                            label={systemPrompt.categories.join(', ')}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        )}
                      <Chip
                        label={`${systemPrompt.tokenCount} tokens`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectSystemPrompt(systemPrompt);
                    }}
                  >
                    Select
                  </Button>
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: isMobile ? 2 : 1 }}>
        <Button
          onClick={onClose}
          size={isMobile ? 'large' : 'medium'}
          sx={{
            color: 'primary.dark',
            minWidth: isMobile ? 100 : 80,
          }}
        >
          Cancel
        </Button>
      </DialogActions>

      {/* Help Modal */}
      <SystemPromptHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </Dialog>
  );
}

interface FullPromptModalProps {
  open: boolean;
  onClose: () => void;
  fullPrompt: string;
}

function FullPromptModal({ open, onClose, fullPrompt }: FullPromptModalProps) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      // You could add a success toast here
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullPrompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, [fullPrompt]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Full Prompt</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          rows={10}
          variant="outlined"
          value={fullPrompt}
          InputProps={{
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <ChatIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'background.paper',
              boxShadow: 1,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCopy} color="primary">
          Copy
        </Button>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PromptLabPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  // Mobile responsiveness
  const { isMobile } = useMobile();
  const spacing = useResponsiveSpacing();

  // Redux state
  const { currentPrompt } = useAppSelector(state => state.promptLab);
  const { currentProfile } = useAppSelector(state => state.auth);
  const {
    items: contexts,
    loading: contextsLoading,
    error: contextsError,
  } = useAppSelector(state => state.contexts);
  const {
    items: systemPrompts,
    loading: systemPromptsLoading,
    error: systemPromptsError,
  } = useAppSelector(state => state.systemPrompts);
  const { settings } = useAppSelector(state => state.settings);
  const { items: documents } = useAppSelector(state => state.documents);
  const unifiedStorage = useUnifiedStorage();
  const isSystemPromptsEnabled = useFeatureFlag('system_prompts');
  const isModelSelectionEnabled = useFeatureFlag('model_selection');
  const isContextsEnabled = useFeatureFlag('context');
  const isViewCopyFullPromptEnabled = useFeatureFlag('view_copy_full_prompt');
  const isRecentConversationsInChatPageEnabled = useFeatureFlag(
    'recent_conversations_in_chat_page'
  );
  const isNewChatButtonInChatPageEnabled = useFeatureFlag(
    'new_chat_button_in_chat_page'
  );
  const isBackgroundAgentsEnabled = useFeatureFlag('background_agents');
  const isPromptWizardEnabled = useFeatureFlag('prompt_wizard');
  const isSystemPromptLibrarianEnabled = useFeatureFlag(
    'system_prompt_librarian'
  );

  // Persistence keys for sessionStorage (memoized to prevent recreation)
  const STORAGE_KEYS = useMemo(
    () => ({
      messages: 'promptlab_messages',
      conversation: 'promptlab_conversation',
      context: 'promptlab_context',
      systemPrompts: 'promptlab_system_prompts',
    }),
    []
  );

  // Helper functions for persistence
  const saveToSession = useCallback((key: string, data: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error);
    }
  }, []);

  const loadFromSession = useCallback((key: string) => {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to load from sessionStorage:', error);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      (Object.values(STORAGE_KEYS) as string[]).forEach(key =>
        sessionStorage.removeItem(key)
      );
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error);
    }
  }, [STORAGE_KEYS]);

  // State for the chat interface - initialize from sessionStorage
  const [messages, setMessages] = useState<Message[]>(
    () => loadFromSession(STORAGE_KEYS.messages) || []
  );
  const [selectedModel, setSelectedModel] = useState(
    settings.lastUsedModel || 'auto-router'
  );
  const [selectedContexts, setSelectedContexts] = useState<Context[]>(() => {
    const STORAGE_KEYS_TEMP = {
      context: 'promptlab_context',
    };
    try {
      const data = loadFromSession(STORAGE_KEYS_TEMP.context);
      if (!data) return [];
      // Backward compatibility: if it's a single context object (not array), wrap it in an array
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object') {
        // Single context object - convert to array
        return [data];
      }
      return [];
    } catch (error) {
      console.warn('Failed to load contexts from sessionStorage:', error);
      return [];
    }
  });
  const [selectedSystemPrompts, setSelectedSystemPrompts] = useState<
    SystemPrompt[]
  >(() => loadFromSession(STORAGE_KEYS.systemPrompts) || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostMessages, setGhostMessages] = useState<Record<string, Message[]>>(
    {}
  );

  // Mobile-specific state
  const [showMobileControls, setShowMobileControls] = useState(false);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMinimized, setWizardMinimized] = useState(false);
  const [wizardMessages, setWizardMessages] = useState<WizardMessage[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardInitialMessage, setWizardInitialMessage] = useState<string>('');

  // System Prompt Suggestor Wizard state
  const [systemPromptSuggestorOpen, setSystemPromptSuggestorOpen] =
    useState(false);
  const [systemPromptSuggestorMinimized, setSystemPromptSuggestorMinimized] =
    useState(false);
  const [systemPromptSuggestorMessages, setSystemPromptSuggestorMessages] =
    useState<WizardMessage[]>([]);
  const [systemPromptSuggestorLoading, setSystemPromptSuggestorLoading] =
    useState(false);
  const [systemPromptSuggestorError, setSystemPromptSuggestorError] = useState<
    string | null
  >(null);
  const [
    systemPromptSuggestorInitialMessage,
    setSystemPromptSuggestorInitialMessage,
  ] = useState<string>('');

  // Background Agents state
  const [backgroundAgentsDialogOpen, setBackgroundAgentsDialogOpen] =
    useState(false);
  const [backgroundAgents, setBackgroundAgents] = useState<BackgroundAgent[]>(
    []
  );
  const [backgroundAgentsLoading, setBackgroundAgentsLoading] = useState(false);
  const [backgroundAgentsPrefsVersion, setBackgroundAgentsPrefsVersion] =
    useState(0);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [alertToExpand, setAlertToExpand] = useState<string | null>(null); // Alert ID to auto-expand when modal opens
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [backgroundAgentsEvaluating, setBackgroundAgentsEvaluating] =
    useState(false);

  // Set up alert click handler for the toaster
  const alertClickContext = useAlertClick();
  useEffect(() => {
    if (alertClickContext?.setOnAlertClick) {
      alertClickContext.setOnAlertClick((alertId: string) => {
        setAlertToExpand(alertId);
        setBackgroundAgentsDialogOpen(true);
      });
    }
    // Cleanup: clear the handler when component unmounts
    return () => {
      if (alertClickContext?.setOnAlertClick) {
        alertClickContext.setOnAlertClick(null);
      }
    };
  }, [alertClickContext]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(
      () => loadFromSession(STORAGE_KEYS.conversation) || null
    );
  const [isSavingConversation, setIsSavingConversation] = useState(false);

  // Update selectedModel when settings change (e.g., when settings are loaded from localStorage)
  useEffect(() => {
    if (settings.lastUsedModel && settings.lastUsedModel !== selectedModel) {
      setSelectedModel(settings.lastUsedModel);
    }
  }, [settings.lastUsedModel, selectedModel]);

  // Load background agents when dialog opens
  useEffect(() => {
    if (backgroundAgentsDialogOpen && currentProfile?.id) {
      const loadAgents = async () => {
        setBackgroundAgentsLoading(true);
        try {
          const storage = getUnifiedStorageService();
          const profileId = currentProfile.id;

          // Load custom agents from storage
          const { backgroundAgents: customAgents } =
            await storage.getBackgroundAgents(undefined, 1, 20, profileId);
          const filteredCustom = (customAgents || []).filter(
            (a: BackgroundAgent) => !a.isSystem && a.enabled
          );

          // Transform built-in agents with preferences
          const storedPrefs = loadAgentPreferences();
          const builtInAgents = BUILT_IN_BACKGROUND_AGENTS.map(template => {
            const agentId = `built-in-${template.name.toLowerCase().replace(/\s+/g, '-')}`;
            const userPrefs = storedPrefs[agentId];
            return {
              id: agentId,
              name: template.name,
              description: template.description,
              enabled: userPrefs?.enabled ?? true,
              actionType: template.actionType,
              promptTemplate: template.promptTemplate,
              runEveryNTurns:
                userPrefs?.runEveryNTurns ?? template.runEveryNTurns,
              verbosityThreshold:
                userPrefs?.verbosityThreshold ?? template.verbosityThreshold,
              contextWindowStrategy: template.contextWindowStrategy,
              contextParams:
                template.contextWindowStrategy === 'lastNMessages'
                && userPrefs?.contextLastN !== undefined
                  ? { ...template.contextParams, lastN: userPrefs.contextLastN }
                  : template.contextParams,
              outputSchemaName: template.outputSchemaName,
              customOutputSchema: template.customOutputSchema,
              notifyChannel: template.notifyChannel,
              modelId: userPrefs?.modelId ?? template.modelId ?? 'gpt-oss-120b',
              isSystem: true,
              categories: template.categories || [],
              version: template.version,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as BackgroundAgent;
          });

          // Combine and filter for enabled agents
          const allAgents = [...builtInAgents, ...filteredCustom];
          setBackgroundAgents(allAgents);

          // Refresh unread count when dialog opens (filtered by current conversation)
          setUnreadAlertCount(
            currentConversation?.id
              ? getUnreadAlertCount(currentConversation.id)
              : 0
          );
        } catch (error) {
          console.error('Error loading background agents:', error);
        } finally {
          setBackgroundAgentsLoading(false);
        }
      };
      void loadAgents();
    }
  }, [
    backgroundAgentsDialogOpen,
    currentProfile?.id,
    backgroundAgentsPrefsVersion,
    currentConversation?.id,
  ]);

  const handleUpdateBackgroundAgentPreference = useCallback(
    async (
      agentId: string,
      prefs: {
        runEveryNTurns: number;
        verbosityThreshold?: number;
        contextLastN?: number;
        outputDocumentId?: string;
      }
    ) => {
      // Find the agent to determine if it's built-in or custom
      const agent = backgroundAgents.find(a => a.id === agentId);

      if (!agent) {
        console.warn(`Agent ${agentId} not found`);
        return;
      }

      if (agent.isSystem) {
        // Built-in agents: save preferences to localStorage
        const prefsToSave: Partial<BackgroundAgentPreferences> = {
          runEveryNTurns: prefs.runEveryNTurns,
          verbosityThreshold: prefs.verbosityThreshold,
        };
        if (prefs.contextLastN !== undefined) {
          prefsToSave.contextLastN = prefs.contextLastN;
        }
        setAgentPreference(agentId, prefsToSave);
        setBackgroundAgentsPrefsVersion(prev => prev + 1);

        // Update local state for built-in agents
        setBackgroundAgents(prev =>
          prev.map(a =>
            a.id === agentId
              ? {
                  ...a,
                  runEveryNTurns: prefs.runEveryNTurns,
                  verbosityThreshold: prefs.verbosityThreshold,
                  contextParams:
                    a.contextWindowStrategy === 'lastNMessages'
                    && prefs.contextLastN !== undefined
                      ? { ...a.contextParams, lastN: prefs.contextLastN }
                      : a.contextParams,
                }
              : a
          )
        );
      } else {
        // Custom agents: update in storage
        try {
          const storage = getUnifiedStorageService();
          if (!currentProfile?.id) {
            console.warn('No profile ID available for updating custom agent');
            return;
          }

          const updatedAgent: BackgroundAgent = {
            ...agent,
            runEveryNTurns: prefs.runEveryNTurns,
            verbosityThreshold: prefs.verbosityThreshold,
            contextParams:
              agent.contextWindowStrategy === 'lastNMessages'
              && prefs.contextLastN
                ? { ...agent.contextParams, lastN: prefs.contextLastN }
                : agent.contextParams,
            updatedAt: new Date().toISOString(),
          };

          await storage.updateBackgroundAgent(updatedAgent, currentProfile.id);
          console.log(`✅ Updated custom agent ${agent.name} in storage`);

          // Reload agents to ensure we have the latest data from storage
          // This ensures any other fields that might have been updated are reflected
          const { backgroundAgents: reloadedAgents } =
            await storage.getBackgroundAgents(
              undefined,
              1,
              20,
              currentProfile.id
            );
          const filteredCustom = (reloadedAgents || []).filter(
            (a: BackgroundAgent) => !a.isSystem && a.enabled
          );

          // Reload built-in agents with preferences
          const storedPrefs = loadAgentPreferences();
          const builtInAgents = BUILT_IN_BACKGROUND_AGENTS.map(template => {
            const agentId = `built-in-${template.name.toLowerCase().replace(/\s+/g, '-')}`;
            const userPrefs = storedPrefs[agentId];
            return {
              id: agentId,
              name: template.name,
              description: template.description,
              enabled: userPrefs?.enabled ?? true,
              actionType: template.actionType,
              promptTemplate: template.promptTemplate,
              runEveryNTurns:
                userPrefs?.runEveryNTurns ?? template.runEveryNTurns,
              verbosityThreshold:
                userPrefs?.verbosityThreshold ?? template.verbosityThreshold,
              contextWindowStrategy: template.contextWindowStrategy,
              contextParams:
                template.contextWindowStrategy === 'lastNMessages'
                && userPrefs?.contextLastN !== undefined
                  ? { ...template.contextParams, lastN: userPrefs.contextLastN }
                  : template.contextParams,
              outputSchemaName: template.outputSchemaName,
              customOutputSchema: template.customOutputSchema,
              notifyChannel: template.notifyChannel,
              modelId: userPrefs?.modelId ?? template.modelId ?? 'gpt-oss-120b',
              isSystem: true,
              categories: template.categories || [],
              version: template.version,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as BackgroundAgent;
          });

          // Update with reloaded agents
          setBackgroundAgents([...builtInAgents, ...filteredCustom]);
        } catch (error) {
          console.error(`Failed to update custom agent ${agentId}:`, error);
          // Still update local state for better UX even if storage fails
          setBackgroundAgents(prev =>
            prev.map(a =>
              a.id === agentId
                ? {
                    ...a,
                    runEveryNTurns: prefs.runEveryNTurns,
                    verbosityThreshold: prefs.verbosityThreshold,
                    contextParams:
                      a.contextWindowStrategy === 'lastNMessages'
                      && prefs.contextLastN !== undefined
                        ? { ...a.contextParams, lastN: prefs.contextLastN }
                        : a.contextParams,
                  }
                : a
            )
          );
        }
      }
    },
    [backgroundAgents, currentProfile?.id]
  );

  // Jump to message handler - scrolls to message and closes modal
  const handleJumpToMessage = useCallback((messageId: string) => {
    // Close the background agents dialog
    setBackgroundAgentsDialogOpen(false);

    // Small delay to ensure dialog is closed before scrolling
    setTimeout(() => {
      // Find the message element
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        // Add a highlight effect
        messageElement.style.transition = 'box-shadow 0.3s ease';
        messageElement.style.boxShadow = '0 0 20px rgba(25, 118, 210, 0.5)';
        setTimeout(() => {
          messageElement.style.boxShadow = '';
        }, 2000);
      } else {
        console.warn(`Message ${messageId} not found in DOM`);
      }
    }, 100);
  }, []);

  // System Prompts Management
  const [systemPromptDrawerOpen, setSystemPromptDrawerOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleRemoveSystemPrompt = (promptId: string) => {
    setSelectedSystemPrompts(prev => prev.filter(sp => sp.id !== promptId));
  };

  const handleChangeSystemPrompt = (prompt: SystemPrompt) => {
    setChangingSystemPrompt(prompt);
    setSystemPromptModalOpen(true);
  };

  // Helper function to restore system prompts and contexts from a conversation
  const restoreConversationSettings = useCallback(
    (conversation: Conversation) => {
      if (conversation.originalPrompt) {
        if (
          conversation.originalPrompt.systemPrompts
          && conversation.originalPrompt.systemPrompts.length > 0
        ) {
          setSelectedSystemPrompts(conversation.originalPrompt.systemPrompts);
        } else if (conversation.originalPrompt.systemPrompt) {
          // Backward compatibility: single system prompt
          setSelectedSystemPrompts([conversation.originalPrompt.systemPrompt]);
        }

        // Restore contexts
        if (
          conversation.originalPrompt.contexts
          && Array.isArray(conversation.originalPrompt.contexts)
        ) {
          setSelectedContexts(conversation.originalPrompt.contexts);
        } else if (conversation.originalPrompt.context) {
          // Backward compatibility: single context
          setSelectedContexts([conversation.originalPrompt.context]);
        } else {
          setSelectedContexts([]);
        }

        // Embellishments removed
      }
    },
    []
  );

  // Measure drawer height when it opens or content changes
  useEffect(() => {
    if (systemPromptDrawerOpen && drawerRef.current) {
      const height = drawerRef.current.offsetHeight;
      setDrawerHeight(height);
    }
  }, [systemPromptDrawerOpen, selectedSystemPrompts]);

  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Check if user has scrolled up
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const isScrolledUp = scrollTop + clientHeight < scrollHeight - 100; // Show button if scrolled up more than 100px
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // Consider at bottom if within 10px

      setShowScrollToBottom(isScrolledUp);
      setIsAtBottom(atBottom);
    }
  }, []);

  useEffect(() => {
    // Only auto-scroll if user is already at the bottom
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isAtBottom]);

  // Helper function to get provider key from model ID
  const getProviderKey = (modelId: string): 'autoRouter' | 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'microsoft' | 'xai' | 'unknown' => {
    const modelLower = modelId.toLowerCase();
    if (modelLower.includes('auto-router') || modelLower.includes('autorouter')) return 'autoRouter';
    if (modelLower.includes('gpt') || modelLower.includes('openai')) return 'openai';
    if (modelLower.includes('claude') || modelLower.includes('anthropic')) return 'anthropic';
    if (modelLower.includes('gemini') || modelLower.includes('google')) return 'google';
    if (modelLower.includes('llama') || modelLower.includes('meta')) return 'meta';
    if (modelLower.includes('mistral')) return 'mistral';
    if (modelLower.includes('phi') || modelLower.includes('microsoft')) return 'microsoft';
    if (modelLower.includes('grok') || modelLower.includes('xai')) return 'xai';
    return 'unknown';
  };

  // Get model-specific colors and display names
  const getModelInfo = (
    modelId: string,
    actualModelInfo?: ActualModelInfo | null
  ) => {
    const modelMap: Record<
      string,
      { name: string; color: string; provider: string }
    > = {
      // Auto Router
      'auto-router': {
        name: 'Auto Router',
        color: getModelColor(theme.palette.mode, 'autoRouter'),
        provider: 'NLP Workbench',
      },

      // OpenAI Models
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-3.5-turbo-instruct': {
        name: 'GPT-3.5 Turbo Instruct',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4': { name: 'GPT-4', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4o': { name: 'GPT-4o', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-4o-search-preview': {
        name: 'GPT-4o Search Preview',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4o-mini-search-preview': {
        name: 'GPT-4o Mini Search Preview',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5': { name: 'GPT-5', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-5-mini': {
        name: 'GPT-5 Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5-nano': {
        name: 'GPT-5 Nano',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5-pro': { name: 'GPT-5 Pro', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-oss-120b': {
        name: 'GPT-OSS 120B',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },

      // Anthropic Claude Models
      'claude-haiku-3': {
        name: 'Claude Haiku 3',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-haiku-3.5': {
        name: 'Claude Haiku 3.5',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-haiku-4.5': {
        name: 'Claude Haiku 4.5',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-opus-4': {
        name: 'Claude Opus 4',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-opus-4.1': {
        name: 'Claude Opus 4.1',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-opus-4.6': {
        name: 'Claude Opus 4.6',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-sonnet-3.7': {
        name: 'Claude Sonnet 3.7',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-sonnet-4': {
        name: 'Claude Sonnet 4',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-sonnet-4.5': {
        name: 'Claude Sonnet 4.5',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },

      // Google Gemini Models
      'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-2.0-flash-lite': {
        name: 'Gemini 2.0 Flash-Lite',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-2.5-flash-lite': {
        name: 'Gemini 2.5 Flash-Lite',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-3-pro-preview': {
        name: 'Gemini 3 Pro Preview',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },

      // Meta Llama Models
      'llama-4-maverick': {
        name: 'Llama 4 Maverick',
        color: getModelColor(theme.palette.mode, 'meta'),
        provider: 'Meta',
      },
      'llama-4-scout': {
        name: 'Llama 4 Scout',
        color: getModelColor(theme.palette.mode, 'meta'),
        provider: 'Meta',
      },

      // Mistral Models
      'mistral-medium-3.1': {
        name: 'Mistral Medium 3.1',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-codestral-2508': {
        name: 'Mistral Codestral 2508',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-ministral-3b': {
        name: 'Mistral Ministral 3B',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-ministral-8b': {
        name: 'Mistral Ministral 8B',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-small': {
        name: 'Mistral Small',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-tiny': {
        name: 'Mistral Tiny',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },
      'mistral-large': {
        name: 'Mistral Large',
        color: getModelColor(theme.palette.mode, 'mistral'),
        provider: 'Mistral',
      },

      // Microsoft Phi Models
      'microsoft-phi-4': {
        name: 'Microsoft Phi 4',
        color: getModelColor(theme.palette.mode, 'microsoft'),
        provider: 'Microsoft',
      },
      'microsoft-phi-4-multimodal': {
        name: 'Microsoft Phi 4 Multimodal',
        color: getModelColor(theme.palette.mode, 'microsoft'),
        provider: 'Microsoft',
      },
      'microsoft-phi-4-reasoning-plus': {
        name: 'Microsoft Phi 4 Reasoning Plus',
        color: getModelColor(theme.palette.mode, 'microsoft'),
        provider: 'Microsoft',
      },

      // xAI Grok Models
      'grok-3': { name: 'Grok 3', color: getModelColor(theme.palette.mode, 'xai'), provider: 'xAI' },
      'grok-3-mini': { name: 'Grok 3 Mini', color: getModelColor(theme.palette.mode, 'xai'), provider: 'xAI' },
      'grok-4': { name: 'Grok 4', color: getModelColor(theme.palette.mode, 'xai'), provider: 'xAI' },
      'grok-4-fast': { name: 'Grok 4 Fast', color: getModelColor(theme.palette.mode, 'xai'), provider: 'xAI' },

      // Direct Models (Google)
      'gemini-2.5-flash-lite-direct': {
        name: 'Gemini 2.5 Flash Lite',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-2.0-flash-direct': {
        name: 'Gemini 2.0 Flash',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },

      // Direct Models (Anthropic)
      'claude-opus-4.1-direct': {
        name: 'Claude Opus 4.1',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-haiku-3-direct': {
        name: 'Claude Haiku 3',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-sonnet-3.7-direct': {
        name: 'Claude Sonnet 3.7',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },

      // Direct Models (OpenAI)
      'gpt-5-nano-direct': {
        name: 'GPT 5.0 Nano',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5-mini-direct': {
        name: 'GPT 5.0 Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5-direct': { name: 'GPT 5.0', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-4o-mini-direct': {
        name: 'GPT 4.0 Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4-direct': { name: 'GPT 4.0', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-4-turbo-direct': {
        name: 'GPT 4.0 Turbo',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-3.5-turbo-direct': {
        name: 'GPT 3.5 Turbo',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4o-search-preview-direct': {
        name: 'GPT 4o Search',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },

      // Legacy mappings for backward compatibility
      'gemini-flash': {
        name: 'Gemini Flash',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'gemini-pro': {
        name: 'Gemini Pro',
        color: getModelColor(theme.palette.mode, 'google'),
        provider: 'Google',
      },
      'claude-haiku': {
        name: 'Claude Haiku',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-sonnet': {
        name: 'Claude Sonnet',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'claude-opus-41': {
        name: 'Claude Opus',
        color: getModelColor(theme.palette.mode, 'anthropic'),
        provider: 'Anthropic',
      },
      'gpt-4.0': { name: 'GPT-4.0', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-4.0-turbo': {
        name: 'GPT-4.0 Turbo',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-4.0-mini': {
        name: 'GPT-4.0 Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5.0': { name: 'GPT-5.0', color: getModelColor(theme.palette.mode, 'openai'), provider: 'OpenAI' },
      'gpt-5.0-mini': {
        name: 'GPT-5.0 Mini',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
      'gpt-5.0-nano': {
        name: 'GPT-5.0 Nano',
        color: getModelColor(theme.palette.mode, 'openai'),
        provider: 'OpenAI',
      },
    };

    // If modelId is missing or unknown, fall back to primary colors
    if (!modelId || modelId === 'unknown' || modelId === 'other') {
      const providerKey = getProviderKey(modelId || 'unknown');
      const fallback = {
        name: 'AI Assistant',
        color: getModelColor(theme.palette.mode, providerKey),
        provider: 'Unknown',
      };
      if (actualModelInfo) {
        return {
          ...fallback,
          name: actualModelInfo.modelDisplay?.trim() || fallback.name,
          provider:
            actualModelInfo.providerDisplay?.trim() || fallback.provider,
        };
      }
      return fallback;
    }

    const providerKey = getProviderKey(modelId);
    const baseInfo = modelMap[modelId] || {
      name: modelId,
      color: getModelColor(theme.palette.mode, providerKey),
      provider: 'Unknown',
    };

    if (actualModelInfo) {
      return {
        ...baseInfo,
        name: actualModelInfo.modelDisplay?.trim() || baseInfo.name,
        provider: actualModelInfo.providerDisplay?.trim() || baseInfo.provider,
      };
    }

    return baseInfo;
  };

  // State for the right sidebar
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState<
    Conversation[]
  >([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Modal states
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
  const [fullPromptModalOpen, setFullPromptModalOpen] = useState(false);
  const [createContextModalOpen, setCreateContextModalOpen] = useState(false);

  // System prompt change state
  const [changingSystemPrompt, setChangingSystemPrompt] =
    useState<SystemPrompt | null>(null);

  // Create context form state
  const [contextForm, setContextForm] = useState({
    title: '',
    body: '',
    tags: [],
  });
  const [isCreatingContext, setIsCreatingContext] = useState(false);

  // Toast notification state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Long request detection state
  const [longRequestAnalysis, setLongRequestAnalysis] =
    useState<LongRequestAnalysis | null>(null);
  const [showLongRequestWarning, setShowLongRequestWarning] = useState(false);
  const [_requestStartTime, setRequestStartTime] = useState<number | null>(
    null
  );
  const promptAbortController = useRef<AbortController | null>(null);

  // Show toast message
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  }, []);

  // Get conversation ID for filtering alerts
  const currentConversationId = currentConversation?.id;

  // Update unread count whenever conversation changes
  useEffect(() => {
    // Update unread count based on current conversation (or all if no conversation)
    const updateUnreadCount = () => {
      const count = currentConversationId
        ? getUnreadAlertCount(currentConversationId)
        : 0; // No unread count for new/unsaved conversations
      setUnreadAlertCount(count);
    };

    // Initial update
    updateUnreadCount();

    // Subscribe to new alerts - update count when alerts are created or marked as read
    const unsubscribe = subscribeToAgentAlerts(() => {
      updateUnreadCount();
    });

    // Periodic updates to catch any changes
    const interval = setInterval(updateUnreadCount, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentConversationId]); // Re-run when conversation changes

  // Load contexts and system prompts
  useEffect(() => {
    if (currentProfile) {
      dispatch(fetchContexts(currentProfile.id)).catch(error => {
        console.log(
          'Initial contexts fetch failed, will retry when auth completes:',
          error
        );
      });
      dispatch(fetchSystemPrompts(currentProfile.id)).catch(error => {
        console.log(
          'Initial system prompts fetch failed, will retry when auth completes:',
          error
        );
      });
    }
  }, [currentProfile, dispatch, unifiedStorage.googleDrive.isAuthenticated]);

  // Set default system prompt when loaded
  useEffect(() => {
    if (systemPrompts.length > 0 && selectedSystemPrompts.length === 0) {
      const defaultPrompt =
        systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompts([defaultPrompt]);
      }
    }
  }, [systemPrompts, selectedSystemPrompts]);

  // Load recent conversations
  const loadRecentConversations = useCallback(async () => {
    if (!currentProfile) return;

    setLoadingConversations(true);
    try {
      const response = await conversationsService.getAll(
        {},
        1,
        5,
        currentProfile.id
      );
      setRecentConversations(response.conversations);
    } catch (error: any) {
      // Check if this is a storage initialization timing issue
      if (
        error.message?.includes('Cloud storage adapter not initialized')
        || error.message?.includes('Cloud storage not fully initialized')
      ) {
        console.warn(
          'Storage not ready for recent conversations, will skip for now'
        );
        setRecentConversations([]);
      } else {
        console.error('Error loading recent conversations:', error);
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [currentProfile]);

  useEffect(() => {
    loadRecentConversations();
  }, [loadRecentConversations]);

  // Persist conversation state to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      saveToSession(STORAGE_KEYS.messages, messages);
    }
  }, [messages, saveToSession, STORAGE_KEYS.messages]);

  useEffect(() => {
    if (currentConversation) {
      saveToSession(STORAGE_KEYS.conversation, currentConversation);
    }
  }, [currentConversation, saveToSession, STORAGE_KEYS.conversation]);

  useEffect(() => {
    if (selectedContexts.length > 0) {
      saveToSession(STORAGE_KEYS.context, selectedContexts);
    } else {
      // Clear contexts from sessionStorage when all contexts are cleared
      try {
        sessionStorage.removeItem(STORAGE_KEYS.context);
      } catch (error) {
        console.warn('Failed to clear contexts from sessionStorage:', error);
      }
    }
  }, [selectedContexts, saveToSession, STORAGE_KEYS.context]);

  useEffect(() => {
    if (selectedSystemPrompts.length > 0) {
      saveToSession(STORAGE_KEYS.systemPrompts, selectedSystemPrompts);
    }
  }, [selectedSystemPrompts, saveToSession, STORAGE_KEYS.systemPrompts]);

  // Handle conversation loading when navigating from conversations page
  useEffect(() => {
    if (location.state?.loadConversation && location.state?.conversationId) {
      const loadConversationFromState = async () => {
        try {
          const conversationId = location.state.conversationId;
          // Get messages for the conversation
          const messages =
            await conversationsService.getMessages(conversationId);

          // Use the complete conversation object from navigation state
          if (location.state.conversation) {
            setCurrentConversation(location.state.conversation);
            setMessages(messages);

            // Restore system prompts from the conversation
            if (location.state.conversation.originalPrompt) {
              restoreConversationSettings(location.state.conversation);
            }

            // Update unread alert count for this conversation
            setUnreadAlertCount(getUnreadAlertCount(conversationId));

            // Clear the navigation state to prevent reloading on subsequent renders
            navigate('/prompt-lab', { replace: true });
          } else {
            // Fallback: create a minimal conversation object
            const conversation: Conversation = {
              id: conversationId,
              title: location.state.conversationTitle || 'Conversation',
              platform: location.state.platform || 'other',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessage:
                messages.length > 0
                  ? messages[messages.length - 1].content
                  : '',
              messageCount: messages.length,
              tags: location.state.tags || [],
              isArchived: false,
              isFavorite: false,
              participants: [],
              status: 'active',
            };

            setCurrentConversation(conversation);
            setMessages(messages);

            // Update unread alert count for this conversation
            setUnreadAlertCount(getUnreadAlertCount(conversationId));

            // Clear the navigation state to prevent reloading on subsequent renders
            navigate('/prompt-lab', { replace: true });
          }
        } catch (error) {
          console.error(
            'Error loading conversation from navigation state:',
            error
          );
          setError('Failed to load conversation');
        }
      };

      loadConversationFromState();
    }
  }, [location.state, navigate, restoreConversationSettings]);

  // Handle system prompt application from navigation
  useEffect(() => {
    if (
      location.state?.openSystemPromptDrawer
      && location.state?.applySystemPrompt
    ) {
      const systemPrompt = location.state.applySystemPrompt;

      // Handle different scenarios based on navigation state
      if (location.state.startNew) {
        // Start new conversation - clear existing state
        setMessages([]);
        dispatch(clearCurrentPrompt());
        setSelectedContexts([]);
        setSelectedSystemPrompts([systemPrompt]);
        setCurrentConversation(null);
        clearSession();
      } else if (location.state.addToCurrent) {
        // Add to current conversation - add to existing selection
        setSelectedSystemPrompts(prev => {
          // Check if the prompt is already in the selection
          if (prev.find(sp => sp.id === systemPrompt.id)) {
            return prev; // Don't add if already present
          }
          return [...prev, systemPrompt];
        });
      } else {
        // Default behavior - replace default if it's the only one selected
        setSelectedSystemPrompts(prev => {
          if (prev.length === 1 && prev[0].isDefault) {
            return [systemPrompt];
          } else {
            // Add to existing selection if not already present
            if (!prev.find(sp => sp.id === systemPrompt.id)) {
              return [...prev, systemPrompt];
            }
            return prev;
          }
        });
      }

      // Open the system prompt drawer
      setSystemPromptDrawerOpen(true);

      // Clear the navigation state to prevent reloading on subsequent renders
      navigate('/prompt-lab', { replace: true });
    }
  }, [location.state, navigate, clearSession, dispatch]);

  // Handle librarian wizard opening from navigation
  useEffect(() => {
    if (location.state?.openSystemPromptSuggestor) {
      // Open the system prompt suggestor wizard
      setSystemPromptSuggestorOpen(true);
      setSystemPromptSuggestorMinimized(false);
      setSystemPromptSuggestorMessages([]);
      setSystemPromptSuggestorError(null);

      // Add the librarian's greeting as the first assistant message
      const librarianGreeting: WizardMessage = {
        id: `system-prompt-suggestor-${Date.now()}-librarian-greeting`,
        role: 'assistant',
        content:
          "Hello! I'm the FIDU Librarian, your friendly system prompt assistant. I can help you find the perfect system prompt in our collection for your specific task or goal. What would you like to accomplish with AI today?",
        timestamp: new Date().toISOString(),
      };

      setSystemPromptSuggestorMessages([librarianGreeting]);

      // Clear the navigation state to prevent reloading on subsequent renders
      navigate('/prompt-lab', { replace: true });
    }
  }, [location.state, navigate]);

  // Save or update conversation
  // Note: conversationId parameter allows passing the ID directly to avoid race conditions with state updates
  const saveConversation = useCallback(
    async (messages: Message[], conversationIdOverride?: string) => {
      if (!currentProfile || messages.length === 0) return;

      setIsSavingConversation(true);
      try {
        // Use override ID if provided (from handleSendMessage), otherwise use currentConversation
        const conversationId =
          conversationIdOverride || currentConversation?.id;

        // Update existing conversation (it should always have an ID now since we generate it on first message)
        if (conversationId) {
          // Fetch the existing conversation from storage to ensure we have all properties (especially title)
          // This prevents accidentally overwriting the title with "Untitled Conversation"
          let existingConversation: Partial<Conversation> | null = null;
          try {
            existingConversation =
              await conversationsService.getById(conversationId);
          } catch (error) {
            // If conversation doesn't exist yet (race condition), use currentConversation
            console.log(
              'Conversation not found in storage yet, using current state:',
              error
            );
            existingConversation = currentConversation;
          }

          // Merge existing conversation with any updates, ensuring we preserve the title
          const conversationToSave = existingConversation
            || currentConversation || { id: conversationId };

          // Update existing conversation using Redux action
          const updatedConversation = await dispatch(
            updateConversationWithMessages({
              conversation: { ...conversationToSave, id: conversationId },
              messages,
              originalPrompt: {
                promptText: messages[0]?.content || '',
                contexts: selectedContexts,
                context: selectedContexts[0] || null, // Keep for backward compatibility
                systemPrompts: selectedSystemPrompts, // Store all selected system prompts
                systemPrompt: selectedSystemPrompts[0] || null, // Keep for backward compatibility
                metadata: { estimatedTokens: 0 },
              },
            })
          ).unwrap();

          setCurrentConversation(updatedConversation);

          // Update recent conversations list - ensure no duplicates
          setRecentConversations(prev => {
            const filtered = prev.filter(
              conv => conv.id !== updatedConversation.id
            );
            return [updatedConversation, ...filtered.slice(0, 4)];
          });
        } else {
          // This should rarely happen now since we create conversation on first message
          // But handle it as a fallback for edge cases
          console.warn(
            '⚠️ [Conversation] Attempting to save conversation without ID - this should not happen'
          );
          const conversationData = {
            id: crypto.randomUUID(), // Generate ID as fallback
            title: messages[0]?.content || 'New Conversation',
            platform:
              (selectedModel as 'chatgpt' | 'claude' | 'gemini' | 'other')
              || ('chatgpt' as const),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: messages[messages.length - 1]?.content || '',
            messageCount: messages.length,
            tags: [],
            isArchived: false,
            isFavorite: false,
            participants: ['user', 'AI'],
            status: 'active' as const,
            originalPrompt: {
              promptText: messages[0]?.content || '',
              contexts: selectedContexts,
              context: selectedContexts[0] || null, // Keep for backward compatibility
              systemPrompts: selectedSystemPrompts, // Store all selected system prompts
              systemPrompt: selectedSystemPrompts[0] || null, // Keep for backward compatibility
              metadata: { estimatedTokens: 0 },
            },
          };
          const newConversation = await conversationsService.createConversation(
            currentProfile.id,
            conversationData,
            messages,
            {
              promptText: messages[0]?.content || '',
              contexts: selectedContexts,
              context: selectedContexts[0] || null, // Keep for backward compatibility
              systemPrompts: selectedSystemPrompts,
              systemPrompt: selectedSystemPrompts[0] || null,
              metadata: { estimatedTokens: 0 },
            }
          );
          setCurrentConversation(newConversation);

          // Add to recent conversations - ensure no duplicates
          setRecentConversations(prev => {
            const filtered = prev.filter(
              conv => conv.id !== newConversation.id
            );
            return [newConversation, ...filtered.slice(0, 4)];
          });
        }
      } catch (error) {
        console.error('Error saving conversation:', error);
        setError('Failed to save conversation');
      } finally {
        setIsSavingConversation(false);
      }
    },
    [
      currentProfile,
      currentConversation,
      selectedContexts,
      selectedSystemPrompts,
      selectedModel,
      dispatch,
    ]
  );

  // Handle sending a message
  const handleSendMessage = async () => {
    if (
      !currentPrompt.trim()
      || !selectedModel
      || !selectedSystemPrompts.length
      || !currentProfile
    )
      return;

    // Close the system prompt drawer when sending a message
    if (systemPromptDrawerOpen) {
      setSystemPromptDrawerOpen(false);
    }

    // Generate conversation ID immediately if this is the first message
    // This ensures background agents and all messages have a valid conversation ID from the start
    let conversationId: string;

    if (!currentConversation?.id) {
      // Generate a new conversation ID for this new conversation
      conversationId = crypto.randomUUID();

      // Create a conversation object immediately so it exists from the first message
      const newConversation: Conversation = {
        id: conversationId,
        title: currentPrompt.substring(0, 40) || 'New Conversation',
        platform: selectedModel as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: '',
        messageCount: 0,
        tags: [],
        isArchived: false,
        isFavorite: false,
        participants: ['user', 'AI'],
        status: 'active',
        modelsUsed: [],
        originalPrompt: {
          promptText: currentPrompt,
          contexts: selectedContexts,
          context: selectedContexts[0] || null, // Keep for backward compatibility
          systemPrompts: selectedSystemPrompts,
          systemPrompt: selectedSystemPrompts[0] || null,
          metadata: { estimatedTokens: 0 },
        },
      };

      // CRITICAL: Set the conversation state immediately and also save it to storage
      // This ensures the conversation exists before we try to save messages to it
      setCurrentConversation(newConversation);

      // Immediately create the conversation in storage to ensure it exists
      try {
        if (currentProfile?.id) {
          console.log(
            `📝 [Conversation] Creating new conversation in storage with ID: ${conversationId}`
          );
          const createdConversation =
            await conversationsService.createConversation(
              currentProfile.id,
              newConversation,
              [], // No messages yet - will be added when user message is saved
              newConversation.originalPrompt
            );
          // Update with the created conversation (may have additional fields from server)
          setCurrentConversation(createdConversation);
          console.log(
            `📝 [Conversation] ✅ Successfully created conversation in storage`
          );
        } else {
          console.warn(
            `📝 [Conversation] No profile ID available - conversation will be created on first save`
          );
        }
      } catch (error) {
        console.error(
          `📝 [Conversation] Failed to create conversation in storage:`,
          error
        );
        // Continue anyway - will be created on save
      }

      console.log(
        `📝 [Conversation] Created new conversation with ID: ${conversationId}`
      );
    } else {
      conversationId = currentConversation.id;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      conversationId: conversationId,
      content: currentPrompt,
      role: 'user',
      timestamp: new Date().toISOString(),
      platform: selectedModel, // Store the selected model ID
      isEdited: false,
    };

    setMessages(prev => [...prev, userMessage]);
    dispatch(clearCurrentPrompt());
    setIsLoading(true);
    setError(null);
    promptAbortController.current = new AbortController();

    // Analyze request for potential long duration
    const contextLength = selectedContexts.reduce(
      (total, ctx) => total + JSON.stringify(ctx).length,
      0
    );
    const conversationLength = messages.reduce(
      (total, msg) => total + msg.content.length,
      0
    );
    const analysis = analyzeRequestDuration(
      currentPrompt,
      selectedModel,
      contextLength,
      conversationLength
    );

    setLongRequestAnalysis(analysis);
    setRequestStartTime(Date.now());

    // Show warning if request is likely to be long-running
    if (analysis.isLikelyLongRunning) {
      setShowLongRequestWarning(true);
    }

    try {
      // Call the actual API to get AI response
      const response = await promptsApi.executePrompt(
        messages, // Pass existing conversation history
        selectedContexts,
        currentPrompt,
        selectedModel,
        currentProfile.id,
        selectedSystemPrompts, // Pass the full array of selected system prompts
        [],
        promptAbortController.current.signal
      );

      // Track successful message sent to model (safely handle if MetricsService unavailable)
      safeRecordMessageSent(selectedModel, 'success');

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;
        const actualModelInfo = parseActualModelInfo(
          response.responses?.actualModel
        );

        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          conversationId: conversationId,
          content: content,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          platform: selectedModel, // Store the selected model ID for AI responses
          isEdited: false,
          metadata: actualModelInfo
            ? {
                actualModel: actualModelInfo.raw,
                actualModelProvider: actualModelInfo.providerRaw,
                actualModelProviderDisplay: actualModelInfo.providerDisplay,
                actualModelName: actualModelInfo.modelRaw,
                actualModelNameDisplay: actualModelInfo.modelDisplay,
              }
            : undefined,
        };
        setMessages(prev => [...prev, aiMessage]);

        // Save conversation after AI response, then trigger background agents
        // Use fire-and-forget with comprehensive error handling to ensure
        // background agent failures never affect the main chat UI
        (async () => {
          try {
            const allMessages = [...messages, userMessage, aiMessage];

            // First, save the conversation and wait for it to complete
            // This ensures messages are persisted before we try to attach alerts
            // Pass conversationId explicitly to avoid race conditions with state updates
            console.log(
              `🤖 [BackgroundAgents] Saving conversation before evaluation...`
            );
            await saveConversation(allMessages, conversationId);
            console.log(
              `🤖 [BackgroundAgents] Conversation saved, verifying messages are available in storage...`
            );

            // CRITICAL: Verify messages are actually available in storage before proceeding
            // This prevents race conditions where save completes but messages aren't readable yet
            const { getUnifiedStorageService } =
              await import('../services/storage/UnifiedStorageService');
            const storage = getUnifiedStorageService();
            const verificationMaxRetries = 10;
            const verificationDelay = 300; // 300ms between verification attempts
            let messagesVerified = false;

            for (let attempt = 0; attempt < verificationMaxRetries; attempt++) {
              try {
                const storedMessages =
                  await storage.getMessages(conversationId);
                const expectedMessageCount = allMessages.length;

                if (storedMessages.length >= expectedMessageCount) {
                  // Check if we can find the target message (by ID or as last assistant message)
                  const foundById = storedMessages.find(
                    m => m.id === aiMessage.id
                  );
                  const assistantMessages = storedMessages.filter(
                    m => m.role === 'assistant'
                  );
                  const foundByPosition =
                    assistantMessages.length > 0
                    && assistantMessages[assistantMessages.length - 1];

                  if (foundById || foundByPosition) {
                    console.log(
                      `🤖 [BackgroundAgents] ✅ Messages verified in storage (attempt ${attempt + 1}/${verificationMaxRetries}): ${storedMessages.length} messages found`
                    );
                    messagesVerified = true;
                    break;
                  }
                }

                if (attempt < verificationMaxRetries - 1) {
                  console.log(
                    `🤖 [BackgroundAgents] Messages not yet available (attempt ${attempt + 1}/${verificationMaxRetries}): found ${storedMessages.length}, expected ${expectedMessageCount}, waiting ${verificationDelay}ms...`
                  );
                  await new Promise(resolve =>
                    setTimeout(resolve, verificationDelay)
                  );
                }
              } catch (error) {
                console.error(
                  `🤖 [BackgroundAgents] Error verifying messages on attempt ${attempt + 1}:`,
                  error
                );
                if (attempt < verificationMaxRetries - 1) {
                  await new Promise(resolve =>
                    setTimeout(resolve, verificationDelay)
                  );
                }
              }
            }

            if (!messagesVerified) {
              console.warn(
                `🤖 [BackgroundAgents] ⚠️ Could not verify messages in storage after ${verificationMaxRetries} attempts. Skipping agent evaluation to avoid alert persistence failures.`
              );
              return;
            }

            // Compute assistant turn count as number of assistant messages
            const assistantTurns = allMessages.filter(
              m => m.role === 'assistant'
            ).length;
            console.log(
              `🤖 [BackgroundAgents] Triggering evaluation - Assistant turn count: ${assistantTurns}, Total messages: ${allMessages.length}`
            );

            // Map to slice messages shape
            const sliceMessages = allMessages.map(m => ({
              role: m.role as any,
              content: m.content,
              timestamp: m.timestamp,
            }));
            // Lazy import to avoid bundle bloat in case of code splitting
            const { maybeEvaluateBackgroundAgents } =
              await import('../services/agents/backgroundAgentRunner');
            const profileId = currentProfile?.id;
            if (!profileId) {
              console.warn(
                `🤖 [BackgroundAgents] Cannot evaluate - no profile ID available`
              );
              return;
            }
            console.log(
              `🤖 [BackgroundAgents] Starting evaluation with profile: ${profileId}`
            );

            // Set evaluating state
            setBackgroundAgentsEvaluating(true);

            // Execute in fire-and-forget mode - errors are fully isolated
            await maybeEvaluateBackgroundAgents({
              profileId,
              conversationId: conversationId, // Use the conversation ID we just ensured exists
              messages: sliceMessages as any,
              turnCount: assistantTurns,
              messageId: aiMessage.id, // Required: Link alerts to this specific assistant message
            }).catch((error: any) => {
              // Additional safety layer - log but never throw
              console.error(
                `🤖 [BackgroundAgents] Evaluation failed (non-blocking):`,
                error?.message || error
              );
            });
          } catch (error: any) {
            // Catch all errors including import failures and save failures - log but never throw
            console.warn(
              'Background agent system error (non-blocking):',
              error?.message || error
            );
          } finally {
            // Always reset evaluating state when done
            setBackgroundAgentsEvaluating(false);
          }
        })(); // IIFE for fire-and-forget async execution
      } else {
        console.log(
          'AI response failed - Status:',
          response.status,
          'Content present:',
          !!response.responses?.content,
          'Full response:',
          response
        );
        throw new Error(
          'The model failed to complete the call, please try again shortly'
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Request cancelled by user');
        return;
      }

      console.error('Error getting AI response:', error);

      // Track error message sent to model (safely handle if MetricsService unavailable)
      safeRecordMessageSent(selectedModel, 'error');

      // Determine user-friendly error message and debug info
      const { userMessage: errorUserMessage, debugInfo } = getErrorMessage(
        error,
        selectedModel
      );
      console.log('AI Response Error Debug Info:', debugInfo);

      // Log additional timeout details if this is a timeout error
      if (error instanceof ApiError && error.status === 408 && error.data) {
        console.log('Detailed Timeout Analysis:', error.data);
      }

      setError(errorUserMessage);

      // Add error message to chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: currentConversation?.id || 'current',
        content: `Error: ${errorUserMessage}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel, // Store the selected model ID for error messages
        isEdited: false,
      };
      setMessages(prev => [...prev, errorMessage]);

      // Save conversation even with error message
      setTimeout(() => {
        saveConversation([...messages, userMessage, errorMessage]);
      }, 100);
    } finally {
      setIsLoading(false);
      setShowLongRequestWarning(false);
      setLongRequestAnalysis(null);
      setRequestStartTime(null);
      promptAbortController.current = null;
    }
  };

  // Handle cancelling a long request
  const handleCancelRequest = useCallback(() => {
    promptAbortController.current?.abort('Request cancelled by user');
    setIsLoading(false);
    setShowLongRequestWarning(false);
    setLongRequestAnalysis(null);
    setRequestStartTime(null);

    // Add a cancellation message to the chat
    const cancelMessage: Message = {
      id: `msg-${Date.now()}-cancel`,
      conversationId: currentConversation?.id || 'current',
      content: 'Request cancelled by user.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      platform: selectedModel,
      isEdited: false,
    };
    setMessages(prev => [...prev, cancelMessage]);

    showToast('Request cancelled');
  }, [selectedModel, showToast, currentConversation?.id]);

  // Wizard handlers
  const handleOpenWizard = () => {
    setWizardOpen(true);
    setWizardMinimized(false);
    setWizardError(null);

    // Only copy current message and initialize greeting for fresh wizard conversations
    if (wizardMessages.length === 0) {
      // Copy current message to wizard initial message for new conversations
      setWizardInitialMessage(currentPrompt);

      // Initialize wizard with greeting
      const greetingMessage: WizardMessage = {
        id: `wizard-${Date.now()}-greeting`,
        role: 'assistant',
        content:
          "Hello! I'm the FIDU-Prompt-Wizard, your friendly prompt enhancement bot. My goal is to help you transform your initial idea into a powerful, precise instruction for an AI. Please share the prompt you'd like me to help you improve.",
        timestamp: new Date().toISOString(),
      };
      setWizardMessages([greetingMessage]);

      // Clear the initial message after it's been set to prevent reuse
      setTimeout(() => setWizardInitialMessage(''), 100);
    }
  };

  const handleCloseWizard = () => {
    setWizardOpen(false);
    setWizardMinimized(false);
    setWizardMessages([]); // Clear conversation when explicitly closed
    setWizardError(null);
    setWizardInitialMessage(''); // Clear initial message
  };

  const handleMinimizeWizard = () => {
    setWizardMinimized(true);
    setWizardOpen(false);
  };

  const handleMaximizeWizard = () => {
    setWizardMinimized(false);
    setWizardOpen(true);
  };

  const handleWizardSendMessage = async (message: string) => {
    if (!message.trim() || !currentProfile) return;

    const userMessage: WizardMessage = {
      id: `wizard-${Date.now()}-user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setWizardMessages(prev => [...prev, userMessage]);
    setWizardLoading(true);
    setWizardError(null);

    try {
      // Find the Prompt Wizard system prompt
      const promptWizardSystemPrompt = wizardSystemPrompts.find(
        sp => sp.id === 'sys-2'
      );
      if (!promptWizardSystemPrompt) {
        throw new Error('Prompt Wizard system prompt not found');
      }

      // Convert wizard messages to regular messages for API call
      const apiMessages: Message[] = wizardMessages.map(wm => ({
        id: wm.id,
        conversationId: 'wizard',
        content: wm.content,
        role: wm.role,
        timestamp: wm.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false,
      }));

      // Add the new user message
      const apiUserMessage: Message = {
        id: userMessage.id,
        conversationId: 'wizard',
        content: userMessage.content,
        role: 'user',
        timestamp: userMessage.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false,
      };

      // Add user message to API messages
      apiMessages.push(apiUserMessage);

      // Call the API with wizard-specific parameters
      const response = await promptsApi.executePrompt(
        apiMessages,
        null, // No context for wizard
        message,
        'gpt-oss-120b', // Fixed model for wizard
        currentProfile.id,
        [promptWizardSystemPrompt], // Use Prompt Wizard system prompt
        []
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;

        const aiMessage: WizardMessage = {
          id: `wizard-${Date.now()}-ai`,
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString(),
        };
        setWizardMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(
          'The wizard failed to complete the call, please try again shortly'
        );
      }
    } catch (error) {
      console.error('Error getting wizard response:', error);
      setWizardError('Failed to get wizard response. Please try again.');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleCopyWizardResult = (content: string) => {
    dispatch(setCurrentPrompt(content));
    showToast('Prompt copied to chat input!');
    setWizardMinimized(true);
  };

  const handleClearWizardConversation = () => {
    setWizardMessages([]);
    setWizardError(null);
    setWizardInitialMessage(''); // Clear initial message
    showToast('Wizard conversation cleared');
  };

  // System Prompt Suggestor Wizard handlers
  const handleOpenSystemPromptSuggestor = () => {
    setSystemPromptSuggestorOpen(true);
    setSystemPromptSuggestorMinimized(false);
    setSystemPromptSuggestorMessages([]);
    setSystemPromptSuggestorError(null);
    setSystemPromptSuggestorInitialMessage(''); // Clear initial message

    // Add the librarian's greeting as the first assistant message
    const librarianGreeting: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-librarian-greeting`,
      role: 'assistant',
      content:
        "Hello! I'm the FIDU Librarian, your friendly system prompt assistant. I can help you find the perfect system prompt in our collection for your specific task or goal. What would you like to accomplish with AI today?",
      timestamp: new Date().toISOString(),
    };

    setSystemPromptSuggestorMessages([librarianGreeting]);
  };

  const handleCloseSystemPromptSuggestor = () => {
    // Instead of closing completely, minimize to preserve the tab
    setSystemPromptSuggestorMinimized(true);
    setSystemPromptSuggestorOpen(false);
  };

  const handleMinimizeSystemPromptSuggestor = () => {
    setSystemPromptSuggestorMinimized(true);
    setSystemPromptSuggestorOpen(false);
  };

  const handleMaximizeSystemPromptSuggestor = () => {
    setSystemPromptSuggestorMinimized(false);
    setSystemPromptSuggestorOpen(true);
  };

  const handleSystemPromptSuggestorSendMessage = async (message: string) => {
    if (!message.trim() || !currentProfile) return;

    const userMessage: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setSystemPromptSuggestorMessages(prev => [...prev, userMessage]);
    setSystemPromptSuggestorLoading(true);
    setSystemPromptSuggestorError(null);

    try {
      // Find the System Prompt Suggestor system prompt
      const systemPromptSuggestorSystemPrompt = wizardSystemPrompts.find(
        sp => sp.id === 'sys-3'
      );
      if (!systemPromptSuggestorSystemPrompt) {
        throw new Error('System Prompt Suggestor system prompt not found');
      }

      // Convert wizard messages to regular messages for API call
      // This includes the librarian's greeting message to maintain conversation context
      const apiMessages: Message[] = systemPromptSuggestorMessages.map(wm => ({
        id: wm.id,
        conversationId: 'system-prompt-suggestor',
        content: wm.content,
        role: wm.role,
        timestamp: wm.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false,
      }));

      // Add the new user message
      const apiUserMessage: Message = {
        id: userMessage.id,
        conversationId: 'system-prompt-suggestor',
        content: userMessage.content,
        role: 'user',
        timestamp: userMessage.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false,
      };

      // Add user message to API messages
      apiMessages.push(apiUserMessage);

      // Call the API with wizard-specific parameters
      const response = await promptsApi.executePrompt(
        apiMessages,
        null, // No context for wizard
        message,
        'gpt-oss-120b', // Fixed model for wizard
        currentProfile.id,
        [systemPromptSuggestorSystemPrompt], // Use System Prompt Suggestor system prompt
        []
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;

        const aiMessage: WizardMessage = {
          id: `system-prompt-suggestor-${Date.now()}-ai`,
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString(),
        };
        setSystemPromptSuggestorMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(
          'The System Prompt Suggestor failed to complete the call, please try again shortly'
        );
      }
    } catch (error) {
      console.error('Error getting System Prompt Suggestor response:', error);
      setSystemPromptSuggestorError(
        'Failed to get System Prompt Suggestor response. Please try again.'
      );
    } finally {
      setSystemPromptSuggestorLoading(false);
    }
  };

  const handleCopySystemPromptSuggestorResult = (content: string) => {
    // For System Prompt Suggestor, we want to add the suggested system prompt to the selected system prompts
    // First, we need to find the system prompt by name from the content
    const suggestedPromptName = extractSystemPromptNameFromContent(content);
    if (suggestedPromptName) {
      const suggestedPrompt = systemPrompts.find(
        sp => sp.name === suggestedPromptName
      );
      if (
        suggestedPrompt
        && !selectedSystemPrompts.find(sp => sp.id === suggestedPrompt.id)
      ) {
        setSelectedSystemPrompts(prev => [...prev, suggestedPrompt]);
        showToast(
          `System prompt "${suggestedPromptName}" added to selected prompts!`
        );
      } else if (suggestedPrompt) {
        showToast(
          `System prompt "${suggestedPromptName}" is already selected!`
        );
      } else {
        showToast(
          'Could not find the suggested system prompt. Please add it manually.'
        );
      }
    } else {
      showToast(
        'Could not extract system prompt name from suggestion. Please add manually.'
      );
    }
    setSystemPromptSuggestorMinimized(true);
  };

  const handleClearSystemPromptSuggestorConversation = () => {
    setSystemPromptSuggestorMessages([]);
    setSystemPromptSuggestorError(null);
    setSystemPromptSuggestorInitialMessage('');

    // Add the librarian's greeting back as the first assistant message
    const librarianGreeting: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-librarian-greeting`,
      role: 'assistant',
      content:
        "Hello! I'm the FIDU Librarian, your friendly system prompt assistant. I can help you find the perfect system prompt in our collection for your specific task or goal. What would you like to accomplish with AI today?",
      timestamp: new Date().toISOString(),
    };

    setSystemPromptSuggestorMessages([librarianGreeting]);
    showToast('System Prompt Suggestor conversation cleared');
  };

  // Helper function to extract system prompt name from the librarian's response
  const extractSystemPromptNameFromContent = (
    content: string
  ): string | null => {
    // Look for patterns like "I recommend the [Name] system prompt" or "The [Name] prompt would be perfect"
    const patterns = [
      /(?:recommend|suggest|perfect|ideal).*?["']([^"']+)["']/i,
      /(?:recommend|suggest|perfect|ideal).*?the\s+([A-Za-z\s]+?)\s+(?:system\s+)?prompt/i,
      /(?:system\s+)?prompt.*?["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  };

  // Helper function to get system prompt by ID
  const getSystemPromptById = (id: string): SystemPrompt | null => {
    return systemPrompts.find(sp => sp.id === id) || null;
  };

  // Handler for adding system prompts from wizard suggestions
  const handleAddSystemPromptFromWizard = (promptId: string) => {
    const systemPrompt = getSystemPromptById(promptId);
    if (systemPrompt && !selectedSystemPrompts.find(sp => sp.id === promptId)) {
      // Smart replacement: if only default is selected, replace it; otherwise add
      setSelectedSystemPrompts(prev => {
        // Check if only one prompt is selected and it's the default
        const isOnlyDefaultSelected = prev.length === 1 && prev[0].isDefault;

        if (isOnlyDefaultSelected) {
          // Replace the default with the new prompt
          return [systemPrompt];
        } else {
          // Add to existing selection
          return [...prev, systemPrompt];
        }
      });

      // Show appropriate toast message
      const isOnlyDefaultSelected =
        selectedSystemPrompts.length === 1
        && selectedSystemPrompts[0].isDefault;
      if (isOnlyDefaultSelected) {
        showToast(
          `System prompt "${systemPrompt.name}" replaced the default prompt!`
        );
      } else {
        showToast(
          `System prompt "${systemPrompt.name}" added to selected prompts!`
        );
      }
    } else if (systemPrompt) {
      showToast(`System prompt "${systemPrompt.name}" is already selected!`);
    } else {
      showToast(
        'Could not find the suggested system prompt. Please add it manually.'
      );
    }
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      const messages = await conversationsService.getMessages(conversation.id);
      setMessages(messages);
      setCurrentConversation(conversation);

      // Update the conversation ID in messages to match the loaded conversation
      const updatedMessages = messages.map(msg => ({
        ...msg,
        conversationId: conversation.id,
      }));
      setMessages(updatedMessages);

      // Restore system prompts and embellishments from the conversation
      restoreConversationSettings(conversation);

      // Update unread alert count for this conversation
      setUnreadAlertCount(getUnreadAlertCount(conversation.id));

      // Close the drawer
      setConversationsDrawerOpen(false);
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      setError('Failed to load conversation');
    }
  };

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setCurrentConversation(null);
    setGhostMessages({});
    setError(null);
    // Clear selected contexts
    setSelectedContexts([]);
    // Clear persisted conversation state
    clearSession();
    // Reset unread alert count (no conversation = no alerts)
    setUnreadAlertCount(0);
    // Reset to default system prompt
    if (systemPrompts.length > 0) {
      const defaultPrompt =
        systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompts([defaultPrompt]);
      }
    }
    // Note: Embellishments removed
  }, [systemPrompts, clearSession]);

  // Handle create context submit
  const handleCreateContextSubmit = useCallback(async () => {
    if (!currentProfile?.id || !contextForm.title.trim()) return;

    setIsCreatingContext(true);
    try {
      await dispatch(
        createContext({
          contextData: {
            title: contextForm.title.trim(),
            body: contextForm.body.trim(),
            tags: contextForm.tags,
          },
          profileId: currentProfile.id,
        })
      ).unwrap();

      setCreateContextModalOpen(false);
      setContextForm({ title: '', body: '', tags: [] });
      showToast('Context created successfully!');

      // Refresh contexts list
      dispatch(fetchContexts(currentProfile.id));
    } catch (error) {
      console.error('Error creating context:', error);
      showToast('Failed to create context');
    } finally {
      setIsCreatingContext(false);
    }
  }, [dispatch, contextForm, currentProfile?.id, showToast]);

  // Handle rewind to a specific message
  const handleRewindToMessage = useCallback(
    (messageIndex: number) => {
      const targetMessage = messages[messageIndex];
      if (targetMessage && targetMessage.role === 'user') {
        // Show confirmation dialog
        if (
          window.confirm(
            `Rewind to "${targetMessage.content.substring(0, 50)}${targetMessage.content.length > 50 ? '...' : ''}"?\n\nThis will remove all messages after this point from the conversation (while retaining a ghost while the page is open) and load the message into the input box.`
          )
        ) {
          // Cancel any outstanding requests
          handleCancelRequest();
          const deletedMessages = messages.slice(messageIndex);
          let rootMessageKey;
          if (messageIndex > 0) {
            rootMessageKey = messages[messageIndex - 1].id;
          } else {
            rootMessageKey = 'conversation_start';
            dispatch(deleteConversation(currentConversation!.id));
            setCurrentConversation(null);
          }
          setGhostMessages(prev => ({
            ...prev,
            [rootMessageKey]: [
              ...(prev[rootMessageKey] ?? []),
              ...deletedMessages,
            ],
          }));

          // Load the message content into the chat text box
          dispatch(setCurrentPrompt(targetMessage.content));
          // Remove all messages after this point (including the target message)
          setMessages(prev => prev.slice(0, messageIndex));
          // Clear any errors
          setError(null);
          // Scroll to bottom to show the rewinded state
          setTimeout(() => scrollToBottom(), 100);
          // Show success toast
          showToast('Conversation rewound successfully!');
        }
      }
    },
    [
      messages,
      scrollToBottom,
      showToast,
      dispatch,
      handleCancelRequest,
      currentConversation,
    ]
  );

  // Handle retry for failed messages
  const handleRetryMessage = useCallback(
    async (errorMessageIndex: number) => {
      // Find the last user message before the error
      const lastUserMessageIndex = errorMessageIndex - 1;
      const lastUserMessage = messages[lastUserMessageIndex];

      if (!lastUserMessage || lastUserMessage.role !== 'user') {
        showToast('No user message found to retry');
        return;
      }

      // Remove the error message and all messages after it
      setMessages(prev => prev.slice(0, errorMessageIndex));

      // Clear any existing errors
      setError(null);

      // Set the user message content for resending
      dispatch(setCurrentPrompt(lastUserMessage.content));

      // Show loading state
      setIsLoading(true);

      promptAbortController.current = new AbortController();

      try {
        // Call the API to get AI response
        const response = await promptsApi.executePrompt(
          messages.slice(0, errorMessageIndex), // Pass messages up to the error point
          selectedContexts,
          lastUserMessage.content,
          selectedModel,
          currentProfile!.id,
          selectedSystemPrompts,
          [],
          promptAbortController.current.signal
        );

        if (response.status === 'completed' && response.responses?.content) {
          const content = response.responses.content;
          const actualModelInfo = parseActualModelInfo(
            response.responses?.actualModel
          );

          const aiMessage: Message = {
            id: `msg-${Date.now()}-ai`,
            conversationId: currentConversation?.id || 'current',
            content: content,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            platform: selectedModel,
            isEdited: false,
            metadata: actualModelInfo
              ? {
                  actualModel: actualModelInfo.raw,
                  actualModelProvider: actualModelInfo.providerRaw,
                  actualModelProviderDisplay: actualModelInfo.providerDisplay,
                  actualModelName: actualModelInfo.modelRaw,
                  actualModelNameDisplay: actualModelInfo.modelDisplay,
                }
              : undefined,
          };

          setMessages(prev => [...prev, aiMessage]);

          // Save conversation after AI response
          setTimeout(() => {
            saveConversation([
              ...messages.slice(0, errorMessageIndex),
              lastUserMessage,
              aiMessage,
            ]);
          }, 100);

          showToast('Message retried successfully!');
        } else {
          console.log(
            'AI retry response failed - Status:',
            response.status,
            'Content present:',
            !!response.responses?.content,
            'Full response:',
            response
          );
          throw new Error(
            'The model failed to complete the call, please try again shortly'
          );
        }
      } catch (error) {
        console.error('Error retrying message:', error);

        // Determine user-friendly error message and debug info
        const { userMessage: errorUserMessage, debugInfo } = getErrorMessage(
          error,
          selectedModel
        );
        console.log('AI Retry Error Debug Info:', debugInfo);

        // Log additional timeout details if this is a timeout error
        if (error instanceof ApiError && error.status === 408 && error.data) {
          console.log('Detailed Timeout Analysis (Retry):', error.data);
        }

        setError(errorUserMessage);

        // Add error message to chat
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          conversationId: currentConversation?.id || 'current',
          content: `Error: ${errorUserMessage}`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          platform: selectedModel,
          isEdited: false,
        };
        setMessages(prev => [...prev, errorMessage]);

        // Save conversation even with error message
        setTimeout(() => {
          saveConversation([
            ...messages.slice(0, errorMessageIndex),
            lastUserMessage,
            errorMessage,
          ]);
        }, 100);
      } finally {
        setIsLoading(false);
        dispatch(clearCurrentPrompt()); // Clear the input after retry
      }
    },
    [
      messages,
      selectedContexts,
      selectedModel,
      currentProfile,
      selectedSystemPrompts,
      saveConversation,
      showToast,
      currentConversation?.id,
      dispatch,
    ]
  );

  // Construct the full prompt as it would be sent to the model
  const constructFullPrompt = useCallback(() => {
    // Use the same unified function that builds prompts for the API
    return buildCompletePrompt(
      selectedSystemPrompts,
      [], // Embellishments removed
      selectedContexts,
      messages,
      currentPrompt.trim()
        || (messages.length > 0
          ? messages.filter(m => m.role === 'user').pop()?.content || ''
          : '')
    );
  }, [selectedSystemPrompts, selectedContexts, messages, currentPrompt]);

  const renderMessage = useCallback(
    (
      message: Message,
      messageIndex: number,
      isGhost: boolean = false
    ): JSX.Element => {
      const opacity = isGhost ? 0.5 : 1;
      const metadata = message.metadata as Record<string, any> | undefined;
      const actualModelRaw =
        typeof metadata?.actualModel === 'string'
          ? metadata.actualModel
          : undefined;
      let actualModelInfo: ActualModelInfo | null =
        parseActualModelInfo(actualModelRaw);

      if (actualModelInfo) {
        const providerDisplay =
          typeof metadata?.actualModelProviderDisplay === 'string'
            ? metadata.actualModelProviderDisplay.trim()
            : '';
        const modelDisplay =
          typeof metadata?.actualModelNameDisplay === 'string'
            ? metadata.actualModelNameDisplay.trim()
            : '';

        if (providerDisplay) {
          actualModelInfo = {
            ...actualModelInfo,
            providerDisplay,
          };
        }

        if (modelDisplay) {
          actualModelInfo = {
            ...actualModelInfo,
            modelDisplay,
          };
        }
      } else if (
        typeof metadata?.actualModelProviderDisplay === 'string'
        || typeof metadata?.actualModelNameDisplay === 'string'
      ) {
        actualModelInfo = {
          raw: actualModelRaw ?? '',
          providerRaw:
            typeof metadata?.actualModelProvider === 'string'
              ? metadata.actualModelProvider
              : '',
          modelRaw:
            typeof metadata?.actualModelName === 'string'
              ? metadata.actualModelName
              : '',
          providerDisplay:
            typeof metadata?.actualModelProviderDisplay === 'string'
              ? metadata.actualModelProviderDisplay
              : '',
          modelDisplay:
            typeof metadata?.actualModelNameDisplay === 'string'
              ? metadata.actualModelNameDisplay
              : '',
        };
      }

      const modelInfo = getModelInfo(message.platform, actualModelInfo);
      return (
        <>
          <Box
            key={message.id}
            id={`message-${message.id}`}
            data-message-id={message.id}
            sx={{
              display: 'flex',
              justifyContent:
                message.role === 'user' ? 'flex-end' : 'flex-start',
              mb: isMobile ? 1.5 : 2,
              mr: message.role === 'user' ? (isMobile ? '5%' : '15%') : 0,
              ml: message.role === 'assistant' ? (isMobile ? '5%' : 0) : 0,
              scrollMarginTop: '80px', // Add offset for sticky headers
              opacity: opacity,
            }}
          >
            <Paper
              sx={{
                p: isMobile ? 1.5 : 2,
                maxWidth: isMobile ? '90%' : '70%',
                minWidth: isMobile ? '60%' : 'auto',
                backgroundColor:
                  message.role === 'user'
                    ? 'tertiary.dark'
                    : message.role === 'assistant'
                        && message.content.startsWith('Error:')
                      ? 'error.light'
                      : modelInfo.color, // Use model-specific color for AI messages
                color:
                  message.role === 'user' 
                    ? 'tertiary.contrastText' 
                    : theme.palette.mode === 'light' ? 'text.primary' : 'white',
                borderRadius: isMobile ? 3 : 2,
                position: 'relative',
                // Add subtle shadow for better visual separation
                boxShadow: message.role === 'assistant' ? 2 : 1,
                // Add hover effect for user messages to indicate rewind functionality
                ...(message.role === 'user'
                  && !isMobile && {
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-1px)',
                      transition: 'all 0.2s ease',
                    },
                  }),
                // Add subtle border to indicate interactive elements
                border:
                  message.role === 'user'
                    ? '1px solid rgba(0,0,0,0.1)'
                    : theme.palette.mode === 'light'
                      ? '1px solid rgba(0,0,0,0.1)'
                      : '1px solid rgba(255,255,255,0.1)',
                // Mobile-specific touch feedback
                ...(isMobile
                  && message.role === 'user' && {
                    '&:active': {
                      transform: 'scale(0.98)',
                      transition: 'transform 0.1s ease',
                    },
                  }),
              }}
            >
              {message.role === 'assistant' && (
                <Avatar
                  sx={{
                    width: isMobile ? 20 : 24,
                    height: isMobile ? 20 : 24,
                    position: 'absolute',
                    top: isMobile ? -10 : -12,
                    left: isMobile ? -10 : -12,
                    bgcolor: message.content.startsWith('Error:')
                      ? 'error.dark'
                      : modelInfo.color,
                    color: theme.palette.mode === 'light' ? 'text.primary' : 'white',
                  }}
                >
                  <ModelIcon fontSize={isMobile ? 'small' : 'small'} />
                </Avatar>
              )}

              {/* Model information for AI messages */}
              {message.role === 'assistant' && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 0.5 : 1,
                    mb: isMobile ? 0.5 : 1,
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}
                >
                  <Chip
                    label={modelInfo.name}
                    size="small"
                    sx={{
                      height: isMobile ? 18 : 20,
                      fontSize: isMobile ? '0.6rem' : '0.7rem',
                      backgroundColor: theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.1)' 
                        : 'rgba(255,255,255,0.2)',
                      color: theme.palette.mode === 'light' ? 'text.primary' : 'white',
                      '& .MuiChip-label': {
                        px: isMobile ? 0.5 : 1,
                      },
                    }}
                  />
                  {!isMobile && (
                    <Typography
                      variant="caption"
                      sx={{ 
                        opacity: 0.7, 
                        color: theme.palette.mode === 'light' ? 'text.primary' : 'white' 
                      }}
                    >
                      {modelInfo.provider}
                    </Typography>
                  )}
                </Box>
              )}

              <Box
                sx={{
                  // Let EnhancedMarkdown handle paragraph styling
                  // Remove conflicting paragraph styles that override markdown rendering
                  '& pre': {
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    padding: isMobile ? 0.75 : 1,
                    borderRadius: isMobile ? 0.75 : 1,
                    overflow: 'auto',
                    margin: isMobile ? '6px 0' : '8px 0',
                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                  },
                  '& code': {
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    padding: isMobile ? '1px 3px' : '2px 4px',
                    borderRadius: isMobile ? 0.5 : 1,
                    fontFamily: 'monospace',
                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                  },
                  '& ul, & ol': {
                    margin: isMobile ? '6px 0' : '8px 0',
                    paddingLeft: isMobile ? 1.5 : 2,
                  },
                  '& li': { margin: isMobile ? '2px 0' : '4px 0' },
                  '& blockquote': {
                    borderLeft: '3px solid rgba(255,255,255,0.3)',
                    paddingLeft: isMobile ? 0.75 : 1,
                    margin: isMobile ? '6px 0' : '8px 0',
                    fontStyle: 'italic',
                  },
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    margin: isMobile ? '8px 0 4px 0' : '12px 0 8px 0',
                    fontWeight: 600,
                    lineHeight: 1.2,
                  },
                  '& h1': { fontSize: isMobile ? '1.3em' : '1.5em' },
                  '& h2': { fontSize: isMobile ? '1.2em' : '1.3em' },
                  '& h3': { fontSize: isMobile ? '1.1em' : '1.1em' },
                  '& strong': { fontWeight: 600 },
                  '& em': { fontStyle: 'italic' },
                  '& hr': {
                    border: 'none',
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                    margin: isMobile ? '12px 0' : '16px 0',
                  },
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%',
                    margin: isMobile ? '6px 0' : '8px 0',
                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                  },
                  '& th, & td': {
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: isMobile ? '2px 4px' : '4px 8px',
                    textAlign: 'left',
                  },
                  '& th': {
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    fontWeight: 600,
                  },
                  // Add padding to prevent button overlap
                  paddingRight:
                    message.role === 'user'
                      ? isMobile
                        ? '36px'
                        : '44px'
                      : isMobile
                        ? '36px'
                        : '44px', // Space for rewind/copy buttons
                  paddingBottom:
                    message.role === 'assistant'
                      ? isMobile
                        ? '36px'
                        : '44px'
                      : isMobile
                        ? '6px'
                        : '8px', // Extra bottom padding for copy button
                  // Mobile-specific typography
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  lineHeight: isMobile ? 1.4 : 1.5,
                }}
              >
                <EnhancedMarkdown
                  content={message.content}
                  enableSyntaxHighlighting={true}
                  showCopyButtons={true}
                  preprocess={true}
                />
              </Box>

              {/* Rewind Button for User Messages */}
              {!isGhost && message.role === 'user' && (
                <IconButton
                  onClick={() => handleRewindToMessage(messageIndex)}
                  sx={{
                    position: 'absolute',
                    top: isMobile ? 6 : 8,
                    right: isMobile ? 6 : 8,
                    width: isMobile ? 32 : 28,
                    height: isMobile ? 32 : 28,
                    borderRadius: '50%',
                    backgroundColor: theme.palette.mode === 'light' 
                      ? 'rgba(0,0,0,0.1)' 
                      : 'rgba(255,255,255,0.2)',
                    color: theme.palette.mode === 'light' ? 'text.primary' : 'white',
                    opacity: 0.8,
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.15)' 
                        : 'rgba(255,255,255,0.3)',
                      opacity: 1,
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    },
                    '&:active': isMobile
                      ? {
                          transform: 'scale(0.95)',
                          backgroundColor: theme.palette.mode === 'light' 
                            ? 'rgba(0,0,0,0.2)' 
                            : 'rgba(255,255,255,0.4)',
                        }
                      : {},
                    transition: 'all 0.2s ease',
                  }}
                  title="Rewind conversation to this point (removes all messages after this message)"
                >
                  <RestartAltIcon sx={{ fontSize: isMobile ? 16 : 14 }} />
                </IconButton>
              )}

              {/* Small indicator for user messages to hint at rewind functionality */}
              {message.role === 'user' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    opacity: 0.6,
                    zIndex: 5,
                  }}
                />
              )}

              {/* Copy Button for Assistant Messages */}
              {message.role === 'assistant'
                && !message.content.startsWith('Error:') && (
                  <IconButton
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(message.content);
                        showToast('Message copied to clipboard!');
                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = message.content;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      bottom: isMobile ? 6 : 8,
                      right: isMobile ? 6 : 8,
                      width: isMobile ? 32 : 28,
                      height: isMobile ? 32 : 28,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.1)' 
                        : 'rgba(255,255,255,0.2)',
                      color: theme.palette.mode === 'light' ? 'text.primary' : 'white',
                      opacity: 0.8,
                      zIndex: 10,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.15)' 
                          : 'rgba(255,255,255,0.3)',
                        opacity: 1,
                        transform: 'scale(1.1)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      },
                      '&:active': isMobile
                        ? {
                            transform: 'scale(0.95)',
                            backgroundColor: theme.palette.mode === 'light' 
                              ? 'rgba(0,0,0,0.2)' 
                              : 'rgba(255,255,255,0.4)',
                          }
                        : {},
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ContentCopyIcon sx={{ fontSize: isMobile ? 16 : 14 }} />
                  </IconButton>
                )}

              {/* Retry Button for Error Messages */}
              {message.role === 'assistant'
                && message.content.startsWith('Error:') && (
                  <Tooltip
                    title="Retry the last user message"
                    placement="top"
                    arrow
                  >
                    <IconButton
                      onClick={() => handleRetryMessage(messageIndex)}
                      disabled={isLoading}
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        opacity: 0.8,
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          opacity: 1,
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        },
                        '&:disabled': {
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          opacity: 0.5,
                          transform: 'none',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <ReplayIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
            </Paper>
          </Box>
          {ghostMessages[message.id]
            && ghostMessages[message.id].map(message =>
              renderMessage(message, 1e6, true)
            )}
        </>
      );
    },
    [
      ghostMessages,
      handleRetryMessage,
      handleRewindToMessage,
      isLoading,
      isMobile,
      showToast,
    ]
  );

  return (
    <Box
      sx={{
        height: '100%', // Use full height of parent container
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden', // Prevent outer page scrolling
        // Mobile-specific adjustments
        ...(isMobile && {
          height: 'calc(100vh - 120px)', // Account for bottom navigation
        }),
      }}
    >
      {/* Storage Directory Banner */}
      {/* Main Chat Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          pb: isMobile ? 0 : 0, // No bottom padding needed since prompt bar is fixed
          minHeight: 0, // Ensure flex child can shrink properly
          // Mobile-specific adjustments
          ...(isMobile && {
            pb: 2, // Add padding for mobile
          }),
        }}
      >
        {/* Error Display */}
        {error && (
          <Box sx={{ p: 1, pb: 0 }}>
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{ borderRadius: 2 }}
            >
              {error}
            </Alert>
          </Box>
        )}

        {/* Messages Container */}
        <Box
          ref={messagesContainerRef}
          onScroll={handleScroll}
          sx={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden', // Prevent horizontal scrolling
            p: isMobile ? spacing.padding.sm : 3,
            pb: isMobile ? 25 : 24, // Extra bottom padding for mobile input box
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 1.5 : 2,
            // Mobile-specific scroll behavior
            ...(isMobile && {
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '2px',
              },
            }),
          }}
        >
          {/* New Conversation Button - Top Right (when context is selected and messages exist) - Desktop Only */}
          {!isMobile
            && selectedContexts.length > 0
            && messages.length > 0
            && isNewChatButtonInChatPageEnabled && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 60,
                  right: 8,
                  zIndex: 1002,
                }}
              >
                <Button
                  variant="outlined"
                  onClick={startNewConversation}
                  startIcon={<AddIcon />}
                  size="small"
                  sx={{
                    color: 'primary.dark',
                    borderColor: 'primary.dark',
                    backgroundColor: 'background.paper',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  New Chat
                </Button>
              </Box>
            )}

          {/* New Conversation Button - Top Right (when no context selected and messages exist) - Desktop Only */}
          {!isMobile
            && messages.length > 0
            && selectedContexts.length === 0
            && isNewChatButtonInChatPageEnabled && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 60,
                  right: 8,
                  zIndex: 1002,
                }}
              >
                <Button
                  variant="outlined"
                  onClick={startNewConversation}
                  startIcon={<AddIcon />}
                  size="small"
                  sx={{
                    color: 'primary.dark',
                    borderColor: 'primary.dark',
                    backgroundColor: 'background.paper',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  New Chat
                </Button>
              </Box>
            )}

          {/* Save Status - Top Right */}
          {messages.length > 0 && isSavingConversation && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 1002,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: 'background.paper',
                px: 2,
                py: 1,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Saving...
              </Typography>
            </Box>
          )}

          {messages.length === 0
          && ghostMessages['conversation_start']?.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <ChatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
                FIDU CHAT LAB
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.5 }}>
                Start a conversation by typing a message below
              </Typography>
            </Box>
          ) : (
            <>
              {ghostMessages['conversation_start']?.map(
                (message, messageIndex) =>
                  renderMessage(message, messageIndex, true)
              )}
              {messages.map((message, messageIndex) =>
                renderMessage(message, messageIndex)
              )}

              {/* Long request warning */}
              {longRequestAnalysis && (
                <LongRequestWarning
                  analysis={longRequestAnalysis}
                  isVisible={showLongRequestWarning}
                  onCancel={handleCancelRequest}
                />
              )}

              {/* Loading indicator */}
              {isLoading && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      backgroundColor: getModelInfo(selectedModel).color, // Use selected model's color
                      color: 'white',
                      borderRadius: 2,
                      position: 'relative',
                      boxShadow: 2,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        position: 'absolute',
                        top: -12,
                        left: -12,
                        bgcolor: getModelInfo(selectedModel).color,
                      }}
                    >
                      <ModelIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} color="inherit" />
                      <Typography variant="body2">
                        {getModelInfo(selectedModel).name} is thinking...
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Scroll anchor for auto-scrolling */}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>
      </Box>

      {/* Scroll to Bottom Button */}
      {showScrollToBottom && messages.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 200, // Position above the prompt bar
            right: conversationsDrawerOpen ? 320 : 20, // Adjust position based on drawer state
            zIndex: 1001,
            transition: 'right 0.3s ease', // Smooth transition when drawer opens/closes
          }}
        >
          <Button
            variant="contained"
            onClick={scrollToBottom}
            sx={{
              borderRadius: '50%',
              minWidth: 48,
              width: 48,
              height: 48,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 4,
              },
            }}
          >
            <Box>
              <ExpandMoreIcon />
            </Box>
          </Button>
        </Box>
      )}

      {/* Fixed Bottom Prompt Bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: isMobile ? 0 : 240, // Account for sidebar width on desktop
          right: 0,
          background: isMobile
            ? 'transparent'
            : 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.9) 100%)',
          p: isMobile ? 0 : 3,
          zIndex: 1000,
        }}
      >
        {/* Container to center content within chat window */}
        <Box
          sx={{
            maxWidth: isMobile ? '100%' : 800,
            mx: isMobile ? 0 : 'auto',
            px: isMobile ? 0 : 2,
          }}
        >
          {/* System Prompts Sliding Drawer - Desktop Only */}
          {!isMobile && isSystemPromptsEnabled && (
            <Box
              sx={{
                position: 'relative',
                mb: 2,
              }}
            >
              {/* Tab - Always visible, positioned outside the drawer */}
              <Box
                onClick={() =>
                  setSystemPromptDrawerOpen(!systemPromptDrawerOpen)
                }
                sx={{
                  position: 'absolute',
                  bottom: 0, // Always at bottom of container
                  left: '50%',
                  transform: `translateX(-50%) translateY(${systemPromptDrawerOpen ? `-${drawerHeight}px` : '0px'})`, // Move up by actual drawer height
                  zIndex: 1001,
                  cursor: 'pointer',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  px: 6, // Increased from 4 to 5 for wider tab
                  py: 0.45,
                  borderRadius: '8px 8px 0 0',
                  boxShadow: 0,
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    boxShadow: 3,
                  },
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column', // Stack content vertically
                  alignItems: 'center',
                  gap: 0,
                }}
              >
                {/* Main row with text and arrow */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    System Prompts
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      fontSize: 18,
                      transform: systemPromptDrawerOpen
                        ? 'rotate(0deg)'
                        : 'rotate(180deg)',
                      transition: 'transform 0.3s ease',
                    }}
                  />
                </Box>
                {/* Selection count indicator */}
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.65rem', opacity: 0.8, mt: 0 }}
                >
                  {selectedSystemPrompts.length} selected
                </Typography>
              </Box>

              {/* Expandable Drawer - Dynamic height based on content */}
              <Box
                ref={drawerRef}
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '8px 8px 0 0',
                  boxShadow: 3,
                  transform: systemPromptDrawerOpen
                    ? 'translateY(0)'
                    : 'translateY(100%)',
                  transition: 'transform 0.3s ease',
                  zIndex: 1000,
                  maxHeight: systemPromptDrawerOpen ? 'auto' : '0px', // Allow natural height when open
                  overflow: 'hidden',
                }}
              >
                {/* Scrollable Content Container */}
                <Box
                  sx={{
                    p: 3,
                    pt: 4, // Reduced top padding from 6 to 4
                    maxHeight: '400px', // Maximum height constraint
                    overflowY: 'auto', // Make content scrollable
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: 'transparent',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      },
                    },
                  }}
                >
                  {/* Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 3,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      System Prompts
                    </Typography>
                  </Box>

                  {/* Description */}
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.4 }}
                    >
                      System prompts provide instructions to AI models about how
                      to behave and respond. They set the tone and style for
                      conversations, or set specific goals and purposes for the
                      model. Use of multiple system prompts at once is
                      experiemental!
                    </Typography>
                  </Box>

                  {/* System Prompt Suggestor Wizard Button */}
                  {isSystemPromptLibrarianEnabled && (
                    <Box sx={{ mb: 3 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: 'rgba(147, 112, 219, 0.1)',
                          border: '1px solid rgba(147, 112, 219, 0.3)',
                          mb: 2,
                        }}
                      >
                        <HelpOutlineIcon
                          sx={{ color: 'secondary.main', fontSize: 20 }}
                        />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ flexGrow: 1 }}
                        >
                          Not sure what system prompt to use? Ask our librarian
                          wizard:
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<WizardIcon />}
                          onClick={handleOpenSystemPromptSuggestor}
                          sx={{
                            backgroundColor: 'secondary.main',
                            color: 'secondary.contrastText',
                            borderRadius: 2,
                            px: 2,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': {
                              backgroundColor: 'secondary.dark',
                            },
                          }}
                        >
                          Ask Librarian
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Selected System Prompts List */}
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, fontWeight: 500 }}
                    >
                      Selected Prompts:
                    </Typography>
                    {selectedSystemPrompts.length > 0 ? (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {selectedSystemPrompts.map(prompt => (
                          <Box
                            key={prompt.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: 'primary.light',
                              border: 1,
                              borderColor: 'primary.main',
                              position: 'relative',
                            }}
                          >
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography
                                variant="body2"
                                component="div"
                                sx={{ fontWeight: 600, mb: 0.5 }}
                              >
                                {prompt.name}
                                {prompt.isDefault && (
                                  <Chip
                                    label="Default"
                                    size="small"
                                    color="primary"
                                    sx={{ ml: 1, fontSize: '0.6rem' }}
                                  />
                                )}
                              </Typography>
                              {prompt.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                  {prompt.description}
                                </Typography>
                              )}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                {prompt.tokenCount} tokens
                              </Typography>
                            </Box>

                            {/* Change Button */}
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleChangeSystemPrompt(prompt)}
                              sx={{
                                minWidth: 'auto',
                                px: 2,
                                py: 0.5,
                                fontSize: '0.75rem',
                                borderColor: 'primary.main',
                                color: 'primary.main',
                                '&:hover': {
                                  backgroundColor: 'primary.light',
                                  borderColor: 'primary.dark',
                                },
                              }}
                            >
                              Change
                            </Button>

                            <IconButton
                              onClick={() =>
                                handleRemoveSystemPrompt(prompt.id)
                              }
                              size="small"
                              sx={{
                                color: 'error.main',
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'error.contrastText',
                                },
                              }}
                            >
                              <Box sx={{ fontSize: 16 }}>×</Box>
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          p: 3,
                          textAlign: 'center',
                          backgroundColor: 'action.hover',
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic' }}
                        >
                          No system prompts selected
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Add New Button - At the bottom of the list */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      pt: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/system-prompts')}
                      startIcon={<AddIcon />}
                      sx={{
                        fontSize: '0.75rem',
                        px: 3,
                        py: 1,
                      }}
                    >
                      Add New Prompt
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Unified Prompt Entry Container */}
          <Paper
            sx={{
              p: isMobile ? 2 : 0.75,
              borderRadius: isMobile ? 0 : 2,
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: isMobile ? 3 : 1,
              // Mobile-specific positioning
              ...(isMobile
                ? {
                    position: 'fixed',
                    bottom: 0, // At the very bottom of the screen
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    maxWidth: '100vw',
                    borderRadius: 0, // Full width, no border radius
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    borderTop: 1,
                    borderTopColor: 'divider',
                  }
                : {}),
            }}
          >
            {/* Message Input Container */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={isMobile ? 2 : 1}
                maxRows={isMobile ? 4 : 6}
                placeholder={
                  isMobile ? 'Type your message...' : 'Type your message...'
                }
                value={currentPrompt}
                onChange={e => dispatch(setCurrentPrompt(e.target.value))}
                onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: isMobile ? 2 : 2,
                    backgroundColor: 'background.paper',
                    boxShadow: isMobile ? 1 : 1,
                    pr: isMobile ? 18 : 16, // Add right padding to make room for wizard and send buttons
                    fontSize: isMobile ? '1rem' : '0.875rem',
                    minHeight: isMobile ? 48 : 'auto',
                    border: isMobile ? '1px solid rgba(0,0,0,0.12)' : 'none',
                  },
                  '& .MuiInputBase-input': {
                    fontSize: isMobile ? '1rem' : '0.875rem',
                    padding: isMobile ? '12px 14px' : '8px 14px',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ChatIcon
                        color="action"
                        sx={{ fontSize: isMobile ? 20 : 18 }}
                      />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Wizard Button - Inside text box */}
              {isPromptWizardEnabled && (
                <Tooltip title="Open Prompt Wizard">
                  <IconButton
                    onClick={handleOpenWizard}
                    sx={{
                      position: 'absolute',
                      right: isMobile ? 60 : 48,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: isMobile ? 40 : 32,
                      height: isMobile ? 40 : 32,
                      borderRadius: '50%',
                      backgroundColor: 'secondary.main',
                      color: 'secondary.contrastText',
                      '&:hover': {
                        backgroundColor: 'secondary.dark',
                      },
                      '&:active': isMobile
                        ? {
                            transform: 'translateY(-50%) scale(0.95)',
                          }
                        : {},
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <WizardIcon sx={{ fontSize: isMobile ? 20 : 16 }} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Send Button - Inside text box */}
              <IconButton
                onClick={handleSendMessage}
                disabled={!currentPrompt.trim() || isLoading}
                sx={{
                  position: 'absolute',
                  right: isMobile ? 10 : 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isMobile ? 40 : 32,
                  height: isMobile ? 40 : 32,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '&:disabled': {
                    backgroundColor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                  '&:active': isMobile
                    ? {
                        transform: 'translateY(-50%) scale(0.95)',
                      }
                    : {},
                  transition: 'all 0.2s ease',
                }}
              >
                {isLoading ? (
                  <CircularProgress size={isMobile ? 20 : 16} color="inherit" />
                ) : (
                  <SendIcon sx={{ fontSize: isMobile ? 20 : 16 }} />
                )}
              </IconButton>
            </Box>

            {/* Controls Container Box - Mobile responsive */}
            {!isMobile ? (
              <Box
                sx={{
                  display: 'flex',
                  gap: 4,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  mt: 1,
                }}
              >
                {isModelSelectionEnabled && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setModelModalOpen(true)}
                    sx={{
                      minWidth: 200,
                      borderRadius: 4,
                      backgroundColor: 'background.paper',
                      color: 'primary.dark',
                      borderColor: 'primary.dark',
                      boxShadow: 1,
                      fontSize: '0.75rem',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                    }}
                  >
                    model: {selectedModel} ▾
                  </Button>
                )}
                {isContextsEnabled && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setContextModalOpen(true)}
                    sx={{
                      minWidth: 150,
                      borderRadius: 4,
                      backgroundColor: 'background.paper',
                      color: 'primary.dark',
                      borderColor: 'primary.dark',
                      boxShadow: 1,
                      fontSize: '0.75rem',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                    }}
                  >
                    Context:{' '}
                    {selectedContexts.length > 0
                      ? selectedContexts.length === 1
                        ? selectedContexts[0].title
                        : `${selectedContexts.length} selected`
                      : 'None'}{' '}
                    ▾
                  </Button>
                )}
                {isViewCopyFullPromptEnabled && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setFullPromptModalOpen(true)}
                    sx={{
                      minWidth: 150,
                      borderRadius: 4,
                      backgroundColor: 'background.paper',
                      color: 'primary.dark',
                      borderColor: 'primary.dark',
                      boxShadow: 1,
                      fontSize: '0.75rem',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.main',
                        boxShadow: 2,
                      },
                    }}
                  >
                    View/Copy Full Prompt
                  </Button>
                )}
              </Box>
            ) : (
              // Mobile controls - Collapsible
              <Collapse in={showMobileControls}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    mt: 1.5,
                    px: 0.5,
                  }}
                >
                  {isModelSelectionEnabled && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setModelModalOpen(true)}
                      sx={{
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                    >
                      model: {selectedModel} ▾
                    </Button>
                  )}
                  {isContextsEnabled && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setContextModalOpen(true)}
                      sx={{
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                    >
                      Context:{' '}
                      {selectedContexts.length > 0
                        ? selectedContexts.length === 1
                          ? selectedContexts[0].title
                          : `${selectedContexts.length} selected`
                        : 'None'}{' '}
                      ▾
                    </Button>
                  )}
                  {isSystemPromptLibrarianEnabled && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setSystemPromptModalOpen(true)}
                      sx={{
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                    >
                      System Prompts ({selectedSystemPrompts.length}) ▾
                    </Button>
                  )}
                  {isViewCopyFullPromptEnabled && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setFullPromptModalOpen(true)}
                      sx={{
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                    >
                      View Full Prompt
                    </Button>
                  )}
                  {isRecentConversationsInChatPageEnabled && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        setConversationsDrawerOpen(!conversationsDrawerOpen)
                      }
                      sx={{
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                    >
                      Recent Conversations
                    </Button>
                  )}
                </Box>
              </Collapse>
            )}

            {/* Mobile Controls Toggle and New Chat Button */}
            {isMobile && (
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  mt: 1.5,
                  mb: 0.5,
                  px: 2,
                }}
              >
                {/* New Chat Button - Positioned at 1/4 from left */}
                {messages.length > 0 && isNewChatButtonInChatPageEnabled && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '20%',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <Button
                      variant="outlined"
                      onClick={startNewConversation}
                      startIcon={<AddIcon />}
                      size="small"
                      sx={{
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        fontSize: '0.75rem',
                        px: 2,
                        py: 0.75,
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      New Chat
                    </Button>
                  </Box>
                )}

                {/* Menu Toggle Button - Centered */}
                <IconButton
                  onClick={() => setShowMobileControls(!showMobileControls)}
                  sx={{
                    backgroundColor: 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                    width: 44,
                    height: 44,
                  }}
                >
                  {showMobileControls ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                </IconButton>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Right Sidebar - Recent Conversations */}
      {isRecentConversationsInChatPageEnabled && (
        <Drawer
          anchor="right"
          open={conversationsDrawerOpen}
          onClose={() => setConversationsDrawerOpen(false)}
          variant={isMobile ? 'temporary' : 'persistent'}
          sx={{
            '& .MuiDrawer-paper': {
              width: isMobile ? '85vw' : 300,
              maxWidth: isMobile ? 400 : 300,
              boxSizing: 'border-box',
              borderLeft: 1,
              borderColor: 'divider',
              backgroundColor: 'rgba(147, 112, 219, 0.1)', // Light purple background
              backdropFilter: 'blur(10px)',
            },
          }}
        >
          <Box
            sx={{
              p: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: 'primary.main',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              Recent Conversations:
            </Typography>

            {loadingConversations ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <List sx={{ flex: 1 }}>
                  {recentConversations.map(conversation => (
                    <ListItem key={conversation.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleSelectConversation(conversation)}
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          border: 1,
                          borderColor: 'divider',
                          backgroundColor: 'background.paper',
                          '&:hover': {
                            backgroundColor: 'rgba(147, 112, 219, 0.1)',
                            borderColor: 'primary.main',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                lineHeight: 1.3,
                                mb: 0.5,
                              }}
                            >
                              {conversation.title}
                            </Typography>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {conversation.lastMessage || 'No messages'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>

                {/* View All Button */}
                <Box
                  sx={{
                    mt: 'auto',
                    pt: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/conversations')}
                    sx={{
                      borderRadius: 2,
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                      },
                    }}
                  >
                    View All
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Drawer>
      )}
      {/* Chat History Tab - Desktop Only */}
      {!isMobile && isRecentConversationsInChatPageEnabled && (
        <Tooltip title="Recent Conversations" placement="left">
          <Box
            onClick={() => setConversationsDrawerOpen(!conversationsDrawerOpen)}
            sx={{
              position: 'fixed',
              right: conversationsDrawerOpen ? 300 : 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              cursor: 'pointer',
              transition: 'right 0.3s ease',
            }}
          >
            <Paper
              elevation={3}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1.5,
                borderRadius: '8px 0 0 8px',
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                boxShadow: 2,
                '&:hover': {
                  backgroundColor: 'primary.dark',
                  boxShadow: 4,
                },
              }}
            >
              <ChevronLeftIcon
                sx={{
                  fontSize: 18,
                  transform: conversationsDrawerOpen
                    ? 'rotate(180deg)'
                    : 'none',
                  transition: 'transform 0.3s ease',
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ChatBubbleIcon sx={{ fontSize: 20 }} />
                <Box
                  component="img"
                  src={HistoryIcon}
                  alt="Chat history"
                  sx={{
                    width: 30,
                    height: 30,
                    opacity: 0.8,
                  }}
                />
              </Box>
            </Paper>
          </Box>
        </Tooltip>
      )}

      {/* Wizard Tab - Desktop Only */}
      {!isMobile && wizardMessages.length > 0 && isPromptWizardEnabled && (
        <Tooltip title="Prompt Wizard" placement="left">
          <Box
            onClick={wizardOpen ? handleMinimizeWizard : handleMaximizeWizard}
            sx={{
              position: 'fixed',
              right: wizardOpen && !wizardMinimized ? 600 : 0,
              top: conversationsDrawerOpen
                ? 'calc(50% + 80px)'
                : 'calc(50% + 50px)', // Position below conversations tab with more gap
              transform: 'translateY(-50%)',
              zIndex: 1000,
              cursor: 'pointer',
              transition: 'right 0.3s ease',
            }}
          >
            <Paper
              elevation={3}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1.5,
                borderRadius: '8px 0 0 8px',
                backgroundColor: 'secondary.main',
                color: 'secondary.contrastText',
                boxShadow: 2,
                '&:hover': {
                  backgroundColor: 'secondary.dark',
                  boxShadow: 4,
                },
              }}
            >
              <ChevronLeftIcon
                sx={{
                  fontSize: 18,
                  transform: wizardOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s ease',
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WizardIcon sx={{ fontSize: 20 }} />
              </Box>
            </Paper>
          </Box>
        </Tooltip>
      )}

      {/* System Prompt Suggestor Tab - Desktop Only */}
      {!isMobile
        && systemPromptSuggestorMessages.length > 0
        && isSystemPromptLibrarianEnabled && (
          <Tooltip title="System Prompt Librarian" placement="left">
            <Box
              onClick={
                systemPromptSuggestorOpen
                  ? handleMinimizeSystemPromptSuggestor
                  : handleMaximizeSystemPromptSuggestor
              }
              sx={{
                position: 'fixed',
                right:
                  systemPromptSuggestorOpen && !systemPromptSuggestorMinimized
                    ? 600
                    : 0,
                top: conversationsDrawerOpen
                  ? 'calc(50% + 140px)'
                  : 'calc(50% + 110px)', // Position below wizard tab
                transform: 'translateY(-50%)',
                zIndex: 1000,
                cursor: 'pointer',
                transition: 'right 0.3s ease',
              }}
            >
              <Paper
                elevation={3}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1.5,
                  borderRadius: '8px 0 0 8px',
                  backgroundColor: 'secondary.main',
                  color: 'secondary.contrastText',
                  boxShadow: 2,
                  '&:hover': {
                    backgroundColor: 'secondary.dark',
                    boxShadow: 4,
                  },
                }}
              >
                <ChevronLeftIcon
                  sx={{
                    fontSize: 18,
                    transform: systemPromptSuggestorOpen
                      ? 'rotate(180deg)'
                      : 'none',
                    transition: 'transform 0.3s ease',
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MenuBookIcon sx={{ fontSize: 20 }} />
                </Box>
              </Paper>
            </Box>
          </Tooltip>
        )}

      {/* Modals */}
      <ModelSelectionModal
        open={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelectModel={model => {
          setSelectedModel(model);
          dispatch(updateLastUsedModel(model));
          setModelModalOpen(false);
        }}
        onAutoModeToggle={model => {
          setSelectedModel(model);
          dispatch(updateLastUsedModel(model));
          // Don't close the modal for auto mode toggles
        }}
        selectedModel={selectedModel}
      />

      <ContextSelectionModal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        onAddContext={context => {
          setSelectedContexts(prev => {
            // Prevent duplicates
            if (prev.some(ctx => ctx.id === context.id)) {
              return prev;
            }
            return [...prev, context];
          });
        }}
        onRemoveContext={contextId => {
          setSelectedContexts(prev => prev.filter(ctx => ctx.id !== contextId));
        }}
        contexts={contexts}
        selectedContexts={selectedContexts}
        loading={contextsLoading}
        error={contextsError}
        onCreateNewContext={() => setCreateContextModalOpen(true)}
        onClearAllContexts={() => {
          setSelectedContexts([]);
        }}
      />

      {/* Create Context Modal */}
      <Dialog
        open={createContextModalOpen}
        onClose={() => setCreateContextModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Context</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={contextForm.title}
              onChange={e =>
                setContextForm(prev => ({ ...prev, title: e.target.value }))
              }
              slotProps={{
                htmlInput: { maxLength: RESOURCE_TITLE_MAX_LENGTH },
              }}
              helperText={`${contextForm.title.length}/${RESOURCE_TITLE_MAX_LENGTH} characters`}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Body"
              multiline
              rows={4}
              value={contextForm.body}
              onChange={e =>
                setContextForm(prev => ({ ...prev, body: e.target.value }))
              }
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateContextModalOpen(false)}
            sx={{ color: 'primary.dark' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateContextSubmit}
            disabled={isCreatingContext || !contextForm.title.trim()}
          >
            {isCreatingContext ? 'Creating...' : 'Create Context'}
          </Button>
        </DialogActions>
      </Dialog>

      <SystemPromptSelectionModal
        open={systemPromptModalOpen}
        onClose={() => {
          setSystemPromptModalOpen(false);
          setChangingSystemPrompt(null); // Reset change state when closing
        }}
        onSelectSystemPrompt={systemPrompt => {
          if (changingSystemPrompt) {
            // Replace the specific system prompt
            setSelectedSystemPrompts(prev =>
              prev.map(sp =>
                sp.id === changingSystemPrompt.id ? systemPrompt : sp
              )
            );
            setChangingSystemPrompt(null);
            showToast(
              `System prompt "${changingSystemPrompt.name}" replaced with "${systemPrompt.name}"`
            );
          } else {
            // Smart replacement: if only default is selected, replace it; otherwise add
            setSelectedSystemPrompts(prev => {
              // Check if only one prompt is selected and it's the default
              const isOnlyDefaultSelected =
                prev.length === 1 && prev[0].isDefault;

              if (isOnlyDefaultSelected) {
                // Replace the default with the new prompt
                return [systemPrompt];
              } else {
                // Add to existing selection (avoid duplicates)
                return prev.some(sp => sp.id === systemPrompt.id)
                  ? prev
                  : [...prev, systemPrompt];
              }
            });

            // Show appropriate toast message
            const isOnlyDefaultSelected =
              selectedSystemPrompts.length === 1
              && selectedSystemPrompts[0].isDefault;
            if (isOnlyDefaultSelected) {
              showToast(
                `System prompt "${systemPrompt.name}" replaced the default prompt`
              );
            } else {
              showToast(`System prompt "${systemPrompt.name}" added`);
            }
          }
          setSystemPromptModalOpen(false);
        }}
        systemPrompts={systemPrompts}
        selectedSystemPrompts={selectedSystemPrompts}
        onRemoveSystemPrompt={handleRemoveSystemPrompt}
        onOpenLibrarianWizard={() => {
          setSystemPromptModalOpen(false);
          handleOpenSystemPromptSuggestor();
        }}
        loading={systemPromptsLoading}
        error={systemPromptsError}
        title={
          changingSystemPrompt
            ? `Change System Prompt: ${changingSystemPrompt.name}`
            : 'Add System Prompt'
        }
      />

      <FullPromptModal
        open={fullPromptModalOpen}
        onClose={() => setFullPromptModalOpen(false)}
        fullPrompt={constructFullPrompt()}
      />

      {/* Wizard Window */}
      <WizardWindow
        open={wizardOpen}
        onClose={handleCloseWizard}
        onMinimize={handleMinimizeWizard}
        title="Prompt Wizard"
        messages={wizardMessages}
        isLoading={wizardLoading}
        error={wizardError}
        onSendMessage={handleWizardSendMessage}
        onCopyResult={handleCopyWizardResult}
        onClearConversation={handleClearWizardConversation}
        initialMessage={wizardInitialMessage}
        modelName="GPT-OSS 120B"
      />

      {/* System Prompt Suggestor Wizard Window */}
      <WizardWindow
        open={systemPromptSuggestorOpen}
        onClose={handleCloseSystemPromptSuggestor}
        onMinimize={handleMinimizeSystemPromptSuggestor}
        title="System Prompt Librarian"
        messages={systemPromptSuggestorMessages}
        isLoading={systemPromptSuggestorLoading}
        error={systemPromptSuggestorError}
        onSendMessage={handleSystemPromptSuggestorSendMessage}
        onCopyResult={handleCopySystemPromptSuggestorResult}
        onClearConversation={handleClearSystemPromptSuggestorConversation}
        initialMessage={systemPromptSuggestorInitialMessage}
        modelName="GPT-OSS 120B"
        onAddSystemPrompt={handleAddSystemPromptFromWizard}
        systemPrompts={systemPrompts}
        showCopyButton={false}
        icon={<MenuBookIcon color="secondary" />}
      />

      {/* Toast Notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={2000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbar-root': {
            bottom: 120, // Position above the prompt area
          },
        }}
      >
        <Alert
          onClose={() => setToastOpen(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* Background Agents Floating Button */}
      {isBackgroundAgentsEnabled && (
        <Tooltip
          title={
            backgroundAgentsEvaluating
              ? 'Evaluating background agents...'
              : unreadAlertCount > 0
                ? `Background Agents (${unreadAlertCount} unread alert${unreadAlertCount !== 1 ? 's' : ''})`
                : 'Background Agents'
          }
          placement="left"
        >
          <Box
            sx={{
              position: 'fixed',
              bottom: isMobile ? 16 : 100,
              right: isMobile ? 16 : 24,
              zIndex: 1000,
            }}
          >
            <IconButton
              onClick={() => {
                setBackgroundAgentsDialogOpen(true);
                // Refresh unread count when opening (filtered by current conversation)
                // The useEffect will handle the update automatically, but this ensures it's immediate
              }}
              sx={{
                backgroundColor:
                  unreadAlertCount > 0 ? 'error.main' : 'primary.main',
                color: 'white',
                width: isMobile ? 48 : 56,
                height: isMobile ? 48 : 56,
                boxShadow: unreadAlertCount > 0 ? 6 : 3,
                '&:hover': {
                  backgroundColor:
                    unreadAlertCount > 0 ? 'error.dark' : 'primary.dark',
                  boxShadow: 8,
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease-in-out',
                ...(unreadAlertCount > 0
                  && !backgroundAgentsEvaluating && {
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.8 },
                    },
                  }),
                position: 'relative',
              }}
            >
              <Badge
                badgeContent={unreadAlertCount > 0 ? unreadAlertCount : 0}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.75rem',
                    minWidth: unreadAlertCount > 9 ? 20 : 18,
                    height: unreadAlertCount > 9 ? 20 : 18,
                    padding: unreadAlertCount > 9 ? '0 4px' : 0,
                  },
                }}
              >
                <SmartToyIcon />
              </Badge>
              {/* Subtle spinner overlay when evaluating */}
              {backgroundAgentsEvaluating && (
                <CircularProgress
                  size={32}
                  thickness={3}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: '-16px',
                    marginLeft: '-16px',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                />
              )}
            </IconButton>
          </Box>
        </Tooltip>
      )}

      {/* Background Agents Dialog */}
      <Dialog
        open={backgroundAgentsDialogOpen}
        onClose={() => {
          setBackgroundAgentsDialogOpen(false);
          setAlertToExpand(null); // Clear the alert to expand when closing
        }}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 1, sm: 2 },
            height: { xs: '90vh', sm: 'auto' },
            maxHeight: { xs: '90vh', sm: '80vh' },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SmartToyIcon />
            <Typography variant="h6">Active Background Agents</Typography>
            {unreadAlertCount > 0 && (
              <Badge
                badgeContent={unreadAlertCount}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    ml: 1, // Additional left margin for spacing
                  },
                }}
              >
                <Box />
              </Badge>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
          {backgroundAgentsLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : backgroundAgents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SmartToyIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                No active background agents
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setBackgroundAgentsDialogOpen(false);
                  navigate('/background-agents');
                }}
                sx={{
                  color: 'primary.dark',
                  borderColor: 'primary.dark',
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
                  },
                }}
              >
                Add More Agents
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {backgroundAgents.map(agent => {
                // Get alerts for this agent, filtered by current conversation
                const allAlerts = getFilteredAlerts({
                  agentId: agent.id,
                  conversationId: currentConversationId,
                });
                const namedAgent = {
                  ...agent,
                  outputDocumentName:
                    documents.find(doc => doc.id === agent.outputDocumentId)
                      ?.title || agent.outputDocumentId,
                };
                return (
                  <BackgroundAgentDialogCard
                    key={agent.id}
                    agent={namedAgent}
                    onUpdatePreference={handleUpdateBackgroundAgentPreference}
                    alerts={allAlerts}
                    autoExpand={allAlerts.some(
                      alert => alert.id === alertToExpand
                    )}
                    alertIdToExpand={alertToExpand || undefined}
                    onAlertsChanged={() => {
                      // Refresh unread counts when alerts are marked as read (filtered by current conversation)
                      setUnreadAlertCount(
                        currentConversationId
                          ? getUnreadAlertCount(currentConversationId)
                          : 0
                      );
                    }}
                    onJumpToMessage={handleJumpToMessage}
                    onAlertExpanded={() => {
                      // Clear the alertToExpand state to release scroll lock
                      setAlertToExpand(null);
                    }}
                  />
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2 },
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Button
            onClick={() => {
              setTimelineModalOpen(true);
            }}
            startIcon={<MenuBookIcon />}
            variant="outlined"
            sx={{
              mr: 'auto',
              color: 'primary.dark',
              borderColor: 'primary.dark',
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'primary.light',
                borderColor: 'primary.main',
              },
            }}
          >
            View All Alerts Timeline
          </Button>
          <Button
            onClick={() => {
              setBackgroundAgentsDialogOpen(false);
              navigate('/background-agents');
            }}
            startIcon={<AddIcon />}
            variant="outlined"
            sx={{
              color: 'primary.dark',
              borderColor: 'primary.dark',
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'primary.light',
                borderColor: 'primary.main',
              },
            }}
          >
            Add More Agents
          </Button>
          <Button
            onClick={() => setBackgroundAgentsDialogOpen(false)}
            sx={{
              color: 'primary.dark',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert Timeline Modal */}
      <AlertTimelineModal
        open={timelineModalOpen}
        onClose={() => {
          setTimelineModalOpen(false);
          // Refresh counts when closing (filtered by current conversation)
          // The useEffect will handle the update automatically
        }}
        conversationId={currentConversationId}
        currentAgents={backgroundAgents}
        onAlertsChanged={() => {
          // Refresh counts when alerts change (filtered by current conversation)
          setUnreadAlertCount(
            currentConversationId
              ? getUnreadAlertCount(currentConversationId)
              : 0
          );
        }}
      />
    </Box>
  );
}
