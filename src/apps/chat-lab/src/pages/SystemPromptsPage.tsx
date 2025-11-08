import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Stack,
  Divider,
  DialogContentText,
  Tabs,
  Tab,
  CircularProgress,
  Link,
  Snackbar,
  Alert,
  IconButton,
} from '@mui/material';
import CategoryFilter from '../components/common/CategoryFilter';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Extension as ExtensionIcon,
  HelpOutline as HelpOutlineIcon,
  PlayArrow as PlayArrowIcon,
  MenuBook as MenuBookIcon,
  FileUpload as ExportIcon,
  FileDownload as ImportIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';

import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate } from 'react-router-dom';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { useFilesystemDirectoryRequired } from '../hooks/useFilesystemDirectoryRequired';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import SystemPromptHelpModal from '../components/help/SystemPromptHelpModal';
import { 
  fetchSystemPrompts, 
  createSystemPrompt, 
  updateSystemPrompt, 
  deleteSystemPrompt
} from '../store/slices/systemPromptsSlice';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { FloatingExportActions } from '../components/resourceExport/FloatingExportActions';
import { getResourceExportService } from '../services/resourceExport/resourceExportService';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';
import type { ExportSelection } from '../services/resourceExport/types';

// Extracted SystemPromptCard component for better performance
const SystemPromptCard = React.memo<{ 
  systemPrompt: any; 
  onViewEdit: (systemPrompt: any) => void;
  onTryPrompt: (systemPrompt: any) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}>(({ systemPrompt, onViewEdit, onTryPrompt, isSelectionMode = false, isSelected = false, onToggleSelection, onEnterSelectionMode }) => {
  const handleViewEdit = useCallback(() => {
    onViewEdit(systemPrompt);
  }, [systemPrompt, onViewEdit]);

  const handleTryPrompt = useCallback(() => {
    if (!isSelectionMode) {
      onTryPrompt(systemPrompt);
    }
  }, [systemPrompt, onTryPrompt, isSelectionMode]);

  const handleCardClick = useCallback(() => {
    if (isSelectionMode && onToggleSelection && !systemPrompt.isBuiltIn) {
      onToggleSelection(systemPrompt.id);
    }
  }, [isSelectionMode, onToggleSelection, systemPrompt.id, systemPrompt.isBuiltIn]);

  const handleExportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnterSelectionMode) {
      onEnterSelectionMode();
      if (onToggleSelection && !systemPrompt.isBuiltIn) {
        onToggleSelection(systemPrompt.id);
      }
    }
  }, [onEnterSelectionMode, onToggleSelection, systemPrompt.id, systemPrompt.isBuiltIn]);

  return (
    <Card 
      onClick={handleCardClick}
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isSelectionMode && !systemPrompt.isBuiltIn ? 'pointer' : 'default',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected ? 'action.selected' : 'background.paper',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && !systemPrompt.isBuiltIn && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 3,
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection?.(systemPrompt.id);
            }}
            sx={{
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {isSelected ? (
              <CheckCircleIcon color="primary" />
            ) : (
              <RadioButtonUncheckedIcon />
            )}
          </IconButton>
        </Box>
      )}

      {/* Export button */}
      {!isSelectionMode && !systemPrompt.isBuiltIn && (
        <IconButton
          size="small"
          onClick={handleExportClick}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 3,
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label="Export this prompt"
        >
          <ExportIcon fontSize="small" />
        </IconButton>
      )}

      {/* Source indicator */}
      {systemPrompt.source && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: !isSelectionMode && !systemPrompt.isBuiltIn ? 48 : 8,
            backgroundColor: systemPrompt.source === 'fabric' ? 'rgba(25, 118, 210, 0.8)' : 
                           systemPrompt.source === 'wharton' ? 'rgba(76, 175, 80, 0.8)' :
                           systemPrompt.source === 'built-in' ? 'rgba(0, 0, 0, 0.6)' : 
                           'rgba(156, 39, 176, 0.8)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 2
          }}
        >
          {systemPrompt.source === 'fabric' ? 'Fabric' : 
           systemPrompt.source === 'wharton' ? 'Wharton' :
           systemPrompt.source === 'built-in' ? 'Built-in' : 'Custom'}
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Default indicator */}
        {systemPrompt.isDefault && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Chip 
              label="Default" 
              size="small" 
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
        )}

        {/* Name */}
        <Typography variant="h6" sx={{ 
          mb: 1, 
          fontWeight: 600, 
          lineHeight: 1.2,
          fontSize: { xs: '1rem', sm: '1.25rem' },
          pr: isSelectionMode && !systemPrompt.isBuiltIn ? 5 : (!isSelectionMode && !systemPrompt.isBuiltIn ? 8 : 0),
          pl: isSelectionMode && !systemPrompt.isBuiltIn ? 5 : 0,
        }}>
          {systemPrompt.name}
        </Typography>

        {/* Description */}
        {systemPrompt.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              fontStyle: 'normal',
              backgroundColor: 'rgba(0,0,0,0.02)',
              p: { xs: 0.75, sm: 1 },
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              lineHeight: { xs: 1.4, sm: 1.5 }
            }}
          >
            {systemPrompt.description}
          </Typography>
        )}

        {/* Stats */}
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          mb: 1, 
          fontSize: { xs: '0.7rem', sm: '0.8rem' }, 
          color: 'text.secondary',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' }
        }}>
          <Box>
            {systemPrompt.tokenCount?.toLocaleString() || 'Unknown'} tokens
          </Box>
          {systemPrompt.categories && systemPrompt.categories.length > 0 && (
            <Box sx={{ 
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              wordBreak: 'break-word'
            }}>
              {systemPrompt.categories.join(', ')}
            </Box>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ 
        pt: 0, 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: 1,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ 
          flex: 1, 
          minWidth: 'fit-content',
          fontSize: { xs: '0.7rem', sm: '0.75rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          {!systemPrompt.isBuiltIn && `Updated ${new Date(systemPrompt.updatedAt).toLocaleDateString()}`}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          flexWrap: 'wrap',
          width: { xs: '100%', sm: 'auto' },
          justifyContent: { xs: 'center', sm: 'flex-end' }
        }}>
          <Button 
            size="small" 
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleTryPrompt}
            sx={{ 
              backgroundColor: 'success.main',
              '&:hover': {
                backgroundColor: 'success.dark',
              },
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              px: { xs: 2, sm: 1.5 },
              py: { xs: 1, sm: 0.5 },
              minWidth: { xs: '120px', sm: 'auto' }
            }}
          >
            Use This Prompt
          </Button>
          <Button 
            size="small" 
            variant="outlined"
            onClick={handleViewEdit}
            sx={{ 
              color: 'primary.dark', 
              borderColor: 'primary.dark',
              backgroundColor: 'background.paper',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              px: { xs: 2, sm: 1.5 },
              py: { xs: 1, sm: 0.5 },
              minWidth: { xs: '120px', sm: 'auto' },
              '&:hover': {
                backgroundColor: 'primary.light',
                borderColor: 'primary.main'
              }
            }}
          >
            {systemPrompt.isBuiltIn ? 'View' : 'View/Edit'}
          </Button>
        </Box>
      </CardActions>
    </Card>
  );
});

SystemPromptCard.displayName = 'SystemPromptCard';

// Optimized Grid Component with lazy loading for better performance
const OptimizedSystemPromptsGrid = React.memo<{
  prompts: any[];
  onViewEdit: (systemPrompt: any) => void;
  onTryPrompt: (systemPrompt: any) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: () => void;
}>(({ prompts, onViewEdit, onTryPrompt, isSelectionMode = false, selectedIds = new Set(), onToggleSelection, onEnterSelectionMode }) => {
  const [visibleCount, setVisibleCount] = useState(20); // Start with 20 prompts
  const [isLoading, setIsLoading] = useState(false);
  
  // Load more prompts when scrolling
  const loadMore = useCallback(() => {
    if (visibleCount < prompts.length && !isLoading) {
      setIsLoading(true);
      // Simulate loading delay for smooth UX
      setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 20, prompts.length));
        setIsLoading(false);
      }, 100);
    }
  }, [visibleCount, prompts.length, isLoading]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && visibleCount < prompts.length) {
            loadMore();
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe the last visible card
    const lastCard = document.querySelector('[data-last-card="true"]');
    if (lastCard) {
      observer.observe(lastCard);
    }

    return () => observer.disconnect();
  }, [visibleCount, prompts.length, loadMore]);

  const visiblePrompts = prompts.slice(0, visibleCount);

  return (
    <Box>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: 'repeat(2, 1fr)', 
          lg: 'repeat(3, 1fr)' 
        }, 
        gap: 3 
      }}>
        {visiblePrompts.map((systemPrompt, index) => (
          <Box 
            key={systemPrompt.id}
            data-last-card={index === visibleCount - 1}
          >
            <SystemPromptCard 
              systemPrompt={systemPrompt} 
              onViewEdit={onViewEdit}
              onTryPrompt={onTryPrompt}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(systemPrompt.id)}
              onToggleSelection={onToggleSelection}
              onEnterSelectionMode={onEnterSelectionMode}
            />
          </Box>
        ))}
      </Box>
      
      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {/* Load more button for better UX */}
      {visibleCount < prompts.length && !isLoading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Button 
            variant="outlined" 
            onClick={loadMore}
            startIcon={<AddIcon />}
          >
            Load More Prompts ({prompts.length - visibleCount} remaining)
          </Button>
        </Box>
      )}
    </Box>
  );
});

OptimizedSystemPromptsGrid.displayName = 'OptimizedSystemPromptsGrid';

const SystemPromptsPage = React.memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentProfile, user } = useAppSelector((state) => state.auth);
  const { items: systemPrompts, loading } = useAppSelector((state) => state.systemPrompts);
  const unifiedStorage = useUnifiedStorage();
  const isDirectoryRequired = useFilesystemDirectoryRequired();
  
  // Helper function to normalize category tags - capitalize first letter, lowercase the rest, and deduplicate
  const normalizeCategories = (categoriesString: string): string[] => {
    if (!categoriesString.trim()) return [];
    
    const normalized = categoriesString
      .split(',')
      .map(cat => cat.trim())
      .filter(cat => cat)
      .map(cat => cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase());
    
    // Remove duplicates using Set
    return Array.from(new Set(normalized));
  };
  
  // State for UI
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Fabric, 2: Built-in, 3: User
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showTryPromptDialog, setShowTryPromptDialog] = useState(false);
  const [promptToTry, setPromptToTry] = useState<any>(null);
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<any>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Error notification state
  const [errorSnackbar, setErrorSnackbar] = useState<{open: boolean; message: string}>({
    open: false,
    message: ''
  });
  
  // View/Edit form state
  const [viewEditForm, setViewEditForm] = useState({
    name: '',
    description: '',
    content: '',
    categories: ''
  });
  
  // Form states
  const [systemPromptForm, setSystemPromptForm] = useState({
    name: '',
    description: '',
    content: '',
    categories: ''
  });
  
  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Multi-select for export
  const multiSelect = useMultiSelect();
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    if (currentProfile?.id) {
      dispatch(fetchSystemPrompts(currentProfile.id)).catch((error) => {
        console.log('Initial fetch failed, will retry when auth completes:', error);
      });
    }
  }, [dispatch, currentProfile?.id, unifiedStorage.googleDrive.isAuthenticated]);

  // Memoize expensive calculations to prevent recalculation on every render
  const { fabricPrompts, builtInPrompts, userPrompts, whartonPrompts } = useMemo(() => {
    const fabric = systemPrompts.filter(sp => sp.source === 'fabric');
    const builtIn = systemPrompts.filter(sp => sp.source === 'built-in');
    const user = systemPrompts.filter(sp => sp.source === 'user' || !sp.source);
    const wharton = systemPrompts.filter(sp => sp.source === 'wharton');
    return { fabricPrompts: fabric, builtInPrompts: builtIn, userPrompts: user, whartonPrompts: wharton };
  }, [systemPrompts]);

  // Get current tab's prompts
  const currentTabPrompts = useMemo(() => {
    switch (activeTab) {
      case 1: return fabricPrompts;
      case 2: return whartonPrompts;
      case 3: return builtInPrompts;
      case 4: return userPrompts;
      default: return systemPrompts; // All
    }
  }, [activeTab, fabricPrompts, whartonPrompts, builtInPrompts, userPrompts, systemPrompts]);

  // Debounced search query for better performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize filtered prompts based on debounced search query, category filter, and current tab
  const filteredPrompts = useMemo(() => {
    let filtered = currentTabPrompts;
    
    // Apply text search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(prompt => 
        prompt.name.toLowerCase().includes(query) ||
        (prompt.description && prompt.description.toLowerCase().includes(query)) ||
        prompt.content.toLowerCase().includes(query) ||
        (prompt.categories && prompt.categories.some(cat => cat.toLowerCase().includes(query)))
      );
    }
    
    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(prompt => 
        prompt.categories && prompt.categories.some(cat => selectedCategories.includes(cat))
      );
    }
    
    return filtered;
  }, [currentTabPrompts, debouncedSearchQuery, selectedCategories]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setSelectedSystemPrompt(null);
  }, []);

  const handleCreateSystemPrompt = useCallback(() => {
    setSystemPromptForm({
      name: '',
      description: '',
      content: '',
      categories: ''
    });
    setCreateDialogOpen(true);
  }, []);

  const handleEditSystemPrompt = useCallback(() => {
    if (selectedSystemPrompt) {
      setSystemPromptForm({
        name: selectedSystemPrompt.name,
        description: selectedSystemPrompt.description || '',
        content: selectedSystemPrompt.content,
        categories: selectedSystemPrompt.categories ? selectedSystemPrompt.categories.join(', ') : ''
      });
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  }, [selectedSystemPrompt, handleContextMenuClose]);

  const handleCreateSystemPromptSubmit = useCallback(async () => {
    if (!currentProfile?.id || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsCreating(true);
    try {
      await dispatch(createSystemPrompt({ 
        systemPromptData: {
          name: systemPromptForm.name.trim(),
          description: systemPromptForm.description.trim() || undefined,
          content: systemPromptForm.content.trim(),
          categories: normalizeCategories(systemPromptForm.categories),
          isBuiltIn: false,
          isDefault: false,
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateDialogOpen(false);
      setSystemPromptForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error creating system prompt:', error);
      setErrorSnackbar({
        open: true,
        message: 'Failed to create system prompt. Please try again.'
      });
    } finally {
      setIsCreating(false);
    }
  }, [dispatch, currentProfile?.id, systemPromptForm]);

  const handleUpdateSystemPromptSubmit = useCallback(async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()) return;
    
    setIsUpdating(true);
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: systemPromptForm.name.trim(),
          description: systemPromptForm.description.trim() || undefined,
          content: systemPromptForm.content.trim(),
          categories: normalizeCategories(systemPromptForm.categories),
          tokenCount: Math.ceil(systemPromptForm.content.length / 4), // Approximate token count
          updatedAt: new Date().toISOString()
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setSystemPromptForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
      setErrorSnackbar({
        open: true,
        message: 'Failed to update system prompt. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  }, [dispatch, selectedSystemPrompt, currentProfile?.id, systemPromptForm]);

  const handleDeleteSystemPrompt = useCallback(async () => {
    if (!selectedSystemPrompt) return;
    
    try {
      await dispatch(deleteSystemPrompt(selectedSystemPrompt.id)).unwrap();
      setDeleteDialogOpen(false);
      setViewEditDialogOpen(false);
      setSelectedSystemPrompt(null);
    } catch (error) {
      console.error('Error deleting system prompt:', error);
    }
  }, [dispatch, selectedSystemPrompt]);

  const handleViewEditSystemPrompt = useCallback((systemPrompt: any) => {
    setSelectedSystemPrompt(systemPrompt);
    setViewEditForm({
      name: systemPrompt.name,
      description: systemPrompt.description || '',
      content: systemPrompt.content,
      categories: systemPrompt.categories ? systemPrompt.categories.join(', ') : ''
    });
    setViewEditDialogOpen(true);
  }, []);

  const handleTryPrompt = useCallback((systemPrompt: any) => {
    // Check if there's existing state in the prompt lab
    const existingMessages = sessionStorage.getItem('promptlab_messages');
    const existingContext = sessionStorage.getItem('promptlab_context');
    const existingSystemPrompts = sessionStorage.getItem('promptlab_system_prompts');
    
    // Check if there's any existing conversation state
    const hasExistingState = existingMessages || existingContext || existingSystemPrompts;
    
    if (hasExistingState) {
      // Show confirmation dialog
      setPromptToTry(systemPrompt);
      setShowTryPromptDialog(true);
    } else {
      // No existing state, navigate directly
      navigate('/prompt-lab', {
        state: {
          openSystemPromptDrawer: true,
          applySystemPrompt: systemPrompt
        }
      });
    }
  }, [navigate]);

  // Export handlers
  const handleExportSelected = useCallback(async () => {
    if (!currentProfile?.id || multiSelect.selectionCount === 0) return;

    setIsExporting(true);
    try {
      const exportService = getResourceExportService();
      const selection: ExportSelection = {
        systemPromptIds: Array.from(multiSelect.selectedIds),
      };
      
      const exportData = await exportService.exportResources(
        selection,
        currentProfile.id,
        user?.email
      );
      
      exportService.downloadExport(exportData);
      multiSelect.exitSelectionMode();
    } catch (error) {
      console.error('Export failed:', error);
      setErrorSnackbar({
        open: true,
        message: 'Failed to export resources. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [currentProfile?.id, multiSelect, user?.email]);

  const handleCancelExport = useCallback(() => {
    multiSelect.exitSelectionMode();
  }, [multiSelect]);

  const handleAddToCurrentConversation = useCallback(() => {
    if (promptToTry) {
      navigate('/prompt-lab', {
        state: {
          openSystemPromptDrawer: true,
          applySystemPrompt: promptToTry,
          addToCurrent: true
        }
      });
    }
    setShowTryPromptDialog(false);
    setPromptToTry(null);
  }, [navigate, promptToTry]);

  const handleStartNewConversation = useCallback(() => {
    if (promptToTry) {
      navigate('/prompt-lab', {
        state: {
          openSystemPromptDrawer: true,
          applySystemPrompt: promptToTry,
          startNew: true
        }
      });
    }
    setShowTryPromptDialog(false);
    setPromptToTry(null);
  }, [navigate, promptToTry]);

  const handleCancelTryPrompt = useCallback(() => {
    setShowTryPromptDialog(false);
    setPromptToTry(null);
  }, []);

  const handleOpenLibrarianWizard = useCallback(() => {
    // Navigate to prompt lab page with state to auto-open the librarian wizard
    navigate('/prompt-lab', {
      state: {
        openSystemPromptSuggestor: true
      }
    });
  }, [navigate]);

  const handleViewEditSubmit = useCallback(async () => {
    if (!currentProfile?.id || !selectedSystemPrompt || !viewEditForm.name.trim() || !viewEditForm.content.trim()) return;
    
    setIsUpdating(true); // Changed from isViewEditing to isUpdating
    try {
      await dispatch(updateSystemPrompt({ 
        systemPrompt: {
          id: selectedSystemPrompt.id,
          name: viewEditForm.name.trim(),
          description: viewEditForm.description.trim() || undefined,
          content: viewEditForm.content.trim(),
          categories: normalizeCategories(viewEditForm.categories)
        },
        profileId: currentProfile.id 
      })).unwrap();
      
      setViewEditDialogOpen(false);
      setSelectedSystemPrompt(null);
      setViewEditForm({ name: '', description: '', content: '', categories: '' });
    } catch (error) {
      console.error('Error updating system prompt:', error);
      setErrorSnackbar({
        open: true,
        message: 'Failed to update system prompt. Please try again.'
      });
    } finally {
      setIsUpdating(false); // Changed from isViewEditing to isUpdating
    }
  }, [dispatch, selectedSystemPrompt, currentProfile?.id, viewEditForm]);

  // Memoize search query change handler with performance optimization
  const handleSearchQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only update if the value actually changed
    if (value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [searchQuery]);



  // Memoize dialog close handlers
  const handleCloseCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditDialogOpen(false);
  }, []);

  return (
    <Box sx={{ 
      height: '100%', // Use full height of parent container
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden' // Prevent outer page scrolling
    }}>
      {/* Storage Directory Banner */}
      <StorageDirectoryBanner pageType="system-prompts" />
      
      {/* Scrollable Content Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', // Enable scrolling for content
        p: { xs: 2, sm: 3 },
        minHeight: 0 // Ensure flex child can shrink properly
      }}>
      {/* Header */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        flexDirection: { xs: 'column', lg: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', lg: 'flex-start' },
        gap: { xs: 3, lg: 0 }
      }}>
        <Box sx={{ 
          flex: { xs: 'none', lg: '0 0 60%' }, 
          maxWidth: { xs: '100%', lg: '60%' },
          width: { xs: '100%', lg: 'auto' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 1,
            flexWrap: 'wrap'
          }}>
            <Typography variant="h4" sx={{ fontWeight: 600, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
              System Prompts
            </Typography>
            <Link
              component="button"
              variant="body2"
              onClick={() => setHelpModalOpen(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textDecoration: 'none',
                color: 'primary.main',
                fontSize: { xs: '0.875rem', sm: '0.875rem' },
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              <HelpOutlineIcon fontSize="small" />
              <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                What are "System Prompts"?
              </Box>
              <Box sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Help
              </Box>
            </Link>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Manage system prompts that define AI behavior and personality for your conversations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Our library of system prompts is a curated collection sourced from Open Source prompt libraries. Thanks and credit goes to the respective projects:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
            <Typography component="li" variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              <Link href="https://github.com/danielmiessler/Fabric" target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none' }}>
                Fabric
              </Link> - Copyright (c) 2012-2024 Scott Chacon and others
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              <Link href="https://gail.wharton.upenn.edu/prompt-library" target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'none' }}>
                Wharton Generative AI Labs
              </Link> - Ethan Mollick and Lilach Mollick (Creative Commons Attribution 4.0 International)
            </Typography>
          </Box>
        </Box>
        {unifiedStorage.status === 'configured' && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2, 
            flex: { xs: 'none', lg: '0 0 37%' }, 
            minWidth: { xs: '100%', lg: '300px' },
            width: { xs: '100%', lg: 'auto' }
          }}>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSystemPrompt}
                disabled={isDirectoryRequired}
                sx={{ 
                  borderRadius: 2, 
                  flex: 1,
                  minWidth: { xs: '100%', sm: '200px' },
                  py: { xs: 1.5, sm: 1 },
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}
              >
                Add System Prompt
              </Button>
              <Button
                variant="outlined"
                startIcon={<ImportIcon />}
                onClick={() => setShowImportDialog(true)}
                disabled={isDirectoryRequired}
                sx={{ 
                  borderRadius: 2, 
                  flex: 1,
                  minWidth: { xs: '100%', sm: '200px' },
                  py: { xs: 1.5, sm: 1 },
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}
              >
                Import
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                Need help picking a system prompt for your task?
              </Typography>
              <Button
                variant="outlined"
                startIcon={<MenuBookIcon />}
                onClick={handleOpenLibrarianWizard}
                sx={{ 
                  borderRadius: 2, 
                  alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  minWidth: { xs: '100%', sm: '200px' },
                  py: { xs: 1.5, sm: 1 },
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}
              >
                Ask the System Prompt Librarian
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flexGrow: 1, width: { xs: '100%', md: 'auto' } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search system prompts..."
                value={searchQuery}
                onChange={handleSearchQueryChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: { xs: '0.875rem', sm: '0.875rem' }
                  }
                }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '300px' } }}>
              <CategoryFilter
                systemPrompts={currentTabPrompts}
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
                placeholder="Filter by category"
                size="small"
                fullWidth
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* Tabs for different prompt sources */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              minHeight: { xs: 48, sm: 48 },
              px: { xs: 1, sm: 2 }
            }
          }}
        >
          <Tab 
            label={`All (${systemPrompts.length})`} 
            icon={<SettingsIcon />}
            iconPosition="start"
            sx={{ 
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }
            }}
          />
          <Tab 
            label={`Fabric (${fabricPrompts.length})`} 
            icon={<ExtensionIcon />}
            iconPosition="start"
            sx={{ 
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }
            }}
          />
          <Tab 
            label={`Wharton (${whartonPrompts.length})`} 
            icon={<MenuBookIcon />}
            iconPosition="start"
            sx={{ 
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }
            }}
          />
          <Tab 
            label={`Built-in (${builtInPrompts.length})`} 
            icon={<SettingsIcon />}
            iconPosition="start"
            sx={{ 
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }
            }}
          />
          <Tab 
            label={`Custom (${userPrompts.length})`} 
            icon={<CodeIcon />}
            iconPosition="start"
            sx={{ 
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }
            }}
          />
        </Tabs>
      </Paper>

      {/* System Prompts Virtualized Grid */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Loading system prompts...
          </Typography>
        </Box>
      ) : unifiedStorage.status !== 'configured' && activeTab === 4 ? (
        // Show centered error message for Custom tab when storage not configured
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
          minHeight: '400px'
        }}>
          <CodeIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
            No storage option selected.
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.5 }}>
            No Custom System Prompts Available. Please configure storage to use this feature
          </Typography>
        </Box>
      ) : filteredPrompts.length > 0 ? (
        <Box sx={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}>
          <OptimizedSystemPromptsGrid
            prompts={filteredPrompts}
            onViewEdit={handleViewEditSystemPrompt}
            onTryPrompt={handleTryPrompt}
            isSelectionMode={multiSelect.isSelectionMode}
            selectedIds={multiSelect.selectedIds}
            onToggleSelection={multiSelect.toggleSelection}
            onEnterSelectionMode={multiSelect.enterSelectionMode}
          />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CodeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            {searchQuery ? 'No system prompts match your search' : 
             activeTab === 4 ? 'No custom system prompts yet' :
             activeTab === 3 ? 'No built-in system prompts' :
             activeTab === 2 ? 'No Wharton prompts' :
             activeTab === 1 ? 'No Fabric patterns' :
             'No system prompts available'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {activeTab === 4 ? 'Create your first custom system prompt to define specific AI behaviors' :
             'Try adjusting your search or switching to a different tab'}
          </Typography>
          {activeTab === 4 && unifiedStorage.status === 'configured' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateSystemPrompt} disabled={isDirectoryRequired}>
              Create System Prompt
            </Button>
          )}
        </Box>
      )}
      </Box>



      {/* Context Menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
      >
        <MenuItem onClick={handleEditSystemPrompt}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleContextMenuClose}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteSystemPrompt} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create System Prompt Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCloseCreateDialog} 
        maxWidth="md" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 },
            height: { xs: '100vh', sm: 'auto' },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Create New System Prompt
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={systemPromptForm.name}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Description (optional)"
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={systemPromptForm.categories}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, categories: e.target.value }))}
              placeholder="e.g., Technical, Development, Code Quality (comma-separated)"
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={6}
              value={systemPromptForm.content}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="You are an expert... (define the AI's role and behavior)"
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  minHeight: { xs: '200px', sm: '150px' }
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)} 
            sx={{ 
              color: 'primary.dark',
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSystemPromptSubmit}
            disabled={isCreating || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            {isCreating ? 'Creating...' : 'Create System Prompt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit System Prompt Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseEditDialog} 
        maxWidth="md" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 },
            height: { xs: '100vh', sm: 'auto' },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Edit System Prompt
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={systemPromptForm.name}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, name: e.target.value }))}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Description (optional)"
              value={systemPromptForm.description}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, description: e.target.value }))}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={systemPromptForm.categories}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, categories: e.target.value }))}
              placeholder="e.g., Technical, Development, Code Quality (comma-separated)"
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={6}
              value={systemPromptForm.content}
              onChange={(e) => setSystemPromptForm(prev => ({ ...prev, content: e.target.value }))}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  minHeight: { xs: '200px', sm: '150px' }
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button 
            onClick={() => setEditDialogOpen(false)} 
            sx={{ 
              color: 'primary.dark',
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateSystemPromptSubmit}
            disabled={isUpdating || !systemPromptForm.name.trim() || !systemPromptForm.content.trim()}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View/Edit System Prompt Dialog */}
      <Dialog 
        open={viewEditDialogOpen} 
        onClose={() => setViewEditDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 },
            height: { xs: '100vh', sm: 'auto' },
            maxHeight: { xs: '100vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {selectedSystemPrompt?.isBuiltIn ? 'View System Prompt' : 'View/Edit System Prompt'}
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
            {selectedSystemPrompt?.name}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="System Prompt Name"
              value={viewEditForm.name}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, name: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Description (optional)"
              value={viewEditForm.description}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, description: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="Categories (optional)"
              value={viewEditForm.categories}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, categories: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }
              }}
            />
            <TextField
              fullWidth
              label="System Prompt Content"
              multiline
              rows={12}
              value={viewEditForm.content}
              onChange={(e) => setViewEditForm(prev => ({ ...prev, content: e.target.value }))}
              disabled={selectedSystemPrompt?.isBuiltIn}
              sx={{ 
                fontFamily: 'monospace',
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  minHeight: { xs: '300px', sm: '250px' }
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          justifyContent: 'space-between', 
          px: { xs: 2, sm: 3 }, 
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ order: { xs: 2, sm: 1 } }}>
            {!selectedSystemPrompt?.isBuiltIn && (
              <Button 
                onClick={() => setDeleteDialogOpen(true)}
                color="error"
                variant="outlined"
                size="small"
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: { xs: 1.5, sm: 0.5 }
                }}
              >
                Delete
              </Button>
            )}
          </Box>
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            order: { xs: 1, sm: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <Button 
              onClick={() => setViewEditDialogOpen(false)} 
              sx={{ 
                color: 'primary.dark',
                width: { xs: '100%', sm: 'auto' },
                py: { xs: 1.5, sm: 1 }
              }}
            >
              {selectedSystemPrompt?.isBuiltIn ? 'Close' : 'Cancel'}
            </Button>
            {!selectedSystemPrompt?.isBuiltIn && (
              <Button 
                variant="contained" 
                onClick={handleViewEditSubmit}
                disabled={!viewEditForm.name.trim() || !viewEditForm.content.trim()}
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: { xs: 1.5, sm: 1 }
                }}
              >
                Save Changes
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 2, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Delete System Prompt
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <DialogContentText sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Are you sure you want to delete "{selectedSystemPrompt?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteSystemPrompt} 
            color="error" 
            variant="contained"
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Try Prompt Confirmation Dialog */}
      <Dialog 
        open={showTryPromptDialog} 
        onClose={handleCancelTryPrompt} 
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 2, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontSize: { xs: '1.25rem', sm: '1.5rem' }
        }}>
          <PlayArrowIcon color="primary" />
          Try This Prompt
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <DialogContentText sx={{ 
            mb: 2,
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}>
            You have an existing conversation in the Prompt Lab. How would you like to use the system prompt "{promptToTry?.name}"?
          </DialogContentText>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2, 
            color: 'primary.dark'  
          }}>
            <Button
              variant="outlined"
              onClick={handleAddToCurrentConversation}
              sx={{ 
                justifyContent: 'flex-start', 
                textAlign: 'left', 
                py: { xs: 2, sm: 1.5 },
                px: { xs: 2, sm: 2 }
              }}
            >
              <Box sx={{ textAlign: 'left', color: 'primary.dark' }}>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}>
                  Add to Current Conversation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{
                  fontSize: { xs: '0.8rem', sm: '0.875rem' }
                }}>
                  Keep your existing messages and add this system prompt to your current selection
                </Typography>
              </Box>
            </Button>
            <Button
              variant="outlined"
              onClick={handleStartNewConversation}
              sx={{ 
                justifyContent: 'flex-start', 
                textAlign: 'left', 
                py: { xs: 2, sm: 1.5 },
                px: { xs: 2, sm: 2 }
              }}
            >
              <Box sx={{ textAlign: 'left', color: 'primary.dark' }}>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '0.875rem' }
                }}>
                  Start New Conversation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{
                  fontSize: { xs: '0.8rem', sm: '0.875rem' }
                }}>
                  Clear your current conversation and start fresh with this system prompt
                </Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2 }
        }}>
          <Button 
            onClick={handleCancelTryPrompt}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              py: { xs: 1.5, sm: 1 }
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Modal */}
      <SystemPromptHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      {/* Error Notification Snackbar */}
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorSnackbar({ open: false, message: '' })}
          severity="error"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {errorSnackbar.message}
        </Alert>
      </Snackbar>

      {/* Floating Export Actions */}
      {multiSelect.isSelectionMode && (
        <FloatingExportActions
          selectionCount={multiSelect.selectionCount}
          onExport={handleExportSelected}
          onCancel={handleCancelExport}
          disabled={isExporting}
        />
      )}

      {/* Resource Import Dialog */}
      <ResourceImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => {
          // Refresh system prompts after import
          if (currentProfile?.id) {
            dispatch(fetchSystemPrompts(currentProfile.id));
          }
        }}
      />
    </Box>
  );
});

SystemPromptsPage.displayName = 'SystemPromptsPage';

export default SystemPromptsPage;
