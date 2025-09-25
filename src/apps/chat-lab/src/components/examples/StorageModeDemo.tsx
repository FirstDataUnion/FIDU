/**
 * Example component demonstrating the use of the unified storage service
 * This component shows how to switch between local and cloud storage modes
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, Typography, Box, Chip, Alert } from '@mui/material';
import { useStorage } from '../../hooks/useStorage';

export const StorageModeDemo: React.FC = () => {
  const storage = useStorage();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (storage.isInitialized) {
      loadConversations();
    }
  }, [storage.isInitialized]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await storage.getConversations();
      setConversations(result.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setError(null);
      await storage.sync();
      // Reload conversations after sync
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    }
  };

  if (!storage.isInitialized) {
    return (
      <Card>
        <CardContent>
          <Typography>Initializing storage service...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Storage Mode Demo
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Current Storage Mode:
          </Typography>
          <Chip 
            label={storage.storageMode.toUpperCase()} 
            color={storage.isCloudMode ? 'primary' : 'default'}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={storage.isOnline ? 'ONLINE' : 'OFFLINE'} 
            color={storage.isOnline ? 'success' : 'error'}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Button 
            variant="outlined" 
            onClick={loadConversations}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            {loading ? 'Loading...' : 'Load Conversations'}
          </Button>
          
          {storage.isCloudMode && (
            <Button 
              variant="contained" 
              onClick={handleSync}
              sx={{ mr: 1 }}
            >
              Sync
            </Button>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary">
          Conversations loaded: {conversations.length}
        </Typography>

        {conversations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Recent Conversations:
            </Typography>
            {conversations.slice(0, 3).map((conv) => (
              <Typography key={conv.id} variant="body2" sx={{ mb: 1 }}>
                • {conv.title} ({conv.messageCount} messages)
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
