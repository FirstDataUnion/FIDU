import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  Chip,
  Button,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Stack,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  FilterList as FilterListIcon,
  ClearAll as ClearAllIcon,
  Refresh as RefreshIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
// Simple date formatting utility
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};
import type { AgentAlert } from '../../services/agents/agentAlerts';
import {
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  clearAlertHistory,
  getUnreadAlertCount,
  getFilteredAlerts,
  subscribeToAgentAlerts,
} from '../../services/agents/agentAlerts';

interface AlertHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

type SeverityFilter = 'all' | 'error' | 'warn' | 'info';

export default function AlertHistoryDrawer({ open, onClose }: AlertHistoryDrawerProps): React.JSX.Element {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const loadAlerts = useCallback(() => {
    const filtered = getFilteredAlerts({
      unreadOnly: showUnreadOnly,
      severity: filter === 'all' ? undefined : filter,
    });
    setAlerts(filtered);
  }, [filter, showUnreadOnly]);

  useEffect(() => {
    loadAlerts();
    
    // Subscribe to new alerts
    const unsubscribe = subscribeToAgentAlerts(() => {
      loadAlerts();
    });
    
    return unsubscribe;
  }, [loadAlerts]);

  const handleMarkAsRead = (alertId: string) => {
    markAlertAsRead(alertId);
    loadAlerts();
  };

  const handleMarkAllAsRead = () => {
    markAllAlertsAsRead();
    loadAlerts();
    setAnchorEl(null);
  };

  const handleDelete = (alertId: string) => {
    deleteAlert(alertId);
    loadAlerts();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all alert history?')) {
      clearAlertHistory();
      loadAlerts();
      setAnchorEl(null);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getSeverityColor = (severity: AgentAlert['severity']) => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      default:
        return 'info';
    }
  };

  const unreadCount = getUnreadAlertCount();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 480 },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Alert History
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                color="error"
                size="small"
                sx={{ minWidth: 24, height: 24 }}
              />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={filter}
              label="Severity"
              onChange={(e) => setFilter(e.target.value as SeverityFilter)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="warn">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={showUnreadOnly ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            Unread Only
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadAlerts}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="More options">
            <IconButton size="small" onClick={handleMenuOpen}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
              <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
              Mark All as Read
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleClearAll}>
              <ClearAllIcon sx={{ mr: 1, fontSize: 20 }} />
              Clear All
            </MenuItem>
          </Menu>
        </Box>

        {/* Alert List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {alerts.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                height: '100%',
              }}
            >
              <SmartToyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Alerts Found
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {showUnreadOnly
                  ? 'All alerts have been read.'
                  : filter !== 'all'
                  ? `No ${filter} alerts found.`
                  : 'No alerts yet. Background agents will show alerts here when they detect issues.'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {alerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem
                    sx={{
                      bgcolor: alert.read ? 'transparent' : 'action.selected',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      py: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                      <Chip
                        label={alert.severity.toUpperCase()}
                        color={getSeverityColor(alert.severity)}
                        size="small"
                        sx={{ flexShrink: 0 }}
                      />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: alert.read ? 400 : 600,
                            mb: 0.5,
                            wordBreak: 'break-word',
                          }}
                        >
                          {alert.message || 'Background agent alert'}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`Rating: ${alert.rating}/100`}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(new Date(alert.createdAt))}
                          </Typography>
                        </Stack>
                      </Box>
                      <ListItemSecondaryAction sx={{ position: 'static', transform: 'none' }}>
                        <Stack direction="row" spacing={0.5}>
                          {!alert.read && (
                            <Tooltip title="Mark as read">
                              <IconButton
                                size="small"
                                onClick={() => handleMarkAsRead(alert.id)}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => handleDelete(alert.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItemSecondaryAction>
                    </Box>
                  </ListItem>
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            {unreadCount > 0 && ` • ${unreadCount} unread`}
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

