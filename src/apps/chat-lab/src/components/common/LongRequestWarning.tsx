/**
 * Long Request Warning Component
 * Shows a warning when a request is likely to take a long time
 */

import React, { useState } from 'react';
import {
  Box,
  Alert,
  Typography,
  Button,
  Stack,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Schedule,
  Cancel,
  ExpandMore,
  ExpandLess,
  Speed,
  AutoMode,
  Compress
} from '@mui/icons-material';
import { type LongRequestAnalysis } from '../../utils/longRequestDetection';

interface LongRequestWarningProps {
  analysis: LongRequestAnalysis;
  isVisible: boolean;
  onCancel: () => void;
  onDismiss?: () => void;
}

export const LongRequestWarning: React.FC<LongRequestWarningProps> = ({
  analysis,
  isVisible,
  onCancel,
  onDismiss
}) => {
  const [showTips, setShowTips] = useState(false);

  if (!isVisible) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Alert 
        severity="info" 
        icon={<Schedule />}
        sx={{
          borderRadius: 2,
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
              Processing might take a while! 
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {analysis.reasons.map((reason, index) => (
                <span key={index}>
                  {reason}
                  {index < analysis.reasons.length - 1 && ', '}
                </span>
              ))}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Some large models can take a while to process large requests or large contexts. We will wait up to 11 minutes for the model to complete its work.
            </Typography>
          </Box>
          
          {/* Speed tips dropdown */}
          <Box>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowTips(!showTips)}
              startIcon={showTips ? <ExpandLess /> : <ExpandMore />}
              sx={{ 
                minWidth: 'auto',
                fontSize: '0.75rem',
                py: 0.5,
                px: 1,
                textTransform: 'none',
                color: 'primary.main'
              }}
            >
              Want to speed things up?
            </Button>
            
            <Collapse in={showTips}>
              <Box sx={{ mt: 1, pl: 2 }}>
                <List dense sx={{ py: 0 }}>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Speed fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Try a smaller model with a higher speed rating"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <AutoMode fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Try the auto mode, which automatically balances processing power and speed"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Compress fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Try slimming down your context with our context condenser"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                </List>
              </Box>
            </Collapse>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancel}
              sx={{ 
                minWidth: 'auto',
                fontSize: '0.75rem',
                py: 0.5,
                px: 1
              }}
            >
              Cancel Request
            </Button>
            {onDismiss && (
              <Button
                size="small"
                variant="text"
                onClick={onDismiss}
                sx={{ 
                  minWidth: 'auto',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1
                }}
              >
                Dismiss
              </Button>
            )}
          </Box>
        </Stack>
      </Alert>
    </Box>
  );
};

export default LongRequestWarning;

