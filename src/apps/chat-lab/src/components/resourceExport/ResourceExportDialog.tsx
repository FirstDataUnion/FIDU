/**
 * Resource Export Dialog
 * Allows users to select resources to export
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
} from '@mui/icons-material';
import { getResourceExportService } from '../../services/resourceExport/resourceExportService';
import type { SystemPrompt, Context } from '../../types';
import type { BackgroundAgent } from '../../services/api/backgroundAgents';

interface ResourceExportDialogProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  userEmail?: string;
}

export default function ResourceExportDialog({
  open,
  onClose,
  profileId,
  userEmail,
}: ResourceExportDialogProps) {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [availableResources, setAvailableResources] = useState<{
    systemPrompts: SystemPrompt[];
    contexts: Context[];
    backgroundAgents: BackgroundAgent[];
    conversations: any[];
  }>({
    systemPrompts: [],
    contexts: [],
    backgroundAgents: [],
    conversations: [],
  });

  const [selectedIds, setSelectedIds] = useState<{
    systemPrompts: Set<string>;
    contexts: Set<string>;
    backgroundAgents: Set<string>;
    conversations: Set<string>;
  }>({
    systemPrompts: new Set(),
    contexts: new Set(),
    backgroundAgents: new Set(),
    conversations: new Set(),
  });

  const exportService = getResourceExportService();

  // Load available resources
  useEffect(() => {
    if (open && profileId) {
      loadResources();
    }
  }, [open, profileId]);

  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const resources = await exportService.getAvailableResources(profileId);
      setAvailableResources(resources);
    } catch (err: any) {
      setError(err.message || 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResource = useCallback((
    type: 'systemPrompts' | 'contexts' | 'backgroundAgents' | 'conversations',
    id: string
  ) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev[type]);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return {
        ...prev,
        [type]: newSet,
      };
    });
  }, []);

  const handleSelectAll = useCallback((type: 'systemPrompts' | 'contexts' | 'backgroundAgents' | 'conversations') => {
    setSelectedIds(prev => {
      const resources = availableResources[type];
      const allSelected = resources.every(r => prev[type].has(r.id));
      
      if (allSelected) {
        // Deselect all
        return {
          ...prev,
          [type]: new Set(),
        };
      } else {
        // Select all
        return {
          ...prev,
          [type]: new Set(resources.map(r => r.id)),
        };
      }
    });
  }, [availableResources]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      const selection = {
        systemPromptIds: Array.from(selectedIds.systemPrompts),
        contextIds: Array.from(selectedIds.contexts),
        backgroundAgentIds: Array.from(selectedIds.backgroundAgents),
        conversationIds: Array.from(selectedIds.conversations),
      };

      const exportData = await exportService.exportResources(selection, profileId, userEmail);
      exportService.downloadExport(exportData);

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to export resources');
    } finally {
      setExporting(false);
    }
  };

  const totalSelected = 
    selectedIds.systemPrompts.size +
    selectedIds.contexts.size +
    selectedIds.backgroundAgents.size +
    selectedIds.conversations.size;

  const renderResourceSection = (
    title: string,
    type: 'systemPrompts' | 'contexts' | 'backgroundAgents' | 'conversations',
    resources: any[],
    getLabel: (resource: any) => string
  ) => {
    if (resources.length === 0) {
      return null;
    }

    const selected = selectedIds[type];
    const allSelected = resources.length > 0 && resources.every(r => selected.has(r.id));
    const someSelected = resources.some(r => selected.has(r.id));

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={() => handleSelectAll(type)}
              onClick={(e) => e.stopPropagation()}
            />
            <Typography variant="h6" sx={{ ml: 1 }}>
              {title} ({resources.length})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <List dense>
            {resources.map((resource) => (
              <ListItem key={resource.id}>
                <Checkbox
                  checked={selected.has(resource.id)}
                  onChange={() => handleToggleResource(type, resource.id)}
                  icon={<CheckBoxOutlineBlankIcon />}
                  checkedIcon={<CheckBoxIcon />}
                />
                <ListItemText
                  primary={getLabel(resource)}
                  secondary={resource.description || resource.body?.substring(0, 100) || ''}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Export Resources</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select resources to export. Built-in resources are excluded.
            </Typography>

            {renderResourceSection(
              'System Prompts',
              'systemPrompts',
              availableResources.systemPrompts,
              (sp) => sp.name
            )}

            {renderResourceSection(
              'Contexts',
              'contexts',
              availableResources.contexts,
              (ctx) => ctx.title
            )}

            {renderResourceSection(
              'Background Agents',
              'backgroundAgents',
              availableResources.backgroundAgents,
              (agent) => agent.name
            )}

            {renderResourceSection(
              'Conversations',
              'conversations',
              availableResources.conversations,
              (conv) => conv.title
            )}

            {totalSelected === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Select at least one resource to export.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={totalSelected === 0 || exporting}
        >
          {exporting ? <CircularProgress size={20} /> : `Export ${totalSelected} Resource${totalSelected !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

