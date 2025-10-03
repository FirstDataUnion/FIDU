import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { setCurrentProfile, createProfile, clearError } from '../../store/slices/authSlice';
import type { Profile } from '../../types';

const ProfileSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const { profiles, isLoading, error } = useAppSelector((state) => state.auth);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const handleProfileSelect = (profile: Profile) => {
    dispatch(setCurrentProfile(profile));
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    // Validate profile name length (assuming max 100 characters based on common patterns)
    const trimmedName = newProfileName.trim();
    if (trimmedName.length > 100) {
      // Input validation fallback
      return;
    }

    dispatch(clearError());
    
    const result = await dispatch(createProfile(trimmedName));
    
    if (createProfile.fulfilled.match(result)) {
      setShowCreateDialog(false);
      setNewProfileName('');
      // Select the newly created profile
      dispatch(setCurrentProfile(result.payload));
    }
    // Error handling is done by the Redux state, which will show in the error display
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 500,
          mx: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Select Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Choose a profile to continue or create a new one
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {profiles.length > 0 && (
          <List sx={{ mb: 3 }}>
            {profiles.map((profile) => (
              <ListItem key={profile.id} disablePadding>
                <ListItemButton onClick={() => handleProfileSelect(profile)}>
                  <ListItemText
                    primary={profile.name}
                    secondary={`Created: ${new Date(profile.create_timestamp).toLocaleDateString()}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        <Box display="flex" justifyContent="center" gap={2}>
          <Button
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
            disabled={isLoading}
          >
            Create New Profile
          </Button>
        </Box>

        {/* Create Profile Dialog */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label="Profile Name"
              fullWidth
              variant="outlined"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateProfile();
                }
              }}
              inputProps={{
                maxLength: 100
              }}
              helperText={`${newProfileName.length}/100 characters`}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateProfile} 
              variant="contained"
              disabled={!newProfileName.trim() || isLoading}
            >
              {isLoading ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default ProfileSelector; 