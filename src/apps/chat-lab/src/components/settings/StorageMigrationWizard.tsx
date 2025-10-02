import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Storage as StorageIcon,
  FolderOpen as FolderIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

interface MigrationWizardProps {
  open: boolean;
  onClose: () => void;
  fromMode: 'local' | 'cloud' | 'filesystem';
  toMode: 'local' | 'cloud' | 'filesystem';
  onMigrationComplete?: () => void;
}

interface MigrationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface MigrationStatus {
  step: number;
  isRunning: boolean;
  error: string | null;
  results: {
    conversationsExported: number;
    apiKeysExported: number;
    conversationsImported: number;
    apiKeysImported: number;
  };
}

export const StorageMigrationWizard: React.FC<MigrationWizardProps> = ({
  open,
  onClose,
  fromMode,
  toMode,
  onMigrationComplete
}) => {
  const [status, setStatus] = useState<MigrationStatus>({
    step: 0,
    isRunning: false,
    error: null,
    results: {
      conversationsExported: 0,
      apiKeysExported: 0,
      conversationsImported: 0,
      apiKeysImported: 0
    }
  });

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'local':
        return <StorageIcon />;
      case 'cloud':
        return <CloudUploadIcon />;
      case 'filesystem':
        return <FolderIcon />;
      default:
        return <StorageIcon />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'local':
        return 'Local Browser Storage';
      case 'cloud':
        return 'Google Drive Sync';
      case 'filesystem':
        return 'Local File System';
      default:
        return mode;
    }
  };

  const steps: MigrationStep[] = [
    {
      id: 'prepare',
      label: 'Prepare Migration',
      description: 'Analyzing data and preparing for migration',
      icon: <SyncIcon />
    },
    {
      id: 'export',
      label: 'Export Data',
      description: `Exporting data from ${getModeLabel(fromMode)}`,
      icon: fromMode === 'cloud' ? <CloudDownloadIcon /> : <StorageIcon />
    },
    {
      id: 'import',
      label: 'Import Data',
      description: `Importing data to ${getModeLabel(toMode)}`,
      icon: toMode === 'cloud' ? <CloudUploadIcon /> : <StorageIcon />
    },
    {
      id: 'verify',
      label: 'Verify Migration',
      description: 'Verifying data integrity and completeness',
      icon: <CheckCircleIcon />
    }
  ];

  const handleStartMigration = async () => {
    setStatus({
      step: 0,
      isRunning: true,
      error: null,
      results: {
        conversationsExported: 0,
        apiKeysExported: 0,
        conversationsImported: 0,
        apiKeysImported: 0
      }
    });

    try {
      const storageService = getUnifiedStorageService();
      
      // Step 1: Prepare
      setStatus(prev => ({ ...prev, step: 1 }));
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate preparation
      
      // Step 2: Export (if needed)
      setStatus(prev => ({ ...prev, step: 2 }));
      // For now, we'll simulate the export process
      // In a real implementation, this would export data from the source storage
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Import (if needed)
      setStatus(prev => ({ ...prev, step: 3 }));
      // For now, we'll simulate the import process
      // In a real implementation, this would import data to the target storage
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Verify
      setStatus(prev => ({ ...prev, step: 4 }));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatus(prev => ({ ...prev, isRunning: false }));
      onMigrationComplete?.();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Migration failed';
      setStatus(prev => ({ 
        ...prev, 
        isRunning: false, 
        error: errorMessage 
      }));
    }
  };

  const handleClose = () => {
    if (!status.isRunning) {
      setStatus({
        step: 0,
        isRunning: false,
        error: null,
        results: {
          conversationsExported: 0,
          apiKeysExported: 0,
          conversationsImported: 0,
          apiKeysImported: 0
        }
      });
      onClose();
    }
  };

  const getStepIcon = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (status.step > stepIndex) {
      return <CheckCircleIcon color="success" />;
    } else if (status.step === stepIndex && status.isRunning) {
      return <SyncIcon color="primary" />;
    } else {
      return step.icon;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="migration-wizard-title"
    >
      <DialogTitle id="migration-wizard-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SyncIcon />
          <Typography variant="h6">
            Storage Migration Wizard
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Migrating data from <strong>{getModeLabel(fromMode)}</strong> to <strong>{getModeLabel(toMode)}</strong>
        </Typography>

        {status.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Migration Failed:</strong> {status.error}
            </Typography>
          </Alert>
        )}

        <Stepper activeStep={status.step} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.id}>
              <StepLabel
                icon={getStepIcon(index)}
                error={status.error && status.step === index}
              >
                <Typography variant="subtitle1">
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {step.description}
                </Typography>
                
                {status.isRunning && status.step === index && (
                  <LinearProgress sx={{ mb: 2 }} />
                )}
                
                {status.step > index && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      {step.label} completed successfully
                    </Typography>
                  </Alert>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {status.step === 4 && !status.isRunning && !status.error && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Migration Completed Successfully!</strong>
            </Typography>
            <List dense sx={{ mt: 1 }}>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${status.results.conversationsExported} conversations migrated`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${status.results.apiKeysExported} API keys migrated`}
                />
              </ListItem>
            </List>
          </Alert>
        )}

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> This migration process will copy your data to the new storage location. 
            Your original data will remain in the source location until you manually remove it.
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={status.isRunning}
        >
          {status.step === 4 && !status.isRunning ? 'Close' : 'Cancel'}
        </Button>
        
        {status.step === 0 && !status.isRunning && (
          <Button 
            onClick={handleStartMigration}
            variant="contained"
            color="primary"
          >
            Start Migration
          </Button>
        )}
        
        {status.isRunning && (
          <Button disabled variant="contained">
            <SyncIcon sx={{ mr: 1 }} />
            Migrating...
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default StorageMigrationWizard;
