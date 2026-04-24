import {
  Box,
  Checkbox,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddSourceIcon,
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import type { CorpusSource, UrlCollection } from '../types/local';
import { formatDate } from '../utils';
import { useCallback, useMemo } from 'react';
import { corpusToLocation, createRagApiClient } from '../services/apiClientRag';
import type { FileLocation } from '../types/ragApi';
import {
  GoogleDriveService,
  type DriveFile,
} from '../../services/storage/drive/GoogleDriveService';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';

const mimeTypeColourMap: Record<string, string> = {
  'application/pdf': '#e03131',
  'text/markdown': '#1971c2',
  'application/vnd.google-apps.spreadsheet': 'rgb(52,168,83)',
};

function getMimeTypeColour(mimeType: string): string {
  return mimeTypeColourMap[mimeType] ?? 'text.secondary';
}

function openExternal(source: CorpusSource): void {
  const id = source.id;
  switch (id.provider) {
    case 'url':
      window.open(id.url, '_blank');
      break;
    case 'google_drive':
      window.open(
        `https://drive.google.com/file/d/${id.fileId}/view`,
        '_blank'
      );
      break;
    case 'fidu_context':
      break;
    default: {
      const _exhaustive: never = id;
      console.error(
        `Unknown source type when opening external: ${_exhaustive}`
      );
      break;
    }
  }
}

function sourcePanelPath(corpusId: string, source: CorpusSource): string {
  const id = source.id;
  switch (id.provider) {
    case 'google_drive':
      return `/research-lab/corpus/${corpusId}/source/google_drive/${encodeURIComponent(id.fileId)}`;
    case 'url':
      return `/research-lab/corpus/${corpusId}/source/url/${encodeURIComponent(id.url)}`;
    case 'fidu_context':
      return `/research-lab/corpus/${corpusId}/source/fidu_context/${encodeURIComponent(id.providerId)}`;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export default function SourceSelectionPanel({
  open,
  onToggleHeader,
}: {
  open: boolean;
  onToggleHeader: () => void;
}) {
  const navigate = useNavigate();
  const { corpusId: urlCorpusId } = useParams();
  const { corpus, sourceInfo, ingestQueueInfo, sourceFetchError } =
    useCorpusSessionContext();
  const s = useMemo(
    () =>
      sourceInfo === undefined
        ? { loading: true as const }
        : { loading: false as const, ...sourceInfo },
    [sourceInfo]
  );
  const q =
    ingestQueueInfo === undefined
      ? { loading: true as const }
      : { loading: false as const, ...ingestQueueInfo };

  const deleteSource = useCallback(
    async (source: CorpusSource) => {
      const corpusLocation = corpusToLocation(corpus);
      if (corpusLocation === undefined) {
        return;
      }
      let fileLocation: FileLocation;
      switch (source.id.provider) {
        case 'google_drive':
          fileLocation = {
            provider: 'google_drive',
            file_id: source.id.fileId,
          };
          break;
        case 'url':
          fileLocation = {
            provider: 'url',
            url: source.id.url,
          };
          break;
        case 'fidu_context':
          fileLocation = {
            provider: 'fidu_context',
            provider_id: source.id.providerId,
          };
          break;
        default: {
          const _exhaustive: never = source.id;
          console.error(`Unknown source type when deleting: ${_exhaustive}`);
          return;
        }
      }
      const ragApiClient = createRagApiClient();
      await ragApiClient.deleteFiles(corpusLocation, [
        { location: fileLocation },
      ]);
      ingestQueueInfo?.pollIngestQueueStatus();
    },
    [corpus, ingestQueueInfo]
  );

  const refreshUrlCollection = useCallback(
    async (collection: UrlCollection & { fileMetadata: DriveFile }) => {
      const corpusLocation = corpusToLocation(corpus);
      if (!corpusLocation || s.loading) {
        return;
      }
      console.log('refreshUrlCollection', { collection });
      const authService = await getGoogleDriveAuthService();
      const driveService = new GoogleDriveService(authService);
      await driveService.initialize();

      const collectionUrls = await driveService.getGoogleSheetColumnAValues(
        collection.fileId
      );
      const existingUrls = s.sources
        .filter(source => source.id.provider === 'url')
        .filter(
          source =>
            source.metadata?.url_collection_sheets_file_id === collection.fileId
        ) as (CorpusSource & { id: { provider: 'url' } })[];
      const addOrReplace = collectionUrls.map(url => ({
        location: {
          provider: 'url' as const,
          url,
        },
        metadata: {
          url_collection_sheets_file_id: collection.fileId,
        },
      }));
      const deleteSources = existingUrls
        .filter(source => !collectionUrls.includes(source.id.url))
        .map(source => ({
          location: { provider: 'url' as const, url: source.id.url },
        }));
      console.log({
        sources: s.sources,
        collectionUrls,
        existingUrls,
        addOrReplace,
        deleteSources,
      });

      const ragApiClient = createRagApiClient();
      await ragApiClient.ingestFiles(corpusLocation, addOrReplace);
      await ragApiClient.deleteFiles(corpusLocation, deleteSources);
      ingestQueueInfo?.pollIngestQueueStatus();
    },
    [corpus, s, ingestQueueInfo]
  );

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        flex: open ? '1 1 0' : '0 0 auto',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', m: 1 }}
      >
        <Checkbox
          checked={s.loading || s.allSourcesSelected}
          disabled={s.loading}
          onChange={s.loading ? undefined : s.toggleAllSourcesSelected}
        />
        <Typography
          variant="h6"
          onClick={onToggleHeader}
          sx={{ cursor: 'pointer' }}
        >
          Sources
        </Typography>
        <IconButton
          disabled={s.loading || !urlCorpusId}
          onClick={() =>
            navigate(`/research-lab/corpus/${urlCorpusId}/add-source`)
          }
        >
          <AddSourceIcon />
        </IconButton>
      </Stack>
      {sourceFetchError ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ p: 1, borderBottom: 1, borderColor: 'divider', m: 1 }}
        >
          <Typography>Error fetching queue/sources</Typography>
          {!q.loading && (
            <IconButton onClick={q.pollIngestQueueStatus}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ) : (
        <>
          {!q.loading && q.remaining > 0 && (
            <Typography
              sx={{ p: 1, borderBottom: 1, borderColor: 'divider', m: 1 }}
            >
              {q.remaining} source
              {q.remaining === 1 ? '' : 's'} ingesting...
            </Typography>
          )}
          {!s.loading && s.reloadingSources && (
            <Typography
              sx={{ p: 1, borderBottom: 1, borderColor: 'divider', m: 1 }}
            >
              Reloading sources...
            </Typography>
          )}
        </>
      )}
      {open && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: theme =>
              `${alpha(theme.palette.text.primary, 0.35)} ${theme.palette.background.paper}`,
          }}
        >
          {s.loading ? (
            <Typography sx={{ p: 2 }}>Loading sources...</Typography>
          ) : (
            <Stack direction="column" spacing={1} sx={{ p: 2 }}>
              {s.urlCollections.length > 0 && (
                <Box sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  {s.urlCollections.map(c => (
                    <Paper key={c.fileId} sx={{ p: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            position: 'relative',
                            minWidth: 48,
                            width: 48,
                            height: 48 * 1.3,
                            backgroundColor: getMimeTypeColour(
                              c.fileMetadata.mimeType
                            ),
                            borderRadius: 0.75,
                          }}
                        >
                          <LinkIcon
                            fontSize="large"
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%) rotate(-45deg)',
                            }}
                          />
                        </Box>
                        <Stack
                          direction="column"
                          spacing={0.5}
                          sx={{ minWidth: '5em' }}
                          width="100%"
                        >
                          <Typography>{c.fileMetadata.name}</Typography>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="space-between"
                            sx={{ color: 'text.secondary' }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatDate(c.fileMetadata.modifiedTime)}
                            </Typography>
                            <Box>
                              <IconButton
                                size="small"
                                color="inherit"
                                sx={{ p: 0 }}
                                onClick={() => {
                                  window.open(
                                    `https://docs.google.com/spreadsheets/d/${c.fileId}/edit?gid=0#gid=0`,
                                    '_blank'
                                  );
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="inherit"
                                sx={{ p: 0 }}
                                onClick={() => {
                                  refreshUrlCollection(c);
                                }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              )}
              {s.sources.length === 0 && (
                <Typography>No sources yet</Typography>
              )}
              {s.sources.map(source => {
                const selected = s.sourceSelection[s.sourceStringId(source)];
                return (
                  <Paper
                    key={s.sourceStringId(source)}
                    sx={{
                      p: 1,
                      boxShadow: selected
                        ? theme =>
                            `0px 4px 2px -2px ${alpha(theme.palette.primary.main, 0.2)}, `
                            + `0px 2px 2px 0px ${alpha(theme.palette.primary.main, 0.14)}, `
                            + `0px 2px 6px 0px ${alpha(theme.palette.primary.main, 0.12)};`
                        : undefined,
                      backgroundColor: selected
                        ? theme => alpha(theme.palette.primary.light, 0.15)
                        : 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          position: 'relative',
                          minWidth: 48,
                          width: 48,
                          height: 48 * 1.3,
                        }}
                      >
                        <Box
                          onClick={() => {
                            s.setSourceSelection(
                              s.sourceStringId(source),
                              !selected
                            );
                          }}
                          sx={{
                            position: 'absolute',
                            borderRadius: 0.75,
                            backgroundColor: getMimeTypeColour(source.mimeType),
                            width: '100%',
                            height: '100%',
                          }}
                        />
                        <Checkbox
                          checked={selected ?? false}
                          onChange={() =>
                            s.setSourceSelection(
                              s.sourceStringId(source),
                              !selected
                            )
                          }
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            p: 0,
                            color: 'background.paper',
                            opacity: 0,
                            '&:hover': {
                              opacity: 1,
                            },
                            '&.Mui-focusVisible': {
                              opacity: 1,
                            },
                            '&.Mui-checked': {
                              color: 'background.paper',
                              opacity: 1,
                            },
                          }}
                        />
                      </Box>
                      <Stack
                        direction="column"
                        sx={{ minWidth: '5em' }}
                        spacing={0.5}
                        width="100%"
                      >
                        <Typography
                          onClick={() => {
                            if (!urlCorpusId) {
                              return;
                            }
                            navigate(sourcePanelPath(urlCorpusId, source));
                          }}
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: urlCorpusId ? 'pointer' : 'default',
                          }}
                        >
                          {source.name}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="space-between"
                          sx={{ color: 'text.secondary' }}
                        >
                          <Typography
                            variant="caption"
                            color="inherit"
                            sx={{ p: 0 }}
                            title={source.addedAt}
                          >
                            {formatDate(source.addedAt)}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            {source.id.provider !== 'fidu_context' && (
                              <IconButton
                                size="small"
                                color="inherit"
                                sx={{ p: 0 }}
                                onClick={() => {
                                  openExternal(source);
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            )}
                            {source.metadata?.url_collection_sheets_file_id ? (
                              // mark it as non-deletable because it comes from a URL collection
                              <Box
                                sx={{
                                  backgroundColor: getMimeTypeColour(
                                    'application/vnd.google-apps.spreadsheet'
                                  ),
                                  borderRadius: 0.5,
                                  width: '0.95em',
                                }}
                              ></Box>
                            ) : (
                              <IconButton
                                size="small"
                                color="error"
                                sx={{ p: 0 }}
                                onClick={() => {
                                  deleteSource(source);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}
