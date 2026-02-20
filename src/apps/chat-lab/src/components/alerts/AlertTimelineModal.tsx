import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  Stack,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Badge,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  ClearAll as ClearAllIcon,
  Refresh as RefreshIcon,
  SmartToy as SmartToyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { AgentAlert } from '../../services/agents/agentAlerts';
import {
  getFilteredAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  clearAlertHistory,
  getUnreadAlertCount,
} from '../../services/agents/agentAlerts';
import { transformBuiltInAgentsWithPreferences } from '../../services/agents/agentTransformers';
import { loadAgentPreferences } from '../../services/agents/agentPreferences';
import type { BackgroundAgent } from '../../types';
import { conversationsService } from '../../services/conversationsService';
import type { Message } from '../../types';

interface AlertTimelineModalProps {
  open: boolean;
  onClose: () => void;
  conversationId?: string;
  currentAgents?: BackgroundAgent[];
  onAlertsChanged?: () => void;
}

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

const formatDateHeader = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const alertDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (today.getTime() - alertDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)
    return alertDate.toLocaleDateString('en-US', { weekday: 'long' });
  if (diffDays < 30) return `${diffDays} days ago`;
  return alertDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function AlertTimelineModal({
  open,
  onClose,
  conversationId,
  currentAgents = [],
  onAlertsChanged,
}: AlertTimelineModalProps): React.JSX.Element {
  const [filterSeverity, setFilterSeverity] = useState<
    'all' | 'error' | 'warn' | 'info'
  >('all');
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Map<string, Message>>(new Map());
  const [messageIdToMessageMap, setMessageIdToMessageMap] = useState<
    Map<string, Message>
  >(new Map()); // Map from alert.messageId to actual Message
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh when modal opens

  // Load all agents for filter dropdown
  const allAgents = useMemo(() => {
    const storedPrefs = loadAgentPreferences();
    const builtInAgents = transformBuiltInAgentsWithPreferences(storedPrefs);
    return [...builtInAgents, ...currentAgents];
  }, [currentAgents]);

  // Refresh alerts when modal opens to ensure we have the latest data
  useEffect(() => {
    if (open) {
      // Force refresh by updating the refresh key
      // This ensures we reload alerts from storage when the modal opens
      setRefreshKey(prev => prev + 1);
    }
  }, [open]);

  // Load and filter alerts - always filter by conversationId when provided
  // Include refreshKey in dependencies to force reload when modal opens
  const alerts = useMemo(() => {
    // refreshKey is intentionally included to force refresh when modal opens
    void refreshKey; // Reference to force dependency
    return getFilteredAlerts({
      unreadOnly: showUnreadOnly,
      severity: filterSeverity === 'all' ? undefined : filterSeverity,
      agentId: filterAgentId === 'all' ? undefined : filterAgentId,
      conversationId: conversationId || undefined, // Only filter by conversationId if provided (undefined means no filter)
    });
  }, [
    filterSeverity,
    filterAgentId,
    showUnreadOnly,
    conversationId,
    refreshKey,
  ]);

  // Group alerts by date, then by agent
  const groupedAlerts = useMemo(() => {
    const groups: Record<string, Record<string, AgentAlert[]>> = {};

    alerts.forEach(alert => {
      const alertDate = new Date(alert.createdAt);
      const dateKey = formatDateHeader(alertDate);
      const agentName =
        allAgents.find(a => a.id === alert.agentId)?.name || 'Unknown Agent';

      if (!groups[dateKey]) {
        groups[dateKey] = {};
      }
      if (!groups[dateKey][agentName]) {
        groups[dateKey][agentName] = [];
      }
      groups[dateKey][agentName].push(alert);
    });

    // Sort alerts within each group (most recent first)
    Object.keys(groups).forEach(dateKey => {
      Object.keys(groups[dateKey]).forEach(agentName => {
        groups[dateKey][agentName].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // Sort agents within each date (alphabetically)
      const sortedAgentKeys = Object.keys(groups[dateKey]).sort();
      const sortedAgents: Record<string, AgentAlert[]> = {};
      sortedAgentKeys.forEach(key => {
        sortedAgents[key] = groups[dateKey][key];
      });
      groups[dateKey] = sortedAgents;
    });

    return groups;
  }, [alerts, allAgents]);

  // Calculate unread count filtered by conversation if provided
  const unreadCount = conversationId
    ? getUnreadAlertCount(conversationId)
    : getUnreadAlertCount();

  // Load messages when conversationId changes and build mapping from alert.messageId to actual messages
  useEffect(() => {
    if (open && conversationId) {
      const loadMessages = async () => {
        try {
          const loadedMessages =
            await conversationsService.getMessages(conversationId);
          const messagesMap = new Map<string, Message>();
          const alertIdToMessageMap = new Map<string, Message>();

          loadedMessages.forEach(msg => {
            messagesMap.set(msg.id, msg);
          });

          setMessages(messagesMap);
          setMessageIdToMessageMap(alertIdToMessageMap);
        } catch (error) {
          console.error('Failed to load messages for alert timeline:', error);
        }
      };
      void loadMessages();
    }
  }, [open, conversationId]);

  // Build mapping from alert.messageId to actual messages after messages and alerts are loaded
  // This uses the same mechanism as jump-to-message: simple messageId matching
  // Since we now preserve original message IDs in storage, we can directly match by messageId
  useEffect(() => {
    if (messages.size > 0 && alerts.length > 0) {
      const alertIdToMessageMap = new Map<string, Message>();

      console.log(
        `[AlertTimeline] Building message mapping: ${alerts.length} alerts, ${messages.size} messages`
      );

      // For each alert, find the message by its messageId (same as jump-to-message)
      alerts.forEach(alert => {
        if (!alert.messageId) {
          return; // Skip if no messageId
        }

        // Simple ID match - same as jump-to-message mechanism
        const foundMessage = messages.get(alert.messageId);

        if (foundMessage) {
          alertIdToMessageMap.set(alert.messageId, foundMessage);
          console.log(
            `[AlertTimeline] ✅ Mapped alert ${alert.id} (messageId: ${alert.messageId}) to message ${foundMessage.id}`
          );
        } else {
          console.warn(
            `[AlertTimeline] ❌ Could not find message with ID ${alert.messageId} for alert ${alert.id}`
          );
          console.log(
            `[AlertTimeline] Available message IDs:`,
            Array.from(messages.keys())
          );
        }
      });

      console.log(
        `[AlertTimeline] Built mapping: ${alertIdToMessageMap.size} alert messageIds mapped`
      );
      setMessageIdToMessageMap(alertIdToMessageMap);
    }
  }, [messages, alerts]);

  // Toggle alert expansion
  const toggleAlertExpansion = useCallback((alertId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (onAlertsChanged) {
      onAlertsChanged();
    }
  }, [onAlertsChanged]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAlertsAsRead();
    // Force refresh by incrementing refreshKey to reload alerts from storage
    setRefreshKey(prev => prev + 1);
    handleRefresh();
    setAnchorEl(null);
  }, [handleRefresh]);

  const handleClearAll = useCallback(() => {
    if (
      window.confirm(
        'Are you sure you want to clear all alert history? This cannot be undone.'
      )
    ) {
      clearAlertHistory();
      // Force refresh by incrementing refreshKey to reload alerts from storage
      setRefreshKey(prev => prev + 1);
      handleRefresh();
      setAnchorEl(null);
    }
  }, [handleRefresh]);

  const handleMarkAsRead = useCallback(
    (alertId: string) => {
      markAlertAsRead(alertId);
      // Force refresh by incrementing refreshKey to reload alerts from storage
      setRefreshKey(prev => prev + 1);
      handleRefresh();
    },
    [handleRefresh]
  );

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getSeverityColor = (severity: AgentAlert['severity']) => {
    switch (severity) {
      case 'error':
        return {
          bg: 'error.main',
          border: 'error.main',
          text: 'text.primary',
          chip: 'error',
        };
      case 'warn':
        return {
          bg: 'warning.main',
          border: 'warning.main',
          text: 'text.primary',
          chip: 'warning',
        };
      default:
        return {
          bg: 'info.main',
          border: 'info.main',
          text: 'text.primary',
          chip: 'info',
        };
    }
  };

  const dateKeys = Object.keys(groupedAlerts).sort((a, b) => {
    // Sort dates: Today first, then by recency
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return b.localeCompare(a);
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          m: { xs: 1, sm: 2 },
          height: { xs: '90vh', sm: '85vh' },
          maxHeight: { xs: '90vh', sm: '85vh' },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SmartToyIcon />
          <Typography variant="h6">Alert Timeline</Typography>
          {unreadCount > 0 && (
            <Badge
              badgeContent={unreadCount}
              color="error"
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  ml: 1,
                },
              }}
            >
              <Box />
            </Badge>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Filters */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            value={filterSeverity}
            label="Severity"
            onChange={e =>
              setFilterSeverity(e.target.value as typeof filterSeverity)
            }
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="warn">Warning</MenuItem>
            <MenuItem value="info">Info</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Agent</InputLabel>
          <Select
            value={filterAgentId}
            label="Agent"
            onChange={e => setFilterAgentId(e.target.value)}
          >
            <MenuItem value="all">All Agents</MenuItem>
            {allAgents.map(agent => (
              <MenuItem key={agent.id} value={agent.id}>
                {agent.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={showUnreadOnly}
              onChange={e => setShowUnreadOnly(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="caption">Unread only</Typography>}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Refresh">
          <IconButton size="small" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="More options">
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
            Mark All as Read
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleClearAll}>
            <ClearAllIcon sx={{ mr: 1, fontSize: 20 }} />
            Clear All History
          </MenuItem>
        </Menu>
      </Box>

      {/* Timeline Content */}
      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {dateKeys.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 6,
              textAlign: 'center',
            }}
          >
            <SmartToyIcon
              sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Alerts Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {showUnreadOnly
                ? 'All alerts have been read.'
                : filterSeverity !== 'all'
                  ? `No ${filterSeverity} alerts found.`
                  : filterAgentId !== 'all'
                    ? `No alerts found for this agent.`
                    : 'No alerts yet. Background agents will show alerts here when they detect issues.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            {dateKeys.map((dateKey, dateIdx) => (
              <Box
                key={dateKey}
                sx={{ mb: dateIdx < dateKeys.length - 1 ? 4 : 0 }}
              >
                {/* Date Header */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    mb: 2,
                    backgroundColor: 'action.hover',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'text.primary',
                    }}
                  >
                    {dateKey}
                  </Typography>
                </Paper>

                {/* Agents for this date */}
                {Object.entries(groupedAlerts[dateKey]).map(
                  ([agentName, agentAlerts]) => (
                    <Box key={agentName} sx={{ mb: 3 }}>
                      {/* Agent Header */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1.5,
                        }}
                      >
                        <SmartToyIcon
                          sx={{ fontSize: 18, color: 'text.secondary' }}
                        />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {agentName}
                        </Typography>
                        <Chip
                          label={agentAlerts.length}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>

                      {/* Alerts for this agent */}
                      <Box sx={{ pl: 3 }}>
                        <Stack spacing={1.5}>
                          {agentAlerts.map(alert => {
                            const colors = getSeverityColor(alert.severity);
                            const isExpanded = expandedAlerts.has(alert.id);
                            // Get message from the pre-built mapping
                            const triggeringMessage = alert.messageId
                              ? messageIdToMessageMap.get(alert.messageId)
                              : null;
                            const hasMessageId = !!alert.messageId;
                            const canLoadMessage =
                              hasMessageId
                              && (conversationId || alert.conversationId);
                            return (
                              <Box key={alert.id}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1.5,
                                    backgroundColor: alert.read
                                      ? 'transparent'
                                      : colors.bg,
                                    borderColor: colors.border,
                                    borderWidth: alert.read ? 1 : 2,
                                    opacity: alert.read ? 0.7 : 1,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'flex-start',
                                      mb: 1,
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        flexWrap: 'wrap',
                                      }}
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
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                      />
                                      {!alert.read && (
                                        <Chip
                                          label="Unread"
                                          size="small"
                                          color="primary"
                                          sx={{
                                            height: 20,
                                            fontSize: '0.7rem',
                                          }}
                                        />
                                      )}
                                    </Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {formatTimeAgo(new Date(alert.createdAt))}
                                    </Typography>
                                  </Box>
                                  <Typography
                                    variant="body2"
                                    sx={{ color: colors.text, mb: 1 }}
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
                                        mb: 1,
                                        fontSize: '0.875rem',
                                      }}
                                    >
                                      {alert.description}
                                    </Typography>
                                  )}

                                  {/* Action Buttons */}
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{ mt: 1.5 }}
                                  >
                                    {hasMessageId && (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                          isExpanded ? (
                                            <ExpandLessIcon />
                                          ) : (
                                            <ExpandMoreIcon />
                                          )
                                        }
                                        onClick={() => {
                                          // If we don't have the message yet but have a conversationId, try to load it
                                          if (
                                            !triggeringMessage
                                            && canLoadMessage
                                          ) {
                                            const loadMessage = async () => {
                                              try {
                                                const convId =
                                                  conversationId
                                                  || alert.conversationId;
                                                if (convId) {
                                                  console.log(
                                                    `[AlertTimeline] Loading messages for conversation ${convId} to find message ${alert.messageId}`
                                                  );
                                                  const loadedMessages =
                                                    await conversationsService.getMessages(
                                                      convId
                                                    );
                                                  console.log(
                                                    `[AlertTimeline] Loaded ${loadedMessages.length} messages, looking for messageId: ${alert.messageId}`
                                                  );
                                                  console.log(
                                                    `[AlertTimeline] Available message IDs:`,
                                                    loadedMessages.map(
                                                      m => m.id
                                                    )
                                                  );

                                                  const msgMap = new Map<
                                                    string,
                                                    Message
                                                  >();
                                                  loadedMessages.forEach(
                                                    msg => {
                                                      msgMap.set(msg.id, msg);
                                                    }
                                                  );

                                                  // Simple ID match - same as jump-to-message mechanism
                                                  const foundMessage =
                                                    msgMap.get(
                                                      alert.messageId!
                                                    );

                                                  if (foundMessage) {
                                                    console.log(
                                                      `[AlertTimeline] ✅ Found message ${foundMessage.id} for alert messageId ${alert.messageId}`
                                                    );
                                                  } else {
                                                    console.warn(
                                                      `[AlertTimeline] ❌ Could not find message with ID ${alert.messageId}`
                                                    );
                                                    console.log(
                                                      `[AlertTimeline] Available message IDs:`,
                                                      loadedMessages.map(
                                                        m => m.id
                                                      )
                                                    );
                                                  }

                                                  // Update messages map with all loaded messages
                                                  setMessages(prev => {
                                                    const combined = new Map(
                                                      prev
                                                    );
                                                    msgMap.forEach((v, k) =>
                                                      combined.set(k, v)
                                                    );
                                                    return combined;
                                                  });

                                                  if (foundMessage) {
                                                    // Add the found message to both maps
                                                    setMessages(prev => {
                                                      const updated = new Map(
                                                        prev
                                                      );
                                                      updated.set(
                                                        foundMessage!.id,
                                                        foundMessage!
                                                      );
                                                      return updated;
                                                    });
                                                    setMessageIdToMessageMap(
                                                      prev => {
                                                        const updated = new Map(
                                                          prev
                                                        );
                                                        updated.set(
                                                          alert.messageId!,
                                                          foundMessage!
                                                        );
                                                        return updated;
                                                      }
                                                    );
                                                  } else {
                                                    console.warn(
                                                      `[AlertTimeline] Could not find message for alert ${alert.id}, messageId: ${alert.messageId}`
                                                    );
                                                  }
                                                }
                                              } catch (error) {
                                                console.error(
                                                  '[AlertTimeline] Failed to load message for alert:',
                                                  error
                                                );
                                              }
                                            };
                                            void loadMessage();
                                          }
                                          toggleAlertExpansion(alert.id);
                                        }}
                                        disabled={
                                          !canLoadMessage && !triggeringMessage
                                        }
                                        sx={{
                                          fontSize: '0.75rem',
                                          color: 'primary.dark',
                                          borderColor: 'primary.dark',
                                          backgroundColor: 'background.paper',
                                          '&:hover': {
                                            backgroundColor: 'primary.light',
                                            borderColor: 'primary.main',
                                          },
                                          '&.Mui-disabled': {
                                            color: 'text.disabled',
                                            borderColor: 'divider',
                                          },
                                        }}
                                      >
                                        {isExpanded ? 'Hide' : 'Show'} Original
                                        Chat Message
                                      </Button>
                                    )}
                                    {!alert.read && (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<CheckCircleIcon />}
                                        onClick={() =>
                                          handleMarkAsRead(alert.id)
                                        }
                                        sx={{
                                          fontSize: '0.75rem',
                                          color: 'primary.dark',
                                          borderColor: 'primary.dark',
                                          backgroundColor: 'background.paper',
                                          '&:hover': {
                                            backgroundColor: 'primary.light',
                                            borderColor: 'primary.main',
                                          },
                                        }}
                                      >
                                        Mark as Read
                                      </Button>
                                    )}
                                  </Stack>

                                  {/* Expanded Message View */}
                                  {isExpanded && (
                                    <Collapse in={isExpanded}>
                                      <Paper
                                        variant="outlined"
                                        sx={{
                                          mt: 1.5,
                                          p: 1.5,
                                          backgroundColor: 'background.default',
                                          borderColor: 'divider',
                                        }}
                                      >
                                        {triggeringMessage ? (
                                          <>
                                            <Typography
                                              variant="caption"
                                              sx={{
                                                fontWeight: 600,
                                                mb: 1,
                                                display: 'block',
                                              }}
                                            >
                                              Triggering Message (
                                              {triggeringMessage.role})
                                            </Typography>
                                            <Typography
                                              variant="body2"
                                              sx={{
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                color: 'text.primary',
                                              }}
                                            >
                                              {triggeringMessage.content}
                                            </Typography>
                                          </>
                                        ) : (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ fontStyle: 'italic' }}
                                          >
                                            {hasMessageId && !canLoadMessage
                                              ? 'Message unavailable (conversation not found)'
                                              : 'Loading message...'}
                                          </Typography>
                                        )}
                                      </Paper>
                                    </Collapse>
                                  )}
                                </Paper>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    </Box>
                  )
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          {unreadCount > 0 && ` • ${unreadCount} unread`}
        </Typography>
        <Button
          onClick={onClose}
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
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
