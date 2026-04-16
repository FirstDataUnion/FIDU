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
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Corpus,
  CorpusConversation,
  CorpusSource,
  CorpusSourceId,
} from '../types/local';
import { getStorageService } from '../../services/storage/StorageService';
import SourceSelectionPanel from '../components/SourceSelectionPanel';
import { createRagApiClient } from '../services/apiClientRag';
import type {
  CorpusLocation,
  Source,
  SourceFileLocation,
} from '../types/ragApi';

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

function mapId(id: SourceFileLocation): CorpusSourceId {
  switch (id.provider) {
    case 'google_drive':
      return { provider: 'google_drive', fileId: id.file_id };
    case 'url':
      return { provider: 'url', url: id.url };
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function mapSource(source: Source): CorpusSource {
  return {
    id: mapId(source.id),
    name: source.name,
    mimeType: source.mime_type,
    addedAt: source.added_at,
    lastIngestedAt: source.last_ingested_at,
  };
}

function useIngestQueuePolling(
  corpus: Corpus | undefined,
  enabled: boolean,
  setRemaining: (remaining: number) => void,
  setSources: (sources: CorpusSource[]) => void,
  onComplete: () => void
) {
  useEffect(() => {
    if (!enabled || !corpus) {
      return;
    }
    const apiClient = createRagApiClient();
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
    let cancelled = false;

    const corpusLocation: CorpusLocation = {
      provider: 'fidu_rag',
      engine: 'cortexdb',
      database_file_location: {
        provider: 'google_drive',
        file_id: corpus.databaseLocation.fileId,
      },
    };

    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        const { remaining_queue_size, queue_status } =
          await apiClient.getIngestQueueStatus(corpusLocation);
        if (cancelled) {
          return;
        }
        setRemaining(remaining_queue_size);
        if (queue_status === 'completed' || queue_status === 'empty') {
          const sources = await apiClient.getSources(corpusLocation);
          if (cancelled) {
            return;
          }
          setSources(sources.map(mapSource));
          onComplete();
          return;
        }
        timeoutId = setTimeout(tick, 1000);
      } catch (error) {
        console.error('Error polling ingest queue status:', error);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [corpus, enabled, onComplete, setRemaining, setSources]);
}

export default function CorpusPage() {
  const { corpusId } = useParams();
  const location = useLocation();
  const [corpus, setCorpus] = useState<Corpus | undefined>();
  const [conversations, setConversations] = useState<
    CorpusConversation[] | undefined
  >();
  const [sources, setSources] = useState<CorpusSource[] | undefined>();
  const [ingestQueueSourcesRemaining, setIngestQueueSourcesRemaining] =
    useState<number>(0);
  const [ingestQueuePollingEnabled, setIngestQueuePollingEnabled] =
    useState(true);

  useEffect(() => {
    if (!corpusId) {
      return;
    }
    let cancelled = false;
    const fetchCorpus = async () => {
      const storageAdapter = getStorageService().getAdapter();
      const corpus = await storageAdapter.getCorpusById(corpusId);
      if (cancelled) {
        return;
      }
      setCorpus(corpus);
    };
    fetchCorpus();
    return () => {
      cancelled = true;
    };
  }, [corpusId]);

  useEffect(() => {
    if (!corpusId) {
      return;
    }
    let cancelled = false;
    const fetchConversations = async () => {
      const storageAdapter = getStorageService().getAdapter();
      const conversations =
        await storageAdapter.getConversationsInCorpus(corpusId);
      if (cancelled) {
        return;
      }
      setConversations(conversations);
    };
    fetchConversations();
    return () => {
      cancelled = true;
    };
  }, [corpusId]);

  useIngestQueuePolling(
    corpus,
    ingestQueuePollingEnabled,
    setIngestQueueSourcesRemaining,
    setSources,
    useCallback(() => setIngestQueuePollingEnabled(false), [])
  );

  const devNoop = useCallback(() => {}, []);
  const pollIngestQueueStatus = useCallback(
    () => setIngestQueuePollingEnabled(true),
    []
  );

  const sessionContext: CorpusSessionContextValue = useMemo(
    () => ({
      corpus,
      conversationInfo: conversations && {
        conversations,
      },
      sourceInfo: sources && {
        allSourcesSelected: false,
        setAllSourcesSelected: devNoop,
        sources,
        sourceSelection: {},
        setSourceSelection: devNoop,
        clearSourceSelection: devNoop,
        sourceStringId,
        pollIngestQueueStatus,
        ingestQueueSourcesRemaining,
      },
    }),
    [
      corpus,
      conversations,
      sources,
      devNoop,
      pollIngestQueueStatus,
      ingestQueueSourcesRemaining,
    ]
  );

  if (!corpusId) {
    return <Navigate to="/research-lab" replace />;
  }

  const sidebarSections = getSidebarSections(location.pathname);

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
          {sidebarSections.map(section => {
            switch (section) {
              case 'sources':
                return <SourceSelectionPanel key={section} />;
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
