import { useEffect, useMemo } from 'react';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import {
  ListItemText,
  ListItem,
  List,
  Paper,
  Typography,
  alpha,
  Link,
} from '@mui/material';
import type { IngestQueueError } from '../types/ragApi';

function titleForError(error: IngestQueueError) {
  const location = error.file.location;
  switch (location.provider) {
    case 'google_drive':
      return (
        <Typography>
          {error.file.action}:{' '}
          <Link
            href={`https://drive.google.com/file/d/${location.file_id}`}
            target="_blank"
          >
            {location.file_id}
          </Link>
        </Typography>
      );
    case 'url':
      return (
        <Typography>
          {error.file.action}:{' '}
          <Link href={location.url} target="_blank">
            {location.url}
          </Link>
        </Typography>
      );
    case 'fidu_context':
      return `${error.file.action}: FIDU Context ${location.provider_id}`;
    default: {
      const _exhaustive: never = location;
      console.error(
        `Unknown location provider when generating title for error: ${_exhaustive}`,
        { error }
      );
      return `${error.file.action}: unknown location provider`;
    }
  }
}

export default function IngestionErrorPanel() {
  const { ingestQueueInfo, navigation } = useCorpusSessionContext();
  useEffect(() => {
    navigation.showBackButton();
    return () => {
      navigation.clearActions();
    };
  }, [navigation]);

  const ingestionErrors = useMemo(
    () =>
      ingestQueueInfo?.ingestionErrors?.map(err => ({
        title: titleForError(err),
        message: err.message,
      })) || [],
    [ingestQueueInfo]
  );

  return (
    <Paper
      sx={{
        p: 2,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: theme =>
          `${alpha(theme.palette.text.primary, 0.35)} ${theme.palette.background.paper}`,
      }}
    >
      <Typography variant="h6">Ingestion Errors</Typography>
      <List>
        {ingestionErrors.map((error, i) => (
          <ListItem key={i}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: 'rgba(0,0,0,0.05)',
                border: '1px solid',
                borderColor: theme => alpha(theme.palette.error.main, 0.5),
                width: '100%',
              }}
            >
              <ListItemText primary={error.title} secondary={error.message} />
            </Paper>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
