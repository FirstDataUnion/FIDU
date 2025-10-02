import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  FolderOpen as FolderIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Storage as StorageIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useAppSelector } from '../hooks/redux';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { MigrationService } from '../services/migration/MigrationService';

interface MigrationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

const DataMigrationPage: React.FC = () => {
  const { settings } = useAppSelector((state) => state.settings);
  const { currentProfile } = useAppSelector((state) => state.auth);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDatabaseLocation = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) {
      return '%APPDATA%\\FIDU\\fidu.db';
    } else if (userAgent.includes('Mac')) {
      return '/Users/[Your_Username]/Library/Application Support/FIDU/fidu.db';
    } else {
      return '~/.local/share/fidu/fidu.db';
    }
  };

  const initializeMigrationSteps = useCallback(() => {
    const steps: MigrationStep[] = [
      { id: 'validate', label: 'Validate database file', status: 'pending' },
      { id: 'parse', label: 'Parse old database structure', status: 'pending' },
      { id: 'convert', label: 'Convert to new format', status: 'pending' },
      { id: 'import', label: 'Import to local storage', status: 'pending' },
      { id: 'sync', label: 'Sync to cloud storage', status: 'pending' },
    ];
    setMigrationSteps(steps);
    return steps;
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: MigrationStep['status'], error?: string) => {
    setMigrationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, error } : step
    ));
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
      setMigrationResult({
        success: false,
        message: 'Please select a valid SQLite database file (.db, .sqlite, or .sqlite3)',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setMigrationResult(null);
    
    const steps = initializeMigrationSteps();
    const migrationService = new MigrationService();
    const storageService = getUnifiedStorageService();

    try {
      // Step 1: Validate file
      updateStepStatus('validate', 'in-progress');
      setProgress(10);
      
      const fileBuffer = await file.arrayBuffer();
      const isValid = await migrationService.validateDatabase(fileBuffer);
      
      if (!isValid) {
        throw new Error('Invalid database file format');
      }
      
      updateStepStatus('validate', 'completed');
      setProgress(20);

      // Run the migration
      updateStepStatus('parse', 'in-progress');
      updateStepStatus('convert', 'in-progress');
      updateStepStatus('import', 'in-progress');
      setProgress(30);
      
      const migrationResult = await migrationService.migrateDatabase(fileBuffer, storageService, currentProfile?.id || 'default');
      
      updateStepStatus('parse', 'completed');
      updateStepStatus('convert', 'completed');
      updateStepStatus('import', 'completed');
      setProgress(90);

      // Step 5: Sync to cloud (if in cloud mode)
      if (settings.storageMode === 'cloud') {
        updateStepStatus('sync', 'in-progress');
        setProgress(95);
        
        await storageService.sync();
        updateStepStatus('sync', 'completed');
      } else {
        updateStepStatus('sync', 'completed');
      }
      
      setProgress(100);
      
      setMigrationResult({
        success: true,
        message: 'Migration completed successfully! Your data has been imported and is ready to use.',
        details: {
          conversations: migrationResult.dataPackets.imported,
          contexts: 0, // Will be updated when we track these separately
          systemPrompts: 0, // Will be updated when we track these separately
          apiKeys: migrationResult.apiKeys.imported,
        }
      });

    } catch (error) {
      console.error('Migration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setMigrationResult({
        success: false,
        message: `Migration failed: ${errorMessage}`,
      });
      
      // Mark current step as error
      const currentStep = steps.find(step => step.status === 'in-progress');
      if (currentStep) {
        updateStepStatus(currentStep.id, 'error', errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [settings.storageMode, initializeMigrationSteps, updateStepStatus]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive: dropzoneDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
      'application/octet-stream': ['.db', '.sqlite', '.sqlite3'],
    },
    multiple: false,
    disabled: isProcessing,
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const getStepIcon = (status: MigrationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'in-progress':
        return <LinearProgress size={20} />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="action" />;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Data Migration
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Migrate your data from the old FIDU Vault desktop application to the new cloud-based version.
      </Typography>

      {/* Current Storage Mode Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <StorageIcon />
          <Typography variant="body2" component="span">
            Current storage mode: 
          </Typography>
          <Chip label={settings.storageMode} size="small" />
        </Box>
      </Alert>

      {/* Migration Guide */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              How to find your old database file
            </Typography>
            <IconButton onClick={() => setShowGuide(!showGuide)}>
              {showGuide ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={showGuide}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your old FIDU database file is typically located at:
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2, fontFamily: 'monospace' }}>
                {getDatabaseLocation()}
              </Paper>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Note:</strong> Replace [Your_Username] with your actual macOS username.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                To find and upload your database:
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <FolderIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Navigate to the folder above"
                    secondary="Use your file manager to go to this location"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <UploadIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Look for 'fidu.db' file"
                    secondary="This is your old database file"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Drag and drop or select the file"
                    secondary="Use the upload area below to import your data"
                  />
                </ListItem>
              </List>
              
              {/* macOS Library Folder Help */}
              {navigator.userAgent.includes('Mac') && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Can't find your Library folder?
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    On newer Macs, the Library folder is hidden by default. Here are several ways to access it:
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Method 1: Go Menu (Temporary)"
                        secondary="1. Open Finder → Go menu → Hold Option key → Click 'Library'"
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Method 2: Go to Folder (Direct)"
                        secondary="1. Open Finder → Go menu → 'Go to Folder...' → Type '~/Library' → Press Enter"
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Method 3: Make Library Permanently Visible"
                        secondary="1. Open Finder → Go to Home folder → View menu → Show View Options → Check 'Show Library Folder'"
                      />
                    </ListItem>
                  </List>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Once you can see the Library folder, navigate to: <strong>Application Support → FIDU → fidu.db</strong>
                    </Typography>
                  </Alert>
                </Box>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: dropzoneDragActive ? 'primary.main' : 'grey.300',
          backgroundColor: dropzoneDragActive ? 'primary.50' : 'background.paper',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          opacity: isProcessing ? 0.6 : 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.50',
          },
        }}
      >
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        
        <Typography variant="h6" gutterBottom>
          {dropzoneDragActive ? 'Drop your database file here' : 'Upload your old database file'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag and drop your fidu.db file here, or click to browse
        </Typography>
        
        <Button
          variant="outlined"
          onClick={handleFileSelect}
          disabled={isProcessing}
          startIcon={<FolderIcon />}
        >
          Select File
        </Button>
      </Paper>

      {/* Progress and Steps */}
      {isProcessing && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Migration Progress
          </Typography>
          
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ mb: 2, height: 8, borderRadius: 4 }}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {progress}% complete
          </Typography>
          
          <List>
            {migrationSteps.map((step) => (
              <ListItem key={step.id}>
                <ListItemIcon>
                  {getStepIcon(step.status)}
                </ListItemIcon>
                <ListItemText
                  primary={step.label}
                  secondary={step.error}
                  secondaryTypographyProps={{ color: 'error' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Migration Result */}
      {migrationResult && (
        <Alert 
          severity={migrationResult.success ? 'success' : 'error'} 
          sx={{ mt: 3 }}
        >
          <Typography variant="body1">
            {migrationResult.message}
          </Typography>
          
          {migrationResult.success && migrationResult.details && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Imported: {migrationResult.details.conversations} conversations, {migrationResult.details.contexts} contexts, {migrationResult.details.systemPrompts} system prompts, {migrationResult.details.apiKeys} API keys
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Storage Mode Information */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Storage Mode Information
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            After migration, your data will be stored according to your current storage mode:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText
                primary={settings.storageMode === 'cloud' ? 'Cloud Storage (Google Drive)' : 'Local Browser Storage'}
                secondary={
                  settings.storageMode === 'cloud' 
                    ? 'Data will be synced to your Google Drive for multi-device access'
                    : 'Data will be stored locally in your browser'
                }
              />
            </ListItem>
            
            {settings.storageMode === 'cloud' && (
              <ListItem>
                <ListItemIcon>
                  <SyncIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Automatic Sync"
                  secondary="Changes will be automatically synced to Google Drive"
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataMigrationPage;
