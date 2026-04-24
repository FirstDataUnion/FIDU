import {
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddConversationIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';
import { useCallback, useEffect, useMemo } from 'react';
import type { CorpusConversation } from '../types/local';
import { getStorageService } from '../../services/storage/StorageService';
import { useAppSelector } from '../../store';
import { useNavigate } from 'react-router-dom';
import { formatDate, toUrlId } from '../utils';

export default function SelectConversationPanel() {
  const navigate = useNavigate();
  const { conversationInfo, corpus, navigation } = useCorpusSessionContext();
  const { currentProfile } = useAppSelector(state => state.auth);

  useEffect(() => {
    navigation.clearActions();
    return () => {
      navigation.clearActions();
    };
  }, [navigation]);

  const c = useMemo(
    () =>
      conversationInfo === undefined
        ? { loading: true as const }
        : { loading: false as const, ...conversationInfo },
    [conversationInfo]
  );

  const handleAddConversation = useCallback(async () => {
    if (!corpus || !currentProfile || !conversationInfo) {
      return;
    }

    const uuid = crypto.randomUUID();
    const conversation: CorpusConversation = {
      id: uuid,
      name: 'Untitled Conversation',
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      messages: [],
    };

    const storageAdapter = getStorageService().getAdapter();
    await storageAdapter.createCorpusConversation(
      corpus.id,
      conversation,
      currentProfile.id
    );

    conversationInfo?.reloadConversations();

    navigate(
      `/research-lab/corpus/${toUrlId(corpus.id)}/conversations/${toUrlId(uuid)}`
    );
  }, [corpus, currentProfile, navigate, conversationInfo]);

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      if (!corpus || !conversationInfo) {
        return;
      }

      const storageAdapter = getStorageService().getAdapter();
      try {
        await storageAdapter.deleteCorpusConversation(conversationId);
        await conversationInfo.reloadConversations();
      } catch (error) {
        console.error('Error deleting corpus conversation:', error);
      }
    },
    [corpus, conversationInfo]
  );

  return (
    <Paper>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', m: 1 }}
      >
        <Typography variant="h6">Conversations</Typography>
        <IconButton disabled={c.loading} onClick={handleAddConversation}>
          <AddConversationIcon />
        </IconButton>
      </Stack>
      {c.loading ? (
        <Typography sx={{ p: 2 }}>Loading conversations...</Typography>
      ) : (
        <Stack direction="column" spacing={1} sx={{ p: 2 }}>
          {c.conversations.length === 0 && (
            <Typography>No conversations yet</Typography>
          )}
          <List>
            {c.conversations.map(conversation => (
              <Paper sx={{ width: '100%', mb: 2 }} key={conversation.id}>
                <ListItem
                  sx={{ width: '100%' }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="Delete conversation"
                      disabled={c.loading}
                      color="error"
                      onClick={() => {
                        void handleDeleteConversation(conversation.id);
                      }}
                      sx={{ borderRadius: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    sx={{ width: '100%', p: 1, borderRadius: 1 }}
                    onClick={() => {
                      if (!corpus?.id) {
                        return;
                      }
                      navigate(
                        `/research-lab/corpus/${toUrlId(corpus.id)}/conversations/${toUrlId(conversation.id)}`
                      );
                    }}
                  >
                    <Stack
                      direction="column"
                      justifyContent="space-between"
                      sx={{ width: '100%' }}
                    >
                      <Typography variant="body1">
                        {conversation.name}
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-around"
                        alignItems="center"
                        spacing={1}
                        sx={{ width: '100%', color: 'text.secondary' }}
                      >
                        <Typography variant="caption">
                          Created: {formatDate(conversation.createdAt)}
                        </Typography>
                        <Typography variant="caption">
                          Last opened: {formatDate(conversation.lastOpenedAt)}
                        </Typography>
                        <Typography variant="caption">
                          {conversation.messages.length} messages
                        </Typography>
                      </Stack>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              </Paper>
            ))}
          </List>
        </Stack>
      )}
    </Paper>
  );
}
