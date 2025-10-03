import React, { useEffect, useRef } from 'react';
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
  Button,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Send as SendIcon,
  Minimize as MinimizeIcon
} from '@mui/icons-material';
import EnhancedMarkdown from '../common/EnhancedMarkdown';

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
  role: 'user' | 'assistant' | 'system';
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
  conversationId?: string;
  title?: string;
  onMinimize?: () => void;
}

export const ConversationWindow: React.FC<ConversationWindowProps> = ({
  open,
  onClose,
  messages,
  selectedModel,
  isSendingFollowUp,
  error,
  onSendMessage,
  conversationId,
  title,
  onMinimize
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages]);

  // Auto-scroll to bottom when follow-up is being sent
  useEffect(() => {
    if (isSendingFollowUp && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [isSendingFollowUp]);

  // Auto-scroll to bottom when new messages are added (for better UX)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100); // Small delay to ensure DOM is updated

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    }
  };

  const handleClose = () => {
    // Only close if explicitly requested (close button), otherwise minimize
    if (onMinimize) {
      onMinimize();
    } else {
      onClose();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
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
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {title || 'Conversation'}
            </Typography>
            {conversationId && (
              <Typography variant="caption" color="text.secondary" noWrap>
                ID: {conversationId.substring(0, 8)}...
              </Typography>
            )}
          </Box>
          <Chip 
            label={selectedModel || 'Model'} 
            size="small" 
            color="primary"
          />
          {onMinimize && (
            <Tooltip title="Minimize (Ctrl+M)">
              <IconButton onClick={handleMinimize} size="small">
                <MinimizeIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Close (Ctrl+W)">
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Messages */}
        <Box 
          ref={messagesContainerRef}
          sx={{ 
            flexGrow: 1, 
            overflow: 'auto', 
            p: 2,
            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
          }}
        >
          <Stack spacing={2}>
            {messages.map((message, index) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  animation: index === messages.length - 1 ? 'fadeInUp 0.3s ease-out' : 'none',
                  '@keyframes fadeInUp': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(10px)'
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)'
                    }
                  }
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
                  <EnhancedMarkdown 
                    content={message.content}
                    enableSyntaxHighlighting={true}
                    showCopyButtons={true}
                    preprocess={true}
                    sx={{
                      '& p': { margin: 0 },
                      '& h1, & h2, & h3, & h4, & h5, & h6': { marginTop: '4px', marginBottom: '4px' },
                    }}
                  />
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

            {/* Invisible element for auto-scrolling */}
            <div ref={messagesEndRef} />
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
