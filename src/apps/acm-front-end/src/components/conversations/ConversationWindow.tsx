import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Drawer,
  TextField,
  Button
} from '@mui/material';
import {
  Close as CloseIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Send as SendIcon
} from '@mui/icons-material';

// Conversation input component with internal state management
const ConversationInput = ({ 
  onSendMessage, 
  isSendingFollowUp 
}: {
  onSendMessage: (message: string) => void;
  isSendingFollowUp: boolean;
}) => {
  const [localMessage, setLocalMessage] = React.useState('');

  const handleSend = () => {
    if (localMessage.trim() && !isSendingFollowUp) {
      onSendMessage(localMessage);
      setLocalMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Stack direction="row" spacing={1}>
      <TextField
        key="conversation-input-text-box"
        fullWidth
        multiline
        maxRows={4}
        placeholder="Type your follow-up message...."
        value={localMessage}
        onChange={(e) => setLocalMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={isSendingFollowUp}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2
          }
        }}
      />
      <Button
        variant="contained"
        onClick={handleSend}
        disabled={!localMessage.trim() || isSendingFollowUp}
        sx={{ 
          minWidth: 'auto',
          px: 2,
          borderRadius: 2
        }}
      >
        {isSendingFollowUp ? (
          <CircularProgress size={20} />
        ) : (
          <SendIcon />
        )}
      </Button>
    </Stack>
  );
};

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

interface ConversationWindowProps {
  open: boolean;
  onClose: () => void;
  messages: ConversationMessage[];
  selectedModel?: string;
  isSendingFollowUp: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
}

export const ConversationWindow: React.FC<ConversationWindowProps> = ({
  open,
  onClose,
  messages,
  selectedModel,
  isSendingFollowUp,
  error,
  onSendMessage
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 600, md: 700 },
          maxWidth: '100vw'
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          backgroundColor: 'background.paper'
        }}>
          <BotIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Conversation
          </Typography>
          <Chip 
            label={selectedModel || 'Model'} 
            size="small" 
            color="primary"
          />
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 2,
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
        }}>
          <Stack spacing={2}>
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    backgroundColor: message.role === 'user' 
                      ? 'primary.main' 
                      : 'background.paper',
                    color: message.role === 'user' 
                      ? 'primary.contrastText' 
                      : 'text.primary',
                    borderRadius: 2,
                    p: 2,
                    boxShadow: 1,
                    position: 'relative'
                  }}
                >
                  {/* Message Header */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 1,
                    opacity: 0.8
                  }}>
                    {message.role === 'user' ? (
                      <>
                        <UserIcon fontSize="small" />
                        <Typography variant="caption">You</Typography>
                      </>
                    ) : (
                      <>
                        <BotIcon fontSize="small" />
                        <Typography variant="caption">{message.model || 'Assistant'}</Typography>
                      </>
                    )}
                    <Typography variant="caption" sx={{ ml: 'auto' }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Box>

                  {/* Message Content */}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5
                    }}
                  >
                    {message.content}
                  </Typography>
                </Box>
              </Box>
            ))}

            {isSendingFollowUp && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Box sx={{ 
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  p: 2,
                  boxShadow: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BotIcon fontSize="small" />
                    <Typography variant="caption">{selectedModel || 'Assistant'}</Typography>
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Thinking...
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Error Display */}
        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">
              {error}
            </Alert>
          </Box>
        )}

        {/* Input Area */}
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}>
          <ConversationInput 
            onSendMessage={onSendMessage}
            isSendingFollowUp={isSendingFollowUp}
          />
        </Box>
      </Box>
    </Drawer>
  );
};
