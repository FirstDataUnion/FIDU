import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
  Settings as SystemIcon,
  ContentCopy as CopyIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/redux';
import type { Conversation } from '../../types';
import { getPlatformColor } from '../../utils/conversationUtils';

interface ConversationViewerProps {
  conversation: Conversation;
}

const ConversationViewer: React.FC<ConversationViewerProps> = ({ conversation }) => {
  const navigate = useNavigate();
  const { currentMessages, messagesLoading, error } = useAppSelector((state) => state.conversations);



  const handleContinueConversation = () => {
    // Navigate to prompt lab page with the conversation loaded
    navigate('/prompt-lab', { 
      state: { 
        conversationId: conversation.id,
        conversation: conversation,
        loadConversation: true 
      }
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <PersonIcon />;
      case 'bot':
      case 'assistant':
        // Return platform-specific icons for assistant messages
        return <BotIcon />; // Use standard bot icon for all AI assistants
      case 'system':
        return <SystemIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string, platform: string) => {
    switch (role) {
      case 'user':
        return 'secondary.main';
      case 'bot':
      case 'assistant':
        // Return platform-specific colors for assistant messages
        if (platform) {
          return getPlatformColor(platform); // Use utility function for all platforms
        }
        return '#2e7d32'; // Fallback color
      case 'system':
        return '#ed6c02';
      default:
        return '#666';
    }
  };

  const getPlatformDisplayName = (platform: string) => {
    if (!platform) return '';
    
    const platformLower = platform.toLowerCase();
    switch (platformLower) {
      case 'gemini-flash':
      case 'gemini-pro':
        return 'Gemini';
      case 'chatgpt':
        return 'ChatGPT';
      case 'claude-haiku':
      case 'claude-sonnet':
      case 'claude-opus-41':
        return 'Claude';
      case 'gpt-4.0':
      case 'gpt-4.0-turbo':
      case 'gpt-4.0-mini':
        return 'GPT-4';
      case 'gpt-5.0':
      case 'gpt-5.0-mini':
      case 'gpt-5.0-nano':
        return 'GPT-5';
      case 'gpt-3.5-turbo':
        return 'GPT-3.5';
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (messagesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading conversation...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          <strong>Error loading conversation:</strong> {error}
        </Alert>
      </Box>
    );
  }

  if (!currentMessages.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <Typography variant="body1" color="text.secondary">
          No messages found in this conversation.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Scrollable Container - Everything scrolls together */}
      <Box sx={{ 
        height: '100%',
        overflow: 'auto',
        pr: 1,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: (theme) => theme.palette.mode === 'dark' ? '#424242' : '#f1f1f1',
        },
        '&::-webkit-scrollbar-thumb': {
          background: (theme) => theme.palette.mode === 'dark' ? '#666' : '#888',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: (theme) => theme.palette.mode === 'dark' ? '#888' : '#555',
        },
      }}>
        {/* Conversation Header - Scrolls naturally with content */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h5" component="h2">
              {conversation.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={conversation.platform.toUpperCase()}
                size="small"
                sx={{ 
                  backgroundColor: getPlatformColor(conversation.platform),
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
              <Chip
                label={`${currentMessages.length} messages`}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Created: {formatTimestamp(new Date(conversation.createdAt))} • 
            Updated: {formatTimestamp(new Date(conversation.updatedAt))}
          </Typography>
          {conversation.tags.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {conversation.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
              ))}
            </Box>
          )}
        </Paper>

        {/* Messages Container - No longer needs separate scrolling */}
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
        {currentMessages.map((message) => {
          // Get the platform for this specific message, fallback to conversation platform
          const messagePlatform = message.platform || conversation.platform;
          
          return (
            <Paper
              key={message.id}
              elevation={1}
              sx={{
                mb: 2,
                p: 2,
                backgroundColor: (theme) => 
                  message.role === 'user' 
                    ? theme.palette.mode === 'dark' 
                      ? theme.palette.grey[800] 
                      : theme.palette.grey[100]
                    : theme.palette.background.paper,
                border: (theme) => 
                  `1px solid ${
                    message.role === 'user' 
                      ? theme.palette.mode === 'dark' 
                        ? theme.palette.grey[700] 
                        : theme.palette.grey[300]
                      : theme.palette.mode === 'dark' 
                        ? theme.palette.grey[700] 
                        : theme.palette.grey[200]
                  }`
              }}
            >
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: getRoleColor(message.role, messagePlatform),
                    width: 32,
                    height: 32
                  }}
                >
                  {getRoleIcon(message.role)}
                </Avatar>
                
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {message.role}
                      </Typography>
                      
                      {/* Show platform chip for assistant messages */}
                      {message.role === 'assistant' && messagePlatform && (
                        <Chip
                          label={getPlatformDisplayName(messagePlatform)}
                          size="small"
                          sx={{ 
                            backgroundColor: getPlatformColor(messagePlatform),
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            height: '20px'
                          }}
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(message.timestamp)}
                      </Typography>
                      {message.isEdited && (
                        <Chip label="Edited" size="small" variant="outlined" />
                      )}
                      <Tooltip title="Copy message">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyMessage(message.content)}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.6
                    }}
                  >
                    {message.content}
                  </Typography>
                  
                  {/* Show attachments if any */}
                  {message.attachments && message.attachments.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Attachments:
                      </Typography>
                      {message.attachments.map((attachment) => (
                        <Chip
                          key={attachment.id}
                          label={attachment.name}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}
        </Box>

        {/* Continue Conversation Button - Fixed at bottom */}
        <Box sx={{ 
          position: 'sticky', 
          bottom: 0, 
          bgcolor: 'background.paper',
          borderTop: 1, 
          borderColor: 'divider',
          p: 2,
          mt: 2,
          zIndex: 1
        }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<ChatIcon />}
            onClick={handleContinueConversation}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark',
                transform: 'translateY(-1px)',
                boxShadow: 3
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Continue Conversation
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ConversationViewer; 