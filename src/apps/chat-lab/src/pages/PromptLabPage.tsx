import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Send as SendIcon,
  Add as AddIcon,
  Chat as ChatIcon,
  SmartToy as ModelIcon,
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  ChatBubbleOutline as ChatBubbleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate } from 'react-router-dom';
import { fetchContexts } from '../store/slices/contextsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import { conversationsApi } from '../services/api/conversations';
import type { Conversation, Message, Context, SystemPrompt } from '../types';

// Modal Components
interface ModelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectModel: (model: string) => void;
  selectedModel: string;
}

function ModelSelectionModal({ open, onClose, onSelectModel, selectedModel }: ModelSelectionModalProps) {
  const models = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
    { id: 'gemini-ultra', name: 'Gemini Ultra', provider: 'Google' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Target Model</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {models.map((model) => (
            <ListItemButton
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              selected={selectedModel === model.id}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon>
                <ModelIcon />
              </ListItemIcon>
              <ListItemText
                primary={model.name}
                secondary={model.provider}
              />
            </ListItemButton>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

interface ContextSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectContext: (context: Context) => void;
  contexts: Context[];
  loading: boolean;
  error: string | null;
}

function ContextSelectionModal({ open, onClose, onSelectContext, contexts, loading, error }: ContextSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContexts = contexts.filter(context => 
    context.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    context.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select Context</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth
            placeholder="Search contexts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {!loading && !error && filteredContexts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery ? 'No contexts match your search' : 'No contexts available'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredContexts.length > 0 && (
            <List>
              {filteredContexts.map((context) => (
                <ListItem key={context.id} divider>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body1" component="div" sx={{ fontWeight: 500, mb: 1 }}>
                      {context.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {context.body.length > 150 
                        ? `${context.body.substring(0, 150)}...` 
                        : context.body
                      }
                    </Typography>
                      <Chip 
                        label={`${context.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onSelectContext(context)}
                    >
                      Select
                    </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

interface SystemPromptSelectionModalProps {
  open: boolean; 
  onClose: () => void; 
  onSelectSystemPrompt: (systemPrompt: SystemPrompt) => void;
  systemPrompts: SystemPrompt[];
  loading: boolean;
  error: string | null;
}

function SystemPromptSelectionModal({ open, onClose, onSelectSystemPrompt, systemPrompts, loading, error }: SystemPromptSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSystemPrompts = systemPrompts.filter(sp => 
    sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sp.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select System Prompt</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth
            placeholder="Search system prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {!loading && !error && filteredSystemPrompts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery ? 'No system prompts match your search' : 'No system prompts available'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredSystemPrompts.length > 0 && (
            <List>
              {filteredSystemPrompts.map((systemPrompt) => (
                <ListItem key={systemPrompt.id} divider>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                        {systemPrompt.name}
                      </Typography>
                      {systemPrompt.isDefault && (
                        <Chip label="Default" size="small" color="primary" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {systemPrompt.description}
                    </Typography>
                      <Chip 
                        label={`${systemPrompt.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onSelectSystemPrompt(systemPrompt)}
                    >
                      Select
                    </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PromptLabPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: contexts, loading: contextsLoading, error: contextsError } = useAppSelector((state) => state.contexts);
  const { items: systemPrompts, loading: systemPromptsLoading, error: systemPromptsError } = useAppSelector((state) => state.systemPrompts);

  // State for the chat interface
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<SystemPrompt | null>(null);
  const [embellishments, setEmbellishments] = useState<string[]>([]);

  // State for the right sidebar
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Modal states
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);

  // Load contexts and system prompts
  useEffect(() => {
    if (currentProfile) {
      dispatch(fetchContexts(currentProfile.id));
      dispatch(fetchSystemPrompts(currentProfile.id));
    }
  }, [currentProfile, dispatch]);

  // Set default system prompt when loaded
  useEffect(() => {
    if (systemPrompts.length > 0 && !selectedSystemPrompt) {
      const defaultPrompt = systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompt(defaultPrompt);
      }
    }
  }, [systemPrompts, selectedSystemPrompt]);

  // Load recent conversations
  const loadRecentConversations = useCallback(async () => {
    if (!currentProfile) return;
    
    setLoadingConversations(true);
    try {
      const response = await conversationsApi.getAll({}, 1, 5, currentProfile.id);
      setRecentConversations(response.conversations);
    } catch (error) {
      console.error('Error loading recent conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, [currentProfile]);

  useEffect(() => {
    loadRecentConversations();
  }, [loadRecentConversations]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel || !selectedSystemPrompt) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      conversationId: 'current',
      content: currentMessage,
      role: 'user',
      timestamp: new Date().toISOString(),
      platform: selectedModel,
      isEdited: false
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');

    // TODO: Implement actual AI response logic
    // For now, just add a placeholder response
    setTimeout(() => {
      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        conversationId: 'current',
        content: 'This is a placeholder response. The actual AI integration will be implemented later.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel,
        isEdited: false
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      const messages = await conversationsApi.getMessages(conversation.id);
      setMessages(messages);
      // TODO: Update the current conversation context
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  };

  // Handle adding embellishment
  const handleAddEmbellishment = () => {
    const newEmbellishment = prompt('Enter embellishment:');
    if (newEmbellishment && newEmbellishment.trim()) {
      setEmbellishments(prev => [...prev, newEmbellishment.trim()]);
    }
  };

  // Handle removing embellishment
  const handleRemoveEmbellishment = (index: number) => {
    setEmbellishments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden', 
        position: 'relative',
        pb: 0 // No bottom padding needed since prompt bar is fixed
      }}>
        {/* Messages Container */}
        <Box sx={{ 
          height: '100%', 
          overflowY: 'auto', 
          p: 3,
          pb: 32, // Add bottom padding to account for fixed prompt bar height
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          {messages.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}>
              <ChatIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h5" sx={{ mb: 1, opacity: 0.7 }}>
                FIDU CHAT LAB
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.5 }}>
                Start a conversation by typing a message below
              </Typography>
            </Box>
          ) : (
            messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '70%',
                    backgroundColor: message.role === 'user' ? 'primary.main' : 'grey.100',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: 2,
                    position: 'relative'
                  }}
                >
                  {message.role === 'assistant' && (
                    <Avatar sx={{ 
                      width: 24, 
                      height: 24, 
                      position: 'absolute', 
                      top: -12, 
                      left: -12,
                      bgcolor: 'primary.main'
                    }}>
                      <ModelIcon fontSize="small" />
                    </Avatar>
                  )}
                  <Typography variant="body1">
                    {message.content}
                  </Typography>
                </Paper>
              </Box>
            ))
          )}
        </Box>
      </Box>

                        {/* Fixed Bottom Prompt Bar */}
        <Box sx={{ 
          position: 'fixed',
          bottom: 0,
          left: 240, // Account for sidebar width
          right: 0,
          backgroundColor: 'background.default',
          p: 3,
          zIndex: 1000
        }}>
          {/* Container to center content within chat window */}
          <Box sx={{ 
            maxWidth: 800,
            mx: 'auto',
            px: 2
          }}>
            {/* Dropdown Controls */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                size="medium"
                onClick={() => setModelModalOpen(true)}
                sx={{ 
                  minWidth: 200,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': {
                    boxShadow: 2
                  }
                }}
              >
                {selectedModel || 'Select Target Model ▾'}
              </Button>
              
              <Button
                variant="outlined"
                size="medium"
                onClick={() => setContextModalOpen(true)}
                sx={{ 
                  minWidth: 150,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': {
                    boxShadow: 2
                  }
                }}
              >
                Context: {selectedContext?.title || 'None'}
              </Button>
              
              <Button
                variant="outlined"
                size="medium"
                onClick={() => setSystemPromptModalOpen(true)}
                sx={{ 
                  minWidth: 180,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': {
                    boxShadow: 2
                  }
                }}
              >
                System Prompt: {selectedSystemPrompt?.name || 'Default'}
              </Button>
            </Box>

            {/* Message Input Container */}
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'flex-end',
              maxWidth: 800,
              mx: 'auto'
            }}>
              <TextField
                fullWidth
                multiline
                rows={1}
                placeholder="Type your message..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'background.paper',
                    boxShadow: 1
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ChatIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleSendMessage}
                disabled={!currentMessage.trim()}
                sx={{ 
                  minWidth: 56, 
                  height: 56, 
                  borderRadius: '50%',
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
              >
                <SendIcon />
              </Button>
            </Box>

            {/* Embellishments Bar */}
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              justifyContent: 'center'
            }}>
              <Paper
                onClick={handleAddEmbellishment}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  backgroundColor: 'grey.900',
                  color: 'white',
                  minWidth: 200,
                  boxShadow: 1,
                  '&:hover': {
                    backgroundColor: 'grey.800',
                    boxShadow: 2
                  }
                }}
              >
                <AddIcon sx={{ color: 'white' }} />
                <Typography variant="body2" sx={{ color: 'white' }}>
                  Add Embellishments
                </Typography>
              </Paper>
            </Box>

            {/* Active Embellishments */}
            {embellishments.length > 0 && (
              <Box sx={{ 
                mt: 1, 
                display: 'flex', 
                gap: 1, 
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                {embellishments.map((embellishment, index) => (
                  <Chip 
                    key={index}
                    label={embellishment}
                    onDelete={() => handleRemoveEmbellishment(index)}
                    color="primary"
                    variant="filled"
                    size="small" 
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

            {/* Right Sidebar - Recent Conversations */}
      <Drawer
        anchor="right"
        open={conversationsDrawerOpen}
        onClose={() => setConversationsDrawerOpen(false)}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
            borderLeft: 1,
            borderColor: 'divider',
            backgroundColor: 'rgba(147, 112, 219, 0.1)', // Light purple background
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2, 
              color: 'primary.main',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            Recent Conversations:
          </Typography>
          
          {loadingConversations ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <List sx={{ flex: 1 }}>
                {recentConversations.map((conversation) => (
                  <ListItem key={conversation.id} disablePadding>
                    <ListItemButton 
                      onClick={() => handleSelectConversation(conversation)}
                      sx={{ 
                        borderRadius: 2,
                        mb: 1,
                        border: 1,
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                        '&:hover': {
                          backgroundColor: 'rgba(147, 112, 219, 0.1)',
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500,
                              lineHeight: 1.3,
                              mb: 0.5
                            }}
                          >
                            {conversation.title}
                          </Typography>
                        }
                        secondary={
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {conversation.lastMessage || 'No messages'}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              
              {/* View All Button */}
              <Box sx={{ mt: 'auto', pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/conversations')}
                  sx={{
                    borderRadius: 2,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText'
                    }
                  }}
                >
                  View All
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* Chat History Tab */}
      <Box
        onClick={() => setConversationsDrawerOpen(!conversationsDrawerOpen)}
        sx={{
          position: 'fixed',
          right: conversationsDrawerOpen ? 300 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          cursor: 'pointer',
          transition: 'right 0.3s ease'
        }}
      >
        <Paper
          elevation={3}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1.5,
            borderRadius: '8px 0 0 8px',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: 2,
            '&:hover': {
              backgroundColor: 'primary.dark',
              boxShadow: 4
            }
          }}
        >
          <ChevronLeftIcon 
            sx={{ 
              fontSize: 18,
              transform: conversationsDrawerOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.3s ease'
            }} 
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ChatBubbleIcon sx={{ fontSize: 20 }} />
            <RefreshIcon sx={{ fontSize: 16, opacity: 0.8 }} />
          </Box>
        </Paper>
      </Box>

      {/* Modals */}
      <ModelSelectionModal
        open={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelectModel={(model) => {
          setSelectedModel(model);
          setModelModalOpen(false);
        }}
        selectedModel={selectedModel}
      />

      <ContextSelectionModal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        onSelectContext={(context) => {
          setSelectedContext(context);
          setContextModalOpen(false);
        }}
        contexts={contexts}
        loading={contextsLoading}
        error={contextsError}
      />

      <SystemPromptSelectionModal
        open={systemPromptModalOpen}
        onClose={() => setSystemPromptModalOpen(false)}
        onSelectSystemPrompt={(systemPrompt) => {
          setSelectedSystemPrompt(systemPrompt);
          setSystemPromptModalOpen(false);
        }}
        systemPrompts={systemPrompts}
        loading={systemPromptsLoading}
        error={systemPromptsError}
      />
    </Box>
  );
} 