import {
  Navigate,
  Outlet,
  matchPath,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import {
  CorpusSessionContext,
  type CorpusSessionContextValue,
} from '../contexts/CorpusSessionContext';

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

export default function CorpusPage() {
  const { corpusId } = useParams();
  const location = useLocation();

  if (!corpusId) {
    return <Navigate to="/research-lab" replace />;
  }

  const sidebarSections = getSidebarSections(location.pathname);

  // TODO: get real data from API and storage adapter
  const sessionContext: CorpusSessionContextValue = {
    corpus: {
      id: corpusId,
      name: 'My Corpus',
      description: 'My Corpus Description',
      createdAt: '2026-01-28T12:59:00Z',
      lastOpenedAt: '2026-03-12T15:23:00Z',
      tags: [],
      databaseLocation: {
        provider: 'google_drive',
        fileId: '1234567890',
      },
      conversations: [],
    },
    loading: false,
    sourceInfo: {
      allSourcesSelected: false,
      setAllSourcesSelected: () => {},
      sources: [],
      sourceSelection: {},
      setSourceSelection: () => {},
      clearSourceSelection: () => {},
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
          <Typography variant="h5">Sidebar</Typography>
          <Box component="pre" sx={{ m: 0, fontSize: 12, opacity: 0.8 }}>
            {JSON.stringify(sidebarSections, null, 2)}
          </Box>
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
          <Typography variant="h5">Corpus {corpusId}</Typography>
          <Outlet />
        </Box>
      </Box>
    </CorpusSessionContext.Provider>
  );
}
