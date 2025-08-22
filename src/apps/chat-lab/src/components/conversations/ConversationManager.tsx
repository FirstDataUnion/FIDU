import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  Fade,
  Paper,
  Typography
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material';
import { ConversationWindow } from './ConversationWindow';
import type { Conversation, Message } from '../../types';

interface ConversationTab {
  id: string;
  conversation: Conversation;
  messages: Message[];
  isMinimized: boolean;
  isActive: boolean;
  title: string;
  model: string;
  unreadCount: number;
}

interface ConversationManagerProps {
  conversations: ConversationTab[];
  onCloseConversation: (id: string) => void;
  onMinimizeConversation: (id: string) => void;
  onActivateConversation: (id: string) => void;
  onSendMessage: (conversationId: string, message: string) => void;
  isSendingFollowUp: boolean;
  error: string | null;
}

export const ConversationManager: React.FC<ConversationManagerProps> = ({
  conversations,
  onCloseConversation,
  onMinimizeConversation,
  onActivateConversation,
  onSendMessage,
  isSendingFollowUp,
  error
}) => {
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const activeConversation = conversations.find(tab => tab.isActive && !tab.isMinimized);
  const minimizedTabs = conversations.filter(tab => tab.isMinimized);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'w':
            e.preventDefault();
            if (activeConversation) {
              onCloseConversation(activeConversation.id);
            }
            break;
          case 'm':
            e.preventDefault();
            if (activeConversation) {
              onMinimizeConversation(activeConversation.id);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeConversation, onCloseConversation, onMinimizeConversation]);

  const handleTabClick = (tabId: string) => {
    if (expandedTab === tabId) {
      setExpandedTab(null);
    } else {
      setExpandedTab(tabId);
      onActivateConversation(tabId);
    }
  };

  const handleMinimize = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onMinimizeConversation(tabId);
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onCloseConversation(tabId);
  };

  return (
    <>
      {/* Minimized Conversation Tabs */}
      {minimizedTabs.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            gap: 1
          }}
        >
          {minimizedTabs.map((tab) => (
            <Tooltip
              key={tab.id}
              title={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {tab.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Model: {tab.model}
                  </Typography>
                  {tab.messages.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Last: {tab.messages[tab.messages.length - 1].content.substring(0, 50)}...
                    </Typography>
                  )}
                </Box>
              }
              placement="left"
              arrow
            >
              <Paper
                elevation={4}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  backgroundColor: 'background.paper',
                  border: '2px solid',
                  borderColor: tab.isActive ? 'primary.main' : 'divider',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.light',
                    '& .MuiSvgIcon-root': {
                      color: 'primary.contrastText'
                    },
                    '& .MuiTypography-root': {
                      color: 'primary.contrastText'
                    }
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
                onClick={() => handleTabClick(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <ChatIcon 
                  sx={{ 
                    fontSize: 24,
                    color: tab.isActive ? 'primary.main' : 'text.secondary'
                  }} 
                />
                
                {/* Unread Badge */}
                {tab.unreadCount > 0 && (
                  <Badge
                    badgeContent={tab.unreadCount}
                    color="error"
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      '& .MuiBadge-badge': {
                        fontSize: '0.75rem',
                        height: 20,
                        minWidth: 20
                      }
                    }}
                  />
                )}

                {/* Model indicator */}
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.6rem',
                    color: 'text.secondary',
                    mt: 0.5,
                    textAlign: 'center',
                    lineHeight: 1
                  }}
                >
                  {tab.model}
                </Typography>

                {/* Hover actions */}
                <Fade in={hoveredTab === tab.id}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      display: 'flex',
                      gap: 0.5
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => handleMinimize(e, tab.id)}
                      sx={{
                        width: 20,
                        height: 20,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText'
                        }
                      }}
                    >
                      <ExpandIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleClose(e, tab.id)}
                      sx={{
                        width: 20,
                        height: 20,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                          backgroundColor: 'error.main',
                          color: 'error.contrastText'
                        }
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                </Fade>
              </Paper>
            </Tooltip>
          ))}
        </Box>
      )}

      {/* Active Conversation Window */}
      {activeConversation && (
        <ConversationWindow
          open={true}
          onClose={() => onCloseConversation(activeConversation.id)}
          messages={activeConversation.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString(),
              model: msg.platform
            }))}
          selectedModel={activeConversation.model}
          isSendingFollowUp={isSendingFollowUp}
          error={error}
          onSendMessage={(message) => onSendMessage(activeConversation.id, message)}
          conversationId={activeConversation.id}
          title={activeConversation.title}
          onMinimize={() => onMinimizeConversation(activeConversation.id)}
        />
      )}
    </>
  );
};
