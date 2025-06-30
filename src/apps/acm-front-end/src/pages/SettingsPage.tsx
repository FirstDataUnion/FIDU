import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Alert, 
  CircularProgress,
  Divider 
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Refresh as RefreshIcon 
} from '@mui/icons-material';
import { populateDatabaseWithSampleData, isDatabaseEmpty } from '../utils/sampleData';
import { dbService } from '../services/database';
import { useAppDispatch } from '../hooks/redux';
import { fetchConversations } from '../store/slices/conversationsSlice';
import { fetchMemories } from '../store/slices/memoriesSlice';
import { fetchTags } from '../store/slices/tagsSlice';
import { fetchSettings } from '../store/slices/settingsSlice';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const dispatch = useAppDispatch();

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
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧪 Development & Testing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage sample data for testing the ACM Manager application.
          </Typography>
          
          {message && (
            <Alert 
              severity={message.type} 
              sx={{ mb: 2 }}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}
          
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