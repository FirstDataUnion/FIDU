import { useState, useEffect, useCallback, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Snackbar,
  Tooltip,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Add as AddIcon,
  Chat as ChatIcon,
  SmartToy as ModelIcon,
  ChevronLeft as ChevronLeftIcon,
  Search as SearchIcon,
  ChatBubbleOutline as ChatBubbleIcon,
  Refresh as RefreshIcon,
  ExpandMore,
  ArrowBackIos as ArrowBackIosIcon,
  RestartAlt as RestartAltIcon,
  Replay as ReplayIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchContexts, createContext } from '../store/slices/contextsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import { fetchEmbellishments } from '../store/slices/embellishmentsSlice';
import { conversationsApi } from '../services/api/conversations';
import { promptsApi, buildCompletePrompt } from '../services/api/prompts';
import { formatMessageContent } from '../utils/conversationUtils';
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
    // Gemini Models
    { id: 'gemini-flash', name: 'Gemini Flash', provider: 'Google' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
    // Claude Models
    { id: 'claude-haiku', name: 'Claude Haiku', provider: 'Anthropic' },
    { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'Anthropic' },
    { id: 'claude-opus-41', name: 'Claude Opus', provider: 'Anthropic' },
    // ChatGPT Models
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { id: 'gpt-4.0', name: 'GPT-4.0', provider: 'OpenAI' },
    { id: 'gpt-4.0-turbo', name: 'GPT-4.0 Turbo', provider: 'OpenAI' },
    { id: 'gpt-4.0-mini', name: 'GPT-4.0 Mini', provider: 'OpenAI' },
    { id: 'gpt-5.0', name: 'GPT-5.0', provider: 'OpenAI' },
    { id: 'gpt-5.0-mini', name: 'GPT-5.0 Mini', provider: 'OpenAI' },
    { id: 'gpt-5.0-nano', name: 'GPT-5.0 Nano', provider: 'OpenAI' },
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
  onCreateNewContext: () => void;
}

function ContextSelectionModal({ open, onClose, onSelectContext, contexts, loading, error, onCreateNewContext }: ContextSelectionModalProps) {
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
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`${context.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
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
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          startIcon={<AddIcon />}
          onClick={onCreateNewContext}
          sx={{
            borderColor: 'primary.dark',
            color: 'primary.dark',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'white',
              borderColor: 'primary.dark',
            }
          }}
        >
          Create New Context
        </Button>
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
  title?: string;
}

function SystemPromptSelectionModal({ open, onClose, onSelectSystemPrompt, systemPrompts, loading, error, title = 'Add System Prompt' }: SystemPromptSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSystemPrompts = systemPrompts.filter(sp => 
    sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (sp.description && sp.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (sp.categories && sp.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
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
                    {systemPrompt.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {systemPrompt.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      {systemPrompt.categories && systemPrompt.categories.length > 0 && (
                        <Chip 
                          label={systemPrompt.categories.join(', ')} 
                          size="small" 
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      <Chip 
                        label={`${systemPrompt.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
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
  const getSelectedIds = useCallback((): string[] => {
    return embellishments
      .filter((emb: Embellishment) => selectedEmbellishments.some((selected: Embellishment) => selected.id === emb.id))
      .map((emb: Embellishment) => emb.id);
  }, [embellishments, selectedEmbellishments]);

  const [selectedIds, setSelectedIds] = useState<string[]>(getSelectedIds());

  // Update selectedIds when selectedEmbellishments changes
  useEffect(() => {
    setSelectedIds(getSelectedIds());
  }, [selectedEmbellishments, getSelectedIds]);

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
  const [selectedModel, setSelectedModel] = useState('gpt-4.0-turbo');
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [selectedSystemPrompts, setSelectedSystemPrompts] = useState<SystemPrompt[]>([]);
  const [embellishments, setEmbellishments] = useState<Embellishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System Prompts Management
  const [systemPromptDrawerOpen, setSystemPromptDrawerOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleRemoveSystemPrompt = (promptId: string) => {
    setSelectedSystemPrompts(prev => prev.filter(sp => sp.id !== promptId));
  };

  const handleChangeSystemPrompt = (prompt: SystemPrompt) => {
    setChangingSystemPrompt(prompt);
    setSystemPromptModalOpen(true);
  };

  // Helper function to restore system prompts and embellishments from a conversation
  const restoreConversationSettings = useCallback((conversation: Conversation) => {
    if (conversation.originalPrompt) {
      if (conversation.originalPrompt.systemPrompts && conversation.originalPrompt.systemPrompts.length > 0) {
        setSelectedSystemPrompts(conversation.originalPrompt.systemPrompts);
      } else if (conversation.originalPrompt.systemPrompt) {
        // Backward compatibility: single system prompt
        setSelectedSystemPrompts([conversation.originalPrompt.systemPrompt]);
      }
      
      if (conversation.originalPrompt.embellishments && conversation.originalPrompt.embellishments.length > 0) {
        setEmbellishments(conversation.originalPrompt.embellishments);
      }
    }
  }, []);

  // Measure drawer height when it opens or content changes
  useEffect(() => {
    if (systemPromptDrawerOpen && drawerRef.current) {
      const height = drawerRef.current.offsetHeight;
      setDrawerHeight(height);
    }
  }, [systemPromptDrawerOpen, selectedSystemPrompts]);

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
      // Gemini Models
      'gemini-flash': { name: 'Gemini Flash', color: '#4285F4', provider: 'Google' },
      'gemini-pro': { name: 'Gemini Pro', color: '#4285F4', provider: 'Google' },
      // Claude Models
      'claude-haiku': { name: 'Claude Haiku', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet': { name: 'Claude Sonnet', color: '#C46902', provider: 'Anthropic' },
      'claude-opus-41': { name: 'Claude Opus', color: '#C46902', provider: 'Anthropic' },
      // ChatGPT Models
      'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4.0': { name: 'GPT-4.0', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4.0-turbo': { name: 'GPT-4.0 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4.0-mini': { name: 'GPT-4.0 Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5.0': { name: 'GPT-5.0', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5.0-mini': { name: 'GPT-5.0 Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5.0-nano': { name: 'GPT-5.0 Nano', color: '#10a37f', provider: 'OpenAI' },
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
  const [createContextModalOpen, setCreateContextModalOpen] = useState(false);
  
  // System prompt change state
  const [changingSystemPrompt, setChangingSystemPrompt] = useState<SystemPrompt | null>(null);
  
  // Create context form state
  const [contextForm, setContextForm] = useState({
    title: '',
    body: '',
    tags: []
  });
  const [isCreatingContext, setIsCreatingContext] = useState(false);

  // Toast notification state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Show toast message
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  }, []);


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
    if (systemPrompts.length > 0 && selectedSystemPrompts.length === 0) {
      const defaultPrompt = systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompts([defaultPrompt]);
      }
    }
  }, [systemPrompts, selectedSystemPrompts]);

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
            
            // Restore system prompts and embellishments from the conversation
            if (location.state.conversation.originalPrompt) {
              restoreConversationSettings(location.state.conversation);
            }
            
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
  }, [location.state, navigate, restoreConversationSettings]);

  // Save or update conversation
  const saveConversation = useCallback(async (messages: Message[]) => {
    if (!currentProfile || messages.length === 0) return;

    setIsSavingConversation(true);
    try {
      if (currentConversation) {
        // Update existing conversation
        const updatedConversation =         await conversationsApi.updateConversation(
          currentConversation,
          messages,
          {
            promptText: messages[0]?.content || '',
            context: selectedContext,
            systemPrompts: selectedSystemPrompts, // Store all selected system prompts
            systemPrompt: selectedSystemPrompts[0] || null, // Keep for backward compatibility
            embellishments: embellishments, // Store selected embellishments
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
            systemPrompts: selectedSystemPrompts, // Store all selected system prompts
            systemPrompt: selectedSystemPrompts[0] || null, // Keep for backward compatibility
            embellishments: embellishments, // Store selected embellishments
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
  }, [currentProfile, currentConversation, selectedContext, selectedSystemPrompts, embellishments]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel || !selectedSystemPrompts.length || !currentProfile) return;

    // Automatically close the system prompt drawer when sending a message
    if (systemPromptDrawerOpen) {
      setSystemPromptDrawerOpen(false);
    }

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
        selectedSystemPrompts, // Pass the full array of selected system prompts
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
      
      // Restore system prompts and embellishments from the conversation
      restoreConversationSettings(conversation);
      
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
    // Reset to default system prompt
    if (systemPrompts.length > 0) {
      const defaultPrompt = systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompts([defaultPrompt]);
      }
    }
    // Clear embellishments
    setEmbellishments([]);
  }, [systemPrompts]);

  // Handle create context submit
  const handleCreateContextSubmit = useCallback(async () => {
    if (!currentProfile?.id || !contextForm.title.trim()) return;
    
    setIsCreatingContext(true);
    try {
      await dispatch(createContext({ 
        contextData: {
          title: contextForm.title.trim(),
          body: contextForm.body.trim(),
          tags: contextForm.tags
        }, 
        profileId: currentProfile.id 
      })).unwrap();
      
      setCreateContextModalOpen(false);
      setContextForm({ title: '', body: '', tags: [] });
      showToast('Context created successfully!');
      
      // Refresh contexts list
      dispatch(fetchContexts(currentProfile.id));
    } catch (error) {
      console.error('Error creating context:', error);
      showToast('Failed to create context');
    } finally {
      setIsCreatingContext(false);
    }
  }, [dispatch, contextForm, currentProfile?.id, showToast]);

  // Handle rewind to a specific message
  const handleRewindToMessage = useCallback((messageIndex: number) => {
    const targetMessage = messages[messageIndex];
    if (targetMessage && targetMessage.role === 'user') {
      // Show confirmation dialog
      if (window.confirm(`Rewind to "${targetMessage.content.substring(0, 50)}${targetMessage.content.length > 50 ? '...' : ''}"?\n\nThis will remove all messages after this point and load the message into the input box.`)) {
        // Load the message content into the chat text box
        setCurrentMessage(targetMessage.content);
        // Remove all messages after this point (including the target message)
        setMessages(prev => prev.slice(0, messageIndex));
        // Clear any errors
        setError(null);
        // Scroll to bottom to show the rewinded state
        setTimeout(() => scrollToBottom(), 100);
        // Show success toast
        showToast('Conversation rewound successfully!');
      }
    }
  }, [messages, scrollToBottom, showToast]);

  // Handle retry for failed messages
  const handleRetryMessage = useCallback(async (errorMessageIndex: number) => {
    // Find the last user message before the error
    const lastUserMessageIndex = errorMessageIndex - 1;
    const lastUserMessage = messages[lastUserMessageIndex];
    
    if (!lastUserMessage || lastUserMessage.role !== 'user') {
      showToast('No user message found to retry');
      return;
    }

    // Remove the error message and all messages after it
    setMessages(prev => prev.slice(0, errorMessageIndex));
    
    // Clear any existing errors
    setError(null);
    
    // Set the user message content for resending
    setCurrentMessage(lastUserMessage.content);
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Call the API to get AI response
      const response = await promptsApi.executePrompt(
        messages.slice(0, errorMessageIndex), // Pass messages up to the error point
        selectedContext,
        lastUserMessage.content,
        selectedModel,
        currentProfile!.id,
        selectedSystemPrompts,
        embellishments
      );

      if (response.status === 'completed' && response.responses?.content) {
        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          conversationId: 'current',
          content: response.responses.content,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          platform: selectedModel,
          isEdited: false
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        
        // Save conversation after AI response
        setTimeout(() => {
          saveConversation([...messages.slice(0, errorMessageIndex), lastUserMessage, aiMessage]);
        }, 100);
        
        showToast('Message retried successfully!');
      } else {
        throw new Error('AI response was not successful or content is missing');
      }
    } catch (error) {
      console.error('Error retrying message:', error);
      setError(error instanceof Error ? error.message : 'Failed to retry message');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: 'current',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to retry message'}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: selectedModel,
        isEdited: false
      };
      setMessages(prev => [...prev, errorMessage]);
      
      
      // Save conversation even with error message
      setTimeout(() => {
        saveConversation([...messages.slice(0, errorMessageIndex), lastUserMessage, errorMessage]);
      }, 100);
    } finally {
      setIsLoading(false);
      setCurrentMessage(''); // Clear the input after retry
    }
  }, [messages, selectedContext, selectedModel, currentProfile, selectedSystemPrompts, embellishments, saveConversation, showToast]);

  // Construct the full prompt as it would be sent to the model
  const constructFullPrompt = useCallback(() => {
    // Use the same unified function that builds prompts for the API
    return buildCompletePrompt(
      selectedSystemPrompts,
      embellishments,
      selectedContext,
      messages,
      currentMessage.trim() || (messages.length > 0 ? messages.filter(m => m.role === 'user').pop()?.content || '' : '')
    );
  }, [selectedSystemPrompts, selectedContext, messages, currentMessage, embellishments]);

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
            pb: 24, // Reduced bottom padding to eliminate unnecessary empty space
          display: 'flex',
          flexDirection: 'column',
          gap: 2
          }}
        >
          {/* New Conversation Button - Top Right (when context is selected and messages exist) */}
          {selectedContext && messages.length > 0 && (
            <Box sx={{ 
              position: 'absolute', 
              top: 60, 
              right: 8, 
              zIndex: 1002
            }}>
              <Button
                variant="outlined"
                onClick={startNewConversation}
                startIcon={<AddIcon />}
                size="small"
                sx={{ 
                  color: 'primary.dark', 
                  borderColor: 'primary.dark',
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main'
                  }
                }}
              >
                New Chat
              </Button>
            </Box>
          )}

          {/* New Conversation Button - Top Right (when no context selected and messages exist) */}
          {messages.length > 0 && !selectedContext && (
            <Box sx={{ 
              position: 'absolute', 
              top: 60, 
              right: 8, 
              zIndex: 1002 
            }}>
              <Button
                variant="outlined"
                onClick={startNewConversation}
                startIcon={<AddIcon />}
                size="small"
                sx={{ 
                  color: 'primary.dark', 
                  borderColor: 'primary.dark',
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    borderColor: 'primary.main'
                  }
                }}
              >
                New Chat
              </Button>
            </Box>
          )}
          
          {/* Save Status - Top Right */}
          {messages.length > 0 && isSavingConversation && (
            <Box sx={{ 
              position: 'absolute', 
              top: 16, 
              right: 16, 
              zIndex: 1002,
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              backgroundColor: 'background.paper',
              px: 2,
              py: 1,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider'
            }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Saving...
              </Typography>
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
              {messages.map((message, messageIndex) => {
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
                    boxShadow: message.role === 'assistant' ? 2 : 1,
                    // Add hover effect for user messages to indicate rewind functionality
                    ...(message.role === 'user' && {
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-1px)',
                        transition: 'all 0.2s ease'
                      }
                    }),
                    // Add subtle border to indicate interactive elements
                    border: message.role === 'user' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)'
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
                      
                  <Box sx={{ 
                    '& p': { margin: 0, marginBottom: 1 },
                    '& p:last-child': { marginBottom: 0 },
                    '& pre': { 
                      backgroundColor: 'rgba(0,0,0,0.1)', 
                      padding: 1, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      margin: '8px 0'
                    },
                    '& code': { 
                      backgroundColor: 'rgba(0,0,0,0.1)', 
                      padding: '2px 4px', 
                      borderRadius: 1,
                      fontFamily: 'monospace'
                    },
                    '& ul, & ol': { margin: '8px 0', paddingLeft: 2 },
                    '& li': { margin: '4px 0' },
                    '& blockquote': { 
                      borderLeft: '3px solid rgba(255,255,255,0.3)', 
                      paddingLeft: 1, 
                      margin: '8px 0',
                      fontStyle: 'italic'
                    },
                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                      margin: '12px 0 8px 0',
                      fontWeight: 600,
                      lineHeight: 1.2
                    },
                    '& h1': { fontSize: '1.5em' },
                    '& h2': { fontSize: '1.3em' },
                    '& h3': { fontSize: '1.1em' },
                    '& strong': { fontWeight: 600 },
                    '& em': { fontStyle: 'italic' },
                    '& hr': { 
                      border: 'none', 
                      borderTop: '1px solid rgba(255,255,255,0.2)', 
                      margin: '16px 0' 
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      margin: '8px 0'
                    },
                    '& th, & td': {
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px 8px',
                      textAlign: 'left'
                    },
                    '& th': {
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      fontWeight: 600
                    },
                    // Add padding to prevent button overlap
                    paddingRight: message.role === 'user' ? '44px' : '44px', // Space for rewind/copy buttons
                    paddingBottom: message.role === 'assistant' ? '44px' : '8px' // Extra bottom padding for copy button
                  }}>
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {formatMessageContent(message.content)}
                    </Markdown>
                  </Box>

                  {/* Rewind Button for User Messages */}
                  {message.role === 'user' && (
                    <IconButton
                      onClick={() => handleRewindToMessage(messageIndex)}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        color: 'primary.contrastText',
                        opacity: 0.8,
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.25)',
                          opacity: 1,
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                      title="Rewind conversation to this point (removes all messages after this message)"
                    >
                      <RestartAltIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}

                  {/* Small indicator for user messages to hint at rewind functionality */}
                  {message.role === 'user' && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        opacity: 0.6,
                        zIndex: 5
                      }}
                    />
                  )}

                  {/* Copy Button for Assistant Messages */}
                  {message.role === 'assistant' && !message.content.startsWith('Error:') && (
                    <IconButton
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(message.content);
                          showToast('Message copied to clipboard!');
                        } catch (err) {
                          console.error('Failed to copy text: ', err);
                          // Fallback for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = message.content;
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);
                        }
                      }}
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        opacity: 0.8,
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          opacity: 1,
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}

                  {/* Retry Button for Error Messages */}
                  {message.role === 'assistant' && message.content.startsWith('Error:') && (
                    <Tooltip title="Retry the last user message" placement="top" arrow>
                      <IconButton
                        onClick={() => handleRetryMessage(messageIndex)}
                        disabled={isLoading}
                        sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          opacity: 0.8,
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          '&:hover': {
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            opacity: 1,
                            transform: 'scale(1.1)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                          },
                          '&:disabled': {
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            opacity: 0.5,
                            transform: 'none'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <ReplayIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
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
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.9) 100%)',
          p: 3,
          zIndex: 1000
        }}>
          {/* Container to center content within chat window */}
          <Box sx={{ 
            maxWidth: 800,
            mx: 'auto',
            px: 2
          }}>
            {/* System Prompts Sliding Drawer */}
            <Box sx={{ 
              position: 'relative',
              mb: 2
            }}>
              {/* Tab - Always visible, positioned outside the drawer */}
              <Box
                onClick={() => setSystemPromptDrawerOpen(!systemPromptDrawerOpen)}
                sx={{
                  position: 'absolute',
                  bottom: 0, // Always at bottom of container
                  left: '50%',
                  transform: `translateX(-50%) translateY(${systemPromptDrawerOpen ? `-${drawerHeight}px` : '0px'})`, // Move up by actual drawer height
                  zIndex: 1001,
                  cursor: 'pointer',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  px: 6, // Increased from 4 to 5 for wider tab
                  py: .45,
                  borderRadius: '8px 8px 0 0',
                  boxShadow: 0,
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    boxShadow: 3
                  },
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column', // Stack content vertically
                  alignItems: 'center',
                  gap: 0
                }}
              >
                {/* Main row with text and arrow */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    System Prompts
                  </Typography>
                  <ExpandMore 
                    sx={{ 
                      fontSize: 18,
                      transform: systemPromptDrawerOpen ?  'rotate(0deg)' : 'rotate(180deg)',
                      transition: 'transform 0.3s ease'
                    }} 
                  />
                </Box>
                {/* Selection count indicator */}
                <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.8, mt: 0 }}>
                  {selectedSystemPrompts.length} selected
                </Typography>
              </Box>

              {/* Expandable Drawer - Dynamic height based on content */}
              <Box
                ref={drawerRef}
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '8px 8px 0 0',
                  boxShadow: 3,
                  transform: systemPromptDrawerOpen ? 'translateY(0)' : 'translateY(100%)',
                  transition: 'transform 0.3s ease',
                  zIndex: 1000,
                  maxHeight: systemPromptDrawerOpen ? 'auto' : '0px', // Allow natural height when open
                  overflow: 'hidden'
                }}
              >
                {/* Scrollable Content Container */}
                <Box sx={{ 
                  p: 3, 
                  pt: 4, // Reduced top padding from 6 to 4
                  maxHeight: '400px', // Maximum height constraint
                  overflowY: 'auto', // Make content scrollable
                  '&::-webkit-scrollbar': {
                    width: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'transparent'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.3)'
                    }
                  }
                }}>
                  {/* Header */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 3 
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      System Prompts
                    </Typography>
                  </Box>

                  {/* Description */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                      System prompts provide instructions to AI models about how to behave and respond. 
                      They set the tone and style for conversations, or set specific goals and purposes for the model.
                      Use of multiple system prompts at once is experiemental!
                    </Typography>
                  </Box>

                  {/* Selected System Prompts List */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
                      Selected Prompts:
                    </Typography>
                    {selectedSystemPrompts.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedSystemPrompts.map((prompt) => (
                          <Box
                            key={prompt.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: 'primary.light',
                              border: 1,
                              borderColor: 'primary.main',
                              position: 'relative'
                            }}
                          >
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {prompt.name}
                                {prompt.isDefault && (
                                  <Chip 
                                    label="Default" 
                                    size="small" 
                                    color="primary" 
                                    sx={{ ml: 1, fontSize: '0.6rem' }}
                                  />
                                )}
                              </Typography>
                              {prompt.description && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {prompt.description}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {prompt.tokenCount} tokens
                              </Typography>
                            </Box>
                            
                            {/* Change Button */}
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleChangeSystemPrompt(prompt)}
                              sx={{
                                minWidth: 'auto',
                                px: 2,
                                py: 0.5,
                                fontSize: '0.75rem',
                                borderColor: 'primary.main',
                                color: 'primary.main',
                                '&:hover': {
                                  backgroundColor: 'primary.light',
                                  borderColor: 'primary.dark'
                                }
                              }}
                            >
                              Change
                            </Button>
                            
                            <IconButton
                              onClick={() => handleRemoveSystemPrompt(prompt.id)}
                              size="small"
                              sx={{
                                color: 'error.main',
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'error.contrastText'
                                }
                              }}
                            >
                              <Box sx={{ fontSize: 16 }}>×</Box>
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Box sx={{ 
                        p: 3, 
                        textAlign: 'center', 
                        backgroundColor: 'action.hover',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No system prompts selected
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Add New Button - At the bottom of the list */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    pt: 1,
                    borderTop: 1,
                    borderColor: 'divider'
                  }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setSystemPromptModalOpen(true)}
                      startIcon={<AddIcon />}
                      sx={{ 
                        fontSize: '0.75rem',
                        px: 3,
                        py: 1
                      }}
                    >
                      Add New Prompt
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Unified Prompt Entry Container */}
            <Paper sx={{ 
              p: 0.75, 
              borderRadius: 2,
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: 1
            }}>
              {/* Message Input Container */}
              <Box sx={{ 
                position: 'relative',
                width: '100%'
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
                      boxShadow: 1,
                      pr: 8 // Add right padding to make room for send button only
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

                {/* Send Button - Inside text box */}
                <IconButton
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isLoading}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled'
                    }
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <Box sx={{ 
                      fontSize: 16,
                      transform: 'rotate(90deg) translate(5px, 2px)' // Rotate to point upward
                    }}>
                     <ArrowBackIosIcon />
                    </Box>
                  )}
                </IconButton>
              </Box>

              {/* Controls Container Box - Now below the prompt input */}
              <Box sx={{ 
                display: 'flex', 
                gap: 4, 
                justifyContent: 'center', 
                flexWrap: 'wrap', 
                mt: 1 
              }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setModelModalOpen(true)}
                  sx={{ 
                    minWidth: 200,
                    borderRadius: 4,
                    backgroundColor: 'background.paper',
                    color: 'primary.dark',
                    borderColor: 'primary.dark',
                    boxShadow: 1,
                    fontSize: '0.75rem',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                      boxShadow: 2
                    }
                  }}
                >
                  {selectedModel + '  ▾' || 'Select Target Model ▾'}
                </Button>
                
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setContextModalOpen(true)}
                  sx={{ 
                    minWidth: 150,
                    borderRadius: 4,
                    backgroundColor: 'background.paper',
                    color: 'primary.dark',
                    borderColor: 'primary.dark',
                    boxShadow: 1,
                    fontSize: '0.75rem',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                      boxShadow: 2
                    }
                  }}
                >
                  Context: {selectedContext ? selectedContext.title : 'None'} ▾
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setFullPromptModalOpen(true)}
                  sx={{ 
                    minWidth: 150,
                    borderRadius: 4,
                    backgroundColor: 'background.paper',
                    color: 'primary.dark',
                    borderColor: 'primary.dark',
                    boxShadow: 1,
                    fontSize: '0.75rem',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                      boxShadow: 2
                    }
                  }}
                >
                  View/Copy Full Prompt
                </Button>
              </Box>
            </Paper>


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
        onCreateNewContext={() => setCreateContextModalOpen(true)}
      />

      {/* Create Context Modal */}
      <Dialog open={createContextModalOpen} onClose={() => setCreateContextModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Context</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Context Title"
              value={contextForm.title}
              onChange={(e) => setContextForm(prev => ({ ...prev, title: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Context Body"
              multiline
              rows={4}
              value={contextForm.body}
              onChange={(e) => setContextForm(prev => ({ ...prev, body: e.target.value }))}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateContextModalOpen(false)} sx={{ color: 'primary.dark' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateContextSubmit}
            disabled={isCreatingContext || !contextForm.title.trim()}
          >
            {isCreatingContext ? 'Creating...' : 'Create Context'}
          </Button>
        </DialogActions>
      </Dialog>

              <SystemPromptSelectionModal
          open={systemPromptModalOpen}
          onClose={() => {
            setSystemPromptModalOpen(false);
            setChangingSystemPrompt(null); // Reset change state when closing
          }}
          onSelectSystemPrompt={(systemPrompt) => {
            if (changingSystemPrompt) {
              // Replace the specific system prompt
              setSelectedSystemPrompts(prev => 
                prev.map(sp => 
                  sp.id === changingSystemPrompt.id ? systemPrompt : sp
                )
              );
              setChangingSystemPrompt(null);
              showToast(`System prompt "${changingSystemPrompt.name}" replaced with "${systemPrompt.name}"`);
            } else {
              // Add to existing selection instead of replacing
              setSelectedSystemPrompts(prev => 
                prev.some(sp => sp.id === systemPrompt.id) 
                  ? prev 
                  : [...prev, systemPrompt]
              );
              showToast(`System prompt "${systemPrompt.name}" added`);
            }
            setSystemPromptModalOpen(false);
          }}
          systemPrompts={systemPrompts}
          loading={systemPromptsLoading}
          error={systemPromptsError}
          title={changingSystemPrompt ? `Change System Prompt: ${changingSystemPrompt.name}` : 'Add System Prompt'}
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

      {/* Toast Notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={2000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbar-root': {
            bottom: 120 // Position above the prompt area
          }
        }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
} 