import {
  Alert,
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EnhancedMarkdown } from '../../components/common/EnhancedMarkdown';
import { createRagApiClient, corpusToLocation } from '../services/apiClientRag';
import type {
  SourceContentResponse,
  SourceFileLocation,
} from '../types/ragApi';
import { formatDate } from '../utils';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';

type RouteParams = {
  corpusId?: string;
  provider?: string;
  providerSpecificId?: string;
};

function toSourceFileLocation(
  provider: string,
  providerSpecificId: string
): SourceFileLocation {
  switch (provider) {
    case 'google_drive':
      return { provider: 'google_drive', file_id: providerSpecificId };
    case 'url':
      return { provider: 'url', url: providerSpecificId };
    case 'fidu_context':
      return { provider: 'fidu_context', provider_id: providerSpecificId };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export default function SourceContentPanel() {
  const navigate = useNavigate();
  const params = useParams<RouteParams>();
  const { corpus } = useCorpusSessionContext();

  const corpusLocation = useMemo(() => corpusToLocation(corpus), [corpus]);

  const sourceFileLocation = useMemo(() => {
    if (!params.provider || !params.providerSpecificId) {
      return undefined;
    }
    return toSourceFileLocation(params.provider, params.providerSpecificId);
  }, [params.provider, params.providerSpecificId]);

  const [data, setData] = useState<SourceContentResponse | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!corpusLocation || !sourceFileLocation) {
      return;
    }
    let cancelled = false;
    const api = createRagApiClient();
    setLoading(true);
    setError(undefined);
    setData(undefined);
    api
      .getSourceContent(corpusLocation, sourceFileLocation)
      .then(resp => {
        if (!cancelled) {
          setData(resp);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [corpusLocation, sourceFileLocation]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!sourceFileLocation) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Source</Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          Invalid source route params.
        </Alert>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Paper sx={{ p: 2, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={handleBack} aria-label="Back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }}>
            Source
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.source.name}
          </Typography>
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          p: 2,
        }}
      >
        {loading && <Typography>Loading source content...</Typography>}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {data && (
          <Stack direction="column" spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Metadata
              </Typography>
              <Stack direction="column" spacing={0.5}>
                <Typography variant="body2">
                  <strong>Name:</strong> {data.source.name}
                </Typography>
                <Typography variant="body2">
                  <strong>MIME type:</strong> {data.source.mime_type}
                </Typography>
                <Typography variant="body2">
                  <strong>Added:</strong> {formatDate(data.source.added_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Last ingested:</strong>{' '}
                  {formatDate(data.source.last_ingested_at)}
                </Typography>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <EnhancedMarkdown content={data.content} showCopyButtons={true} />
            </Paper>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
