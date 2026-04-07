import { Box, MenuItem, Paper, Select, Typography } from '@mui/material';
import {
  getFiduAuthService,
  type FiduAuthTokens,
} from '../../services/auth/FiduAuthService';
import { useCallback, useEffect, useState } from 'react';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import type { ContextCorpus } from '../../types';
import { getGatewayUrl } from '../../utils/environment';

export default function ContextApiTab({
  corpora,
}: {
  corpora: ContextCorpus[];
}) {
  const gatewayUrl = getGatewayUrl();
  const [selectedCorpusId, setSelectedCorpusId] = useState<string>(
    corpora[0]?.database.location.type === 'google_drive'
      ? corpora[0].database.location.fileId
      : '<MAKE A CORPUS FIRST>'
  );
  const [fiduTokens, setFiduTokens] = useState<FiduAuthTokens | null>(null);
  const [googleDriveToken, setGoogleDriveToken] = useState<string | null>(null);
  const [credsAndLocation, setCredsAndLocation] = useState<object | null>(null);
  const getFiduTokens = useCallback(() => {
    const fiduAuthService = getFiduAuthService();
    fiduAuthService.getTokens().then(setFiduTokens);
  }, [setFiduTokens]);
  useEffect(() => {
    getFiduTokens();
  }, [getFiduTokens]);
  const getGoogleDriveTokens = useCallback(async () => {
    const googleDriveAuthService = await getGoogleDriveAuthService();
    googleDriveAuthService.getAccessToken().then(setGoogleDriveToken);
  }, [setGoogleDriveToken]);
  useEffect(() => {
    getGoogleDriveTokens();
  }, [getGoogleDriveTokens]);
  useEffect(() => {
    setCredsAndLocation({
      provider_credentials: {
        google_drive: {
          oauth_token: googleDriveToken,
        },
      },
      corpus_location: {
        provider: 'fidu_rag',
        engine: 'cortexdb',
        database_file_location: {
          provider: 'google_drive',
          file_id: selectedCorpusId,
        },
      },
    });
  }, [selectedCorpusId, googleDriveToken]);
  return (
    <Box>
      <Typography variant="body1" color="text.secondary">
        This page just exists for testing.
      </Typography>
      <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="h6">Credentials</Typography>
        <Typography>
          FIDU Auth token:{' '}
          <button
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.9em',
              border: 'none',
              background: 'transparent',
              cursor: fiduTokens?.access_token ? 'pointer' : 'not-allowed',
              color: fiduTokens?.access_token ? '#1976d2' : 'grey',
              verticalAlign: 'middle',
            }}
            title="Copy to clipboard"
            aria-label="Copy access token"
            disabled={!fiduTokens?.access_token}
            onClick={() => {
              if (fiduTokens?.access_token) {
                navigator.clipboard.writeText(fiduTokens.access_token);
              }
            }}
          >
            📋
          </button>
          <button
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.9em',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#388e3c',
              verticalAlign: 'middle',
            }}
            title="Refresh tokens"
            aria-label="Refresh tokens"
            onClick={getFiduTokens}
          >
            🔄
          </button>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add this to a file named fidu_access.jwt in a temporary directory.
        </Typography>
        <Typography>
          <code style={{ wordBreak: 'break-word' }}>
            {fiduTokens?.access_token}
          </code>
        </Typography>
        <Typography sx={{ mt: 2 }}>
          Google Drive access token:{' '}
          <button
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.9em',
              border: 'none',
              background: 'transparent',
              cursor: googleDriveToken ? 'pointer' : 'not-allowed',
              color: googleDriveToken ? '#1976d2' : 'grey',
              verticalAlign: 'middle',
            }}
            title="Copy to clipboard"
            aria-label="Copy access token"
            disabled={!googleDriveToken}
            onClick={() => {
              if (googleDriveToken) {
                navigator.clipboard.writeText(googleDriveToken);
              }
            }}
          >
            📋
          </button>
          <button
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.9em',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#388e3c',
              verticalAlign: 'middle',
            }}
            title="Refresh token"
            aria-label="Refresh token"
            onClick={getGoogleDriveTokens}
          >
            🔄
          </button>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will go in your request body (see below).
        </Typography>
        <Typography>
          <code style={{ wordBreak: 'break-word' }}>{googleDriveToken}</code>
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="h6">Corpora</Typography>
        <Typography>
          <Select
            value={selectedCorpusId}
            onChange={event => setSelectedCorpusId(event.target.value)}
          >
            {corpora.map(corpus =>
              corpus.database.location.type === 'google_drive' ? (
                <MenuItem
                  key={corpus.id}
                  value={corpus.database.location.fileId}
                >
                  {corpus.name}
                </MenuItem>
              ) : null
            )}
          </Select>
        </Typography>
        <Typography>
          Selected corpus ID:{' '}
          <code style={{ wordBreak: 'break-word' }}>{selectedCorpusId}</code>
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="h5">Request examples</Typography>
        <Typography variant="body2" color="text.secondary">
          Copy these bodies into data.json and use the curl commands below, or
          use these as inspiration.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Some examples have bits you still need to fill in!
        </Typography>
        <Typography variant="h6">Add to ingest queue</Typography>
        <Typography>
          POST {gatewayUrl}/api/rag/v1/corpus/ingest-queue
        </Typography>
        <Typography>
          <code>
            curl -X POST -H "Content-Type: application/json" -d @data.json -H
            "Authorization: Bearer $(cat fidu_access.jwt)" {gatewayUrl}
            /api/rag/v1/corpus/ingest-queue
          </code>
        </Typography>
        <Typography>
          <code style={{ wordBreak: 'break-word' }}>
            <pre>
              {JSON.stringify(
                {
                  ...credsAndLocation,
                  files: [
                    {
                      action: 'add_or_replace',
                      location: {
                        type: 'google_drive',
                        file_id: '/* GOOGLE DRIVE FILE ID */',
                        mime_type: 'application/pdf',
                      },
                    },
                  ],
                },
                null,
                2
              )}
            </pre>
          </code>
        </Typography>

        <Typography variant="h6">Query ingest queue</Typography>
        <Typography>
          POST {gatewayUrl}/api/rag/v1/corpus/ingest-queue/query
        </Typography>
        <Typography>
          <code>
            curl -X POST -H "Content-Type: application/json" -d @data.json -H
            "Authorization: Bearer $(cat fidu_access.jwt)" {gatewayUrl}
            /api/rag/v1/corpus/ingest-queue/query
          </code>
        </Typography>
        <Typography>
          <code style={{ wordBreak: 'break-word' }}>
            <pre>
              {JSON.stringify(
                {
                  ...credsAndLocation,
                },
                null,
                2
              )}
            </pre>
          </code>
        </Typography>

        <Typography variant="h6">Prompt completion</Typography>
        <Typography>POST {gatewayUrl}/api/rag/v1/corpus/completion</Typography>
        <Typography>
          <code>
            curl -X POST -H "Content-Type: application/json" -d @data.json -H
            "Authorization: Bearer $(cat fidu_access.jwt)" {gatewayUrl}
            /api/rag/v1/corpus/completion
          </code>
        </Typography>
        <Typography>
          The <code>open_router_request_body</code> will be forwarded to
          OpenRouter. It should follow the spec{' '}
          <a href="https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request">
            here
          </a>
          . I recommend using <code>"stream": true</code> to get a streaming
          response.
        </Typography>
        <Typography>
          <code style={{ wordBreak: 'break-word' }}>
            <pre>
              {JSON.stringify(
                {
                  ...credsAndLocation,
                  search_query:
                    '/* SEARCH QUERY: the text that the corpus will be searched for (could be your last message) */',
                  open_router_request_body: {
                    model: 'anthropic/claude-opus-4.6',
                    messages: [
                      {
                        role: 'system',
                        content:
                          'You are a helpful, knowledgeable, and friendly AI assistant. You aim to be useful, accurate, and engaging in your responses. You can help with a wide variety of tasks and topics. Always be helpful and try to provide clear, accurate information.\n\nAnswer the following prompt.',
                      },
                      {
                        role: 'user',
                        content:
                          "Tell me about the contexts you've been provided.",
                      },
                    ],
                    temperature: 0.7,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    repetition_penalty: 1,
                    max_tokens: 4096,
                    stream: true,
                  },
                },
                null,
                2
              )}
            </pre>
          </code>
        </Typography>
      </Paper>
    </Box>
  );
}
