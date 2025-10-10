/**
 * Insufficient Permissions Modal
 * Displayed when user doesn't grant required OAuth permissions
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import { Warning, CheckBox, CloudOff, Refresh } from '@mui/icons-material';
// Import the image from the public directory
const DataPermissionGuide = './DataPermissionGuide.png';

interface InsufficientPermissionsModalProps {
  open: boolean;
  onReconnect: () => void;
  onCancel: () => void;
}

export default function InsufficientPermissionsModal({
  open,
  onReconnect,
  onCancel
}: InsufficientPermissionsModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Warning color="warning" sx={{ fontSize: 28 }} />
        <Typography variant="h6" component="span">
          Missing Required Permissions
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your Google Drive connection is missing required permissions. The app cannot sync your data without these permissions.
        </Alert>

        <Paper sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: 'warning.light',
          border: '2px solid',
          borderColor: 'warning.main',
          boxShadow: '0 0 0 1px rgba(255, 152, 0, 0.2)'
        }}>
          <Typography variant="body1" gutterBottom sx={{ fontWeight: 500 }}>
            What happened?
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            When you authorized the app, there was a checkbox for granting access to Google Drive that wasn't selected. Without this permission, the app cannot store or sync your data.
          </Typography>
          
          {/* Screenshot guide */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
              Here's what to look for on Google's authorization screen:
            </Typography>
            <Box
              component="img"
              src={DataPermissionGuide}
              alt="Google Drive permission checkbox guide"
              sx={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 1
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Look for the Google Drive permission and make sure to check the box
            </Typography>
          </Box>
        </Paper>

        <Typography variant="body1" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
          How to fix this:
        </Typography>
        
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CloudOff color="action" />
            </ListItemIcon>
            <ListItemText 
              primary="Step 1: Disconnect"
              secondary="We'll disconnect your current Google Drive connection"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Refresh color="action" />
            </ListItemIcon>
            <ListItemText 
              primary="Step 2: Re-authorize"
              secondary="You'll be redirected to Google's authorization page again"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckBox color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Step 3: Check ALL boxes"
              secondary="Make sure to check all permission checkboxes, especially the one for Drive access"
            />
          </ListItem>
        </List>

        <Box sx={{ 
          mt: 3, 
          p: 2, 
          bgcolor: 'warning.light', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'warning.main'
        }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            <strong>Important:</strong> The screenshot above shows exactly what to look for. Make sure to check the Google Drive permission box before clicking "Continue".
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', width: '100%' }}>
          Click "Reconnect with Permissions" to go directly to Google's authorization screen where you can check the Drive permission box.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', width: '100%' }}>
        <Button 
          onClick={onCancel}
          color="inherit"
        >
          Cancel
        </Button>
        <Button 
          onClick={onReconnect}
          variant="contained"
          color="primary"
          startIcon={<Refresh />}
          sx={{ minWidth: 200 }}
        >
          Reconnect with Permissions
        </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

