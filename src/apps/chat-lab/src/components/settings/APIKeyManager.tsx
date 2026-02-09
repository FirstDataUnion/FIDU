import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { getEnvironmentInfo } from '../../utils/environment';
import { useStorage } from '../../hooks/useStorage';

interface APIKey {
  id: string;
  provider: string;
  api_key?: string; // Decrypted key (only when editing/viewing)
  create_timestamp: string;
  update_timestamp: string;
}

// Supported providers for NLP Workbench
const SUPPORTED_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'openrouter', label: 'OpenRouter' },
];

export const APIKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const envInfo = getEnvironmentInfo();
  const { isInitialized, storageMode } = useStorage();

  // Only hide the component if we're in local deployment mode AND using local storage mode
  // This allows API key management in all storage modes
  const isLocalDeployment = envInfo.storageMode === 'local';
  const isLocalStorageMode = storageMode === 'local';
  const shouldHideComponent = isLocalDeployment && isLocalStorageMode;

  const loadAPIKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if storage is initialized
      if (!isInitialized) {
        setError(
          'Storage is not set up yet. Please configure your storage options in Settings before managing API keys.'
        );
        setLoading(false);
        return;
      }

      const storage = getUnifiedStorageService();
      const keys = await storage.getAllAPIKeys();
      setApiKeys(keys);
    } catch (err: any) {
      console.error('Failed to load API keys:', err);
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Load API keys on mount and when storage mode changes
  useEffect(() => {
    loadAPIKeys();
  }, [isInitialized, storageMode, loadAPIKeys]);

  const handleProviderChange = (event: SelectChangeEvent<string>) => {
    const provider = event.target.value;
    setSelectedProvider(provider);
    setApiKeyValue('');
    setShowApiKey(false);

    // Check if we're editing an existing key
    const existingKey = apiKeys.find(key => key.provider === provider);
    setIsEditing(!!existingKey);
  };

  const handleSaveAPIKey = async () => {
    if (!selectedProvider || !apiKeyValue.trim()) {
      setError('Please select a provider and enter an API key');
      return;
    }

    // Check if storage is initialized
    if (!isInitialized) {
      setError(
        'Storage is not set up yet. Please configure your storage options in Settings before managing API keys.'
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const storage = getUnifiedStorageService();

      await storage.saveAPIKey(selectedProvider, apiKeyValue.trim());

      setSuccess(
        isEditing
          ? 'API key updated successfully!'
          : 'API key added successfully!'
      );
      setSelectedProvider('');
      setApiKeyValue('');
      setShowApiKey(false);
      setIsEditing(false);

      // Reload the keys
      await loadAPIKeys();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to save API key:', err);
      setError(err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (key: APIKey) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;

    // Check if storage is initialized
    if (!isInitialized) {
      setError(
        'Storage is not set up yet. Please configure your storage options in Settings before managing API keys.'
      );
      setDeleteDialogOpen(false);
      return;
    }

    try {
      setError(null);
      const storage = getUnifiedStorageService();
      await storage.deleteAPIKey(keyToDelete.id);

      setSuccess('API key deleted successfully!');
      setDeleteDialogOpen(false);
      setKeyToDelete(null);

      // Reload the keys
      await loadAPIKeys();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete API key:', err);
      setError(err.message || 'Failed to delete API key');
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setKeyToDelete(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getProviderLabel = (provider: string) => {
    const providerInfo = SUPPORTED_PROVIDERS.find(p => p.value === provider);
    return providerInfo?.label || provider;
  };

  // Don't show this component in local deployment mode when using local storage mode
  if (shouldHideComponent) {
    return null;
  }

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <KeyIcon />
        API Key Management
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your AI model provider API keys. These keys are encrypted and
        stored securely using the same encryption as your conversations and
        other data.
      </Typography>

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* Storage Setup Warning */}
      {!isInitialized && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Storage not configured:</strong> You need to set up your
            storage options before you can manage API keys. Please go to the
            Storage Settings section above to configure your preferred storage
            method (Cloud Storage or File System).
          </Typography>
        </Alert>
      )}

      {/* Add/Update API Key Form */}
      <Box
        component="form"
        onSubmit={e => {
          e.preventDefault();
          handleSaveAPIKey();
        }}
        sx={{
          mb: 4,
          p: 2,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          opacity: !isInitialized ? 0.6 : 1,
          pointerEvents: !isInitialized ? 'none' : 'auto',
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          {isEditing ? 'Update API Key' : 'Add New API Key'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="provider-select-label">Provider</InputLabel>
            <Select
              labelId="provider-select-label"
              id="provider-select"
              value={selectedProvider}
              label="Provider"
              onChange={handleProviderChange}
              disabled={saving}
            >
              <MenuItem value="">
                <em>Select a provider</em>
              </MenuItem>
              {SUPPORTED_PROVIDERS.map(provider => (
                <MenuItem key={provider.value} value={provider.value}>
                  {provider.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <TextField
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyValue}
              onChange={e => setApiKeyValue(e.target.value)}
              disabled={saving || !selectedProvider}
              placeholder="Enter your API key"
              autoComplete="off"
              InputProps={{
                endAdornment: (
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    disabled={!apiKeyValue}
                    type="button"
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                ),
              }}
            />
          </FormControl>

          <Button
            type="submit"
            variant="contained"
            startIcon={
              saving ? (
                <CircularProgress size={20} />
              ) : isEditing ? (
                <EditIcon />
              ) : (
                <AddIcon />
              )
            }
            disabled={saving || !selectedProvider || !apiKeyValue.trim()}
            color={isEditing ? 'warning' : 'primary'}
          >
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Update API Key'
                : 'Add API Key'}
          </Button>
        </Box>
      </Box>

      {/* API Keys List */}
      <Typography variant="subtitle1" gutterBottom>
        Your API Keys
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : apiKeys.length === 0 ? (
        <Alert severity="info">
          No API keys configured yet. Add your first API key above to get
          started.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.map(key => (
                <TableRow key={key.id}>
                  <TableCell>
                    <Chip
                      label={getProviderLabel(key.provider)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatDate(key.create_timestamp)}</TableCell>
                  <TableCell>{formatDate(key.update_timestamp)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => handleDeleteClick(key)}
                      color="error"
                      size="small"
                      title="Delete API Key"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete API Key</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the API key for{' '}
            <strong>
              {keyToDelete ? getProviderLabel(keyToDelete.provider) : ''}
            </strong>
            ?
            <br />
            <br />
            This action cannot be undone. You will need to re-enter the API key
            if you want to use this provider again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
