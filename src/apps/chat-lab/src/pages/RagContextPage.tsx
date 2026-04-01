import { Alert, Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import ContextCorporaTab from '../components/contexts/ContextCorporaTab';
import ContextDocumentsTab from '../components/contexts/ContextDocumentsTab';
import ContextUrlsTab from '../components/contexts/ContextUrlsTab';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { selectContexts } from '../store/selectors/contextSelectors';
import { fetchContexts } from '../store/slices/contextsSlice';
import { useUnifiedStorage } from '../hooks/useStorageCompatibility';

const RAG_TABS = ['corpora', 'documents', 'urls'] as const;
type RagTab = (typeof RAG_TABS)[number];

function getTabFromHash(hash: string): RagTab | null {
  const raw = hash.replace(/^#/, '');
  return (RAG_TABS as readonly string[]).includes(raw) ? (raw as RagTab) : null;
}

export default function RagContextPage() {
  const [activeTab, setActiveTab] = useState<RagTab>(
    () => getTabFromHash(window.location.hash) ?? 'corpora'
  );
  const { currentProfile } = useAppSelector(state => state.auth);
  const { contexts } = useAppSelector(selectContexts);
  const { corpora, loading, error } = useAppSelector(state => state.contexts);
  const unifiedStorage = useUnifiedStorage();

  const dispatch = useAppDispatch();
  useEffect(() => {
    if (
      currentProfile?.id
      || unifiedStorage.activeWorkspace?.type === 'shared'
    ) {
      dispatch(fetchContexts(currentProfile?.id));
    }
  }, [
    dispatch,
    currentProfile?.id,
    unifiedStorage.googleDrive.isAuthenticated,
    unifiedStorage?.activeWorkspace?.id,
    unifiedStorage.activeWorkspace?.type,
  ]);

  useEffect(() => {
    const onHashChange = () => {
      const next = getTabFromHash(window.location.hash) ?? 'corpora';
      setActiveTab(next);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const desiredHash = `#${activeTab}`;
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [activeTab]);

  return (
    <Box
      sx={{
        height: '100%', // Use full height of parent container
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden', // Prevent outer page scrolling
      }}
    >
      {/* Scrollable Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto', // Enable scrolling for content
          p: 3,
          minHeight: 0, // Ensure flex child can shrink properly
        }}
      >
        <Typography variant="h5">Contexts</Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your knowledge bases for adding context to your conversations.
        </Typography>

        {loading && (
          <Typography variant="body1" color="text.secondary">
            Loading...
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 2, mb: 2, mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue: RagTab) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Corpora" value="corpora" />
            <Tab label="Documents" value="documents" />
            <Tab label="URLs" value="urls" />
          </Tabs>

          <Typography variant="body1" color="text.secondary" sx={{ p: 2 }}>
            {activeTab === 'corpora'
              && 'Corpora are collections of documents that you can allow the LLM to search for context when responding to you.'}
            {activeTab === 'documents'
              && 'Documents are files that you can add to conversations directly or via a corpus.'}
            {activeTab === 'urls'
              && 'URLs are scraped to produce documents dynamically to be added to a conversation directly or via a corpus.'}
          </Typography>
        </Paper>

        {activeTab === 'corpora' && (
          <ContextCorporaTab corpora={corpora} contexts={contexts} />
        )}
        {activeTab === 'documents' && (
          <ContextDocumentsTab contexts={contexts} />
        )}
        {activeTab === 'urls' && <ContextUrlsTab />}
      </Box>
    </Box>
  );
}
