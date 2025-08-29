import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, IconButton, Collapse } from '@mui/material';
import { 
  Speed as SpeedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

interface PerformanceMetrics {
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
}

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
  componentName: string;
  showInProduction?: boolean;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  componentName,
  showInProduction = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development or if explicitly enabled
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development' || showInProduction);
  }, [showInProduction]);

  if (!isVisible) return null;

  const { renderTime, renderCount, averageRenderTime, lastRenderTime } = metrics;
  
  // Color coding based on performance
  const getPerformanceColor = (time: number) => {
    if (time <= 16) return 'success.main'; // 60fps
    if (time <= 33) return 'warning.main'; // 30fps
    return 'error.main'; // Below 30fps
  };

  const getPerformanceLabel = (time: number) => {
    if (time <= 16) return 'Excellent';
    if (time <= 33) return 'Good';
    if (time <= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        zIndex: 9999,
        minWidth: 280,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SpeedIcon color="primary" fontSize="small" />
        <Typography variant="caption" sx={{ flex: 1 }}>
          {componentName} Performance
        </Typography>
        <IconButton 
          size="small" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      <Collapse in={isExpanded}>
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Last Render:
            </Typography>
            <Typography 
              variant="caption" 
              color={getPerformanceColor(lastRenderTime)}
              fontWeight="bold"
            >
              {lastRenderTime.toFixed(1)}ms ({getPerformanceLabel(lastRenderTime)})
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Average:
            </Typography>
            <Typography variant="caption" fontWeight="bold">
              {averageRenderTime.toFixed(1)}ms
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Total Renders:
            </Typography>
            <Typography variant="caption" fontWeight="bold">
              {renderCount}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Current:
            </Typography>
            <Typography 
              variant="caption" 
              color={getPerformanceColor(renderTime)}
              fontWeight="bold"
            >
              {renderTime.toFixed(1)}ms
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default React.memo(PerformanceMonitor);
