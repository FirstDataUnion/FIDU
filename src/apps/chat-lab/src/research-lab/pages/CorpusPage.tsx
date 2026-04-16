import {
  Navigate,
  Outlet,
  matchPath,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Box } from '@mui/material';
import {
  CorpusSessionContext,
  type CorpusSessionContextValue,
} from '../contexts/CorpusSessionContext';
import { useEffect, useState } from 'react';
import type { Corpus, CorpusConversation, CorpusSource, CorpusSourceId } from '../types/local';
import { getStorageService } from '../../services/storage/StorageService';
import SourceSelectionPanel from '../components/SourceSelectionPanel';
import { createRagApiClient } from '../services/apiClientRag';
import type { SourceFileLocation } from '../types/ragApi';

type CorpusSidebarSection = 'sources' | 'modelOptions' | 'export';

function getSidebarSections(path: string): CorpusSidebarSection[] {
  // If we were using a data router, we would use useMatches() to get the sidebar sections from the route handle.
  const routeSidebarSections: [string, boolean, CorpusSidebarSection[]][] = [
    [
      '/research-lab/corpora/:corpusId/conversations/:conversationId',
      true,
      ['sources', 'modelOptions', 'export'],
    ],
    ['/research-lab/corpora/:corpusId', false, ['sources']],
  ];
  for (const [routePath, end, sections] of routeSidebarSections) {
    if (matchPath({ path: routePath, end }, path)) {
      return sections;
    }
  }

  return [];
}

function sourceStringId(source: CorpusSource): string {
  switch (source.id.provider) {
      case 'google_drive':
          return `${source.id.provider}::${source.id.fileId}`;
      default:
          throw new Error(`Unknown source provider: ${source.id.provider}`);
  }
}

export default function CorpusPage() {
  const { corpusId } = useParams();
  const location = useLocation();
  const [corpus, setCorpus] = useState<Corpus | undefined>();
  const [conversations, setConversations] = useState<
    CorpusConversation[] | undefined
  >();
  const [sources, setSources] = useState<CorpusSource[] | undefined>();

  useEffect(() => {
    if (!corpusId) {
      return;
    }
    const storageService = getStorageService();
    storageService.getAdapter().getCorpusById(corpusId).then(setCorpus);
  }, [corpusId]);

  useEffect(() => {
    if (!corpusId) {
      return;
    }
    const storageService = getStorageService();
    storageService
      .getAdapter()
      .getConversationsInCorpus(corpusId)
      .then(setConversations);
  }, [corpusId]);

  useEffect(() => {
    if (!corpus) {
      return;
    }
    function mapId(id: SourceFileLocation): CorpusSourceId {
      switch (id.provider) {
        case 'google_drive':
          return { provider: 'google_drive', fileId: id.file_id };
        default:
          throw new Error(`Unknown source provider: ${id.provider}`);
      }
    }
    const apiClient = createRagApiClient();
    apiClient.getSources({
      provider: 'fidu_rag',
      engine: 'cortexdb',
      database_file_location: {
        provider: 'google_drive',
        file_id: corpus.databaseLocation.fileId,
      },
    }).then((sources) => {
      setSources(sources.map((source) => ({
        id: mapId(source.id),
        name: source.name,
        mimeType: source.mime_type,
        addedAt: source.added_at,
        lastIngestedAt: source.last_ingested_at,
      })));
    });
  }, [corpus]);

  if (!corpusId) {
    return <Navigate to="/research-lab" replace />;
  }

  const sidebarSections = getSidebarSections(location.pathname);

  const sessionContext: CorpusSessionContextValue = {
    corpus,
    conversationInfo: conversations && {
      conversations,
    },
    sourceInfo: sources && {
      allSourcesSelected: false,
      setAllSourcesSelected: () => {},
      sources,
      sourceSelection: {},
      setSourceSelection: () => {},
      clearSourceSelection: () => {},
      sourceStringId,
    },
  };

  return (
    <CorpusSessionContext.Provider value={sessionContext}>
      <Box
        sx={{ display: 'flex', flexDirection: 'row', gap: 2, height: '100%' }}
      >
        <Box
          sx={{
            width: 260,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {sidebarSections.map((section) => {
            switch (section) {
              case 'sources':
                return <SourceSelectionPanel />;
              case 'modelOptions':
                return null;
              case 'export':
                return null;
              default:
                return null;
            }
          })}
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </CorpusSessionContext.Provider>
  );
}
