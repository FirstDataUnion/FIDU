import {
  IconButton,
  Box,
  TextField,
  InputAdornment,
  Paper,
  ListItemText,
  alpha,
  Typography,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import type {
  CorpusMessage,
  CorpusMessageError,
  CorpusMessageModel,
  CorpusMessageRagInfo,
  CorpusMessageUser,
} from '../types/local';
import { EnhancedMarkdown } from '../../components/common/EnhancedMarkdown';
import type { CorpusLocation } from '../types/ragApi';
import { createRagApiClient } from '../services/apiClientRag';
import type {
  OpenRouterMessage,
  OpenRouterStreamChunk,
} from '../../types/openRouter';
import { CollapsibleFragmentList } from './CollapsibleFragmentList';
import { getModelColor } from '../../utils/themeColors';
import type { Theme } from '@mui/material/styles';

function getProviderColor(model: string, mode: 'light' | 'dark') {
  if (model === 'openrouter/auto') {
    return getModelColor(mode, 'autoRouter');
  }
  const provider = model.split('/')[0]?.toLowerCase() ?? 'unknown';
  const knownProviders = [
    'openai',
    'anthropic',
    'google',
    'meta',
    'mistral',
    'microsoft',
    'xai',
  ] as const;
  if (knownProviders.includes(provider as any)) {
    return getModelColor(mode, provider as (typeof knownProviders)[number]);
  }
  return getModelColor(mode, 'unknown');
}

function BaseMessage({
  side,
  color,
  children,
}: {
  side: 'left' | 'right';
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      sx={{
        mb: 2,
        p: 2,
        pt: 0.5,
        maxWidth: '90%',
        minWidth: '60%',
        backgroundColor: color,
        color: 'white',
        borderRadius: 2,
        ...(side === 'left' ? { mr: 'auto' } : { ml: 'auto' }),
      }}
    >
      {children}
    </Paper>
  );
}

function UserMessage({ message }: { message: CorpusMessageUser }) {
  return (
    <BaseMessage side="right" color="primary.main">
      <EnhancedMarkdown content={message.content} showCopyButtons={true} />
    </BaseMessage>
  );
}

function ModelMessage({
  message,
  theme,
}: {
  message: CorpusMessageModel;
  theme: Theme;
}) {
  const providerColor = getProviderColor(message.model, theme.palette.mode);
  return (
    <BaseMessage side="left" color={providerColor}>
      <Typography
        variant="body2"
        sx={{
          mt: 1,
          color: 'white',
          borderRadius: '2em',
          p: 1,
          backgroundColor: 'rgba(0,0,0,0.1)',
          width: 'fit-content',
        }}
      >
        {message.model}
      </Typography>
      <EnhancedMarkdown content={message.content} showCopyButtons={true} />
    </BaseMessage>
  );
}

function ErrorMessage({ message }: { message: CorpusMessageError }) {
  return (
    <BaseMessage side="left" color="error.main">
      <EnhancedMarkdown content={message.error} showCopyButtons={true} />
    </BaseMessage>
  );
}

function RAGInfoMessage({
  message,
  processesCollapsed,
  resultsCollapsed,
  onToggleProcesses,
  onToggleResults,
}: {
  message: CorpusMessageRagInfo;
  processesCollapsed: boolean;
  resultsCollapsed: boolean;
  onToggleProcesses: () => void;
  onToggleResults: () => void;
}) {
  return (
    <BaseMessage side="left" color="secondary.main">
      <Box sx={{ pt: 1.5 }}>
        <CollapsibleFragmentList
          title="Process steps"
          collapsed={processesCollapsed}
          onToggle={onToggleProcesses}
        >
          {message.processes.map((process, idx) => (
            <ListItemText
              key={`${idx}-${process}`}
              primary={process}
              slotProps={{
                primary: {
                  variant: 'body2',
                  sx: { opacity: 0.95 },
                },
              }}
            />
          ))}
        </CollapsibleFragmentList>
      </Box>
      {message.searchResults !== undefined && (
        <Box sx={{ pt: 1 }}>
          {message.searchResults.length === 0 ? (
            <Typography variant="body2">No search results</Typography>
          ) : (
            <CollapsibleFragmentList
              title="Search results"
              collapsed={resultsCollapsed}
              onToggle={onToggleResults}
              collapsedVisibleCount={0}
            >
              {message.searchResults.map((result, idx) => (
                <Accordion
                  key={`${idx}-${result.documentId}`}
                  sx={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', width: '100%' }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ backgroundColor: 'action.hover' }}
                  >
                    <Typography variant="body2">
                      {result.documentMetadata.title} -{' '}
                      {result.chunkMetadata.chunk_index}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <EnhancedMarkdown content={result.content} />
                  </AccordionDetails>
                </Accordion>
              ))}
            </CollapsibleFragmentList>
          )}
        </Box>
      )}
    </BaseMessage>
  );
}

export default function CorpusConversationPanel() {
  const theme = useTheme();
  const { conversationId } = useParams();
  const { corpus, conversationInfo, sourceInfo, modelInfo } =
    useCorpusSessionContext();
  const conversation = useMemo(() => {
    return conversationInfo?.conversations.find(
      conversation => conversation.id === conversationId
    );
  }, [conversationInfo, conversationId]);

  const [streamingMessages, setStreamingMessages] = useState<CorpusMessage[]>(
    []
  );
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const isTouchscreenDevice = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const maxTouchPoints = window.navigator?.maxTouchPoints ?? 0;
    const coarsePointer =
      window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const hasTouchEvents = 'ontouchstart' in window;
    return maxTouchPoints > 0 || coarsePointer || hasTouchEvents;
  }, []);

  const [
    processesCollapsedByMessageIndex,
    setProcessesCollapsedByMessageIndex,
  ] = useState<Record<number, boolean>>({});
  const [resultsCollapsedByMessageIndex, setResultsCollapsedByMessageIndex] =
    useState<Record<number, boolean>>({});

  const handleSendMessage = useCallback(async () => {
    if (!conversation || !corpus || !sourceInfo || !modelInfo) {
      return;
    }
    if (!prompt.trim()) {
      return;
    }
    if (isStreamingRef.current) {
      return;
    }
    isStreamingRef.current = true;
    setIsStreaming(true);
    const promptMessage: CorpusMessageUser = {
      type: 'user',
      content: prompt,
      sentAt: new Date().toISOString(),
    };
    await conversationInfo?.addMessages(conversation, [promptMessage]);
    setPrompt('');

    const ragApiClient = createRagApiClient();
    const corpusLocation: CorpusLocation = {
      provider: 'fidu_rag',
      engine: 'cortexdb',
      database_file_location: {
        provider: 'google_drive',
        file_id: corpus.databaseLocation.fileId,
      },
    };
    const typeMap = {
      user: 'user' as const,
      model: 'assistant' as const,
    };
    const messages = conversation?.messages.reduce(
      (acc, msg) => [
        ...acc,
        ...(msg.type === 'user' || msg.type === 'model'
          ? [{ role: typeMap[msg.type], content: msg.content }]
          : []),
      ],
      [] as OpenRouterMessage[]
    );
    const si = sourceInfo;
    const sources = si.allSourcesSelected
      ? []
      : si.sources
          .filter(s => si.sourceSelection[si.sourceStringId(s)])
          .map(s => {
            switch (s.id.provider) {
              case 'google_drive':
                return {
                  provider: 'google_drive' as const,
                  file_id: s.id.fileId,
                };
              case 'fidu_context':
                return {
                  provider: 'fidu_context' as const,
                  provider_id: s.id.providerId,
                };
              case 'url':
                return {
                  provider: 'url' as const,
                  url: s.id.url,
                };
              default: {
                const _exhaustive: never = s.id;
                throw new Error(`Unknown source provider: ${_exhaustive}`);
              }
            }
          });
    const stream = ragApiClient.callChatCompletion(
      corpusLocation,
      {
        model: modelInfo.selectedModelId,
        messages: [...messages, { role: 'user', content: prompt }],
      },
      prompt,
      sources
    );

    const newMessages: CorpusMessage[] = [];
    const newMessagesById = new Map<string, CorpusMessage>();
    function getStepMessage(stepUuid: string): CorpusMessageRagInfo {
      let stepMessage = newMessagesById.get(stepUuid) as
        | CorpusMessageRagInfo
        | undefined;
      if (!stepMessage) {
        stepMessage = {
          type: 'rag-info',
          processes: [],
          searchResults: undefined,
        };
        newMessages.push(stepMessage);
        newMessagesById.set(stepUuid, stepMessage);
      }
      return stepMessage;
    }
    for await (const event of stream) {
      if ('source' in event && event.source === 'fidu_rag') {
        switch (event.type) {
          case 'starting_process': {
            const stepMessage = getStepMessage(event.step_uuid);
            stepMessage.processes = [
              ...stepMessage.processes,
              event.description,
            ];
            break;
          }
          case 'search_results': {
            const stepMessage = getStepMessage(event.step_uuid);
            stepMessage.searchResults = [
              ...(stepMessage.searchResults ?? []),
              ...event.search_results.map(r => ({
                documentId: r.doc_id,
                score: r.score,
                content: r.content,
                chunkMetadata: r.chunk_metadata,
                documentMetadata: r.document_metadata,
              })),
            ];
            break;
          }
          case 'error': {
            newMessages.push({
              type: 'error' as const,
              error: event.error,
            });
            break;
          }
        }
      } else {
        const chunk = event as OpenRouterStreamChunk;
        let chunkMessage = newMessagesById.get(chunk.id) as
          | CorpusMessageModel
          | undefined;
        if (!chunkMessage) {
          chunkMessage = {
            type: 'model',
            model: chunk.model,
            content: '',
            finishedAt: new Date().toISOString(),
          };
          newMessages.push(chunkMessage);
          newMessagesById.set(chunk.id, chunkMessage);
        }
        chunkMessage.content += chunk.choices[0].delta.content;
        chunkMessage.finishedAt = new Date().toISOString();
      }
      setStreamingMessages([...newMessages]);
    }

    await conversationInfo?.addMessages(conversation, [
      promptMessage,
      ...newMessages,
    ]);
    setStreamingMessages([]);
    setIsStreaming(false);
    isStreamingRef.current = false;
  }, [
    prompt,
    conversationInfo,
    conversation,
    corpus,
    setPrompt,
    sourceInfo,
    modelInfo,
  ]);

  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTouchscreenDevice) {
        return;
      }
      if (e.key !== 'Enter') {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      if ((e.nativeEvent as any)?.isComposing) {
        return;
      }
      if (!prompt.trim() || isStreaming || sourceInfo === undefined) {
        return;
      }
      e.preventDefault();
      handleSendMessage();
    },
    [handleSendMessage, isStreaming, isTouchscreenDevice, prompt, sourceInfo]
  );

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
      <Box
        sx={{
          flex: '1 1 0',
          minHeight: 0,
          minWidth: 0,
          overflowY: 'auto',
          p: 2,
          scrollbarWidth: 'thin',
          scrollbarColor: theme =>
            `${alpha(theme.palette.text.primary, 0.35)} ${theme.palette.background.paper}`,
        }}
      >
        {[...(conversation?.messages ?? []), ...streamingMessages].map(
          (message, i) => {
            switch (message.type) {
              case 'user':
                return <UserMessage key={i} message={message} />;
              case 'model':
                return <ModelMessage key={i} message={message} theme={theme} />;
              case 'rag-info':
                return (
                  <RAGInfoMessage
                    key={i}
                    message={message}
                    processesCollapsed={
                      processesCollapsedByMessageIndex[i] ?? true
                    }
                    resultsCollapsed={resultsCollapsedByMessageIndex[i] ?? true}
                    onToggleProcesses={() =>
                      setProcessesCollapsedByMessageIndex(prev => ({
                        ...prev,
                        [i]: !(prev[i] ?? true),
                      }))
                    }
                    onToggleResults={() =>
                      setResultsCollapsedByMessageIndex(prev => ({
                        ...prev,
                        [i]: !(prev[i] ?? true),
                      }))
                    }
                  />
                );
              case 'error':
                return <ErrorMessage key={i} message={message} />;
              default: {
                const _exhaustive: never = message;
                return _exhaustive;
              }
            }
          }
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexShrink: 0,
          width: '100%',
          px: 2,
          pb: 0,
        }}
      >
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Type your message..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          slotProps={{
            input: {
              onKeyDown: handlePromptKeyDown,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    disabled={
                      !prompt.trim() || isStreaming || sourceInfo === undefined
                    }
                    onClick={handleSendMessage}
                    sx={{
                      width: '40px',
                      minWidth: '20px',
                      height: '40px',
                      minHeight: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { backgroundColor: 'primary.dark' },
                    }}
                  >
                    <SendIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
    </Box>
  );
}
