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
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
  Settings as SystemIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';
import type { Conversation } from '../../types';

interface ConversationViewerProps {
  conversation: Conversation;
}

const ConversationViewer: React.FC<ConversationViewerProps> = ({ conversation }) => {
  const { currentMessages, messagesLoading, error } = useAppSelector((state) => state.conversations);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <PersonIcon />;
      case 'assistant':
        return <BotIcon />;
      case 'system':
        return <SystemIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return '#1976d2';
      case 'assistant':
        return '#2e7d32';
      case 'system':
        return '#ed6c02';
      default:
        return '#666';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString('en-US', {
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
      {/* Conversation Header */}
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
          Created: {formatTimestamp(conversation.createdAt)} • 
          Updated: {formatTimestamp(conversation.updatedAt)}
        </Typography>
        {conversation.tags.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {conversation.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </Box>
        )}
      </Paper>

      {/* Messages Container */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        pr: 1,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#888',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#555',
        },
      }}>
        {currentMessages.map((message) => (
          <Paper
            key={message.id}
            elevation={1}
            sx={{
              mb: 2,
              p: 2,
              backgroundColor: message.role === 'user' ? '#f5f5f5' : '#ffffff',
              border: `1px solid ${message.role === 'user' ? '#e0e0e0' : '#f0f0f0'}`
            }}
          >
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Avatar 
                sx={{ 
                  bgcolor: getRoleColor(message.role),
                  width: 32,
                  height: 32
                }}
              >
                {getRoleIcon(message.role)}
              </Avatar>
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                    {message.role}
                  </Typography>
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
        ))}
      </Box>
    </Box>
  );
};

// Helper function for platform colors
const getPlatformColor = (platform: string) => {
  switch (platform) {
    case 'chatgpt': return '#00A67E';
    case 'claude': return '#FF6B35';
    case 'gemini': return '#4285F4';
    default: return '#666';
  }
};

export default ConversationViewer; 