import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FileDownload as ImportIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../store';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { FloatingExportActions } from '../components/resourceExport/FloatingExportActions';
import { getResourceExportService } from '../services/resourceExport/resourceExportService';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';
import { DocumentCard } from '../components/documents/DocumentCard';
import DocumentEditDialog from '../components/documents/DocumentEditDialog';
import type { ExportSelection } from '../services/resourceExport/types';
import type { MarkdownDocument } from '../types';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const unifiedStorage = useUnifiedStorage();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [initialDocument, setInitialDocument] = useState<
    { id?: string; title: string; content: string } | undefined
  >(undefined);
  const currentProfile = useAppSelector(state => state.auth.currentProfile);
  const user = useAppSelector(state => state.auth.user);
  const isDocumentsEnabled = useFeatureFlag('documents');

  // Multi-select export state
  const multiSelect = useMultiSelect();
  const [isExporting, setIsExporting] = useState(false);

  const filteredDocuments = useMemo(() => {
    return documents.filter(document => {
      return document.title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [documents, searchQuery]);

  const loadDocuments = useCallback(async () => {
    if (!currentProfile?.id) return;
    const storage = getUnifiedStorageService();
    try {
      const result = await storage.getDocuments(
        undefined,
        1,
        1000,
        currentProfile.id
      );
      setDocuments(result.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id]);

  const handleCreateDocumentClick = useCallback(() => {
    if (!currentProfile?.id) return;
    setInitialDocument(undefined);
    setDocumentDialogOpen(true);
  }, [currentProfile?.id]);

  const handleViewEditDocument = useCallback((document: MarkdownDocument) => {
    setInitialDocument({
      id: document.id,
      title: document.title,
      content: document.content,
    });
    setDocumentDialogOpen(true);
  }, []);

  const handleCreateDocument = useCallback(
    async (document: {
      title: string;
      content: string;
    }): Promise<{ id: string; title: string; content: string }> => {
      if (!isDocumentsEnabled) {
        throw new Error('Documents feature is disabled');
      }
      if (!currentProfile?.id) {
        throw new Error('No profile ID available');
      }
      const storage = getUnifiedStorageService();
      const created = await storage.createDocument(
        { title: document.title, content: document.content, tags: [] },
        currentProfile.id
      );
      return { id: created.id, title: created.title, content: created.content };
    },
    [currentProfile?.id, isDocumentsEnabled]
  );

  const handleUpdateDocument = useCallback(
    async (
      documentId: string,
      document: { title: string; content: string }
    ): Promise<{ id: string; title: string; content: string }> => {
      if (!isDocumentsEnabled) {
        throw new Error('Documents feature is disabled');
      }
      if (!currentProfile?.id) {
        throw new Error('No profile ID available');
      }
      const storage = getUnifiedStorageService();
      const updated = await storage.updateDocument(
        { id: documentId, title: document.title, content: document.content },
        currentProfile.id
      );
      return { id: updated.id, title: updated.title, content: updated.content };
    },
    [currentProfile?.id, isDocumentsEnabled]
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      if (!isDocumentsEnabled) {
        throw new Error('Documents feature is disabled');
      }
      const storage = getUnifiedStorageService();
      await storage.deleteDocument(documentId);
    },
    [isDocumentsEnabled]
  );

  const handleDialogClose = useCallback(
    (_?: { id: string; title: string; content: string }) => {
      setDocumentDialogOpen(false);
      setInitialDocument(undefined);
      // Refresh documents list when dialog closes (handles create/update/delete cases)
      void loadDocuments();
    },
    [loadDocuments]
  );

  const handleExportSelected = useCallback(async () => {
    if (!currentProfile?.id || multiSelect.selectionCount === 0) return;
    setIsExporting(true);
    try {
      const exportService = getResourceExportService();
      const selection: ExportSelection = {
        documentIds: Array.from(multiSelect.selectedIds),
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
      // Could add error snackbar here
    } finally {
      setIsExporting(false);
    }
  }, [currentProfile?.id, multiSelect, user?.email]);

  const handleCancelExport = useCallback(() => {
    multiSelect.exitSelectionMode();
  }, [multiSelect]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          minHeight: 0,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', lg: 'flex-start' },
            gap: { xs: 3, lg: 0 },
          }}
        >
          <Box
            sx={{
              flex: { xs: 'none', lg: '0 0 60%' },
              maxWidth: { xs: '100%', lg: '60%' },
              width: { xs: '100%', lg: 'auto' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                }}
              >
                Documents
              </Typography>
            </Box>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Manage your documents and references
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              Documents are used to store your references and knowledge bases.
            </Typography>
          </Box>
          {unifiedStorage.status === 'configured' && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                flex: { xs: 'none', lg: '0 0 37%' },
                minWidth: { xs: '100%', lg: '300px' },
                width: { xs: '100%', lg: 'auto' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateDocumentClick}
                  sx={{
                    borderRadius: 2,
                    flex: 1,
                    minWidth: { xs: '100%', sm: '200px' },
                    py: { xs: 1.5, sm: 1 },
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                  }}
                >
                  Create New Document
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ImportIcon />}
                  onClick={() => setShowImportDialog(true)}
                  sx={{
                    borderRadius: 2,
                    flex: 1,
                    minWidth: { xs: '100%', sm: '200px' },
                    py: { xs: 1.5, sm: 1 },
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                  }}
                >
                  Import
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* Search and Filter Bar */}
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-root': {
                fontSize: { xs: '0.875rem', sm: '0.875rem' },
              },
            }}
          />
        </Paper>

        {/* Context Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {filteredDocuments.map((document, index) => (
              <DocumentCard
                key={document.id || `document-${index}`}
                document={document}
                onViewEdit={handleViewEditDocument}
                isSelectionMode={multiSelect.isSelectionMode}
                isSelected={multiSelect.isSelected(document.id)}
                onToggleSelection={multiSelect.toggleSelection}
                onEnterSelectionMode={multiSelect.enterSelectionMode}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Document Edit Dialog */}
      <DocumentEditDialog
        open={documentDialogOpen}
        onClose={handleDialogClose}
        initialDocument={initialDocument}
        onCreate={handleCreateDocument}
        onUpdate={handleUpdateDocument}
        onDelete={handleDeleteDocument}
      />

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
          // Refresh documents after import
          void loadDocuments();
        }}
      />
    </Box>
  );
}
