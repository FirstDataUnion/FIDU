import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';
import { useAppSelector } from '../../hooks/redux';

interface StorageFeatureGuardProps {
  children: React.ReactNode;
  featureName: string;
  checkFeature: (adapter: any) => boolean;
  unsupportedMessage?: string;
}

export const StorageFeatureGuard: React.FC<StorageFeatureGuardProps> = ({
  children,
  featureName,
  checkFeature,
  unsupportedMessage,
}) => {
  const navigate = useNavigate();
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const [isSupported, setIsSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const checkSupport = () => {
      try {
        const storageService = getUnifiedStorageService();
        const adapter = storageService.getAdapter();
        const supported = checkFeature(adapter);
        setIsSupported(supported);
      } catch (error) {
        console.error('Error checking feature support:', error);
        setIsSupported(false);
      }
    };

    // Only check if storage is initialized
    if (unifiedStorage.status === 'configured' || unifiedStorage.mode) {
      checkSupport();
    } else {
      setIsSupported(null); // Still loading
    }
  }, [unifiedStorage.status, unifiedStorage.mode, checkFeature]);

  // Still loading storage configuration
  if (isSupported === null) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <Typography>Checking storage support...</Typography>
      </Box>
    );
  }

  // Feature not supported
  if (!isSupported) {
    const defaultMessage = unsupportedMessage || 
      `${featureName} is not supported by your current storage adapter.`;
    
    let adapterName: string;
    switch (unifiedStorage.mode) {
      case 'cloud':
        adapterName = 'Cloud Storage';
        break;
      case 'local':
        adapterName = 'Local Storage';
        break;
      default:
        adapterName = 'Unknown';
        break;
    }

    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Feature Not Available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {defaultMessage}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Current storage mode: <strong>{adapterName}</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/settings')}>
              Go to Settings
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Feature is supported, render children
  return <>{children}</>;
};

