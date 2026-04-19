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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Corpus,
  CorpusConversation,
  CorpusMessage,
  CorpusSource,
  CorpusSourceId,
} from '../types/local';
import { getStorageService } from '../../services/storage/StorageService';
import ModelOptionsPanel from '../components/ModelOptionsPanel';
import SourceSelectionPanel from '../components/SourceSelectionPanel';
import { createRagApiClient } from '../services/apiClientRag';
import type {
  CorpusLocation,
  Source,
  SourceFileLocation,
} from '../types/ragApi';
import { useAppSelector } from '../../store';
import {
  getAllModels,
  loadOpenRouterModels,
  type ModelConfig,
} from '../../data/models';

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

function selectAllSources(
  sources: CorpusSource[],
  setSourceSelection: (selection: Record<string, boolean>) => void
) {
  setSourceSelection(
    sources.reduce(
      (acc, source) => ({
        ...acc,
        [sourceStringId(source)]: true,
      }),
      {}
    )
  );
}

async function fetchConversations(
  corpusId: string | undefined
): Promise<CorpusConversation[]> {
  if (!corpusId) {
    return [];
  }
  const storageAdapter = getStorageService().getAdapter();
  return await storageAdapter.getConversationsInCorpus(corpusId);
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
  const { currentProfile } = useAppSelector(state => state.auth);
  const [openSidebar, setOpenSidebar] = useState<
    CorpusSidebarSection | undefined
  >('sources');
  const [corpus, setCorpus] = useState<Corpus | undefined>();
  const [conversations, setConversations] = useState<
    CorpusConversation[] | undefined
  >();
  const [sources, setSources] = useState<CorpusSource[] | undefined>();
  const [sourceSelection, setSourceSelection] = useState<
    Record<string, boolean>
  >({});
  const [allSourcesSelected, setAllSourcesSelected] = useState<boolean>(false);
  const [ingestQueueSourcesRemaining, setIngestQueueSourcesRemaining] =
    useState<number>(0);
  const [ingestQueuePollingEnabled, setIngestQueuePollingEnabled] =
    useState(true);
  const previousSourceIds = useRef<Set<string>>(new Set());
  const [modelList, setModelList] = useState<ModelConfig[] | undefined>(
    undefined
  );
  const [selectedModelId, setSelectedModelId] =
    useState<string>('openrouter/auto');

  useEffect(() => {
    let cancelled = false;
    loadOpenRouterModels()
      .then(() => {
        if (!cancelled) {
          setModelList(getAllModels());
        }
      })
      .catch(error => {
        console.error('Failed to load OpenRouter models:', error);
        if (!cancelled) {
          setModelList([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sources) {
      return;
    }
    if (!sourceSelection) {
      setAllSourcesSelected(false);
      return;
    }
    setAllSourcesSelected(
      sources.every(source => sourceSelection[sourceStringId(source)])
    );
  }, [sources, sourceSelection]);

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
    fetchConversations(corpusId).then(conversations => {
      if (cancelled) {
        return;
      }
      setConversations(conversations);
    });
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

  useEffect(() => {
    if (!sources) {
      return;
    }
    const wasEmpty = previousSourceIds.current.size === 0;
    const wasAllSelected = Array.from(previousSourceIds.current).every(
      id => sourceSelection[id]
    );
    const newSourceIds = sources
      .map(sourceStringId)
      .filter(id => !previousSourceIds.current.has(id));
    if (newSourceIds.length > 0 && (wasEmpty || wasAllSelected)) {
      setSourceSelection(prev => ({
        ...prev,
        ...Object.fromEntries(newSourceIds.map(id => [id, true])),
      }));
    }
    previousSourceIds.current = new Set(sources.map(sourceStringId));
  }, [sources, sourceSelection]);

  const addMessages = useCallback(
    async (conversation: CorpusConversation, messages: CorpusMessage[]) => {
      if (!currentProfile || !corpusId) {
        return;
      }
      const update = {
        ...conversation,
        messages: [...conversation.messages, ...messages],
      };
      const adapter = getStorageService().getAdapter();
      const newConversation = await adapter.updateCorpusConversation(
        corpusId,
        update,
        currentProfile.id
      );
      setConversations(prev =>
        prev?.map(c => (c.id === conversation.id ? newConversation : c))
      );
    },
    [corpusId, currentProfile]
  );

  const pollIngestQueueStatus = useCallback(
    () => setIngestQueuePollingEnabled(true),
    []
  );
  const setOneSourceSelection = useCallback(
    (sourceId: string, selected: boolean) => {
      setSourceSelection(sourceSelection => ({
        ...sourceSelection,
        [sourceId]: selected,
      }));
    },
    []
  );
  const toggleAllSourcesSelected = useCallback(() => {
    if (!sources) {
      return;
    }
    if (allSourcesSelected) {
      setSourceSelection({});
    } else {
      selectAllSources(sources, setSourceSelection);
    }
  }, [allSourcesSelected, sources]);

  const sessionContext: CorpusSessionContextValue = useMemo(
    () => ({
      corpus,
      conversationInfo: conversations && {
        conversations,
        reloadConversations: () =>
          fetchConversations(corpusId).then(setConversations),
        addMessages,
      },
      sourceInfo: sources && {
        allSourcesSelected,
        toggleAllSourcesSelected,
        sources,
        sourceSelection,
        setSourceSelection: setOneSourceSelection,
        sourceStringId,
      },
      ingestQueueInfo: {
        remaining: ingestQueueSourcesRemaining,
        pollingEnabled: ingestQueuePollingEnabled,
        pollIngestQueueStatus,
      },
      modelInfo:
        modelList === undefined
          ? undefined
          : {
              models: modelList,
              selectedModelId,
              selectModel: setSelectedModelId,
            },
    }),
    [
      corpus,
      conversations,
      addMessages,
      sources,
      allSourcesSelected,
      toggleAllSourcesSelected,
      sourceSelection,
      setOneSourceSelection,
      ingestQueueSourcesRemaining,
      ingestQueuePollingEnabled,
      pollIngestQueueStatus,
      corpusId,
      modelList,
      selectedModelId,
      setSelectedModelId,
    ]
  );

  const toggleSidebarSection = useCallback((section: CorpusSidebarSection) => {
    setOpenSidebar(prev => (prev === section ? undefined : section));
  }, []);

  if (!corpusId) {
    return <Navigate to="/research-lab" replace />;
  }

  const sidebarSections = getSidebarSections(location.pathname);

  return (
    <CorpusSessionContext.Provider value={sessionContext}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', sm: 260 },
            flexShrink: 0,
            minHeight: 0,
            maxHeight: { xs: '42vh', sm: 'none' },
            height: { xs: undefined, sm: '100%' },
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {sidebarSections.map(section => {
            switch (section) {
              case 'sources':
                return (
                  <SourceSelectionPanel
                    key={section}
                    open={openSidebar === section}
                    onToggleHeader={() => toggleSidebarSection('sources')}
                  />
                );
              case 'modelOptions':
                return (
                  <ModelOptionsPanel
                    key={section}
                    open={openSidebar === section}
                    onToggleHeader={() => toggleSidebarSection('modelOptions')}
                  />
                );
              case 'export':
                return null;
              default:
                return null;
            }
          })}
        </Box>

        <Box
          sx={{
            flex: '1 1 0',
            minWidth: { xs: 0, sm: 260 },
            minHeight: 0,
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
