/**
 * Directory Manager Demo Component
 * Demonstrates the FileSystemDirectoryManager component functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Divider
} from '@mui/material';
import { FileSystemDirectoryManager } from '../settings/FileSystemDirectoryManager';

export const DirectoryManagerDemo: React.FC = () => {
  const [directoryStatus, setDirectoryStatus] = useState<{
    isAccessible: boolean;
    directoryName: string | null;
  }>({
    isAccessible: false,
    directoryName: null
  });

  const handleDirectoryChange = (isAccessible: boolean, directoryName: string | null) => {
    setDirectoryStatus({ isAccessible, directoryName });
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File System Directory Manager Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        This demo shows the directory selection and management functionality for local file system storage.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Full Directory Manager
          </Typography>
          <FileSystemDirectoryManager
            onDirectoryChange={handleDirectoryChange}
            showTitle={false}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Compact Directory Manager
          </Typography>
          <FileSystemDirectoryManager
            onDirectoryChange={handleDirectoryChange}
            showTitle={false}
            compact
          />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Status
          </Typography>
          
          <Alert 
            severity={directoryStatus.isAccessible ? "success" : "info"}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              <strong>Directory Access:</strong> {directoryStatus.isAccessible ? 'Active' : 'Not Available'}
            </Typography>
            {directoryStatus.directoryName && (
              <Typography variant="body2">
                <strong>Selected Directory:</strong> {directoryStatus.directoryName}
              </Typography>
            )}
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Use the directory managers above to select and manage your local directory access.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DirectoryManagerDemo;
