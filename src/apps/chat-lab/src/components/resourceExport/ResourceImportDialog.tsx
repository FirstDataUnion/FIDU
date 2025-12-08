/**
 * Resource Import Dialog
 * Allows users to import resources from JSON files
 */

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { getResourceImportService } from '../../services/resourceExport/resourceImportService';
import type { ResourceExport, ImportResult } from '../../services/resourceExport/types';
import { useAppSelector } from '../../hooks/redux';
import { getUnifiedStorageService } from '../../services/storage/UnifiedStorageService';

interface ResourceImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

export default function ResourceImportDialog({
  open,
  onClose,
  onImportComplete,
}: ResourceImportDialogProps) {
  const { currentProfile } = useAppSelector((state) => state.auth);
  const unifiedStorage = useAppSelector((state) => state.unifiedStorage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ResourceExport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const importService = getResourceImportService();
  
  // Determine effective profile ID: use workspace-level profile for shared workspaces
  const isSharedWorkspace = unifiedStorage.activeWorkspace?.type === 'shared';
  const effectiveProfileId = isSharedWorkspace && unifiedStorage.activeWorkspace?.id
    ? `workspace-${unifiedStorage.activeWorkspace.id}-default`
    : currentProfile?.id;

  const processFile = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setPreviewData(null);
      setImportResult(null);

      // Parse and validate file
      const data = await importService.parseImportFile(file);
      const validation = importService.validateExportFormat(data);

      if (!validation.valid) {
        setError(validation.error || 'Invalid file format');
        return;
      }

      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're actually leaving the drop zone
    // (not just moving over a child element)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Check if we're outside the drop zone bounds
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dropEffect to 'copy' to show the correct cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check if it's a JSON file
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        await processFile(file);
      } else {
        setError('Please drop a JSON file');
      }
    }
  };

  const handleImport = async () => {
    if (!previewData || !effectiveProfileId) {
      setError('Missing required data');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const storage = getUnifiedStorageService();
      const adapter = storage.getAdapter();
      const userId = (adapter as any).ensureUserId?.() || effectiveProfileId;

      const result = await importService.importResources(
        previewData,
        effectiveProfileId,
        userId,
        {
          skipDuplicates: true,
        }
      );

      setImportResult(result);
      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import resources');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreviewData(null);
    setImportResult(null);
    setError(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getResourceCounts = (data: ResourceExport) => ({
    systemPrompts: data.resources.systemPrompts?.length || 0,
    contexts: data.resources.contexts?.length || 0,
    backgroundAgents: data.resources.backgroundAgents?.length || 0,
    conversations: data.resources.conversations?.length || 0,
    documents: data.resources.documents?.length || 0,
  });

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <DialogTitle>Import Resources</DialogTitle>
      <DialogContent>
        {!previewData && !importResult && (
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Box
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? 'action.selected' : 'transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon sx={{ fontSize: 48, color: isDragging ? 'primary.main' : 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isDragging ? 'Drop JSON File Here' : 'Select JSON File to Import'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Click here or drag and drop a resource export file
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress />
              </Box>
            )}
          </Box>
        )}

        {previewData && !importResult && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Review the resources that will be imported:
            </Alert>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Export Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Version: {previewData.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Exported: {new Date(previewData.exportedAt).toLocaleString()}
              </Typography>
              {previewData.exportedBy && (
                <Typography variant="body2" color="text.secondary">
                  Exported by: {previewData.exportedBy}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Resources to Import
            </Typography>
            <List dense>
              {getResourceCounts(previewData).systemPrompts > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`System Prompts: ${getResourceCounts(previewData).systemPrompts}`}
                  />
                </ListItem>
              )}
              {getResourceCounts(previewData).contexts > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Contexts: ${getResourceCounts(previewData).contexts}`}
                  />
                </ListItem>
              )}
              {getResourceCounts(previewData).backgroundAgents > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Background Agents: ${getResourceCounts(previewData).backgroundAgents}`}
                  />
                </ListItem>
              )}
              {getResourceCounts(previewData).conversations > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Conversations: ${getResourceCounts(previewData).conversations}`}
                  />
                </ListItem>
              )}
              {getResourceCounts(previewData).documents > 0 && (
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Documents: ${getResourceCounts(previewData).documents}`}
                  />
                </ListItem>
              )}
            </List>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        )}

        {importResult && (
          <Box>
            <Alert
              severity={importResult.success ? 'success' : 'warning'}
              sx={{ mb: 2 }}
            >
              {importResult.success
                ? 'Import completed'
                : 'Import completed with some errors'}
            </Alert>

            <Typography variant="subtitle2" gutterBottom>
              Import Summary
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Chip
                label={`System Prompts: ${importResult.imported.systemPrompts}`}
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label={`Contexts: ${importResult.imported.contexts}`}
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label={`Background Agents: ${importResult.imported.backgroundAgents}`}
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label={`Conversations: ${importResult.imported.conversations}`}
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label={`Documents: ${importResult.imported.documents}`}
                color="primary"
                sx={{ mr: 1, mb: 1 }}
              />
            </Box>

            {importResult.warnings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Warnings
                </Typography>
                <List dense>
                  {importResult.warnings.map((warning, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={warning.resourceName}
                        secondary={warning.warning}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {importResult.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Errors
                </Typography>
                <List dense>
                  {importResult.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error.resourceName}
                        secondary={error.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {importResult ? 'Close' : 'Cancel'}
        </Button>
        {previewData && !importResult && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={loading || !currentProfile?.id}
          >
            {loading ? <CircularProgress size={20} /> : 'Import Resources'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

