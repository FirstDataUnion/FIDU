import { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Send as SendIcon,
  Add as AddIcon,
  Chat as ChatIcon,
  SmartToy as ModelIcon,
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  ChatBubbleOutline as ChatBubbleIcon,
  Refresh as RefreshIcon,
  ExpandMore,
  MoreVert
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchContexts } from '../store/slices/contextsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import { fetchEmbellishments } from '../store/slices/embellishmentsSlice';
import { conversationsApi } from '../services/api/conversations';
import { promptsApi } from '../services/api/prompts';
import type { Conversation, Message, Context, SystemPrompt, Embellishment } from '../types';

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
    { id: 'gpt-4.0-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
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
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>Cancel</Button>
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
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>Cancel</Button>
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
    sp.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                      {systemPrompt.name}
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
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

interface FullPromptModalProps {
  open: boolean;
  onClose: () => void;
  fullPrompt: string;
}

function FullPromptModal({ open, onClose, fullPrompt }: FullPromptModalProps) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      // You could add a success toast here
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullPrompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, [fullPrompt]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Full Prompt</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          rows={10}
          variant="outlined"
          value={fullPrompt}
          InputProps={{
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <ChatIcon />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'background.paper',
              boxShadow: 1
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCopy} sx={{ color: 'primary.dark' }}>Copy</Button>
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Embellishment Selection Modal
interface EmbellishmentSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectEmbellishments: (embellishments: Embellishment[]) => void;
  selectedEmbellishments: Embellishment[];
  embellishments: Embellishment[];
  loading: boolean;
}

function EmbellishmentSelectionModal({ open, onClose, onSelectEmbellishments, selectedEmbellishments, embellishments, loading }: EmbellishmentSelectionModalProps) {
  // Map selected embellishment objects to their IDs
  const getSelectedIds = (): string[] => {
    return embellishments
      .filter((emb: Embellishment) => selectedEmbellishments.some((selected: Embellishment) => selected.id === emb.id))
      .map((emb: Embellishment) => emb.id);
  };

  const [selectedIds, setSelectedIds] = useState<string[]>(getSelectedIds());

  // Update selectedIds when selectedEmbellishments changes
  useEffect(() => {
    setSelectedIds(getSelectedIds());
  }, [selectedEmbellishments]);

  const handleToggleEmbellishment = (embellishmentId: string) => {
    setSelectedIds(prev => 
      prev.includes(embellishmentId) 
        ? prev.filter(id => id !== embellishmentId)
        : [...prev, embellishmentId]
    );
  };

  const handleConfirm = () => {
    // Filter from embellishments prop and ensure no duplicates
    const selectedEmbellishments: Embellishment[] = embellishments
      .filter((emb: Embellishment) => selectedIds.includes(emb.id));
    
    // Ensure no duplicates by using a Map
    const uniqueEmbellishments = Array.from(
      new Map(selectedEmbellishments.map(emb => [emb.id, emb])).values()
    );
    
    onSelectEmbellishments(uniqueEmbellishments);
    onClose();
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select Embellishments</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose embellishments to enhance your prompt. These will add specific instructions to make your AI responses more effective.
        </Typography>
        
        <Stack spacing={2} sx={{ mt: 1 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {embellishments.map((embellishment) => (
            <ListItemButton
              key={embellishment.id}
              onClick={() => handleToggleEmbellishment(embellishment.id)}
              selected={selectedIds.includes(embellishment.id)}
              sx={{
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon>
                <Box sx={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  backgroundColor: selectedIds.includes(embellishment.id) ? 'primary.contrastText' : 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {selectedIds.includes(embellishment.id) && (
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      ✓
                    </Typography>
                  )}
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={embellishment.name}
                secondary={
                  <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    "{embellishment.instructions}"
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearAll} sx={{ color: 'error.main' }}>Clear All</Button>
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>Cancel</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained"
        >
          {selectedEmbellishments.length === 0 ? 'Add Selected' : 'Update Selection'} ({selectedIds.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PromptLabPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redux state
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: contexts, loading: contextsLoading, error: contextsError } = useAppSelector((state) => state.contexts);
  const { items: systemPrompts, loading: systemPromptsLoading, error: systemPromptsError } = useAppSelector((state) => state.systemPrompts);
  const { items: allEmbellishments, loading: embellishmentsLoading } = useAppSelector((state) => state.embellishments);

  // State for the chat interface
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<SystemPrompt | null>(null);
  const [embellishments, setEmbellishments] = useState<Embellishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Check if user has scrolled up
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledUp = scrollTop + clientHeight < scrollHeight - 100; // Show button if scrolled up more than 100px
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // Consider at bottom if within 10px
      
      setShowScrollToBottom(isScrolledUp);
      setIsAtBottom(atBottom);
    }
  }, []);

  useEffect(() => {
    // Only auto-scroll if user is already at the bottom
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isAtBottom]);

  // Get model-specific colors and display names
  const getModelInfo = (modelId: string) => {
    const modelMap: Record<string, { name: string; color: string; provider: string }> = {
      'gpt-4o': { name: 'GPT-4o', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4.0-turbo': { name: 'GPT-4 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'claude-3-opus': { name: 'Claude 3 Opus', color: '#C46902', provider: 'Anthropic' },
      'claude-3-sonnet': { name: 'Claude 3 Sonnet', color: '#C46902', provider: 'Anthropic' },
      'claude-3-haiku': { name: 'Claude 3 Haiku', color: '#C46902', provider: 'Anthropic' },
      'gemini': {name: 'Gemini', color: '#4285F4', provider: 'Google'},
      'gemini-2.0-flash': {name: 'Gemini 2.0 Flash', color: '#4285F4', provider: 'Google'},
      'gemini-2.0-flash-lite': {name: 'Gemini 2.0 Flash Lite', color: '#4285F4', provider: 'Google'},
      'gemini-2.5-flash': {name: 'Gemini 2.5 Flash', color: '#4285F4', provider: 'Google'},
      'gemini-2.5-flash-lite': {name: 'Gemini 2.5 Flash Lite', color: '#4285F4', provider: 'Google'},
      'gemini-2.5-pro': {name: 'Gemini 2.5 Pro', color: '#4285F4', provider: 'Google'},
      'gemini-2.5-pro-exp': {name: 'Gemini 2.5 Pro Exp', color: '#4285F4', provider: 'Google'},
    };

    // If modelId is missing or unknown, fall back to primary colors
    if (!modelId || modelId === 'unknown' || modelId === 'other') {
      return { 
        name: 'AI Assistant', 
        color: 'primary.dark', 
        provider: 'Unknown' 
      };
    }

    return modelMap[modelId] || { 
      name: modelId, 
      color: 'primary.dark', // Fallback to primary color for unknown models
      provider: 'Unknown' 
    };
  };

  // State for the right sidebar
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Conversation state
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);

  // Modal states
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
  const [fullPromptModalOpen, setFullPromptModalOpen] = useState(false);
  const [embellishmentModalOpen, setEmbellishmentModalOpen] = useState(false);

  // Menu state for contextual menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Load contexts and system prompts
  useEffect(() => {
    if (currentProfile) {
      dispatch(fetchContexts(currentProfile.id));
      dispatch(fetchSystemPrompts(currentProfile.id));
      dispatch(fetchEmbellishments(currentProfile.id));
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

  // Handle conversation loading when navigating from conversations page
  useEffect(() => {
    if (location.state?.loadConversation && location.state?.conversationId) {
      const loadConversationFromState = async () => {
        try {
          const conversationId = location.state.conversationId;
          // Get messages for the conversation
          const messages = await conversationsApi.getMessages(conversationId);
          
          // Use the complete conversation object from navigation state
          if (location.state.conversation) {
            setCurrentConversation(location.state.conversation);
            setMessages(messages);
            
            // Clear the navigation state to prevent reloading on subsequent renders
            navigate('/prompt-lab', { replace: true });
          } else {
            // Fallback: create a minimal conversation object
            const conversation: Conversation = {
              id: conversationId,
              title: location.state.conversationTitle || 'Conversation',
              platform: location.state.platform || 'other',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessage: messages.length > 0 ? messages[messages.length - 1].content : '',
              messageCount: messages.length,
              tags: location.state.tags || [],
              isArchived: false,
              isFavorite: false,
              participants: [],
              status: 'active'
            };
            
            setCurrentConversation(conversation);
            setMessages(messages);
            
            // Clear the navigation state to prevent reloading on subsequent renders
            navigate('/prompt-lab', { replace: true });
          }
        } catch (error) {
          console.error('Error loading conversation from navigation state:', error);
          setError('Failed to load conversation');
        }
      };
      
      loadConversationFromState();
    }
  }, [location.state, navigate]);

  // Save or update conversation
  const saveConversation = useCallback(async (messages: Message[]) => {
    if (!currentProfile || messages.length === 0) return;

    setIsSavingConversation(true);
    try {
      if (currentConversation) {
        // Update existing conversation
        const updatedConversation = await conversationsApi.updateConversation(
          currentConversation,
          messages,
          {
            promptText: messages[0]?.content || '',
            context: selectedContext,
            systemPrompt: selectedSystemPrompt!,
            metadata: { estimatedTokens: 0 }
          }
        );
        setCurrentConversation(updatedConversation);
        
        // Update recent conversations list - ensure no duplicates
        setRecentConversations(prev => {
          const filtered = prev.filter(conv => conv.id !== updatedConversation.id);
          return [updatedConversation, ...filtered.slice(0, 4)];
        });
      } else {
        // Create new conversation
        const conversationData = {
          title: messages[0]?.content || 'New Conversation',
          platform: 'chatgpt' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessage: messages[messages.length - 1]?.content || '',
          messageCount: messages.length,
          tags: [],
          isArchived: false,
          isFavorite: false,
          participants: ['user', 'AI'],
          status: 'active' as const,
          originalPrompt: {
            promptText: messages[0]?.content || '',
            context: selectedContext,
            systemPrompt: selectedSystemPrompt!,
            metadata: { estimatedTokens: 0 }
          }
        };
        const newConversation = await conversationsApi.createConversation(
          currentProfile.id,
          conversationData,
          messages
        );
        setCurrentConversation(newConversation);
        
        // Add to recent conversations - ensure no duplicates
        setRecentConversations(prev => {
          const filtered = prev.filter(conv => conv.id !== newConversation.id);
          return [newConversation, ...filtered.slice(0, 4)];
        });
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
      setError('Failed to save conversation');
    } finally {
      setIsSavingConversation(false);
    }
  }, [currentProfile, currentConversation, selectedContext, selectedSystemPrompt]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel || !selectedSystemPrompt || !currentProfile) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      conversationId: 'current',
      content: currentMessage,
      role: 'user',
      timestamp: new Date().toISOString(),
      platform: selectedModel, // Store the selected model ID
      isEdited: false
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Call the actual API to get AI response
      const response = await promptsApi.executePrompt(
        messages, // Pass existing conversation history
        selectedContext,
        currentMessage,
        selectedModel,
        currentProfile.id,
        selectedSystemPrompt, // Pass the full system prompt object, not just the ID
        embellishments // Pass selected embellishments
      );

      if (response.status === 'completed' && response.responses?.content) {
      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        conversationId: 'current',
          content: response.responses.content,
        role: 'assistant',
        timestamp: new Date().toISOString(),
          platform: selectedModel, // Store the selected model ID for AI responses
        isEdited: false
      };
      setMessages(prev => [...prev, aiMessage]);
        
        // Save conversation after AI response
        setTimeout(() => {
          saveConversation([...messages, userMessage, aiMessage]);
        }, 100);
      } else {
        throw new Error('AI response was not successful or content is missing');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      setError(error instanceof Error ? error.message : 'Failed to get AI response');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: 'current',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel, // Store the selected model ID for error messages
        isEdited: false
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Save conversation even with error message
      setTimeout(() => {
        saveConversation([...messages, userMessage, errorMessage]);
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      const messages = await conversationsApi.getMessages(conversation.id);
      setMessages(messages);
      setCurrentConversation(conversation);
      
      // Update the conversation ID in messages to match the loaded conversation
      const updatedMessages = messages.map(msg => ({
        ...msg,
        conversationId: conversation.id
      }));
      setMessages(updatedMessages);
      
      // Close the drawer
      setConversationsDrawerOpen(false);
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      setError('Failed to load conversation');
    }
  };

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setCurrentConversation(null);
    setError(null);
  }, []);

  // Construct the full prompt as it would be sent to the model
  const constructFullPrompt = useCallback(() => {
    if (!selectedSystemPrompt) return '';

    let fullPrompt = '';
    
    // Start with system prompt
    if (selectedSystemPrompt.content) {
      fullPrompt = `${selectedSystemPrompt.content}\n\n`;
    }
    
    // Add embellishment instructions if any are selected
    if (embellishments.length > 0) {
      const selectedInstructions = embellishments
        .map(embellishment => embellishment.instructions)
        .filter(instruction => instruction.length > 0);
      
      if (selectedInstructions.length > 0) {
        fullPrompt += `Additional Instructions:\n${selectedInstructions.join('\n')}\n\n`;
      }
    }
    
    // Add context if available
    if (selectedContext) {
      fullPrompt += `Given the following existing background context: ${selectedContext.body}\n\n`;
    }
    
    // Add conversation history if available
    if (messages.length > 0) {
      const conversationHistory = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          return `${role}: ${msg.content}`;
        })
        .join('\n\n');
      
      if (selectedContext) {
        fullPrompt += `And the following conversation history: ${conversationHistory}\n\n`;
      } else {
        fullPrompt += `Given the following conversation history: ${conversationHistory}\n\n`;
      }
      
      fullPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind and continuing the flow of the conversation:\n\n`;
    } else if (selectedContext) {
      fullPrompt += `Answer the following prompt, keeping the existing context of the conversation in mind, treating it as either a previous part of the same conversation, or just as a framing for the following prompt:\n\n`;
    }
    
    // Add the current message if there is one
    if (currentMessage.trim()) {
      fullPrompt += `Prompt: ${currentMessage}`;
    } else if (messages.length > 0) {
      // If no current message, use the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        fullPrompt += `Prompt: ${lastUserMessage.content}`;
      }
    }
    
    return fullPrompt;
  }, [selectedSystemPrompt, selectedContext, messages, currentMessage, embellishments]);

  // Handle adding embellishment
  const handleAddEmbellishment = () => {
    setEmbellishmentModalOpen(true);
  };

  // Handle removing embellishment
  const handleRemoveEmbellishment = (embellishmentId: string) => {
    setEmbellishments(prev => prev.filter(emb => emb.id !== embellishmentId));
  };

  return (
    <Box sx={{ 
      height: '100%', // Use full height of parent container
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden' // Prevent outer page scrolling
    }}>
      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden', 
        position: 'relative',
        pb: 0, // No bottom padding needed since prompt bar is fixed
        minHeight: 0 // Ensure flex child can shrink properly
      }}>
        {/* Error Display */}
        {error && (
          <Box sx={{ p: 1, pb: 0 }}>
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              sx={{ borderRadius: 2 }}
            >
              {error}
            </Alert>
          </Box>
        )}
        
        {/* Messages Container */}
        <Box 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          sx={{ 
          height: '100%', 
          overflowY: 'auto', 
          overflowX: 'hidden', // Prevent horizontal scrolling
          p: 3,
            pb: 32, // Reduced bottom padding to a more reasonable amount
          display: 'flex',
          flexDirection: 'column',
          gap: 2
          }}
        >
          {/* New Conversation Button */}
          {messages.length > 0 && (
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={startNewConversation}
                startIcon={<AddIcon />}
                sx={{ 
                  color: 'primary.dark', 
                  borderColor: 'primary.dark',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main'
                  }
                }}
              >
                New Conversation
              </Button>
              
              {/* Save Status */}
              {isSavingConversation && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Saving...
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          
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
            <>
              {messages.map((message) => {
                const modelInfo = getModelInfo(message.platform);
                return (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                  mr: message.role === 'user' ? '15%' : 0
                }}
              >
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '70%',
                    backgroundColor: message.role === 'user' 
                      ? 'primary.light' 
                          : message.role === 'assistant' && message.content.startsWith('Error:')
                            ? 'error.light'
                            : modelInfo.color, // Use model-specific color for AI messages
                    color: message.role === 'user' 
                      ? 'primary.contrastText' 
                      : 'white', 
                    borderRadius: 2,
                    position: 'relative',
                    // Add subtle shadow for better visual separation
                    boxShadow: message.role === 'assistant' ? 2 : 1
                  }}
                >
                  {message.role === 'assistant' && (
                    <Avatar sx={{ 
                      width: 24, 
                      height: 24, 
                      position: 'absolute', 
                      top: -12, 
                      left: -12,
                          bgcolor: message.content.startsWith('Error:') ? 'error.dark' : modelInfo.color
                    }}>
                      <ModelIcon fontSize="small" />
                    </Avatar>
                  )}
                      
                      {/* Model information for AI messages */}
                      {message.role === 'assistant' && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1, 
                          mb: 1
                        }}>
                          <Chip
                            label={modelInfo.name}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              color: 'white',
                              '& .MuiChip-label': {
                                px: 1
                              }
                            }}
                          />
                          <Typography variant="caption" sx={{ opacity: 0.7, color: 'white' }}>
                            {modelInfo.provider}
                          </Typography>
                        </Box>
                      )}
                      
                  <Typography variant="body1">
                    {message.content}
        </Typography>
                </Paper>
              </Box>
                );
              })}
              
              {/* Loading indicator */}
              {isLoading && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    mb: 2
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      backgroundColor: getModelInfo(selectedModel).color, // Use selected model's color
                      color: 'white',
                      borderRadius: 2,
                      position: 'relative',
                      boxShadow: 2
                    }}
                  >
                    <Avatar sx={{ 
                      width: 24, 
                      height: 24, 
                      position: 'absolute', 
                      top: -12, 
                      left: -12,
                      bgcolor: getModelInfo(selectedModel).color
                    }}>
                      <ModelIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} color="inherit" />
                      <Typography variant="body2">
                        {getModelInfo(selectedModel).name} is thinking...
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}
              
              {/* Scroll anchor for auto-scrolling */}
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>
      </Box>

      {/* Scroll to Bottom Button */}
      {showScrollToBottom && messages.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 200, // Position above the prompt bar
            right: conversationsDrawerOpen ? 320 : 20, // Adjust position based on drawer state
            zIndex: 1001,
            transition: 'right 0.3s ease' // Smooth transition when drawer opens/closes
          }}
        >
          <Button
            variant="contained"
            onClick={scrollToBottom}
            sx={{
              borderRadius: '50%',
              minWidth: 48,
              width: 48,
              height: 48,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            <Box>
              <ExpandMore />
            </Box>
          </Button>
        </Box>
      )}

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
                  color: 'primary.dark',
                  borderColor: 'primary.dark',
                  boxShadow: 1,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
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
                  color: 'primary.dark',
                  borderColor: 'primary.dark',
                  boxShadow: 1,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
                    boxShadow: 2
                  }
                }}
              >
                Context: {selectedContext ? selectedContext.title : 'None'}
              </Button>
              
                    <Button
                      variant="outlined"
                size="medium"
                onClick={() => setSystemPromptModalOpen(true)}
                sx={{ 
                  minWidth: 180,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  color: 'primary.dark',
                  borderColor: 'primary.dark',
                  boxShadow: 1,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
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
                minRows={1}
                maxRows={6}
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

              {/* Contextual Menu Button */}
              <IconButton
                onClick={(event) => setMenuAnchorEl(event.currentTarget)}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'background.paper',
                  color: 'primary.dark',
                  border: 1,
                  borderColor: 'primary.dark',
                  boxShadow: 2,
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
                    boxShadow: 3
                  }
                }}
              >
                <MoreVert />
              </IconButton>

              {/* Contextual Menu Dropdown */}
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={() => setMenuAnchorEl(null)}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                sx={{
                  '& .MuiPaper-root': {
                    borderRadius: 2,
                    boxShadow: 3,
                    minWidth: 180
                  }
                }}
              >
                <MenuItem
                  onClick={() => {
                    setFullPromptModalOpen(true);
                    setMenuAnchorEl(null);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1.5,
                    px: 2
                  }}
                >
                  <ChatBubbleIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  <Typography variant="body2">View Full Prompt</Typography>
                </MenuItem>
                
                <MenuItem
                  onClick={() => {
                    startNewConversation();
                    setMenuAnchorEl(null);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1.5,
                    px: 2
                  }}
                >
                  <RefreshIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  <Typography variant="body2">New Chat</Typography>
                </MenuItem>
              </Menu>

              <Button
                variant="contained"
                color="primary"
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading}
                sx={{ 
                  minWidth: 56, 
                  height: 56, 
                  borderRadius: '50%',
                  boxShadow: 2,
                  fontSize: '0.875rem',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              </Button>
            </Box>

            {/* Embellishments Bar */}
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              justifyContent: 'center'
            }}>
              {/* Embellishments Bar - Dynamic content with + button on the right */}
              <Paper
                onClick={() => setEmbellishmentModalOpen(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  color: 'primary.dark',
                  border: 1,
                  borderColor: 'primary.dark',
                  width: 800, // Exact same width as prompt input container
                  boxShadow: 1,
                  minHeight: 48, // Ensure consistent height
                  flexWrap: 'wrap', // Allow wrapping to multiple lines
                  cursor: 'pointer', // Show it's clickable
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main',
                    boxShadow: 2
                  }
                }}
              >
                {/* Display embellishments or placeholder text */}
                {embellishments.length > 0 ? (
                  <>
                    {embellishments.map((embellishment) => (
                      <Chip
                        key={embellishment.id}
                        label={embellishment.name}
                        onDelete={() => handleRemoveEmbellishment(embellishment.id)}
                        color="primary"
                        variant="filled"
                        size="small"
                        onClick={(e) => e.stopPropagation()} // Prevent bar click when clicking on chip
                        sx={{
                          maxWidth: '200px',
                          '& .MuiChip-label': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    Add Embellishments
                  </Typography>
                )}
                
                {/* + Button always on the far right */}
                <Box sx={{ marginLeft: 'auto' }}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent bar click when clicking + button
                      handleAddEmbellishment();
                    }}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      border: 1,
                      borderColor: 'primary.main',
                      boxShadow: 1,
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 2
                      }
                    }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </Paper>
            </Box>
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

      <EmbellishmentSelectionModal
        open={embellishmentModalOpen}
        onClose={() => setEmbellishmentModalOpen(false)}
        onSelectEmbellishments={(selected) => {
          setEmbellishments(selected);
          setEmbellishmentModalOpen(false);
        }}
        selectedEmbellishments={embellishments}
        embellishments={allEmbellishments}
        loading={embellishmentsLoading}
      />

      <FullPromptModal
        open={fullPromptModalOpen}
        onClose={() => setFullPromptModalOpen(false)}
        fullPrompt={constructFullPrompt()}
      />
    </Box>
  );
} 