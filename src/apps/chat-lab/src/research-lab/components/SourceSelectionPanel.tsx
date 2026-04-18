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
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import type { CorpusSource } from '../types/local';
import { formatDate } from '../utils';

const mimeTypeColourMap: Record<string, string> = {
  'application/pdf': '#e03131',
  'text/markdown': '#1971c2',
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
    default: {
      const _exhaustive: never = id;
      console.error(
        `Unknown source type when opening external: ${_exhaustive}`
      );
      break;
    }
  }
}

export default function SourceSelectionPanel() {
  const navigate = useNavigate();
  const { corpusId: urlCorpusId } = useParams();
  const { sourceInfo, ingestQueueInfo } = useCorpusSessionContext();
  const s =
    sourceInfo === undefined
      ? { loading: true as const }
      : { loading: false as const, ...sourceInfo };
  const q =
    ingestQueueInfo === undefined
      ? { loading: true as const }
      : { loading: false as const, ...ingestQueueInfo };

  return (
    <Paper>
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
        <Typography variant="h6">Sources</Typography>
        <IconButton
          disabled={s.loading || !urlCorpusId}
          onClick={() =>
            navigate(`/research-lab/corpora/${urlCorpusId}/add-source`)
          }
        >
          <AddSourceIcon />
        </IconButton>
      </Stack>
      {!q.loading && q.remaining > 0 && (
        <Typography
          sx={{ p: 1, borderBottom: 1, borderColor: 'divider', m: 1 }}
        >
          {q.remaining} source
          {q.remaining === 1 ? '' : 's'} ingesting...
        </Typography>
      )}
      {s.loading ? (
        <Typography sx={{ p: 2 }}>Loading sources...</Typography>
      ) : (
        <Stack direction="column" spacing={1} sx={{ p: 2 }}>
          {s.sources.length === 0 && <Typography>No sources yet</Typography>}
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
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
                      >
                        {formatDate(source.addedAt)}
                      </Typography>
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
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
