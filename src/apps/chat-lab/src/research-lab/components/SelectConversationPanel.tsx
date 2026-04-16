import { IconButton, Paper, Stack, Typography } from '@mui/material';
import { Add as AddConversationIcon } from '@mui/icons-material';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';

export default function SelectConversationPanel() {
  const { conversationInfo } = useCorpusSessionContext();
  const c =
    conversationInfo === undefined
      ? { loading: true as const }
      : { loading: false as const, ...conversationInfo };

  return (
    <Paper>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', m: 1 }}
      >
        <Typography variant="h6">Conversations</Typography>
        <IconButton disabled={c.loading}>
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
          {c.conversations.map(conversation => (
            <Paper key={conversation.id} sx={{ p: 1 }}>
              <Typography variant="body1">{conversation.name}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
