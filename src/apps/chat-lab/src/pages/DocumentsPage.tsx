import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Button,
  Link,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOutlined as FolderIcon,
  HelpOutline as HelpOutlineIcon,
  FileDownload as ImportIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';
import { fetchContexts, createContext, updateContext, deleteContext } from '../store/slices/contextsSlice';
import { fetchConversationMessages } from '../store/slices/conversationsSlice';
import { ContextCard } from '../components/contexts/ContextCard';
import { ConversationSelectionList } from '../components/contexts/ConversationSelectionList';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import { useFilesystemDirectoryRequired } from '../hooks/useFilesystemDirectoryRequired';
import ContextHelpModal from '../components/help/ContextHelpModal';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { FloatingExportActions } from '../components/resourceExport/FloatingExportActions';
import { getResourceExportService } from '../services/resourceExport/resourceExportService';
import ResourceImportDialog from '../components/resourceExport/ResourceImportDialog';
import { DocumentCard } from '../components/documents/DocumentCard';
import type { ExportSelection } from '../services/resourceExport/types';
import type { Context, ContextFormData, ViewEditFormData, ContextMenuPosition, Conversation } from '../types/contexts';
import type { MarkdownDocument } from '../types';
import { getUnifiedStorageService } from '../services/storage/UnifiedStorageService';


export default function DocumentsPage() {
    const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const unifiedStorage = useUnifiedStorage();
    const isDirectoryRequired = useFilesystemDirectoryRequired();
    const [showImportDialog, setShowImportDialog] = useState(false);
    const currentProfile = useAppSelector((state) => state.auth.currentProfile);

    const filteredDocuments = useMemo(() => {
        return documents.filter((document) => {
            return document.title.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [documents, searchQuery]);

    const handleCreateDocument = () => {
      if (!currentProfile?.id) return;
      setIsCreating(true);
      // TODO: Implement create document functionality
      console.log('Create document');
    };

    const handleImportDocument = () => {
      // TODO: Implement import document functionality
        console.log('Import document');
    };

    const handleViewEditDocument = useCallback((document: MarkdownDocument) => {
        // TODO: Implement view/edit functionality for documents
        console.log('View/Edit document:', document);
    }, []);

    useEffect(() => {
        const storage = getUnifiedStorageService();
        const loadDocuments = async () => {
            const documents = await storage.getDocuments(undefined, 1, 1000, currentProfile?.id);
            setDocuments(documents.documents || []);
            setLoading(false);
        };
        void loadDocuments();
    }, [currentProfile?.id]);

  return (
    <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Storage Directory Banner */}
        <StorageDirectoryBanner pageType="background-agents" />
  
        {/* Scrollable Content Area */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          minHeight: 0
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
                  Documents
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Manage your documents and references
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                Documents are used to store your references and knowledge bases.
              </Typography>
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
                    onClick={handleCreateDocument}
                    disabled={isDirectoryRequired}
                    sx={{
                      borderRadius: 2,
                      flex: 1,
                      minWidth: { xs: '100%', sm: '200px' },
                      py: { xs: 1.5, sm: 1 },
                      fontSize: { xs: '0.875rem', sm: '0.875rem' }
                    }}
                  >
                    Create New Document
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
          </Paper>
  
          {/* Context Grid */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: 'repeat(2, 1fr)', 
                    lg: 'repeat(3, 1fr)' 
                }, 
                gap: 3 
                }}>
                {filteredDocuments.map((document, index) => (
                    <DocumentCard 
                        key={document.id || `document-${index}`} 
                        document={document}
                        onViewEdit={handleViewEditDocument}
                    />
                ))}
                </Box>
            )}
            </Box>
      </Box>
  );
}
