import React, { useMemo } from 'react';
import { Box, Chip, Paper, Typography, Stack, Divider } from '@mui/material';
import { SmartToy as SmartToyIcon } from '@mui/icons-material';
import type { AgentAlert } from '../../services/agents/agentAlerts';
import { generateBuiltInAgentId } from '../../services/agents/agentTransformers';
import { BUILT_IN_BACKGROUND_AGENTS } from '../../data/backgroundAgents';

interface InlineAgentResultsProps {
  alerts: AgentAlert[];
  conversationId?: string;
  agentNameMap?: Record<string, string>; // Optional map of agentId -> agentName
}

/**
 * Get agent name from agentId, checking built-in agents first, then provided map
 */
const getAgentName = (agentId: string, agentNameMap?: Record<string, string>): string => {
  // Check built-in agents first
  const builtInAgent = BUILT_IN_BACKGROUND_AGENTS.find(agent => 
    generateBuiltInAgentId(agent.name) === agentId
  );
  if (builtInAgent) {
    return builtInAgent.name;
  }
  
  // Check provided map
  if (agentNameMap && agentNameMap[agentId]) {
    return agentNameMap[agentId];
  }
  
  // Fallback: clean up the agentId
  if (agentId.startsWith('built-in-')) {
    return agentId.replace('built-in-', '').split('-').map(
      word => word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  return 'Background Agent';
};

export default function InlineAgentResults({ 
  alerts, 
  conversationId,
  agentNameMap 
}: InlineAgentResultsProps): React.JSX.Element | null {
  // Filter alerts for this conversation if conversationId is provided
  const relevantAlerts = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    return conversationId 
      ? alerts.filter(a => !a.conversationId || a.conversationId === conversationId)
      : alerts;
  }, [alerts, conversationId]);
  
  // Group alerts by agent for better organization
  const alertsByAgent = useMemo(() => {
    if (relevantAlerts.length === 0) return {};
    const grouped: Record<string, AgentAlert[]> = {};
    relevantAlerts.forEach(alert => {
      const agentName = getAgentName(alert.agentId, agentNameMap);
      if (!grouped[agentName]) {
        grouped[agentName] = [];
      }
      grouped[agentName].push(alert);
    });
    return grouped;
  }, [relevantAlerts, agentNameMap]);
  
  if (relevantAlerts.length === 0) return null;
  
  const getSeverityColor = (severity: AgentAlert['severity']) => {
    switch (severity) {
      case 'error':
        return { bg: 'error.light', border: 'error.main', text: 'error.dark', chip: 'error' as const };
      case 'warn':
        return { bg: 'warning.light', border: 'warning.main', text: 'warning.dark', chip: 'warning' as const };
      default:
        return { bg: 'info.light', border: 'info.main', text: 'info.dark', chip: 'info' as const };
    }
  };
  
  // If only one alert, show it compactly
  if (relevantAlerts.length === 1) {
    const alert = relevantAlerts[0];
    const colors = getSeverityColor(alert.severity);
    const agentName = getAgentName(alert.agentId, agentNameMap);
    
    return (
      <Box sx={{ mt: 1.5 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <SmartToyIcon 
              sx={{ 
                fontSize: 18, 
                color: colors.text,
                mt: 0.25,
                flexShrink: 0,
              }} 
            />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {agentName}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: colors.text,
                  mb: 1,
                }}
              >
                {alert.message || 'Agent detected an issue in this conversation.'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  label={`Rating: ${alert.rating}/100`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    color: colors.text,
                  }}
                />
                <Chip
                  label={alert.severity.toUpperCase()}
                  size="small"
                  color={colors.chip}
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                  }}
                />
              </Stack>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }
  
  // Multiple alerts - show summary header with expandable list
  const errorCount = relevantAlerts.filter(a => a.severity === 'error').length;
  const warnCount = relevantAlerts.filter(a => a.severity === 'warn').length;
  const infoCount = relevantAlerts.filter(a => a.severity === 'info').length;
  const primarySeverity = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'info';
  const primaryColors = getSeverityColor(primarySeverity);
  
  return (
    <Box sx={{ mt: 1.5 }}>
      <Paper
        variant="outlined"
        sx={{
          borderColor: primaryColors.border,
          borderWidth: 1,
          overflow: 'hidden',
        }}
      >
        {/* Summary Header */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: primaryColors.bg,
            borderBottom: `1px solid ${primaryColors.border}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <SmartToyIcon 
              sx={{ 
                fontSize: 18, 
                color: primaryColors.text,
                flexShrink: 0,
              }} 
            />
            <Typography 
              variant="body2" 
              sx={{ 
                color: primaryColors.text,
                fontWeight: 600,
              }}
            >
              {relevantAlerts.length} Background Agent Alert{relevantAlerts.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {errorCount > 0 && (
              <Chip
                label={`${errorCount} Error${errorCount !== 1 ? 's' : ''}`}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            {warnCount > 0 && (
              <Chip
                label={`${warnCount} Warning${warnCount !== 1 ? 's' : ''}`}
                size="small"
                color="warning"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            {infoCount > 0 && (
              <Chip
                label={`${infoCount} Info${infoCount !== 1 ? 's' : ''}`}
                size="small"
                color="info"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        </Box>
        
        {/* Alerts List - Grouped by Agent */}
        <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
          {Object.entries(alertsByAgent).map(([agentName, agentAlerts], agentIdx) => (
            <Box key={agentName}>
              {agentIdx > 0 && <Divider />}
              <Box sx={{ p: 1.5 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                  }}
                >
                  {agentName} ({agentAlerts.length})
                </Typography>
                <Stack spacing={1}>
                  {agentAlerts.map((alert) => {
                    const colors = getSeverityColor(alert.severity);
                    return (
                      <Paper
                        key={alert.id}
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          borderWidth: 1,
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: colors.text,
                            mb: 1,
                          }}
                        >
                          {alert.message || 'Agent detected an issue.'}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Chip
                            label={`Rating: ${alert.rating}/100`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: 'rgba(0,0,0,0.1)',
                              color: colors.text,
                            }}
                          />
                          <Chip
                            label={alert.severity.toUpperCase()}
                            size="small"
                            color={colors.chip}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                            }}
                          />
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

