/**
 * Cloud Mode Test Component
 * Tests the cloud storage functionality
 */

import { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress, Paper } from '@mui/material';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import GoogleDriveAuthPrompt from './auth/GoogleDriveAuthPrompt';

export default function CloudModeTest() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [storageMode, setStorageMode] = useState<string>('unknown');
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);

  useEffect(() => {
    const testCloudMode = async () => {
      try {
        setLoading(true);
        setStatus('Testing cloud mode initialization...');
        
        // Get the storage service
        const storageService = getUnifiedStorageService();
        
        // Check current storage mode
        const envInfo = {
          storageMode: import.meta.env.VITE_STORAGE_MODE || 'local'
        };
        setStorageMode(envInfo.storageMode);
        
        if (envInfo.storageMode === 'cloud') {
          setStatus('Initializing cloud storage...');
          
          // Try to initialize the storage service
          await storageService.initialize();
          
          // Check if we need authentication
          const adapter = storageService.getAdapter();
          if (adapter && 'isAuthenticated' in adapter && typeof adapter.isAuthenticated === 'function') {
            const isAuthenticated = adapter.isAuthenticated();
            if (!isAuthenticated) {
              setNeedsAuth(true);
              setStatus('Google Drive authentication required');
              setLoading(false);
              return;
            }
          }
          
          setStatus('Cloud storage initialized successfully!');
          setError(null);
        } else {
          setStatus('Running in local mode');
          setError(null);
        }
        
      } catch (err: any) {
        console.error('Cloud mode test error:', err);
        setError(err.message || 'Unknown error occurred');
        setStatus('Cloud mode test failed');
      } finally {
        setLoading(false);
      }
    };

    testCloudMode();
  }, []);

  const handleAuthenticated = () => {
    setNeedsAuth(false);
    setLoading(true);
    setStatus('Authentication successful, testing storage...');
    
    // Re-run the test after authentication
    setTimeout(() => {
      window.location.reload(); // Simple way to refresh the test
    }, 1000);
  };

  if (needsAuth) {
    return <GoogleDriveAuthPrompt onAuthenticated={handleAuthenticated} />;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Cloud Mode Test
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Current Configuration
        </Typography>
        <Typography variant="body1">
          Storage Mode: <strong>{storageMode}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Environment: {import.meta.env.MODE}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Test Status
        </Typography>
        
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body1">{status}</Typography>
          </Box>
        )}
        
        {!loading && !error && (
          <Typography variant="body1" color="success.main">
            ✅ {status}
          </Typography>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Error:</strong> {error}
            </Typography>
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Instructions
        </Typography>
        <Typography variant="body2" paragraph>
          To test cloud mode:
        </Typography>
        <Typography variant="body2" component="div">
          1. Set <code>VITE_STORAGE_MODE=cloud</code> in your environment
        </Typography>
        <Typography variant="body2" component="div">
          2. Configure Google Drive OAuth credentials
        </Typography>
        <Typography variant="body2" component="div">
          3. Authenticate with Google Drive
        </Typography>
        <Typography variant="body2" component="div">
          4. Test conversation operations
        </Typography>
      </Paper>
    </Box>
  );
}
