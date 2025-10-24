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
  Tooltip,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Send as SendIcon,
  Minimize as MinimizeIcon,
  ContentCopy as CopyIcon,
  AutoFixHigh as WizardIcon,
  Clear as ClearIcon,
  Add as AddIcon
} from '@mui/icons-material';
import EnhancedMarkdown from '../common/EnhancedMarkdown';
import type { WizardWindowProps, WizardMessage } from '../../types/wizard';

// Wizard input component with internal state management
const WizardInput = ({ 
  onSendMessage, 
  isSendingMessage,
  initialMessage = '',
  messages = []
}: {
  onSendMessage: (message: string) => void;
  isSendingMessage: boolean;
  initialMessage?: string;
  messages?: WizardMessage[];
}) => {
  const [localMessage, setLocalMessage] = React.useState(initialMessage);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textFieldRef = React.useRef<HTMLDivElement>(null);

  // Update local message when initialMessage changes (only for new conversations)
  React.useEffect(() => {
    // Only update if there are no existing messages (fresh conversation)
    if (messages.length === 0 && initialMessage) {
      setLocalMessage(initialMessage);
    }
  }, [initialMessage, messages.length]);

  // Focus helper function that tries multiple approaches
  const focusInput = () => {
    // Try focusing the TextField's input element directly
    if (textFieldRef.current) {
      const inputElement = textFieldRef.current.querySelector('textarea') as HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
        return;
      }
    }
    
    // Fallback to ref
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Maintain focus after sending message
  React.useEffect(() => {
    if (!isSendingMessage) {
      setTimeout(focusInput, 200);
    }
  }, [isSendingMessage]);

  // Focus input when component mounts (wizard opens)
  React.useEffect(() => {
    setTimeout(focusInput, 400);
  }, []);

  // Additional focus restoration when messages change (AI responds)
  React.useEffect(() => {
    if (!isSendingMessage) {
      setTimeout(focusInput, 300);
    }
  }, [messages.length, isSendingMessage]);

  const handleSend = () => {
    if (localMessage.trim() && !isSendingMessage) {
      onSendMessage(localMessage);
      setLocalMessage('');
      // Ensure focus is maintained after sending
      setTimeout(focusInput, 50);
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
        key="wizard-input-text-box"
        ref={textFieldRef}
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={4}
        placeholder="Type your response..."
        value={localMessage}
        onChange={(e) => setLocalMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={isSendingMessage}
        autoFocus={false}
        onClick={focusInput}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2
          }
        }}
      />
      <Button
        variant="contained"
        onClick={handleSend}
        disabled={!localMessage.trim() || isSendingMessage}
        sx={{ 
          minWidth: 'auto',
          px: 2,
          borderRadius: 2,
          backgroundColor: 'secondary.main',
          '&:hover': {
            backgroundColor: 'secondary.dark'
          }
        }}
      >
        {isSendingMessage ? (
          <CircularProgress size={20} />
        ) : (
          <SendIcon />
        )}
      </Button>
    </Stack>
  );
};

export const WizardWindow: React.FC<WizardWindowProps> = ({
  open,
  onClose,
  onMinimize,
  title,
  messages,
  isLoading,
  error,
  onSendMessage,
  onCopyResult,
  onClearConversation,
  initialMessage = '',
  modelName = 'GPT-OSS 120B',
  onAddSystemPrompt,
  systemPrompts = [],
  showCopyButton = true,
  icon
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

  // Auto-scroll to bottom when loading
  useEffect(() => {
    if (isLoading && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [isLoading]);

  const handleMinimize = () => {
    onMinimize();
  };

  const handleClose = () => {
    // When clicking outside, minimize instead of closing completely
    onMinimize();
  };

  // Extract the final assistant message for copying
  const getLastAssistantMessage = (): string | null => {
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant');
    return lastAssistantMessage?.content || null;
  };

  // Extract the final prompt from the latest assistant message
  const getFinalPrompt = (): string | null => {
    const lastAssistantMessage = getLastAssistantMessage();
    if (!lastAssistantMessage) return null;

    // Look for the FINAL_PROMPT tag pattern
    const finalPromptRegex = /<!-- FINAL_PROMPT -->\s*```[\s\S]*?```\s*<!-- \/FINAL_PROMPT -->/g;
    const matches = lastAssistantMessage.match(finalPromptRegex);
    
    if (!matches || matches.length === 0) return null;
    
    // Get the latest match (last occurrence)
    const latestMatch = matches[matches.length - 1];
    
    // Extract content between the tags and code block
    const contentMatch = latestMatch.match(/<!-- FINAL_PROMPT -->\s*```\s*([\s\S]*?)\s*```\s*<!-- \/FINAL_PROMPT -->/);
    
    return contentMatch ? contentMatch[1].trim() : null;
  };

  // Check if a message contains a final prompt
  const messageHasFinalPrompt = (message: WizardMessage): boolean => {
    const finalPromptRegex = /<!-- FINAL_PROMPT -->\s*```[\s\S]*?```\s*<!-- \/FINAL_PROMPT -->/g;
    return finalPromptRegex.test(message.content);
  };

  // Extract final prompt from a specific message
  const extractFinalPromptFromMessage = (message: WizardMessage): string | null => {
    const finalPromptRegex = /<!-- FINAL_PROMPT -->\s*```\s*([\s\S]*?)\s*```\s*<!-- \/FINAL_PROMPT -->/g;
    const match = message.content.match(finalPromptRegex);
    
    if (!match) return null;
    
    // Get the latest match (last occurrence)
    const latestMatch = match[match.length - 1];
    const contentMatch = latestMatch.match(/<!-- FINAL_PROMPT -->\s*```\s*([\s\S]*?)\s*```\s*<!-- \/FINAL_PROMPT -->/);
    
    return contentMatch ? contentMatch[1].trim() : null;
  };

  // Helper function to extract system prompt IDs from librarian responses
  const extractSystemPromptIdsFromContent = (content: string): string[] => {
    // Look for special tags like [PROMPT_ID:fabric-analyze_answers]
    const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;
    const matches = [];
    let match;
    
    while ((match = promptIdRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    // Remove duplicates by converting to Set and back to array
    const uniqueMatches = [...new Set(matches)];
    
    // Debug logging to see what we're detecting
    console.log('=== PROMPT_ID Detection Debug ===');
    console.log('Message content length:', content.length);
    console.log('Looking for PROMPT_ID tags in:', content.substring(0, 200) + '...');
    console.log('Found matches:', matches);
    console.log('Unique matches:', uniqueMatches);
    console.log('Regex pattern:', promptIdRegex);
    
    return uniqueMatches;
  };

  // Helper function to get system prompt by ID
  const getSystemPromptById = (id: string): any => {
    return systemPrompts.find((sp: any) => sp.id === id) || null;
  };

  // Helper function to clean message content by removing PROMPT_ID tags
  const cleanMessageContent = (content: string): string => {
    // Remove [PROMPT_ID:...] tags from the content for display
    // Use a more specific regex that only matches the exact tag format
    const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');
    
    // Debug logging for cleaning
    console.log('=== Message Cleaning Debug ===');
    console.log('Original content length:', content.length);
    console.log('Cleaned content length:', cleaned.length);
    console.log('Original (first 200 chars):', content.substring(0, 200));
    console.log('Cleaned (first 200 chars):', cleaned.substring(0, 200));
    
    return cleaned;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 500, md: 600 },
          maxWidth: '100vw',
          backgroundColor: 'rgba(147, 112, 219, 0.05)', // Light purple background
          backdropFilter: 'blur(10px)'
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
          backgroundColor: 'background.paper',
          background: 'linear-gradient(135deg, rgba(147, 112, 219, 0.1) 0%, rgba(147, 112, 219, 0.05) 100%)'
        }}>
          {icon || <WizardIcon color="secondary" />}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Interactive Prompt Assistant
            </Typography>
          </Box>
          <Chip 
            label={modelName} 
            size="small" 
            color="secondary"
            sx={{ backgroundColor: 'secondary.light', color: 'secondary.contrastText' }}
          />
          {showCopyButton && getFinalPrompt() && (
            <Tooltip title="Copy final prompt to chat">
              <IconButton 
                onClick={() => onCopyResult(getFinalPrompt()!)}
                size="small"
                sx={{
                  backgroundColor: 'secondary.light',
                  color: 'secondary.contrastText',
                  '&:hover': {
                    backgroundColor: 'secondary.main'
                  }
                }}
              >
                <CopyIcon />
              </IconButton>
            </Tooltip>
          )}
          {showCopyButton && !getFinalPrompt() && messages.some(msg => msg.role === 'assistant') && (
            <Tooltip title="Final prompt not ready yet - continue the conversation">
              <IconButton 
                disabled
                size="small"
                sx={{
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled',
                  opacity: 0.5
                }}
              >
                <CopyIcon />
              </IconButton>
            </Tooltip>
          )}
          {onClearConversation && messages.length > 0 && (
            <Tooltip title="Clear conversation">
              <IconButton 
                onClick={onClearConversation}
                size="small"
                sx={{
                  backgroundColor: 'error.light',
                  color: 'error.contrastText',
                  '&:hover': {
                    backgroundColor: 'error.main'
                  }
                }}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Minimize">
            <IconButton onClick={handleMinimize} size="small">
              <MinimizeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
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
              <Box key={message.id}>
                <Box
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
                  <Paper
                    sx={{
                      maxWidth: '80%',
                      backgroundColor: message.role === 'user' 
                        ? 'secondary.main' 
                        : 'background.paper',
                      color: message.role === 'user' 
                        ? 'secondary.contrastText' 
                        : 'text.primary',
                      borderRadius: 2,
                      p: 2,
                      boxShadow: 2,
                      position: 'relative',
                      border: message.role === 'assistant' ? '1px solid rgba(147, 112, 219, 0.2)' : 'none'
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
                          <Typography variant="caption">{modelName}</Typography>
                        </>
                      )}
                      <Typography variant="caption" sx={{ ml: 'auto' }}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>

                    {/* Message Content */}
                    <EnhancedMarkdown 
                      content={cleanMessageContent(message.content)}
                      enableSyntaxHighlighting={true}
                      showCopyButtons={true}
                      preprocess={true}
                      sx={{
                        '& h1, & h2, & h3, & h4, & h5, & h6': { marginTop: '4px', marginBottom: '4px' },
                      }}
                    />
                  </Paper>
                </Box>

                {/* System Prompt Add Buttons - appears below messages with detected system prompt IDs */}
                {message.role === 'assistant' && onAddSystemPrompt && extractSystemPromptIdsFromContent(message.content).length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    flexWrap: 'wrap',
                    gap: 1,
                    mb: 2,
                    animation: 'fadeInUp 0.3s ease-out',
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
                  }}>
                    {extractSystemPromptIdsFromContent(message.content).map((promptId) => {
                      const systemPrompt = getSystemPromptById(promptId);
                      if (!systemPrompt) return null;
                      
                      return (
                        <Button
                          key={promptId}
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => onAddSystemPrompt(promptId)}
                          sx={{
                            borderColor: 'secondary.main',
                            color: 'secondary.main',
                            borderRadius: 2,
                            px: 2,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': {
                              backgroundColor: 'secondary.light',
                              borderColor: 'secondary.dark',
                              color: 'secondary.dark'
                            }
                          }}
                        >
                          Add "{systemPrompt.name}"
                        </Button>
                      );
                    })}
                  </Box>
                )}

                {/* Copy Prompt Button - appears below messages with final prompts */}
                {message.role === 'assistant' && messageHasFinalPrompt(message) && (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    mb: 2,
                    animation: 'fadeInUp 0.3s ease-out',
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
                  }}>
                    <Button
                      variant="contained"
                      startIcon={<CopyIcon />}
                      onClick={() => {
                        const prompt = extractFinalPromptFromMessage(message);
                        if (prompt) {
                          onCopyResult(prompt);
                        }
                      }}
                      sx={{
                        backgroundColor: 'secondary.main',
                        color: 'secondary.contrastText',
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        boxShadow: 2,
                        '&:hover': {
                          backgroundColor: 'secondary.dark',
                          boxShadow: 4,
                          transform: 'translateY(-1px)'
                        },
                        '&:active': {
                          transform: 'translateY(0)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Copy Prompt to Chat
                    </Button>
                  </Box>
                )}
              </Box>
            ))}

            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper sx={{ 
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  p: 2,
                  boxShadow: 1,
                  border: '1px solid rgba(147, 112, 219, 0.2)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BotIcon fontSize="small" />
                    <Typography variant="caption">{modelName}</Typography>
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Thinking...
                  </Typography>
                </Paper>
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
          <WizardInput 
            onSendMessage={onSendMessage}
            isSendingMessage={isLoading}
            initialMessage={initialMessage}
            messages={messages}
          />
        </Box>
      </Box>
    </Drawer>
  );
};
