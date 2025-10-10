/**
 * Smart Auto-Sync Test Component
 * Helps verify and debug the smart auto-sync behavior
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Chip, 
  Alert,
  Divider,
  Stack
} from '@mui/material';
import { 
  PlayArrow, 
  Refresh, 
  Schedule,
  CloudSync
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';

const CloudModeTest: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testData, setTestData] = useState<any>(null);

  const refreshStatus = async () => {
    setIsLoading(true);
    try {
      const storageService = getUnifiedStorageService();
      const adapter = storageService.getAdapter();
      
      if ('getSyncStatus' in adapter) {
        const status = await (adapter as any).getSyncStatus();
        setSyncStatus(status);
      }
    } catch (error) {
      console.error('Failed to get sync status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestData = async () => {
    setIsLoading(true);
    try {
      const storageService = getUnifiedStorageService();
      
      // Create a test conversation to trigger unsynced data
      const testConversation = {
        title: `Test Conversation ${new Date().toLocaleTimeString()}`,
        platform: 'other' as const,
        messages: [{
          id: 'test-msg-1',
          conversationId: 'test-conv-1',
          content: 'This is a test message to trigger auto-sync',
          role: 'user' as const,
          timestamp: new Date().toISOString(),
          platform: 'other',
          attachments: [],
          isEdited: false
        }]
      };

      await storageService.createConversation('test-profile', testConversation, testConversation.messages);
      
      setTestData({
        message: 'Test conversation created! This should trigger auto-sync in 5 minutes.',
        timestamp: new Date().toLocaleTimeString()
      });
      
      // Refresh status to see unsynced data
      setTimeout(refreshStatus, 1000);
      
    } catch (error) {
      console.error('Failed to create test data:', error);
      setTestData({
        message: 'Failed to create test data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const forceSync = async () => {
    setIsLoading(true);
    try {
      const storageService = getUnifiedStorageService();
      await storageService.sync();
      setTestData({
        message: 'Manual sync completed!',
        timestamp: new Date().toLocaleTimeString()
      });
      setTimeout(refreshStatus, 1000);
    } catch (error) {
      console.error('Failed to force sync:', error);
      setTestData({
        message: 'Failed to force sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    
    // Refresh status every 10 seconds
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date | string | null): string => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString();
  };

  const getCountdownStatus = (): string => {
    if (!syncStatus?.smartAutoSync) return 'Unknown';
    
    const { countdownSeconds, nextSyncScheduledFor } = syncStatus.smartAutoSync;
    
    if (countdownSeconds > 0) {
      const minutes = Math.floor(countdownSeconds / 60);
      const seconds = countdownSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (nextSyncScheduledFor) {
      return 'Scheduled';
    } else {
      return 'None';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Smart Auto-Sync Test
      </Typography>
      
      <Stack spacing={3}>
        {/* Test Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Actions
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={createTestData}
                disabled={isLoading}
              >
                Create Test Data
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={forceSync}
                disabled={isLoading}
              >
                Force Sync
              </Button>
              <Button
                variant="outlined"
                startIcon={<Schedule />}
                onClick={refreshStatus}
                disabled={isLoading}
              >
                Refresh Status
              </Button>
            </Stack>
            
            {testData && (
              <Alert 
                severity={testData.error ? 'error' : 'info'}
                sx={{ mt: 2 }}
              >
                <Typography variant="body2">
                  <strong>{testData.timestamp}:</strong> {testData.message}
                  {testData.error && (
                    <><br /><strong>Error:</strong> {testData.error}</>
                  )}
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Auto-Sync Status */}
        {syncStatus?.smartAutoSync && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Smart Auto-Sync Status
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Status:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      icon={<CloudSync />}
                      label={syncStatus.smartAutoSync.enabled ? 'Enabled' : 'Disabled'}
                      color={syncStatus.smartAutoSync.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    <Chip
                      icon={<Schedule />}
                      label={`Countdown: ${getCountdownStatus()}`}
                      color={syncStatus.smartAutoSync.nextSyncScheduled ? 'primary' : 'default'}
                      size="small"
                    />
                    <Chip
                      label={`Unsynced: ${syncStatus.smartAutoSync.hasUnsyncedData ? 'Yes' : 'No'}`}
                      color={syncStatus.smartAutoSync.hasUnsyncedData ? 'warning' : 'success'}
                      size="small"
                    />
                    <Chip
                      label={`Next Sync: ${syncStatus.smartAutoSync.nextSyncScheduled ? 'Scheduled' : 'None'}`}
                      color={syncStatus.smartAutoSync.nextSyncScheduled ? 'primary' : 'default'}
                      size="small"
                    />
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Details:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <strong>Last Activity:</strong> {formatTime(syncStatus.smartAutoSync.lastActivity)}<br />
                    <strong>Last Sync Attempt:</strong> {formatTime(syncStatus.smartAutoSync.lastSyncAttempt)}<br />
                    <strong>Retry Count:</strong> {syncStatus.smartAutoSync.retryCount}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Base Sync Status */}
        {syncStatus && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Base Sync Status
              </Typography>
              
              <Typography variant="body2" component="div">
                <strong>Last Sync Time:</strong> {formatTime(syncStatus.lastSyncTime)}<br />
                <strong>Sync In Progress:</strong> {syncStatus.syncInProgress ? 'Yes' : 'No'}<br />
                <strong>Error:</strong> {syncStatus.error || 'None'}<br />
                <strong>Auto-Sync Enabled:</strong> {syncStatus.autoSyncEnabled ? 'Yes' : 'No'}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              How to Test
            </Typography>
            <Typography variant="body2" component="div">
              1. <strong>Create Test Data:</strong> Click "Create Test Data" to add a test conversation<br />
              2. <strong>Watch Countdown:</strong> See countdown timer in header (no activity timeout)<br />
              3. <strong>Auto-Sync:</strong> Sync triggers when countdown reaches zero<br />
              4. <strong>Check Status:</strong> Use "Refresh Status" to see current state<br />
              5. <strong>Force Sync:</strong> Use "Force Sync" to bypass countdown timing
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default CloudModeTest;