import {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  type JSX,
  type MouseEvent,
} from 'react';
import { EnhancedMarkdown } from '../components/common/EnhancedMarkdown';
import { AssistantAttachmentImage } from '../components/common/AssistantAttachmentImage';
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
  Menu,
  Divider,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  Collapse,
  Link,
  Badge,
  Slider,
  useTheme,
} from '@mui/material';
import { CategoryFilter } from '../components/common/CategoryFilter';
import {
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
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
  SmartToy as SmartToyIcon,
  ArrowUpward as ArrowUpwardIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import {
  fetchContexts,
  createContext,
  updateContext,
} from '../store/slices/contextsSlice';
import {
  updateLastUsedModel,
  updateMessageDownloadPreferences,
} from '../store/slices/settingsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import {
  deleteConversation,
  updateConversationWithMessages,
} from '../store/slices/conversationsSlice';
import { conversationsService } from '../services/conversationsService';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { BUILT_IN_BACKGROUND_AGENTS } from '../data/backgroundAgents';
import type { BackgroundAgent } from '../types';
import { useMobile, useResponsiveSpacing } from '../hooks/useMobile';
import { ApiError } from '../services/api/apiClients';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import {
  promptsApi,
  buildCompletePrompt,
  type ExecutePromptResponsesPayload,
} from '../services/api/prompts';
import ModelSelectionModal from '../components/prompts/ModelSelectionModal';
import { WizardWindow } from '../components/wizards/WizardWindow';
import ContextHelpModal from '../components/help/ContextHelpModal';
import SystemPromptHelpModal from '../components/help/SystemPromptHelpModal';
import {
  subscribeToAgentAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
} from '../services/agents/agentAlerts';
import { getFilteredAlerts } from '../services/agents/agentAlertHistory';
import AlertTimelineModal from '../components/alerts/AlertTimelineModal';
import { wizardSystemPrompts } from '../data/prompts/wizardSystemPrompts';
import HistoryIcon from '../assets/HistoryIcon.png';
import type { Conversation, Message, Context, SystemPrompt } from '../types';
import type { WizardMessage } from '../types/wizard';
import { OpenRouterAPIError } from '../types/openRouter';
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
import {
  openRouterImagePartsToAttachments,
  responseHasDisplayableChatPayload,
} from '../utils/openRouterAttachments';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { getModelConfig, loadOpenRouterModels } from '../data/models';
import { usePromptLabScrollBehavior } from '../hooks/usePromptLabScrollBehavior';
import ConversationCopyExportDialog from '../components/conversations/ConversationCopyExportDialog';
import AddToContextDialog from '../components/conversations/AddToContextDialog';
import {
  buildConversationExportFilename,
  buildConversationExportText,
  collectImageAttachments,
  copyTextToClipboard,
  downloadImageByUrl,
  downloadTextFile,
  type ConversationExportFormat,
} from '../utils/conversationExport';
import {
  endPerfMark,
  recordPerfMetric,
  runAfterNextFrame,
  startPerfMark,
} from '../utils/perfMarks';
import {
  clearLegacyPromptLabSessionStorageKeys,
  getPromptLabSessionScope,
  getPromptLabSessionStorageKeys,
  PROMPTLAB_SESSION_PENDING_SCOPE,
} from '../utils/promptLabSessionStorage';

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

const safeRecordGeneratedImages = (model: string, count: number): void => {
  if (count <= 0) return;
  try {
    if (
      typeof MetricsService !== 'undefined'
      && MetricsService?.recordImageGenerated
    ) {
      MetricsService.recordImageGenerated(model, count);
    }
  } catch (error) {
    console.debug(
      'Generated-image metrics recording failed (non-blocking):',
      error
    );
  }
};

const SHARED_WORKSPACE_VISIBLE_IMAGE_WARNING =
  'Image sharing in shared workspaces is not currently supported. Only you can see this image. Other members will still be able to see this image via the Google Drive Interface';
const SHARED_WORKSPACE_MISSING_IMAGE_WARNING =
  'Image Missing. Image sharing in shared workspaces is not currently supported. You may still view this image by visiting the shared workspace folder in your Google Drive';

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

interface MessageActionsButtonProps {
  messageIndex: number;
  isMobile: boolean;
  themeMode: 'light' | 'dark';
  onCopySingleMessage: (messageIndex: number) => Promise<void>;
  onCopyConversationRange: (messageIndex: number) => Promise<void>;
  onRequestDownload: (
    messageIndex: number,
    mode: 'single' | 'from-here'
  ) => void;
  addToContextEnabled?: boolean;
  onRequestAddToContext?: (
    messageIndex: number,
    mode: 'single' | 'from-here'
  ) => void;
}

const MessageActionsButton = memo(function MessageActionsButton({
  messageIndex,
  isMobile,
  themeMode,
  onCopySingleMessage,
  onCopyConversationRange,
  onRequestDownload,
  addToContextEnabled = false,
  onRequestAddToContext,
}: MessageActionsButtonProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const openMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const closeMenu = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const menuAria = addToContextEnabled
    ? 'Copy, download, or add message to context'
    : 'Copy or download message';

  return (
    <>
      <Tooltip
        title={
          addToContextEnabled
            ? 'Copy, download, or add to context'
            : 'Copy or download message'
        }
        placement="top"
        arrow
      >
        <IconButton
          onClick={openMenu}
          sx={{
            position: 'absolute',
            top: isMobile ? 6 : 8,
            right: isMobile ? 6 : 8,
            width: isMobile ? 40 : 36,
            height: isMobile ? 40 : 36,
            borderRadius: '50%',
            backgroundColor:
              themeMode === 'light'
                ? 'rgba(0,0,0,0.14)'
                : 'rgba(255,255,255,0.24)',
            color: themeMode === 'light' ? 'text.primary' : 'white',
            opacity: 0.9,
            zIndex: 10,
            boxShadow: '0 2px 5px rgba(0,0,0,0.24)',
            '&:hover': {
              backgroundColor:
                themeMode === 'light'
                  ? 'rgba(0,0,0,0.22)'
                  : 'rgba(255,255,255,0.36)',
              opacity: 1,
              transform: 'scale(1.1)',
              boxShadow: '0 5px 10px rgba(0,0,0,0.34)',
            },
            '&:active': isMobile
              ? {
                  transform: 'scale(0.95)',
                  backgroundColor:
                    themeMode === 'light'
                      ? 'rgba(0,0,0,0.28)'
                      : 'rgba(255,255,255,0.44)',
                }
              : {},
            transition: 'all 0.2s ease',
          }}
          aria-label={menuAria}
        >
          <ContentCopyIcon sx={{ fontSize: isMobile ? 20 : 18 }} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem
          onClick={async () => {
            closeMenu();
            await onCopySingleMessage(messageIndex);
          }}
        >
          Copy this message to clipboard
        </MenuItem>
        <MenuItem
          onClick={async () => {
            closeMenu();
            await onCopyConversationRange(messageIndex);
          }}
        >
          Copy this message and all below to clipboard
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onRequestDownload(messageIndex, 'single');
          }}
        >
          Download this message as file
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onRequestDownload(messageIndex, 'from-here');
          }}
        >
          Download this message and all below
        </MenuItem>
        {addToContextEnabled
          && onRequestAddToContext && [
            <Divider key="message-actions-add-to-context-divider" />,
            <MenuItem
              key="message-actions-add-to-context-single"
              onClick={() => {
                closeMenu();
                onRequestAddToContext(messageIndex, 'single');
              }}
            >
              Add this message to a context…
            </MenuItem>,
            <MenuItem
              key="message-actions-add-to-context-from-here"
              onClick={() => {
                closeMenu();
                onRequestAddToContext(messageIndex, 'from-here');
              }}
            >
              Add this message and all below to a context…
            </MenuItem>,
          ]}
      </Menu>
    </>
  );
});

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
const USAGE_LIMIT_REACHED_MESSAGE = `Usage Limit Reached: You have reached your spending limit for the month. This will reset on the first of each month. You can check your usage limits via the FIDU dashboard at [identity.firstdataunion.org](https://identity.firstdataunion.org)

To get more usage, visit the FIDU dashboard at [identity.firstdataunion.org](https://identity.firstdataunion.org) and purchase more credits via the 'Usage' tab.

If you have any questions or feedback while we work on this area of the product, please get in touch at hello@firstdataunion.org`;

type ContextWindowOverflowDetails = {
  maxContextTokens?: number;
  requestedTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

const parseContextWindowOverflowDetails = (
  message: string
): ContextWindowOverflowDetails | null => {
  const normalized = message.toLowerCase();
  if (
    !normalized.includes('maximum context length')
    || !normalized.includes('requested')
  ) {
    return null;
  }

  const details: ContextWindowOverflowDetails = {};
  const maxMatch = message.match(/maximum context length is\s+(\d+)\s+tokens/i);
  const requestedMatch = message.match(
    /requested(?: about)?\s+(\d+)\s+tokens/i
  );
  const breakdownMatch = message.match(
    /\((\d+)\s+of text input,\s*(\d+)\s+in the output\)/i
  );

  if (maxMatch?.[1]) {
    details.maxContextTokens = Number.parseInt(maxMatch[1], 10);
  }
  if (requestedMatch?.[1]) {
    details.requestedTokens = Number.parseInt(requestedMatch[1], 10);
  }
  if (breakdownMatch?.[1] && breakdownMatch?.[2]) {
    details.inputTokens = Number.parseInt(breakdownMatch[1], 10);
    details.outputTokens = Number.parseInt(breakdownMatch[2], 10);
  }

  return details;
};

const formatTokenCount = (value?: number): string | null =>
  Number.isFinite(value) ? Number(value).toLocaleString() : null;

const buildContextWindowOverflowMessage = (
  details: ContextWindowOverflowDetails
): string => {
  const maxTokens = formatTokenCount(details.maxContextTokens);
  const requestedTokens = formatTokenCount(details.requestedTokens);
  const inputTokens = formatTokenCount(details.inputTokens);
  const outputTokens = formatTokenCount(details.outputTokens);

  if (maxTokens && requestedTokens && inputTokens && outputTokens) {
    return `This request is too large for the selected model's context window (${maxTokens} tokens max, ${requestedTokens} requested as ${inputTokens} input + ${outputTokens} output). The context includes the whole conversation, not just your latest message. Please shorten your prompt/context, start a new conversation, or pick a model from the list with a larger token window.`;
  }

  if (maxTokens && requestedTokens) {
    return `This request is too large for the selected model's context window (${maxTokens} tokens max, ${requestedTokens} requested). The context includes the whole conversation, not just your latest message. Please shorten your prompt/context, start a new conversation, or pick a model from the list with a larger token window.`;
  }

  return 'This request is too large for the selected model context window. The context includes the whole conversation, not just your latest message. Please shorten your prompt/context, start a new conversation, or pick a model from the list with a larger token window.';
};

const getContextWindowOverflowDetailsFromError = (
  error: unknown
): ContextWindowOverflowDetails | null => {
  if (!(error instanceof Error) || !error.message) {
    return null;
  }
  return parseContextWindowOverflowDetails(error.message);
};

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
      case 402:
        return {
          userMessage: USAGE_LIMIT_REACHED_MESSAGE,
          debugInfo: { ...debugInfo, cause: 'Usage limit reached' },
        };
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

  if (error instanceof OpenRouterAPIError && error.status === 402) {
    return {
      userMessage: USAGE_LIMIT_REACHED_MESSAGE,
      debugInfo: { ...debugInfo, cause: 'Usage limit reached' },
    };
  }

  const contextWindowOverflowDetails =
    getContextWindowOverflowDetailsFromError(error);
  if (contextWindowOverflowDetails) {
    return {
      userMessage: buildContextWindowOverflowMessage(
        contextWindowOverflowDetails
      ),
      debugInfo: {
        ...debugInfo,
        cause: 'Context window exceeded',
        contextWindowOverflowDetails,
      },
    };
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

export default function PromptLabPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const theme = useTheme();

  // `PerformanceNavigationTiming.type` reflects the *initial* document load only.
  // A prior version keyed off that alone and never reset, so after any full refresh
  // in-app navigations (PUSH) were wrongly treated as "reload" and router state
  // (e.g. load conversation) was discarded. Only skip replay on the POP that
  // corresponds to a real document reload.
  const skipReplayOfRouterStateAfterDocumentReload = useMemo(() => {
    if (navigationType !== 'POP') return false;
    if (typeof window === 'undefined') return false;
    const nav = window.performance.getEntriesByType?.('navigation')?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav?.type === 'reload';
  }, [navigationType]);

  // Mobile responsiveness
  const { isMobile } = useMobile();
  const spacing = useResponsiveSpacing();

  // Redux state
  const { currentPrompt: initialPromptValue } = useAppSelector(
    state => state.promptLab
  );
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
  const isDirectOpenRouterEnabled = useFeatureFlag('direct_openrouter');
  const isSharedWorkspace = unifiedStorage.activeWorkspace?.type === 'shared';
  const openToFirstPaintMarkRef = useRef<string | null>(
    startPerfMark('promptlab_open_to_first_paint_ms')
  );
  const openToDataReadyMarkRef = useRef<string | null>(
    startPerfMark('promptlab_open_to_initial_data_ready_ms')
  );
  const hasRecordedOpenDataReadyRef = useRef(false);

  // Load OpenRouter models when feature flag is enabled
  useEffect(() => {
    if (isDirectOpenRouterEnabled) {
      loadOpenRouterModels().catch(error => {
        console.error(
          '[PromptLabPage] Failed to load OpenRouter models:',
          error
        );
      });
    }
  }, [isDirectOpenRouterEnabled]);

  useEffect(() => {
    const firstPaintMark = openToFirstPaintMarkRef.current;
    runAfterNextFrame(() => {
      recordPerfMetric(
        'promptlab_open_to_first_paint_ms',
        endPerfMark(firstPaintMark)
      );
      openToFirstPaintMarkRef.current = null;
    });
  }, []);

  // Session snapshots are scoped per profile so switching accounts does not reuse
  // another user's Prompt Lab state (or collide on non-globally-unique conversation ids).
  const promptLabSessionScope = getPromptLabSessionScope(currentProfile?.id);

  const STORAGE_KEYS = useMemo(
    () => getPromptLabSessionStorageKeys(promptLabSessionScope),
    [promptLabSessionScope]
  );

  // Helper functions for persistence
  const saveToSession = useCallback((key: string, data: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error);
    }
  }, []);

  /**
   * Keep session snapshots lightweight: preserve attachment metadata/state, but
   * strip large inline generated-image data URLs to avoid sessionStorage quotas.
   */
  const sanitizeMessagesForSession = useCallback(
    (input: Message[]): Message[] => {
      return input.map(message => ({
        ...message,
        attachments: message.attachments?.map(att => {
          if (att.type !== 'image') return att;
          if (typeof att.url !== 'string') return att;
          const trimmed = att.url.trim();
          if (!trimmed.startsWith('data:image/')) return att;
          return {
            ...att,
            url: undefined,
          };
        }),
      }));
    },
    []
  );

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
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const lastSessionHydratedConversationIdRef = useRef<string | null>(null);
  const pendingRefreshImageRetryConversationIdRef = useRef<string | null>(null);
  const pendingRefreshImageRetryAttemptsRef = useRef(0);

  const [selectedContexts, setSelectedContexts] = useState<Context[]>(() => {
    try {
      const ctxKey = getPromptLabSessionStorageKeys(
        getPromptLabSessionScope(currentProfile?.id)
      ).context;
      const data = loadFromSession(ctxKey);
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
  const [
    isLoadingConversationFromNavigation,
    setIsLoadingConversationFromNavigation,
  ] = useState(false);
  const [isHydratingSessionImages, setIsHydratingSessionImages] =
    useState(false);
  const [isRetryHydratingSessionImages, setIsRetryHydratingSessionImages] =
    useState(false);
  const [isRetryingImageLoads, setIsRetryingImageLoads] = useState(false);
  const recentConversationsRequestSeqRef = useRef(0);
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

  const prevPromptLabSessionScopeRef = useRef<string | null>(null);
  useEffect(() => {
    // While router is handing us a conversation from another page, do not hydrate
    // from sessionStorage — profile scope can resolve mid-flight (__pending__ → id)
    // and would overwrite the navigation target before getMessages completes.
    if (location.state?.loadConversation) {
      if (promptLabSessionScope !== PROMPTLAB_SESSION_PENDING_SCOPE) {
        clearLegacyPromptLabSessionStorageKeys();
      }
      prevPromptLabSessionScopeRef.current = promptLabSessionScope;
      return;
    }

    const prev = prevPromptLabSessionScopeRef.current;
    if (prev === promptLabSessionScope) {
      return;
    }

    if (promptLabSessionScope !== PROMPTLAB_SESSION_PENDING_SCOPE) {
      clearLegacyPromptLabSessionStorageKeys();
    }

    const shouldReloadFromStorage =
      promptLabSessionScope !== PROMPTLAB_SESSION_PENDING_SCOPE
      && (prev === PROMPTLAB_SESSION_PENDING_SCOPE
        || (prev !== null && prev !== promptLabSessionScope));

    if (shouldReloadFromStorage) {
      lastSessionHydratedConversationIdRef.current = null;
      pendingRefreshImageRetryConversationIdRef.current = null;
      pendingRefreshImageRetryAttemptsRef.current = 0;
      setMessages(loadFromSession(STORAGE_KEYS.messages) || []);
      setCurrentConversation(
        loadFromSession(STORAGE_KEYS.conversation) || null
      );
      const rawCtx = loadFromSession(STORAGE_KEYS.context);
      setSelectedContexts(() => {
        if (!rawCtx) return [];
        if (Array.isArray(rawCtx)) return rawCtx as Context[];
        if (rawCtx && typeof rawCtx === 'object') return [rawCtx as Context];
        return [];
      });
      setSelectedSystemPrompts(
        loadFromSession(STORAGE_KEYS.systemPrompts) || []
      );
    }

    prevPromptLabSessionScopeRef.current = promptLabSessionScope;
  }, [
    promptLabSessionScope,
    location.state?.loadConversation,
    STORAGE_KEYS.messages,
    STORAGE_KEYS.conversation,
    STORAGE_KEYS.context,
    STORAGE_KEYS.systemPrompts,
    loadFromSession,
  ]);
  const pendingMessagesPaintMarkRef = useRef<string | null>(null);
  const pendingSessionPersistTimerRef = useRef<number | null>(null);
  const promptInputValueRef = useRef(initialPromptValue);
  const promptInputElementRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);

  const setPromptInputValue = useCallback((nextValue: string) => {
    promptInputValueRef.current = nextValue;
    if (
      promptInputElementRef.current
      && promptInputElementRef.current.value !== nextValue
    ) {
      promptInputElementRef.current.value = nextValue;
    }
  }, []);

  useEffect(() => {
    if (initialPromptValue !== promptInputValueRef.current) {
      setPromptInputValue(initialPromptValue);
    }
  }, [initialPromptValue, setPromptInputValue]);

  // Update selectedModel when settings change (e.g., when settings are loaded from localStorage)
  useEffect(() => {
    if (settings.lastUsedModel && settings.lastUsedModel !== selectedModel) {
      setSelectedModel(settings.lastUsedModel);
    }
  }, [settings.lastUsedModel, selectedModel]);

  /**
   * If the persisted selection no longer resolves (OpenRouter-only id with cache empty/failed,
   * direct_openrouter off, etc.), fall back to Auto Router so the toggle and API stay consistent.
   * When direct OpenRouter is on, wait until the catalog load settles so we do not reset while fetching.
   */
  useEffect(() => {
    if (selectedModel === 'auto-router') return;

    const maybeFallbackToAutoRouter = (modelId: string) => {
      if (modelId === 'auto-router') return;
      if (getModelConfig(modelId) !== undefined) return;
      setSelectedModel('auto-router');
      dispatch(updateLastUsedModel('auto-router'));
    };

    if (!isDirectOpenRouterEnabled) {
      maybeFallbackToAutoRouter(selectedModel);
      return;
    }

    let cancelled = false;
    loadOpenRouterModels().finally(() => {
      if (cancelled) return;
      maybeFallbackToAutoRouter(selectedModelRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedModel, isDirectOpenRouterEnabled, dispatch]);

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const {
    showScrollToBottom,
    temporaryStreamBottomSpacerPx,
    handleScroll,
    handleJumpToLatest,
    setTemporaryStreamBottomSpacer,
    focusAssistantResponse,
  } = usePromptLabScrollBehavior({
    messages,
    isLoading,
    currentConversationId: currentConversation?.id,
    isMobile,
    messagesContainerRef,
  });

  // Helper function to get provider key from model ID
  const getProviderKey = (
    modelId: string
  ):
    | 'autoRouter'
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'meta'
    | 'mistral'
    | 'microsoft'
    | 'xai'
    | 'unknown' => {
    const modelLower = modelId.toLowerCase();
    if (modelLower.includes('auto-router') || modelLower.includes('autorouter'))
      return 'autoRouter';
    if (modelLower.includes('gpt') || modelLower.includes('openai'))
      return 'openai';
    if (modelLower.includes('claude') || modelLower.includes('anthropic'))
      return 'anthropic';
    if (modelLower.includes('gemini') || modelLower.includes('google'))
      return 'google';
    if (modelLower.includes('llama') || modelLower.includes('meta'))
      return 'meta';
    if (modelLower.includes('mistral')) return 'mistral';
    if (modelLower.includes('phi') || modelLower.includes('microsoft'))
      return 'microsoft';
    if (modelLower.includes('grok') || modelLower.includes('xai')) return 'xai';
    return 'unknown';
  };

  // Get model-specific colors and display names
  const getModelInfo = useCallback(
    (modelId: string, actualModelInfo?: ActualModelInfo | null) => {
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
        'gpt-4': {
          name: 'GPT-4',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
        'gpt-4-turbo': {
          name: 'GPT-4 Turbo',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
        'gpt-4o': {
          name: 'GPT-4o',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
        'gpt-5': {
          name: 'GPT-5',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
        'gpt-5-pro': {
          name: 'GPT-5 Pro',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
        'grok-3': {
          name: 'Grok 3',
          color: getModelColor(theme.palette.mode, 'xai'),
          provider: 'xAI',
        },
        'grok-3-mini': {
          name: 'Grok 3 Mini',
          color: getModelColor(theme.palette.mode, 'xai'),
          provider: 'xAI',
        },
        'grok-4': {
          name: 'Grok 4',
          color: getModelColor(theme.palette.mode, 'xai'),
          provider: 'xAI',
        },
        'grok-4-fast': {
          name: 'Grok 4 Fast',
          color: getModelColor(theme.palette.mode, 'xai'),
          provider: 'xAI',
        },

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
        'gpt-5-direct': {
          name: 'GPT 5.0',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
        'gpt-4o-mini-direct': {
          name: 'GPT 4.0 Mini',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
        'gpt-4-direct': {
          name: 'GPT 4.0',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
        'gpt-4.0': {
          name: 'GPT-4.0',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
        'gpt-5.0': {
          name: 'GPT-5.0',
          color: getModelColor(theme.palette.mode, 'openai'),
          provider: 'OpenAI',
        },
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
          provider:
            actualModelInfo.providerDisplay?.trim() || baseInfo.provider,
        };
      }

      return baseInfo;
    },
    [theme.palette.mode]
  );

  // State for the right sidebar
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState<
    Conversation[]
  >([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [
    showRecentConversationsWarmupLoading,
    setShowRecentConversationsWarmupLoading,
  ] = useState(false);
  const [
    isRecentConversationsAdapterInitializing,
    setIsRecentConversationsAdapterInitializing,
  ] = useState(false);

  // Modal states
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
  const [createContextModalOpen, setCreateContextModalOpen] = useState(false);
  const [conversationExportDialogOpen, setConversationExportDialogOpen] =
    useState(false);
  const [messageDownloadFormatDialogOpen, setMessageDownloadFormatDialogOpen] =
    useState(false);
  const [messageDownloadSelection, setMessageDownloadSelection] =
    useState<ConversationExportFormat>('markdown');
  const [rememberMessageDownloadChoice, setRememberMessageDownloadChoice] =
    useState(false);
  const [pendingMessageDownloadAction, setPendingMessageDownloadAction] =
    useState<{ messageIndex: number; mode: 'single' | 'from-here' } | null>(
      null
    );

  const [promptLabAddToContextDialog, setPromptLabAddToContextDialog] =
    useState<{
      messageIndex: number;
      mode: 'single' | 'from-here';
    } | null>(null);
  const [promptLabAddToContextSelectedId, setPromptLabAddToContextSelectedId] =
    useState('');
  const [promptLabAddToContextNewTitle, setPromptLabAddToContextNewTitle] =
    useState('');
  const [promptLabAddToContextSubmitting, setPromptLabAddToContextSubmitting] =
    useState(false);

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
  const [selectionHintOpen, setSelectionHintOpen] = useState(false);
  const promptAbortController = useRef<AbortController | null>(null);
  const isSelectionDraggingRef = useRef(false);
  const selectionDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionDragMovedRef = useRef(false);

  // Show toast message
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  }, []);

  const handleMessagesMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (isMobile || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'button, [role="button"], a, input, textarea, [contenteditable="true"]'
        )
      ) {
        return;
      }
      isSelectionDraggingRef.current = true;
      selectionDragStartRef.current = { x: event.clientX, y: event.clientY };
      selectionDragMovedRef.current = false;
    },
    [isMobile]
  );

  const handleMessagesMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!isSelectionDraggingRef.current || isMobile) return;
      const start = selectionDragStartRef.current;
      if (start) {
        const movedEnough =
          Math.abs(event.clientX - start.x) > 3
          || Math.abs(event.clientY - start.y) > 3;
        if (!movedEnough && !selectionDragMovedRef.current) {
          return;
        }
        selectionDragMovedRef.current = true;
      }
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const container = messagesContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const thresholdPx = 48;
      const maxStep = 22;
      const cursorY = event.clientY;

      if (cursorY < rect.top + thresholdPx) {
        const ratio = Math.max(
          0,
          (rect.top + thresholdPx - cursorY) / thresholdPx
        );
        container.scrollBy({ top: -Math.ceil(ratio * maxStep) });
      } else if (cursorY > rect.bottom - thresholdPx) {
        const ratio = Math.max(
          0,
          (cursorY - (rect.bottom - thresholdPx)) / thresholdPx
        );
        container.scrollBy({ top: Math.ceil(ratio * maxStep) });
      }
    },
    [isMobile]
  );

  const handleMessagesMouseUp = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      isSelectionDraggingRef.current = false;
      selectionDragStartRef.current = null;
      if (!selectionDragMovedRef.current) {
        selectionDragMovedRef.current = false;
        return;
      }
      selectionDragMovedRef.current = false;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'button, [role="button"], a, input, textarea, [contenteditable="true"]'
        )
      ) {
        return;
      }
      const selectionText = window.getSelection()?.toString().trim() || '';
      if (selectionText.length === 0) return;
      setSelectionHintOpen(true);
    },
    []
  );

  const downloadConversationRange = useCallback(
    async (
      startIndex: number,
      format: ConversationExportFormat = 'markdown',
      includeImages: boolean = false
    ) => {
      const content = buildConversationExportText(messages, {
        format,
        title: currentConversation?.title,
        startIndex,
        includeTimestamps: false,
      });
      const filename = buildConversationExportFilename(
        currentConversation?.title,
        format
      );
      downloadTextFile(content, filename, format);

      if (!includeImages) {
        showToast('Conversation downloaded.');
        return;
      }

      const images = collectImageAttachments(messages, startIndex);
      let successCount = 0;
      let failedCount = 0;
      for (const [index, image] of images.entries()) {
        const extension = image.fileName.includes('.') ? '' : '.png';
        const imageFilename = `${image.fileName || `image-${index + 1}`}${extension}`;
        try {
          await downloadImageByUrl(image.url, imageFilename);
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (images.length === 0) {
        showToast('Conversation downloaded. No downloadable images found.');
        return;
      }
      showToast(
        `Conversation downloaded. Images downloaded: ${successCount}${failedCount > 0 ? ` (${failedCount} unavailable)` : ''}.`
      );
    },
    [messages, currentConversation?.title, showToast]
  );

  const copyConversationRange = useCallback(
    async (startIndex: number) => {
      const content = buildConversationExportText(messages, {
        format: 'txt',
        title: currentConversation?.title,
        startIndex,
        includeTimestamps: false,
      });
      await copyTextToClipboard(content);
      showToast('Message copied to clipboard!');
    },
    [messages, currentConversation?.title, showToast]
  );

  const copySingleMessage = useCallback(
    async (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message) return;
      await copyTextToClipboard(message.content);
      showToast('Message copied to clipboard!');
    },
    [messages, showToast]
  );

  const downloadSingleMessage = useCallback(
    async (messageIndex: number, format: ConversationExportFormat) => {
      const singleMessage = messages.slice(messageIndex, messageIndex + 1);
      const content = buildConversationExportText(singleMessage, {
        format,
        title: currentConversation?.title,
        includeTimestamps: false,
      });
      const filename = buildConversationExportFilename(
        currentConversation?.title,
        format
      );
      downloadTextFile(content, filename, format);
      showToast('Message downloaded.');
    },
    [messages, currentConversation?.title, showToast]
  );

  const executeMessageDownload = useCallback(
    async (
      messageIndex: number,
      mode: 'single' | 'from-here',
      format: ConversationExportFormat
    ) => {
      if (mode === 'single') {
        await downloadSingleMessage(messageIndex, format);
        return;
      }
      await downloadConversationRange(messageIndex, format, false);
    },
    [downloadConversationRange, downloadSingleMessage]
  );

  const requestMessageDownloadFormat = useCallback(
    (messageIndex: number, mode: 'single' | 'from-here') => {
      const askEachTime = settings.askMessageDownloadFormatEachTime ?? true;
      const preferredFormat =
        settings.messageDownloadFormatPreference || 'markdown';

      if (!askEachTime) {
        executeMessageDownload(messageIndex, mode, preferredFormat);
        return;
      }

      setPendingMessageDownloadAction({ messageIndex, mode });
      setMessageDownloadSelection(preferredFormat);
      setRememberMessageDownloadChoice(false);
      setMessageDownloadFormatDialogOpen(true);
    },
    [
      settings.askMessageDownloadFormatEachTime,
      settings.messageDownloadFormatPreference,
      executeMessageDownload,
    ]
  );

  const handleConfirmMessageDownloadFormat = useCallback(async () => {
    if (!pendingMessageDownloadAction) {
      setMessageDownloadFormatDialogOpen(false);
      return;
    }

    if (rememberMessageDownloadChoice) {
      dispatch(
        updateMessageDownloadPreferences({
          format: messageDownloadSelection,
          askEachTime: false,
        })
      );
    }

    setMessageDownloadFormatDialogOpen(false);
    const { messageIndex, mode } = pendingMessageDownloadAction;
    setPendingMessageDownloadAction(null);
    await executeMessageDownload(messageIndex, mode, messageDownloadSelection);
  }, [
    pendingMessageDownloadAction,
    rememberMessageDownloadChoice,
    dispatch,
    messageDownloadSelection,
    executeMessageDownload,
  ]);

  const promptLabMessageAddToContextEnabled =
    isContextsEnabled && Boolean(currentProfile?.id);

  const requestPromptLabAddToContext = useCallback(
    (messageIndex: number, mode: 'single' | 'from-here') => {
      if (!currentProfile?.id) {
        showToast('Sign in to use contexts.');
        return;
      }
      setPromptLabAddToContextSelectedId('');
      setPromptLabAddToContextNewTitle(
        mode === 'single' ? 'Prompt Lab message' : 'Prompt Lab messages'
      );
      setPromptLabAddToContextDialog({ messageIndex, mode });
    },
    [currentProfile?.id, showToast]
  );

  const closePromptLabAddToContextDialog = useCallback(() => {
    setPromptLabAddToContextDialog(null);
    setPromptLabAddToContextSelectedId('');
    setPromptLabAddToContextNewTitle('');
    setPromptLabAddToContextSubmitting(false);
  }, []);

  const handlePromptLabAddToContextSubmit = useCallback(async () => {
    if (!promptLabAddToContextDialog || !currentProfile?.id) return;

    const { messageIndex, mode } = promptLabAddToContextDialog;
    const chatTitle = currentConversation?.title?.trim() || 'Prompt Lab';
    const exportTitle =
      mode === 'single'
        ? `${chatTitle} (one message)`
        : `${chatTitle} (from message)`;
    const excerptText =
      mode === 'single'
        ? buildConversationExportText(
            messages.slice(messageIndex, messageIndex + 1),
            {
              format: 'txt',
              title: exportTitle,
              includeTimestamps: false,
            }
          )
        : buildConversationExportText(messages, {
            format: 'txt',
            title: exportTitle,
            startIndex: messageIndex,
            includeTimestamps: false,
          });

    const block = `\n\n--- Prompt Lab · ${chatTitle} · ${new Date().toISOString()} ---\n${excerptText}\n`;

    setPromptLabAddToContextSubmitting(true);
    try {
      let targetId = promptLabAddToContextSelectedId;

      if (!targetId) {
        const trimmedTitle = promptLabAddToContextNewTitle.trim();
        if (!trimmedTitle) {
          showToast('Enter a title for the new context.');
          return;
        }
        const newContext = await dispatch(
          createContext({
            contextData: {
              title: trimmedTitle,
              body: block.trim(),
              tags: ['chat-snippet'],
              conversationIds: [],
              conversationMetadata: {
                totalMessages: 0,
                lastAddedAt: new Date().toISOString(),
                platforms: [],
              },
            },
            profileId: currentProfile.id,
          })
        ).unwrap();
        targetId = newContext.id;
      } else {
        const existing = contexts.find(c => c.id === targetId);
        const newBody = `${existing?.body ?? ''}${block}`;
        await dispatch(
          updateContext({
            context: {
              id: targetId,
              body: newBody,
            },
            profileId: currentProfile.id,
          })
        ).unwrap();
      }

      await dispatch(fetchContexts(currentProfile.id));
      showToast('Added to context.');
      closePromptLabAddToContextDialog();
    } catch (error) {
      console.error('Add Prompt Lab messages to context failed:', error);
      showToast('Could not add to context.');
    } finally {
      setPromptLabAddToContextSubmitting(false);
    }
  }, [
    promptLabAddToContextDialog,
    currentProfile?.id,
    currentConversation?.title,
    messages,
    promptLabAddToContextSelectedId,
    promptLabAddToContextNewTitle,
    contexts,
    dispatch,
    showToast,
    closePromptLabAddToContextDialog,
  ]);

  // Get conversation ID for filtering alerts
  const currentConversationId = currentConversation?.id;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.metaKey || event.ctrlKey)
        && event.shiftKey
        && event.key.toLowerCase() === 'c';
      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;
      if (isTypingTarget) {
        return;
      }

      event.preventDefault();
      setConversationExportDialogOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const clearSelectionDrag = () => {
      isSelectionDraggingRef.current = false;
      selectionDragStartRef.current = null;
      selectionDragMovedRef.current = false;
    };
    document.addEventListener('mouseup', clearSelectionDrag);
    return () => document.removeEventListener('mouseup', clearSelectionDrag);
  }, []);

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
    if (!currentProfile) return;
    let cancelled = false;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const runInitialFetches = () => {
      if (cancelled) return;
      const contextsLoadMark = startPerfMark(
        'promptlab_open_contexts_fetch_ms'
      );
      dispatch(fetchContexts(currentProfile.id))
        .catch(error => {
          console.log(
            'Initial contexts fetch failed, will retry when auth completes:',
            error
          );
        })
        .finally(() => {
          recordPerfMetric(
            'promptlab_open_contexts_fetch_ms',
            endPerfMark(contextsLoadMark)
          );
        });

      const systemPromptsLoadMark = startPerfMark(
        'promptlab_open_system_prompts_fetch_ms'
      );
      dispatch(fetchSystemPrompts(currentProfile.id))
        .catch(error => {
          console.log(
            'Initial system prompts fetch failed, will retry when auth completes:',
            error
          );
        })
        .finally(() => {
          recordPerfMetric(
            'promptlab_open_system_prompts_fetch_ms',
            endPerfMark(systemPromptsLoadMark)
          );
        });
    };

    // Prioritize first visual render, then start non-critical startup fetches.
    rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(runInitialFetches, 0);
    });

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
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
    const requestSeq = ++recentConversationsRequestSeqRef.current;

    const recentConversationsMark = startPerfMark(
      'promptlab_open_recent_conversations_load_ms'
    );
    setLoadingConversations(true);
    setIsRecentConversationsAdapterInitializing(false);
    try {
      const response = await conversationsService.getAll(
        {},
        1,
        5,
        currentProfile.id
      );
      if (requestSeq === recentConversationsRequestSeqRef.current) {
        setRecentConversations(response.conversations);
      }
    } catch (error: any) {
      // Check if this is a storage initialization timing issue
      if (
        error.message?.includes('Cloud storage adapter not initialized')
        || error.message?.includes('Cloud storage not fully initialized')
      ) {
        console.warn(
          'Storage not ready for recent conversations, will skip for now'
        );
        if (requestSeq === recentConversationsRequestSeqRef.current) {
          setIsRecentConversationsAdapterInitializing(true);
        }
      } else {
        console.error('Error loading recent conversations:', error);
      }
    } finally {
      if (requestSeq === recentConversationsRequestSeqRef.current) {
        setLoadingConversations(false);
      }
      recordPerfMetric(
        'promptlab_open_recent_conversations_load_ms',
        endPerfMark(recentConversationsMark)
      );
    }
  }, [currentProfile]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          void loadRecentConversations();
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadRecentConversations]);

  const shouldStartRecentConversationsWarmupWindow =
    isRecentConversationsInChatPageEnabled
    && conversationsDrawerOpen
    && unifiedStorage.mode === 'cloud'
    && unifiedStorage.googleDrive.isAuthenticated
    && !loadingConversations
    && recentConversations.length === 0;

  useEffect(() => {
    if (!shouldStartRecentConversationsWarmupWindow) {
      setShowRecentConversationsWarmupLoading(false);
      return;
    }

    setShowRecentConversationsWarmupLoading(true);
    const timeoutId = window.setTimeout(() => {
      setShowRecentConversationsWarmupLoading(false);
    }, 12000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldStartRecentConversationsWarmupWindow]);

  useEffect(() => {
    if (!isRecentConversationsAdapterInitializing || loadingConversations)
      return;
    const retryId = window.setTimeout(() => {
      void loadRecentConversations();
    }, 1200);
    return () => window.clearTimeout(retryId);
  }, [
    isRecentConversationsAdapterInitializing,
    loadingConversations,
    loadRecentConversations,
  ]);

  useEffect(() => {
    const onSyncComplete = () => {
      if (!isRecentConversationsInChatPageEnabled) return;
      if (!currentProfile?.id) return;
      void loadRecentConversations();
    };
    window.addEventListener('chatlab-sync-complete', onSyncComplete);
    return () => {
      window.removeEventListener('chatlab-sync-complete', onSyncComplete);
    };
  }, [
    isRecentConversationsInChatPageEnabled,
    currentProfile?.id,
    loadRecentConversations,
  ]);

  useEffect(() => {
    if (!isRecentConversationsInChatPageEnabled) return;
    if (!conversationsDrawerOpen) return;
    if (loadingConversations) return;
    if (recentConversations.length > 0) return;
    void loadRecentConversations();
  }, [
    isRecentConversationsInChatPageEnabled,
    conversationsDrawerOpen,
    loadingConversations,
    recentConversations.length,
    loadRecentConversations,
  ]);

  useEffect(() => {
    if (!conversationsDrawerOpen) return;
    if (!showRecentConversationsWarmupLoading) return;
    if (loadingConversations) return;
    if (recentConversations.length > 0) return;

    const intervalId = window.setInterval(() => {
      void loadRecentConversations();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    conversationsDrawerOpen,
    showRecentConversationsWarmupLoading,
    loadingConversations,
    recentConversations.length,
    loadRecentConversations,
  ]);

  // Persist conversation state to sessionStorage
  useEffect(() => {
    if (pendingSessionPersistTimerRef.current !== null) {
      window.clearTimeout(pendingSessionPersistTimerRef.current);
      pendingSessionPersistTimerRef.current = null;
    }

    if (messages.length === 0) return;

    const snapshot = messages;
    pendingSessionPersistTimerRef.current = window.setTimeout(() => {
      pendingSessionPersistTimerRef.current = null;
      const persistMark = startPerfMark(
        'promptlab_session_messages_persist_ms'
      );
      saveToSession(
        STORAGE_KEYS.messages,
        sanitizeMessagesForSession(snapshot)
      );
      recordPerfMetric(
        'promptlab_session_messages_persist_ms',
        endPerfMark(persistMark)
      );
    }, 250);

    return () => {
      if (pendingSessionPersistTimerRef.current !== null) {
        window.clearTimeout(pendingSessionPersistTimerRef.current);
        pendingSessionPersistTimerRef.current = null;
      }
    };
  }, [
    messages,
    saveToSession,
    sanitizeMessagesForSession,
    STORAGE_KEYS.messages,
  ]);

  useEffect(() => {
    if (!pendingMessagesPaintMarkRef.current) return;
    const markId = pendingMessagesPaintMarkRef.current;
    pendingMessagesPaintMarkRef.current = null;
    runAfterNextFrame(() => {
      recordPerfMetric(
        'promptlab_messages_state_to_next_paint_ms',
        endPerfMark(markId)
      );
    });
  }, [messages]);

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
      // Document reload + POP: history may still carry loadConversation; skip replay
      // and keep session-restored state. In-session PUSH/REPLACE: always honor state.
      if (skipReplayOfRouterStateAfterDocumentReload) {
        navigate('/prompt-lab', { replace: true });
        return;
      }

      const loadConversationFromState = async () => {
        const navLoadMark = startPerfMark(
          'promptlab_open_navigation_conversation_load_ms'
        );
        try {
          setIsLoadingConversationFromNavigation(true);
          const conversationId = location.state.conversationId;
          // Prevent showing stale previous conversation while the selected
          // conversation is fetched.
          setMessages([]);

          if (location.state.conversation) {
            setCurrentConversation(location.state.conversation);
            // Restore prompt/system settings immediately so the page context
            // matches the selected conversation before async message load.
            if (location.state.conversation.originalPrompt) {
              restoreConversationSettings(location.state.conversation);
            }
          } else {
            const placeholderConversation: Conversation = {
              id: conversationId,
              title: location.state.conversationTitle || 'Conversation',
              platform: location.state.platform || 'other',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessage: '',
              messageCount: 0,
              tags: location.state.tags || [],
              isArchived: false,
              isFavorite: false,
              participants: [],
              status: 'active',
            };
            setCurrentConversation(placeholderConversation);
          }

          // Get messages for the conversation
          const messages =
            await conversationsService.getMessages(conversationId);

          // Use the complete conversation object from navigation state
          if (location.state.conversation) {
            setMessages(messages);

            // Update unread alert count for this conversation
            setUnreadAlertCount(getUnreadAlertCount(conversationId));

            // Clear the navigation state to prevent reloading on subsequent renders
            navigate('/prompt-lab', { replace: true });
          } else {
            // Update placeholder with fetched metadata.
            setCurrentConversation(prev =>
              prev && prev.id === conversationId
                ? {
                    ...prev,
                    lastMessage:
                      messages.length > 0
                        ? messages[messages.length - 1].content
                        : '',
                    messageCount: messages.length,
                    updatedAt: new Date().toISOString(),
                  }
                : prev
            );
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
        } finally {
          setIsLoadingConversationFromNavigation(false);
          recordPerfMetric(
            'promptlab_open_navigation_conversation_load_ms',
            endPerfMark(navLoadMark)
          );
        }
      };

      loadConversationFromState();
    }
    // Intentionally omit currentConversation / messages: this effect mutates them.
    // Including them caused an infinite loop (each setState re-ran the effect).
  }, [
    location.state,
    navigate,
    restoreConversationSettings,
    skipReplayOfRouterStateAfterDocumentReload,
  ]);

  // On hard refresh/navigation, state can be restored from sessionStorage.
  // Re-load canonical messages from local storage once per conversation so we
  // recover persisted attachment state (including inline image fallbacks that
  // were intentionally stripped from sessionStorage snapshots).
  useEffect(() => {
    if (!currentConversation?.id) return;
    if (location.state?.loadConversation) return;
    if (
      lastSessionHydratedConversationIdRef.current === currentConversation.id
    ) {
      return;
    }
    lastSessionHydratedConversationIdRef.current = currentConversation.id;
    (async () => {
      const sessionHydrationMark = startPerfMark(
        'promptlab_open_session_image_hydration_ms'
      );
      setIsHydratingSessionImages(true);
      try {
        const storage = getUnifiedStorageService();
        const hydrated = await storage.getMessages(currentConversation.id);
        setMessages(prev => {
          // Keep the session-restored snapshot if canonical hydration
          // transiently returns empty during startup/sync race windows.
          if (hydrated.length === 0 && prev.length > 0) {
            pendingRefreshImageRetryConversationIdRef.current =
              currentConversation.id;
            pendingRefreshImageRetryAttemptsRef.current = 0;
            setIsRetryHydratingSessionImages(true);
            return prev;
          }
          return hydrated;
        });
      } catch (error) {
        console.warn(
          'Failed to hydrate session-restored drive_ref images after refresh:',
          error
        );
      } finally {
        setIsHydratingSessionImages(false);
        recordPerfMetric(
          'promptlab_open_session_image_hydration_ms',
          endPerfMark(sessionHydrationMark)
        );
      }
    })();
  }, [currentConversation?.id, location.state?.loadConversation]);

  // If we preserved session-restored messages because canonical hydration
  // returned empty during refresh startup, retry a few times so drive_ref image
  // URLs hydrate without requiring route navigation.
  useEffect(() => {
    if (!currentConversation?.id) return;
    if (
      pendingRefreshImageRetryConversationIdRef.current
      !== currentConversation.id
    ) {
      return;
    }
    const hasUnresolvedDriveRefImages = messages.some(message =>
      (message.attachments ?? []).some(att => {
        if (!(att.type === 'image' && att.storage === 'drive_ref')) {
          return false;
        }
        return (
          !att.url
          || att.status === 'pending_upload'
          || att.status === 'missing'
          || att.lastHydrationErrorCode === 'display_fetch_failed'
        );
      })
    );
    if (!hasUnresolvedDriveRefImages) {
      pendingRefreshImageRetryConversationIdRef.current = null;
      pendingRefreshImageRetryAttemptsRef.current = 0;
      setIsRetryHydratingSessionImages(false);
      return;
    }

    if (pendingRefreshImageRetryAttemptsRef.current >= 6) {
      pendingRefreshImageRetryConversationIdRef.current = null;
      pendingRefreshImageRetryAttemptsRef.current = 0;
      setIsRetryHydratingSessionImages(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      pendingRefreshImageRetryAttemptsRef.current += 1;
      try {
        const storage = getUnifiedStorageService();
        const refreshed = await storage.getMessages(currentConversation.id);
        if (!cancelled && refreshed.length > 0) {
          setMessages(refreshed);
        }
      } catch {
        // Non-blocking retry path; polling effect/manual retry can still recover.
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [currentConversation?.id, messages]);

  useEffect(() => {
    if (hasRecordedOpenDataReadyRef.current) return;
    if (contextsLoading || systemPromptsLoading || loadingConversations) return;
    if (isHydratingSessionImages) return;
    hasRecordedOpenDataReadyRef.current = true;
    runAfterNextFrame(() => {
      recordPerfMetric(
        'promptlab_open_to_initial_data_ready_ms',
        endPerfMark(openToDataReadyMarkRef.current)
      );
      openToDataReadyMarkRef.current = null;
    });
  }, [
    contextsLoading,
    systemPromptsLoading,
    loadingConversations,
    isHydratingSessionImages,
  ]);

  // Handle system prompt application from navigation
  useEffect(() => {
    if (
      location.state?.openSystemPromptDrawer
      && location.state?.applySystemPrompt
    ) {
      if (skipReplayOfRouterStateAfterDocumentReload) {
        navigate('/prompt-lab', { replace: true });
        return;
      }

      const systemPrompt = location.state.applySystemPrompt;

      // Handle different scenarios based on navigation state
      if (location.state.startNew) {
        // Start new conversation - clear existing state
        setMessages([]);
        setPromptInputValue('');
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
  }, [
    location.state,
    navigate,
    clearSession,
    dispatch,
    currentConversation?.id,
    messages.length,
    skipReplayOfRouterStateAfterDocumentReload,
    setPromptInputValue,
  ]);

  // Keep image upload/hydration status fresh while viewing a conversation.
  // Only poll while there are unresolved image states; otherwise avoid
  // re-hydrating the whole conversation in the background.
  useEffect(() => {
    if (!currentConversation?.id) return;
    if (isLoading || isSavingConversation || isRetryingImageLoads) return;
    const hasUnresolvedDriveRefImages = messages.some(message =>
      (message.attachments ?? []).some(att => {
        if (!(att.type === 'image' && att.storage === 'drive_ref')) {
          return false;
        }
        return (
          !att.url
          || att.status === 'pending_upload'
          || att.status === 'missing'
          || att.lastHydrationErrorCode === 'display_fetch_failed'
        );
      })
    );
    if (!hasUnresolvedDriveRefImages) return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const storage = getUnifiedStorageService();
        const refreshed = await storage.getMessages(currentConversation.id);
        if (!cancelled) {
          setMessages(prev => {
            const prevSig = JSON.stringify(
              prev.map(m => ({
                id: m.id,
                attachments: (m.attachments ?? []).map(att => ({
                  id: att.id,
                  storage: att.storage,
                  type: att.type,
                  status: att.status,
                  url: att.url,
                  driveFileId: att.driveFileId,
                  imageId: att.imageId,
                  lastHydrationErrorCode: att.lastHydrationErrorCode,
                })),
              }))
            );
            const nextSig = JSON.stringify(
              refreshed.map(m => ({
                id: m.id,
                attachments: (m.attachments ?? []).map(att => ({
                  id: att.id,
                  storage: att.storage,
                  type: att.type,
                  status: att.status,
                  url: att.url,
                  driveFileId: att.driveFileId,
                  imageId: att.imageId,
                  lastHydrationErrorCode: att.lastHydrationErrorCode,
                })),
              }))
            );
            return prevSig === nextSig ? prev : refreshed;
          });
        }
      } catch {
        // Non-blocking background refresh.
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    currentConversation?.id,
    isLoading,
    isSavingConversation,
    isRetryingImageLoads,
    messages,
  ]);

  // Refresh visible conversation immediately after manual sync completes so
  // image upload status warnings update without requiring navigation.
  useEffect(() => {
    const onSyncComplete = async () => {
      if (!currentConversation?.id) return;
      const hasDriveRefImages = messages.some(message =>
        (message.attachments ?? []).some(
          att => att.type === 'image' && att.storage === 'drive_ref'
        )
      );
      if (!hasDriveRefImages) return;
      try {
        const storage = getUnifiedStorageService();
        const refreshed = await storage.getMessages(currentConversation.id);
        setMessages(refreshed);
      } catch {
        // Non-blocking refresh after sync completion.
      }
    };
    window.addEventListener('chatlab-sync-complete', onSyncComplete);
    return () => {
      window.removeEventListener('chatlab-sync-complete', onSyncComplete);
    };
  }, [currentConversation?.id, messages]);

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
      !promptInputValueRef.current.trim()
      || !selectedModel
      || !selectedSystemPrompts.length
      || !currentProfile
    )
      return;
    const promptText = promptInputValueRef.current;

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
        title: promptText.substring(0, 40) || 'New Conversation',
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
          promptText: promptText,
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
      content: promptText,
      role: 'user',
      timestamp: new Date().toISOString(),
      platform: selectedModel, // Store the selected model ID
      isEdited: false,
    };

    pendingMessagesPaintMarkRef.current = startPerfMark(
      'promptlab_messages_state_to_next_paint_ms'
    );
    setMessages(prev => [...prev, userMessage]);
    setPromptInputValue('');
    setIsLoading(true);
    setError(null);
    promptAbortController.current = new AbortController();

    // When using direct OpenRouter, add optimistic assistant message for streaming
    const assistantMessageId = `msg-${Date.now()}-ai`;
    const useStreaming = isDirectOpenRouterEnabled;
    if (useStreaming) {
      const optimisticMessage: Message = {
        id: assistantMessageId,
        conversationId: conversationId,
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel,
        isEdited: false,
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setTemporaryStreamBottomSpacer(true);
      focusAssistantResponse(assistantMessageId, {
        smooth: true,
        mode: 'bottom',
      });
    } else {
      setTemporaryStreamBottomSpacer(false);
    }

    try {
      const executePromptMark = startPerfMark('promptlab_execute_prompt_ms');
      // Call the actual API to get AI response
      const response = await promptsApi.executePrompt(
        messages, // Pass existing conversation history
        selectedContexts,
        promptText,
        selectedModel,
        currentProfile.id,
        selectedSystemPrompts, // Pass the full array of selected system prompts
        [],
        promptAbortController.current.signal,
        useStreaming
          ? update => {
              if (!update.textDelta) return;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + update.textDelta }
                    : m
                )
              );
            }
          : undefined
      );
      recordPerfMetric(
        'promptlab_execute_prompt_ms',
        endPerfMark(executePromptMark)
      );

      // Track successful message sent to model (safely handle if MetricsService unavailable)
      safeRecordMessageSent(selectedModel, 'success');

      if (
        response.status === 'completed'
        && response.responses
        && responseHasDisplayableChatPayload(response.responses)
      ) {
        const resPayload = response.responses as ExecutePromptResponsesPayload;
        const content = resPayload.content;
        const actualModelInfo = parseActualModelInfo(resPayload.actualModel);
        const imageAttachments = openRouterImagePartsToAttachments(
          resPayload.images,
          assistantMessageId
        );
        safeRecordGeneratedImages(
          selectedModel,
          resPayload.images?.length ?? 0
        );

        const aiMessage: Message = {
          id: assistantMessageId,
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
          ...(imageAttachments && { attachments: imageAttachments }),
        };

        if (useStreaming) {
          // Message already in list; update with metadata
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessageId ? { ...m, ...aiMessage } : m
            )
          );
        } else {
          setMessages(prev => [...prev, aiMessage]);
          focusAssistantResponse(aiMessage.id, {
            smooth: true,
            mode: 'none',
          });
        }

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
          'Displayable payload:',
          response.responses
            ? responseHasDisplayableChatPayload(response.responses)
            : false,
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
        // Remove partial streaming message if present
        if (useStreaming) {
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
        }
        return;
      }

      const contextWindowOverflow =
        getContextWindowOverflowDetailsFromError(error);
      if (contextWindowOverflow) {
        console.warn(
          'AI request exceeded model context window (expected user error):',
          contextWindowOverflow
        );
      } else {
        console.error('Error getting AI response:', error);
      }

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

      // Remove partial streaming message before adding error message
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: currentConversation?.id || 'current',
        content: `Error: ${errorUserMessage}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel, // Store the selected model ID for error messages
        isEdited: false,
      };
      setMessages(prev => {
        const filtered = useStreaming
          ? prev.filter(m => m.id !== assistantMessageId)
          : prev;
        return [...filtered, errorMessage];
      });

      // Save conversation even with error message
      setTimeout(() => {
        saveConversation([...messages, userMessage, errorMessage]);
      }, 100);
    } finally {
      setIsLoading(false);
      setTemporaryStreamBottomSpacer(false);
      promptAbortController.current = null;
    }
  };

  // Handle cancelling a long request
  const handleCancelRequest = useCallback(() => {
    promptAbortController.current?.abort('Request cancelled by user');
    setIsLoading(false);
    setTemporaryStreamBottomSpacer(false);

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
  }, [
    selectedModel,
    showToast,
    currentConversation?.id,
    setTemporaryStreamBottomSpacer,
  ]);

  // Wizard handlers
  const handleOpenWizard = () => {
    setWizardOpen(true);
    setWizardMinimized(false);
    setWizardError(null);

    // Only copy current message and initialize greeting for fresh wizard conversations
    if (wizardMessages.length === 0) {
      // Copy current message to wizard initial message for new conversations
      setWizardInitialMessage(promptInputValueRef.current);

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

    const assistantWizardId = `wizard-${Date.now()}-ai`;
    const useStreaming = isDirectOpenRouterEnabled;
    if (useStreaming) {
      setWizardMessages(prev => [
        ...prev,
        {
          id: assistantWizardId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        },
      ]);
    }

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
        [],
        undefined,
        useStreaming
          ? update => {
              if (!update.textDelta) return;
              setWizardMessages(prev =>
                prev.map(wm =>
                  wm.id === assistantWizardId
                    ? { ...wm, content: wm.content + update.textDelta }
                    : wm
                )
              );
            }
          : undefined
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;

        if (useStreaming) {
          setWizardMessages(prev =>
            prev.map(wm =>
              wm.id === assistantWizardId
                ? {
                    ...wm,
                    content,
                    timestamp: new Date().toISOString(),
                  }
                : wm
            )
          );
        } else {
          const aiMessage: WizardMessage = {
            id: `wizard-${Date.now()}-ai`,
            role: 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
          };
          setWizardMessages(prev => [...prev, aiMessage]);
        }
      } else {
        throw new Error(
          'The wizard failed to complete the call, please try again shortly'
        );
      }
    } catch (error) {
      console.error('Error getting wizard response:', error);
      if (useStreaming) {
        setWizardMessages(prev =>
          prev.filter(wm => wm.id !== assistantWizardId)
        );
      }
      setWizardError('Failed to get wizard response. Please try again.');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleCopyWizardResult = (content: string) => {
    setPromptInputValue(content);
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

    const assistantSuggestorId = `system-prompt-suggestor-${Date.now()}-ai`;
    const useStreamingSuggestor = isDirectOpenRouterEnabled;
    if (useStreamingSuggestor) {
      setSystemPromptSuggestorMessages(prev => [
        ...prev,
        {
          id: assistantSuggestorId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        },
      ]);
    }

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
        [],
        undefined,
        useStreamingSuggestor
          ? update => {
              if (!update.textDelta) return;
              setSystemPromptSuggestorMessages(prev =>
                prev.map(wm =>
                  wm.id === assistantSuggestorId
                    ? { ...wm, content: wm.content + update.textDelta }
                    : wm
                )
              );
            }
          : undefined
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;

        if (useStreamingSuggestor) {
          setSystemPromptSuggestorMessages(prev =>
            prev.map(wm =>
              wm.id === assistantSuggestorId
                ? {
                    ...wm,
                    content,
                    timestamp: new Date().toISOString(),
                  }
                : wm
            )
          );
        } else {
          const aiMessage: WizardMessage = {
            id: `system-prompt-suggestor-${Date.now()}-ai`,
            role: 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
          };
          setSystemPromptSuggestorMessages(prev => [...prev, aiMessage]);
        }
      } else {
        throw new Error(
          'The System Prompt Suggestor failed to complete the call, please try again shortly'
        );
      }
    } catch (error) {
      console.error('Error getting System Prompt Suggestor response:', error);
      if (useStreamingSuggestor) {
        setSystemPromptSuggestorMessages(prev =>
          prev.filter(wm => wm.id !== assistantSuggestorId)
        );
      }
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
          setPromptInputValue(targetMessage.content);
          // Remove all messages after this point (including the target message)
          setMessages(prev => prev.slice(0, messageIndex));
          // Clear any errors
          setError(null);
          // Scroll to bottom to show the rewinded state
          setTimeout(() => handleJumpToLatest(), 100);
          // Show success toast
          showToast('Conversation rewound successfully!');
        }
      }
    },
    [
      messages,
      handleJumpToLatest,
      showToast,
      dispatch,
      handleCancelRequest,
      currentConversation,
      setPromptInputValue,
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
      setPromptInputValue(lastUserMessage.content);

      // Show loading state
      setIsLoading(true);

      promptAbortController.current = new AbortController();

      const assistantMessageId = `msg-${Date.now()}-ai`;
      const useStreaming = isDirectOpenRouterEnabled;
      if (useStreaming) {
        setMessages(prev => [
          ...prev,
          {
            id: assistantMessageId,
            conversationId: currentConversation?.id || 'current',
            content: '',
            role: 'assistant',
            timestamp: new Date().toISOString(),
            platform: selectedModel,
            isEdited: false,
          },
        ]);
        setTemporaryStreamBottomSpacer(true);
        focusAssistantResponse(assistantMessageId, {
          smooth: true,
          mode: 'bottom',
        });
      } else {
        setTemporaryStreamBottomSpacer(false);
      }

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
          promptAbortController.current.signal,
          useStreaming
            ? update => {
                if (!update.textDelta) return;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: m.content + update.textDelta }
                      : m
                  )
                );
              }
            : undefined
        );

        if (
          response.status === 'completed'
          && response.responses
          && responseHasDisplayableChatPayload(response.responses)
        ) {
          const resPayload =
            response.responses as ExecutePromptResponsesPayload;
          const content = resPayload.content;
          const actualModelInfo = parseActualModelInfo(resPayload.actualModel);
          const imageAttachments = openRouterImagePartsToAttachments(
            resPayload.images,
            assistantMessageId
          );
          safeRecordGeneratedImages(
            selectedModel,
            resPayload.images?.length ?? 0
          );

          const aiMessage: Message = {
            id: useStreaming ? assistantMessageId : `msg-${Date.now()}-ai`,
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
            ...(imageAttachments && { attachments: imageAttachments }),
          };

          if (useStreaming) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId ? { ...m, ...aiMessage } : m
              )
            );
          } else {
            pendingMessagesPaintMarkRef.current = startPerfMark(
              'promptlab_messages_state_to_next_paint_ms'
            );
            setMessages(prev => [...prev, aiMessage]);
            focusAssistantResponse(aiMessage.id, {
              smooth: true,
              mode: 'none',
            });
          }

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
            'Displayable payload:',
            response.responses
              ? responseHasDisplayableChatPayload(response.responses)
              : false,
            'Full response:',
            response
          );
          throw new Error(
            'The model failed to complete the call, please try again shortly'
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (useStreaming) {
            setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
          }
          return;
        }

        const contextWindowOverflow =
          getContextWindowOverflowDetailsFromError(error);
        if (contextWindowOverflow) {
          console.warn(
            'AI retry exceeded model context window (expected user error):',
            contextWindowOverflow
          );
        } else {
          console.error('Error retrying message:', error);
        }

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

        setMessages(prev => {
          const base = useStreaming
            ? prev.filter(m => m.id !== assistantMessageId)
            : prev;
          return [...base, errorMessage];
        });

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
        setTemporaryStreamBottomSpacer(false);
        setPromptInputValue(''); // Clear the input after retry
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
      isDirectOpenRouterEnabled,
      focusAssistantResponse,
      setTemporaryStreamBottomSpacer,
      setPromptInputValue,
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
      promptInputValueRef.current.trim()
        || (messages.length > 0
          ? messages.filter(m => m.role === 'user').pop()?.content || ''
          : '')
    );
  }, [selectedSystemPrompts, selectedContexts, messages]);

  const handleRetryImageLoads = useCallback(async () => {
    if (isRetryingImageLoads) {
      return;
    }
    if (!currentConversation?.id) {
      showToast('Retry is available after this conversation is saved.');
      return;
    }

    try {
      setIsRetryingImageLoads(true);
      const storage = getUnifiedStorageService();
      const refreshedMessages = await storage.getMessages(
        currentConversation.id
      );
      setMessages(refreshedMessages);
      showToast('Retried loading generated images.');
    } catch (error) {
      console.error('Failed to retry image loading:', error);
      showToast('Failed to retry image loading.');
    } finally {
      setIsRetryingImageLoads(false);
    }
  }, [currentConversation?.id, showToast, isRetryingImageLoads]);

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
      const imageAttachments = (message.attachments ?? []).filter(
        a => a.type === 'image'
      );
      const renderableImageAttachments = imageAttachments.filter(
        (a): a is typeof a & { url: string } => !!a.url
      );
      const riskyRenderableImages = renderableImageAttachments.filter(
        a => a.status === 'pending_upload' || a.status === 'missing'
      );
      const unresolvedDriveImages = imageAttachments.filter(
        a => a.storage === 'drive_ref' && !a.url
      );
      const stalledPendingImages = imageAttachments.filter(
        a =>
          a.status === 'pending_upload'
          && !(typeof a.url === 'string' || !!a.imageId || !!a.driveFileId)
      );
      const missingImages = unresolvedDriveImages.filter(
        a => a.status === 'missing'
      );
      const retryableFetchFailedImages = missingImages.filter(
        a => a.lastHydrationErrorCode === 'display_fetch_failed'
      );
      const permanentMissingImages = missingImages.filter(
        a => a.lastHydrationErrorCode !== 'display_fetch_failed'
      );
      const isStreamingAssistantMessage =
        !isGhost
        && isLoading
        && message.role === 'assistant'
        && !message.content.startsWith('Error:')
        && messageIndex === messages.length - 1;
      return (
        <Fragment key={message.id}>
          <Box
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
                    : theme.palette.mode === 'light'
                      ? 'text.primary'
                      : 'white',
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
                    color:
                      theme.palette.mode === 'light' ? 'text.primary' : 'white',
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
                      backgroundColor:
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.1)'
                          : 'rgba(255,255,255,0.2)',
                      color:
                        theme.palette.mode === 'light'
                          ? 'text.primary'
                          : 'white',
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
                        color:
                          theme.palette.mode === 'light'
                            ? 'text.primary'
                            : 'white',
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
                {message.role === 'assistant'
                  && imageAttachments.length > 0 && (
                    <Box
                      sx={{
                        mt: message.content.trim() ? 1.5 : 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        maxWidth: '100%',
                      }}
                    >
                      {riskyRenderableImages.length > 0 && (
                        <Alert
                          severity="warning"
                          variant="outlined"
                          sx={{
                            '& .MuiAlert-message': {
                              width: '100%',
                              padding: 0,
                              fontSize: '0.75rem',
                              lineHeight: 1.45,
                            },
                          }}
                        >
                          {riskyRenderableImages.length === 1
                            ? 'This generated image may not be safely persisted yet. Download a copy to keep it. Saving will be retried automatically on the next sync.'
                            : `${riskyRenderableImages.length} generated images may not be safely persisted yet. Download copies to keep them. Saving will be retried automatically on the next sync.`}
                        </Alert>
                      )}
                      {renderableImageAttachments.map(att => (
                        <Box key={att.id}>
                          <AssistantAttachmentImage attachment={att} />
                        </Box>
                      ))}
                      {isSharedWorkspace
                        && renderableImageAttachments.length > 0 && (
                          <Alert
                            severity="warning"
                            variant="outlined"
                            sx={{
                              mt: 0.5,
                              '& .MuiAlert-message': {
                                width: '100%',
                                padding: 0,
                                fontSize: '0.75rem',
                                lineHeight: 1.45,
                              },
                            }}
                          >
                            {SHARED_WORKSPACE_VISIBLE_IMAGE_WARNING}
                          </Alert>
                        )}
                      {stalledPendingImages.length > 0 && (
                        <Alert
                          severity="error"
                          variant="outlined"
                          sx={{
                            mt: 0.5,
                            '& .MuiAlert-message': {
                              width: '100%',
                              padding: 0,
                              fontSize: '0.75rem',
                              lineHeight: 1.45,
                            },
                          }}
                        >
                          {stalledPendingImages.length === 1
                            ? 'A generated image is unavailable because its upload did not complete.'
                            : `${stalledPendingImages.length} generated images are unavailable because their uploads did not complete.`}
                        </Alert>
                      )}
                      {(isHydratingSessionImages
                        || isRetryHydratingSessionImages)
                        && unresolvedDriveImages.length > 0 && (
                          <Alert
                            severity="info"
                            variant="outlined"
                            icon={<CircularProgress size={14} />}
                            sx={{
                              mt: 0.5,
                              '& .MuiAlert-message': {
                                width: '100%',
                                padding: 0,
                                fontSize: '0.75rem',
                                lineHeight: 1.45,
                              },
                            }}
                          >
                            Loading generated images...
                          </Alert>
                        )}
                      {!isSharedWorkspace
                        && retryableFetchFailedImages.length > 0 && (
                          <Alert
                            severity="warning"
                            variant="outlined"
                            sx={{
                              mt: 0.5,
                              '& .MuiAlert-message': {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                width: '100%',
                              },
                            }}
                          >
                            <Typography variant="caption">
                              {retryableFetchFailedImages.length === 1
                                ? 'A generated image could not be loaded. You can retry loading it.'
                                : `${retryableFetchFailedImages.length} generated images could not be loaded. You can retry loading them.`}
                            </Typography>
                            <Button
                              size="small"
                              onClick={handleRetryImageLoads}
                              disabled={isRetryingImageLoads}
                              startIcon={
                                isRetryingImageLoads ? (
                                  <CircularProgress size={14} color="inherit" />
                                ) : undefined
                              }
                            >
                              {isRetryingImageLoads
                                ? 'Retrying...'
                                : 'Retry loading images'}
                            </Button>
                          </Alert>
                        )}
                      {!isSharedWorkspace
                        && permanentMissingImages.length > 0 && (
                          <Alert
                            severity="error"
                            variant="outlined"
                            sx={{
                              mt: 0.5,
                              '& .MuiAlert-message': {
                                width: '100%',
                                padding: 0,
                                fontSize: '0.75rem',
                                lineHeight: 1.45,
                              },
                            }}
                          >
                            {permanentMissingImages.length === 1
                              ? 'A generated image is unavailable and cannot be recovered automatically.'
                              : `${permanentMissingImages.length} generated images are unavailable and cannot be recovered automatically.`}
                          </Alert>
                        )}
                      {isSharedWorkspace && missingImages.length > 0 && (
                        <Alert
                          severity="error"
                          variant="outlined"
                          sx={{
                            mt: 0.5,
                            '& .MuiAlert-message': {
                              width: '100%',
                              padding: 0,
                              fontSize: '0.75rem',
                              lineHeight: 1.45,
                            },
                          }}
                        >
                          {SHARED_WORKSPACE_MISSING_IMAGE_WARNING}
                        </Alert>
                      )}
                    </Box>
                  )}
                {isStreamingAssistantMessage && (
                  <Box
                    sx={{
                      mt: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1,
                      py: 0.5,
                      borderRadius: 2,
                      bgcolor:
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.08)'
                          : 'rgba(255,255,255,0.14)',
                    }}
                  >
                    <CircularProgress size={12} thickness={6} />
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Streaming response...
                    </Typography>
                  </Box>
                )}
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
                    backgroundColor:
                      theme.palette.mode === 'light'
                        ? 'rgba(0,0,0,0.1)'
                        : 'rgba(255,255,255,0.2)',
                    color:
                      theme.palette.mode === 'light' ? 'text.primary' : 'white',
                    opacity: 0.8,
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    '&:hover': {
                      backgroundColor:
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.15)'
                          : 'rgba(255,255,255,0.3)',
                      opacity: 1,
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    },
                    '&:active': isMobile
                      ? {
                          transform: 'scale(0.95)',
                          backgroundColor:
                            theme.palette.mode === 'light'
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
              {!isGhost
                && message.role === 'assistant'
                && !message.content.startsWith('Error:') && (
                  <MessageActionsButton
                    messageIndex={messageIndex}
                    isMobile={isMobile}
                    themeMode={theme.palette.mode}
                    onCopySingleMessage={copySingleMessage}
                    onCopyConversationRange={copyConversationRange}
                    onRequestDownload={requestMessageDownloadFormat}
                    addToContextEnabled={promptLabMessageAddToContextEnabled}
                    onRequestAddToContext={requestPromptLabAddToContext}
                  />
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
            && ghostMessages[message.id].map(ghostMsg =>
              renderMessage(ghostMsg, 1e6, true)
            )}
        </Fragment>
      );
    },
    [
      ghostMessages,
      handleRetryMessage,
      handleRetryImageLoads,
      handleRewindToMessage,
      isHydratingSessionImages,
      isRetryHydratingSessionImages,
      isRetryingImageLoads,
      isLoading,
      isSharedWorkspace,
      isMobile,
      messages.length,
      copySingleMessage,
      copyConversationRange,
      requestMessageDownloadFormat,
      promptLabMessageAddToContextEnabled,
      requestPromptLabAddToContext,
      getModelInfo,
      theme.palette.mode,
    ]
  );

  const handlePromptInputChange = useCallback((nextValue: string) => {
    const markId = startPerfMark('promptlab_typing_to_next_paint_ms');
    promptInputValueRef.current = nextValue;
    runAfterNextFrame(() => {
      recordPerfMetric(
        'promptlab_typing_to_next_paint_ms',
        endPerfMark(markId)
      );
    });
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.filter((msg, i) => {
        // Hide empty assistant message when showing thinking bubble
        if (
          isLoading
          && i === messages.length - 1
          && msg.role === 'assistant'
          && msg.content.length === 0
        ) {
          return false;
        }
        return true;
      }),
    [messages, isLoading]
  );

  const renderedConversationStartGhostMessages = useMemo(
    () =>
      (ghostMessages['conversation_start'] ?? []).map((message, messageIndex) =>
        renderMessage(message, messageIndex, true)
      ),
    [ghostMessages, renderMessage]
  );

  const renderedVisibleMessages = useMemo(
    () =>
      visibleMessages.map((message, messageIndex) =>
        renderMessage(message, messageIndex)
      ),
    [visibleMessages, renderMessage]
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
          onMouseDown={handleMessagesMouseDown}
          onMouseMove={handleMessagesMouseMove}
          onMouseUp={handleMessagesMouseUp}
          sx={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden', // Prevent horizontal scrolling
            overflowAnchor: 'none',
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
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              pointerEvents: 'none',
              opacity: isLoadingConversationFromNavigation ? 1 : 0,
              transition: 'opacity 220ms ease',
              background:
                'linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            }}
          >
            <Paper
              elevation={2}
              sx={{
                px: 2,
                py: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                borderRadius: 2,
              }}
            >
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2">Loading conversation...</Typography>
            </Paper>
          </Box>
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
              {renderedConversationStartGhostMessages}
              {renderedVisibleMessages}

              {/* Loading indicator - hide when streaming has begun (assistant message has content) */}
              {isLoading
                && !(
                  messages.length > 0
                  && messages[messages.length - 1].role === 'assistant'
                  && messages[messages.length - 1].content.length > 0
                ) && (
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
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <CircularProgress size={16} color="inherit" />
                        <Typography variant="body2">
                          {getModelInfo(selectedModel).name} is thinking...
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                )}

              {temporaryStreamBottomSpacerPx > 0 && (
                <Box
                  sx={{
                    height: `${temporaryStreamBottomSpacerPx}px`,
                    flexShrink: 0,
                    transition: 'height 220ms ease-out',
                  }}
                />
              )}

              {/* Scroll anchor removed: container scrollHeight is authoritative */}
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
            onClick={handleJumpToLatest}
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
                defaultValue={initialPromptValue}
                inputRef={promptInputElementRef}
                onChange={e => handlePromptInputChange(e.target.value)}
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
                disabled={isLoading}
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
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setConversationExportDialogOpen(true)}
                  sx={{
                    minWidth: 170,
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
                  Copy / Export Conversation
                </Button>
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
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setConversationExportDialogOpen(true)}
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
                    Copy / Export
                  </Button>
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

            {loadingConversations || showRecentConversationsWarmupLoading ? (
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
      {modelModalOpen && (
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
      )}

      {contextModalOpen && (
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
            setSelectedContexts(prev =>
              prev.filter(ctx => ctx.id !== contextId)
            );
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
      )}

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

      {systemPromptModalOpen && (
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
      )}

      {conversationExportDialogOpen && (
        <ConversationCopyExportDialog
          open={conversationExportDialogOpen}
          onClose={() => setConversationExportDialogOpen(false)}
          messages={messages}
          conversationTitle={currentConversation?.title}
          fullPromptText={constructFullPrompt()}
          onToast={showToast}
          initialDownloadFormat={
            settings.conversationDownloadFormatPreference || 'markdown'
          }
          onDownloadFormatChange={format => {
            dispatch(
              updateMessageDownloadPreferences({
                conversationFormat: format,
              })
            );
          }}
        />
      )}

      {promptLabAddToContextDialog && (
        <AddToContextDialog
          open
          onClose={closePromptLabAddToContextDialog}
          sourceSubtitle={`${currentConversation?.title?.trim() || 'Current chat'} · ${
            promptLabAddToContextDialog.mode === 'single'
              ? 'This message only'
              : 'This message and all below'
          }`}
          dialogTitle="Add Messages to Context"
          introText="Append this excerpt to an existing context, or create a new one:"
          selectedContextId={promptLabAddToContextSelectedId}
          newContextTitle={promptLabAddToContextNewTitle}
          contexts={contexts}
          isAdding={promptLabAddToContextSubmitting}
          onContextIdChange={setPromptLabAddToContextSelectedId}
          onNewContextTitleChange={setPromptLabAddToContextNewTitle}
          onSubmit={handlePromptLabAddToContextSubmit}
        />
      )}

      <Dialog
        open={messageDownloadFormatDialogOpen}
        onClose={() => {
          setMessageDownloadFormatDialogOpen(false);
          setPendingMessageDownloadAction(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Choose download format</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the file format for this download.
          </Typography>
          <RadioGroup
            value={messageDownloadSelection}
            onChange={e =>
              setMessageDownloadSelection(
                e.target.value as ConversationExportFormat
              )
            }
          >
            <FormControlLabel
              value="markdown"
              control={<Radio />}
              label="Markdown (.md)"
            />
            <FormControlLabel
              value="txt"
              control={<Radio />}
              label="Text (.txt)"
            />
          </RadioGroup>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={rememberMessageDownloadChoice}
                onChange={e =>
                  setRememberMessageDownloadChoice(e.target.checked)
                }
              />
            }
            label="Remember my choice"
          />
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button
            onClick={() => {
              setMessageDownloadFormatDialogOpen(false);
              setPendingMessageDownloadAction(null);
            }}
            variant="outlined"
            sx={{
              color: 'text.primary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'text.primary',
                backgroundColor: 'action.hover',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMessageDownloadFormat}
            variant="contained"
            sx={{ fontWeight: 600 }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Wizard Window */}
      {wizardOpen && (
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
      )}

      {/* System Prompt Suggestor Wizard Window */}
      {systemPromptSuggestorOpen && (
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
      )}

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

      <Snackbar
        open={selectionHintOpen}
        autoHideDuration={7000}
        onClose={() => setSelectionHintOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSelectionHintOpen(false)}
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSelectionHintOpen(false);
                setConversationExportDialogOpen(true);
              }}
            >
              Open
            </Button>
          }
        >
          Tip: use Copy / Export Conversation for full transcript copy or
          download.
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
      {timelineModalOpen && (
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
      )}
    </Box>
  );
}
