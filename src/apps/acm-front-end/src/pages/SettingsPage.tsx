import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Alert, 
  CircularProgress,
  Divider,
  TextField,
  IconButton,
  InputAdornment
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Refresh as RefreshIcon,
  Visibility,
  VisibilityOff,
  Save as SaveIcon
} from '@mui/icons-material';
import { populateDatabaseWithSampleData, isDatabaseEmpty } from '../utils/sampleData';
import { dbService } from '../services/database';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchConversations } from '../store/slices/conversationsSlice';
import { fetchMemories } from '../store/slices/memoriesSlice';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchSettings, saveSettings } from '../store/slices/settingsSlice';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showNlpApiKey, setShowNlpApiKey] = useState(false);
  const [tempNlpApiKey, setTempNlpApiKey] = useState('');
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((state) => state.settings);

  // Initialize temp API key from settings
  React.useEffect(() => {
    setTempNlpApiKey(settings.apiKeys?.nlpWorkbench || '');
  }, [settings.apiKeys?.nlpWorkbench]);

  const handleSaveApiKeys = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      await dispatch(saveSettings({
        ...settings,
        apiKeys: {
          ...settings.apiKeys,
          nlpWorkbench: tempNlpApiKey,
        }
      })).unwrap();
      
      setMessage({
        type: 'success',
        text: '🔑 API keys saved successfully!'
      });
    } catch (error) {
      console.error('Error saving API keys:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save API keys. Check the console for details.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearNlpApiKey = () => {
    setTempNlpApiKey('');
  };

  const handlePopulateSampleData = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const isEmpty = await isDatabaseEmpty();
      
      if (!isEmpty) {
        setMessage({
          type: 'info',
          text: 'Database already contains data. Clear it first or the sample data will be added to existing data.'
        });
      }
      
      await populateDatabaseWithSampleData();
      
      // Refresh all data in Redux store
      await Promise.all([
        dispatch(fetchConversations({ 
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc'
          },
          page: 1,
          limit: 20
        })),
        dispatch(fetchMemories()),
        dispatch(fetchTags()),
        dispatch(fetchSettings())
      ]);
      
      setMessage({
        type: 'success',
        text: '🎉 Sample data has been successfully loaded! Check the Conversations and Memories pages.'
      });
    } catch (error) {
      console.error('Error loading sample data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load sample data. Check the console for details.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      await dbService.clearAllData();
      
      // Refresh all data in Redux store
      await Promise.all([
        dispatch(fetchConversations({ 
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc'
          },
          page: 1,
          limit: 20
        })),
        dispatch(fetchMemories()),
        dispatch(fetchTags()),
        dispatch(fetchSettings())
      ]);
      
      setMessage({
        type: 'success',
        text: '🗑️ Database has been cleared successfully!'
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      setMessage({
        type: 'error',
        text: 'Failed to clear database. Check the console for details.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      // Refresh all data in Redux store
      await Promise.all([
        dispatch(fetchConversations({ 
          filters: {
            sortBy: 'updatedAt',
            sortOrder: 'desc'
          },
          page: 1,
          limit: 20
        })),
        dispatch(fetchMemories()),
        dispatch(fetchTags()),
        dispatch(fetchSettings())
      ]);
      
      setMessage({
        type: 'success',
        text: '🔄 Data has been refreshed from the database!'
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to refresh data. Check the console for details.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      {/* API Keys Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔑 API Keys
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure API keys for external services. These keys are stored locally and will be used instead of environment variables when provided.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: { xs: 1, md: 2 } }}>
              <TextField
                fullWidth
                label="NLP Workbench API Key"
                type={showNlpApiKey ? 'text' : 'password'}
                value={tempNlpApiKey}
                onChange={(e) => setTempNlpApiKey(e.target.value)}
                placeholder="Enter your NLP Workbench API key"
                helperText="This key will be used for AI model interactions. Leave empty to use environment variable."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNlpApiKey(!showNlpApiKey)}
                        edge="end"
                      >
                        {showNlpApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ flex: { xs: 1, md: 1 } }}>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveApiKeys}
                  disabled={loading}
                  fullWidth
                >
                  Save API Keys
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleClearNlpApiKey}
                  disabled={loading}
                  fullWidth
                >
                  Clear Key
                </Button>
              </Box>
            </Box>
          </Box>
          
        </CardContent>
      </Card>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧪 Development & Testing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage sample data for testing the ACM Manager application.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
              onClick={handlePopulateSampleData}
              disabled={loading}
            >
              Load Sample Data
            </Button>
            
            <Button
              variant="outlined"
              color="secondary"
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={handleRefreshData}
              disabled={loading}
            >
              Refresh Data
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
              onClick={handleClearDatabase}
              disabled={loading}
            >
              Clear Database
            </Button>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary">
            <strong>Sample Data Includes:</strong>
            <br />• 4 conversations from different AI platforms (ChatGPT, Claude, Gemini)
            <br />• Sample messages within conversations
            <br />• 3 extracted memories with different types and importance levels
            <br />• 5 tags for organizing content
            <br />• Default user settings
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 Application Settings
          </Typography>
          <Typography variant="body1">
            User preferences and application configuration will be available here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage; 