import { Checkbox, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import { Add as AddSourceIcon } from '@mui/icons-material';

export default function SourceSelectionPanel() {
  const { sourceInfo } = useCorpusSessionContext();
  const s =
    sourceInfo === undefined
      ? { loading: true as const }
      : { loading: false as const, ...sourceInfo };

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
        />
        <Typography variant="h6">Sources</Typography>
        <IconButton disabled={s === undefined}>
          <AddSourceIcon />
        </IconButton>
      </Stack>
      {s.loading ? (
        <Typography sx={{ p: 2 }}>Loading sources...</Typography>
      ) : (
        <Stack direction="column" spacing={1} sx={{ p: 2 }}>
          {s.sources.length === 0 && (
            <Typography>No sources yet</Typography>
          )}
          {s.sources.map(source => (
            <Paper key={s.sourceStringId(source)} sx={{ p: 1 }}>
              <Checkbox checked={s.sourceSelection[s.sourceStringId(source)]} />
              <Typography variant="body1">{source.name}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
