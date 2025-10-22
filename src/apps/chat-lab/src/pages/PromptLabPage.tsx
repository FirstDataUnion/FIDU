import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import EnhancedMarkdown from '../components/common/EnhancedMarkdown';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Link,
} from '@mui/material';
import CategoryFilter from '../components/common/CategoryFilter';
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
  RestartAlt as RestartAltIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
  ExpandLess as ExpandLessIcon,
  HelpOutline as HelpOutlineIcon,
  AutoFixHigh as WizardIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchContexts, createContext } from '../store/slices/contextsSlice';
import { updateLastUsedModel } from '../store/slices/settingsSlice';
import { fetchSystemPrompts } from '../store/slices/systemPromptsSlice';
import { updateConversationWithMessages } from '../store/slices/conversationsSlice';
import { conversationsService } from '../services/conversationsService';
import { promptsApi, buildCompletePrompt } from '../services/api/prompts';
import type { Conversation, Message, Context, SystemPrompt } from '../types';
import type { WizardMessage } from '../types/wizard';
import { WizardWindow } from '../components/wizards/WizardWindow';
import { ApiError } from '../services/api/apiClients';
import StorageDirectoryBanner from '../components/common/StorageDirectoryBanner';
import ContextHelpModal from '../components/help/ContextHelpModal';
import SystemPromptHelpModal from '../components/help/SystemPromptHelpModal';
import { useMobile, useResponsiveSpacing } from '../hooks/useMobile';
import { MetricsService } from '../services/metrics/MetricsService';
import ModelSelectionModal from '../components/prompts/ModelSelectionModal';


// Helper function to generate user-friendly error messages and debug info
const getErrorMessage = (error: unknown, selectedModel?: string): { userMessage: string; debugInfo: any } => {
  const debugInfo: any = {
    error: error,
    errorType: error?.constructor?.name,
    selectedModel,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof ApiError) {
    debugInfo.statusCode = error.status;
    debugInfo.errorData = error.data;
    
    // Handle specific HTTP status codes
    switch (error.status) {
      case 408: {
        // Timeout error handling with detailed debug info
        const timeoutData = error.data || {};
        const actualWaitTime = timeoutData.actualWaitTime || timeoutData.maxWaitTime || 'unknown';
        const pollCount = timeoutData.totalPolls || 'unknown';
        const lastStatus = timeoutData.lastKnownStatus?.status || 'unknown';
        const inputLength = timeoutData.inputLength || 'unknown';
        
        return {
          userMessage: "The request timed out. The model is taking longer than expected. Please try again with a shorter message.",
          debugInfo: { 
            ...debugInfo, 
            cause: 'Request timeout',
            timeoutDetails: {
              executionId: timeoutData.executionId,
              actualWaitTimeMs: actualWaitTime,
              maxWaitTimeMs: timeoutData.maxWaitTime,
              pollCount: pollCount,
              lastKnownStatus: lastStatus,
              inputLength: inputLength,
              inputPreview: timeoutData.inputPreview,
              pollingErrors: timeoutData.pollingErrors?.length || 0,
              timeoutReason: timeoutData.timeoutReason,
              startTime: timeoutData.startTime,
              endTime: timeoutData.endTime
            }
          }
        };
      }
      case 401:
        return {
          userMessage: "Authentication failed. Please refresh the page and try again.",
          debugInfo: { ...debugInfo, cause: 'Authentication error' }
        };
      case 403: {
        // Check if this is the PAID_MEMBERSHIP_REQUIRED error from the gateway
        const errorData = error.data || {};
        if (errorData.error_code === 'PAID_MEMBERSHIP_REQUIRED') {
          return {
            userMessage: "You need a paid membership or a valid API key to use our models. Please upgrade your membership here: https://identity.firstdataunion.org/ or set your own AI provider API Key in the settings page.",
            debugInfo: { ...debugInfo, cause: 'Paid membership required', errorCode: errorData.error_code }
          };
        }
        // Generic 403 for other access denied scenarios
        return {
          userMessage: "Access denied. You don't have permission to use this model. Please contact support.",
          debugInfo: { ...debugInfo, cause: 'Access denied' }
        };
      }
      case 404:
        return {
          userMessage: "The requested service is not available. Please try a different model or contact support.",
          debugInfo: { ...debugInfo, cause: 'Service not found' }
        };
      case 429:
        return {
          userMessage: "Too many requests. Please wait a moment and try again.",
          debugInfo: { ...debugInfo, cause: 'Rate limit exceeded' }
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          userMessage: "Server error occurred. Please try again in a few moments.",
          debugInfo: { ...debugInfo, cause: 'Server error' }
        };
      default:
        return {
          userMessage: `API error (${error.status}). Please try again or contact support if the problem persists.`,
          debugInfo: { ...debugInfo, cause: 'API error' }
        };
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Handle specific error patterns
    if (message.includes('timeout') || message.includes('timed out')) {
      // Try to extract timeout details from the error message
      const timeoutMatch = message.match(/(\d+)s|(\d+)ms/);
      const timeoutValue = timeoutMatch ? timeoutMatch[1] || timeoutMatch[2] : 'unknown';
      
      return {
        userMessage: "The request timed out. Please try again with a shorter message or check your connection.",
        debugInfo: { ...debugInfo, cause: 'Timeout error', extractedTimeout: timeoutValue }
      };
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return {
        userMessage: "Network connection issue. Please check your internet connection and try again.",
        debugInfo: { ...debugInfo, cause: 'Network error' }
      };
    }
    
    if (message.includes('authentication') || message.includes('unauthorized')) {
      return {
        userMessage: "Authentication failed. Please refresh the page and log in again.",
        debugInfo: { ...debugInfo, cause: 'Authentication error' }
      };
    }
    
    if (message.includes('unsupported model')) {
      return {
        userMessage: `The model "${selectedModel}" is not supported. Please select a different model.`,
        debugInfo: { ...debugInfo, cause: 'Unsupported model' }
      };
    }
    
    if (message.includes('profile id is required')) {
      return {
        userMessage: "Profile configuration error. Please refresh the page and try again.",
        debugInfo: { ...debugInfo, cause: 'Missing profile' }
      };
    }
    
    if (message.includes('no response received')) {
      return {
        userMessage: "No response from server. Please check your connection and try again.",
        debugInfo: { ...debugInfo, cause: 'No response' }
      };
    }
    
    // For known error messages, return them as-is
    if (message.includes('failed to complete') || message.includes('try again shortly')) {
      return {
        userMessage: error.message,
        debugInfo: { ...debugInfo, cause: 'Model execution failed' }
      };
    }
    
    // Default for other errors
    return {
      userMessage: "An unexpected error occurred. Please try again or contact support if the problem persists.",
      debugInfo: { ...debugInfo, cause: 'Unknown error' }
    };
  }

  // Fallback for non-Error objects
  return {
    userMessage: "An unexpected error occurred. Please try again.",
    debugInfo: { ...debugInfo, cause: 'Non-Error object' }
  };
};

// Modal Components
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
  const [sortBy, setSortBy] = useState<'recent-desc' | 'recent-asc' | 'alpha-asc' | 'alpha-desc'>('recent-desc');
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const filteredAndSortedContexts = contexts
    .filter(context => 
      (context.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (context.body?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy.startsWith('alpha')) {
        const comparison = (a.title || '').localeCompare(b.title || '');
        return sortBy === 'alpha-desc' ? -comparison : comparison;
      } else {
        // Sort by date (updatedAt takes precedence, fallback to createdAt)
        const aDate = new Date(a.updatedAt || a.createdAt);
        const bDate = new Date(b.updatedAt || b.createdAt);
        const comparison = bDate.getTime() - aDate.getTime();
        return sortBy === 'recent-asc' ? -comparison : comparison;
      }
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="span">
            Select Context
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={() => setHelpModalOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            <HelpOutlineIcon fontSize="small" />
            What are "Contexts"?
          </Link>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
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
            <FormControl size="small" sx={{ minWidth: 250 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent-desc' | 'recent-asc' | 'alpha-asc' | 'alpha-desc')}
                label="Sort by"
              >
                <MenuItem value="recent-desc">Most Recent (Newest First)</MenuItem>
                <MenuItem value="recent-asc">Oldest First</MenuItem>
                <MenuItem value="alpha-asc">Alphabetical (A-Z)</MenuItem>
                <MenuItem value="alpha-desc">Alphabetical (Z-A)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {!loading && !error && filteredAndSortedContexts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery ? 'No contexts match your search' : 'No contexts available'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredAndSortedContexts.length > 0 && (
            <List>
              {filteredAndSortedContexts.map((context) => (
                <ListItemButton 
                  key={context.id} 
                  divider
                  onClick={() => onSelectContext(context)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body1" component="div" sx={{ fontWeight: 500, mb: 1 }}>
                      {context.title || 'Untitled Context'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {context.body ? (
                        context.body.length > 150 
                          ? `${context.body.substring(0, 150)}...` 
                          : context.body
                      ) : (
                        'No content available'
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`${context.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={new Date(context.updatedAt || context.createdAt).toLocaleDateString()} 
                        size="small" 
                        variant="outlined"
                        color="secondary"
                      />
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectContext(context);
                    }}
                  >
                    Select
                  </Button>
                </ListItemButton>
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

      {/* Help Modal */}
      <ContextHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
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
  const { isMobile } = useMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const filteredSystemPrompts = systemPrompts.filter(sp => {
    // Text search filter
    const matchesText = sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sp.description && sp.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sp.categories && sp.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase())));
    
    // Category filter
    const matchesCategory = selectedCategories.length === 0 || 
      (sp.categories && sp.categories.some(cat => selectedCategories.includes(cat)));
    
    return matchesText && matchesCategory;
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="span">
            {title}
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={() => setHelpModalOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            <HelpOutlineIcon fontSize="small" />
            What are "System Prompts"?
          </Link>
        </Box>
      </DialogTitle>
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
          
          <CategoryFilter
            systemPrompts={systemPrompts}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            placeholder="Filter by category"
            size="small"
            fullWidth
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
                <ListItemButton 
                  key={systemPrompt.id} 
                  divider
                  onClick={() => onSelectSystemPrompt(systemPrompt)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSystemPrompt(systemPrompt);
                    }}
                  >
                    Select
                  </Button>
                </ListItemButton>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: isMobile ? 2 : 1 }}>
        <Button 
          onClick={onClose} 
          size={isMobile ? 'large' : 'medium'}
          sx={{ 
            color: 'primary.dark',
            minWidth: isMobile ? 100 : 80
          }}
        >
          Cancel
        </Button>
      </DialogActions>

      {/* Help Modal */}
      <SystemPromptHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
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



export default function PromptLabPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Mobile responsiveness
  const { isMobile } = useMobile();
  const spacing = useResponsiveSpacing();
  
  // Redux state
  const { currentProfile } = useAppSelector((state) => state.auth);
  const { items: contexts, loading: contextsLoading, error: contextsError } = useAppSelector((state) => state.contexts);
  const { items: systemPrompts, loading: systemPromptsLoading, error: systemPromptsError } = useAppSelector((state) => state.systemPrompts);
  const { settings } = useAppSelector((state) => state.settings);

  // Persistence keys for sessionStorage (memoized to prevent recreation)
  const STORAGE_KEYS = useMemo(() => ({
    messages: 'promptlab_messages',
    conversation: 'promptlab_conversation',
    context: 'promptlab_context',
    systemPrompts: 'promptlab_system_prompts'
  }), []);

  // Helper functions for persistence
  const saveToSession = useCallback((key: string, data: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error);
    }
  }, []);

  const loadFromSession = useCallback((key: string) => {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to load from sessionStorage:', error);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      (Object.values(STORAGE_KEYS) as string[]).forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error);
    }
  }, [STORAGE_KEYS]);

  // State for the chat interface - initialize from sessionStorage
  const [messages, setMessages] = useState<Message[]>(() => loadFromSession(STORAGE_KEYS.messages) || []);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState(settings.lastUsedModel || 'auto-router');
  const [selectedContext, setSelectedContext] = useState<Context | null>(() => loadFromSession(STORAGE_KEYS.context) || null);
  const [selectedSystemPrompts, setSelectedSystemPrompts] = useState<SystemPrompt[]>(() => loadFromSession(STORAGE_KEYS.systemPrompts) || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile-specific state
  const [showMobileControls, setShowMobileControls] = useState(false);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMinimized, setWizardMinimized] = useState(false);
  const [wizardMessages, setWizardMessages] = useState<WizardMessage[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardInitialMessage, setWizardInitialMessage] = useState<string>('');

  // System Prompt Suggestor Wizard state
  const [systemPromptSuggestorOpen, setSystemPromptSuggestorOpen] = useState(false);
  const [systemPromptSuggestorMinimized, setSystemPromptSuggestorMinimized] = useState(false);
  const [systemPromptSuggestorMessages, setSystemPromptSuggestorMessages] = useState<WizardMessage[]>([]);
  const [systemPromptSuggestorLoading, setSystemPromptSuggestorLoading] = useState(false);
  const [systemPromptSuggestorError, setSystemPromptSuggestorError] = useState<string | null>(null);
  const [systemPromptSuggestorInitialMessage, setSystemPromptSuggestorInitialMessage] = useState<string>('');

  // Update selectedModel when settings change (e.g., when settings are loaded from localStorage)
  useEffect(() => {
    if (settings.lastUsedModel && settings.lastUsedModel !== selectedModel) {
      setSelectedModel(settings.lastUsedModel);
    }
  }, [settings.lastUsedModel, selectedModel]);

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

  // Helper function to restore system prompts from a conversation
  const restoreConversationSettings = useCallback((conversation: Conversation) => {
    if (conversation.originalPrompt) {
      if (conversation.originalPrompt.systemPrompts && conversation.originalPrompt.systemPrompts.length > 0) {
        setSelectedSystemPrompts(conversation.originalPrompt.systemPrompts);
      } else if (conversation.originalPrompt.systemPrompt) {
        // Backward compatibility: single system prompt
        setSelectedSystemPrompts([conversation.originalPrompt.systemPrompt]);
      }
      
      // Embellishments removed
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
      // Auto Router
      'auto-router': { name: 'Auto Router', color: '#6366f1', provider: 'NLP Workbench' },
      
      // OpenAI Models
      'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-3.5-turbo-instruct': { name: 'GPT-3.5 Turbo Instruct', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4': { name: 'GPT-4', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4-turbo': { name: 'GPT-4 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o': { name: 'GPT-4o', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o-search-preview': { name: 'GPT-4o Search Preview', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o-mini': { name: 'GPT-4o Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o-mini-search-preview': { name: 'GPT-4o Mini Search Preview', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5': { name: 'GPT-5', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5-mini': { name: 'GPT-5 Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5-nano': { name: 'GPT-5 Nano', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5-pro': { name: 'GPT-5 Pro', color: '#10a37f', provider: 'OpenAI' },
      'gpt-oss-120b': { name: 'GPT-OSS 120B', color: '#10a37f', provider: 'OpenAI' },
      
      // Anthropic Claude Models
      'claude-haiku-3': { name: 'Claude Haiku 3', color: '#C46902', provider: 'Anthropic' },
      'claude-haiku-3.5': { name: 'Claude Haiku 3.5', color: '#C46902', provider: 'Anthropic' },
      'claude-opus-4': { name: 'Claude Opus 4', color: '#C46902', provider: 'Anthropic' },
      'claude-opus-4.1': { name: 'Claude Opus 4.1', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet-3.7': { name: 'Claude Sonnet 3.7', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet-4': { name: 'Claude Sonnet 4', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet-4.5': { name: 'Claude Sonnet 4.5', color: '#C46902', provider: 'Anthropic' },
      
      // Google Gemini Models
      'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', color: '#4285F4', provider: 'Google' },
      'gemini-2.0-flash-lite': { name: 'Gemini 2.0 Flash-Lite', color: '#4285F4', provider: 'Google' },
      'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', color: '#4285F4', provider: 'Google' },
      'gemini-2.5-flash-lite': { name: 'Gemini 2.5 Flash-Lite', color: '#4285F4', provider: 'Google' },
      'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', color: '#4285F4', provider: 'Google' },
      
      // Meta Llama Models
      'llama-4-maverick': { name: 'Llama 4 Maverick', color: '#1877f2', provider: 'Meta' },
      'llama-4-scout': { name: 'Llama 4 Scout', color: '#1877f2', provider: 'Meta' },
      
      // Mistral Models
      'mistral-medium-3.1': { name: 'Mistral Medium 3.1', color: '#ff6b35', provider: 'Mistral' },
      'mistral-codestral-2508': { name: 'Mistral Codestral 2508', color: '#ff6b35', provider: 'Mistral' },
      'mistral-ministral-3b': { name: 'Mistral Ministral 3B', color: '#ff6b35', provider: 'Mistral' },
      'mistral-ministral-8b': { name: 'Mistral Ministral 8B', color: '#ff6b35', provider: 'Mistral' },
      'mistral-small': { name: 'Mistral Small', color: '#ff6b35', provider: 'Mistral' },
      'mistral-tiny': { name: 'Mistral Tiny', color: '#ff6b35', provider: 'Mistral' },
      'mistral-large': { name: 'Mistral Large', color: '#ff6b35', provider: 'Mistral' },
      
      // Microsoft Phi Models
      'microsoft-phi-4': { name: 'Microsoft Phi 4', color: '#00bcf2', provider: 'Microsoft' },
      'microsoft-phi-4-multimodal': { name: 'Microsoft Phi 4 Multimodal', color: '#00bcf2', provider: 'Microsoft' },
      'microsoft-phi-4-reasoning-plus': { name: 'Microsoft Phi 4 Reasoning Plus', color: '#00bcf2', provider: 'Microsoft' },
      
      // xAI Grok Models
      'grok-3': { name: 'Grok 3', color: '#ff6b00', provider: 'xAI' },
      'grok-3-mini': { name: 'Grok 3 Mini', color: '#ff6b00', provider: 'xAI' },
      'grok-4': { name: 'Grok 4', color: '#ff6b00', provider: 'xAI' },
      'grok-4-fast': { name: 'Grok 4 Fast', color: '#ff6b00', provider: 'xAI' },
      
      // Direct Models (Google)
      'gemini-2.5-flash-lite-direct': { name: 'Gemini 2.5 Flash Lite', color: '#4285F4', provider: 'Google' },
      'gemini-2.0-flash-direct': { name: 'Gemini 2.0 Flash', color: '#4285F4', provider: 'Google' },
      
      // Direct Models (Anthropic)
      'claude-opus-4.1-direct': { name: 'Claude Opus 4.1', color: '#C46902', provider: 'Anthropic' },
      'claude-haiku-3-direct': { name: 'Claude Haiku 3', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet-3.7-direct': { name: 'Claude Sonnet 3.7', color: '#C46902', provider: 'Anthropic' },
      
      // Direct Models (OpenAI)
      'gpt-5-nano-direct': { name: 'GPT 5.0 Nano', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5-mini-direct': { name: 'GPT 5.0 Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-5-direct': { name: 'GPT 5.0', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o-mini-direct': { name: 'GPT 4.0 Mini', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4-direct': { name: 'GPT 4.0', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4-turbo-direct': { name: 'GPT 4.0 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-3.5-turbo-direct': { name: 'GPT 3.5 Turbo', color: '#10a37f', provider: 'OpenAI' },
      'gpt-4o-search-preview-direct': { name: 'GPT 4o Search', color: '#10a37f', provider: 'OpenAI' },
      
      // Legacy mappings for backward compatibility
      'gemini-flash': { name: 'Gemini Flash', color: '#4285F4', provider: 'Google' },
      'gemini-pro': { name: 'Gemini Pro', color: '#4285F4', provider: 'Google' },
      'claude-haiku': { name: 'Claude Haiku', color: '#C46902', provider: 'Anthropic' },
      'claude-sonnet': { name: 'Claude Sonnet', color: '#C46902', provider: 'Anthropic' },
      'claude-opus-41': { name: 'Claude Opus', color: '#C46902', provider: 'Anthropic' },
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

  // Conversation state - initialize from sessionStorage
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(() => loadFromSession(STORAGE_KEYS.conversation) || null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);

  // Modal states
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
  const [fullPromptModalOpen, setFullPromptModalOpen] = useState(false);
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
      const response = await conversationsService.getAll({}, 1, 5, currentProfile.id);
      setRecentConversations(response.conversations);
    } catch (error: any) {
      // Check if this is a storage initialization timing issue
      if (error.message?.includes('Cloud storage adapter not initialized') ||
          error.message?.includes('Cloud storage not fully initialized')) {
        console.warn('Storage not ready for recent conversations, will skip for now');
        setRecentConversations([]);
      } else {
        console.error('Error loading recent conversations:', error);
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [currentProfile]);

  useEffect(() => {
    loadRecentConversations();
  }, [loadRecentConversations]);

  // Persist conversation state to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      saveToSession(STORAGE_KEYS.messages, messages);
    }
  }, [messages, saveToSession, STORAGE_KEYS.messages]);

  useEffect(() => {
    if (currentConversation) {
      saveToSession(STORAGE_KEYS.conversation, currentConversation);
    }
  }, [currentConversation, saveToSession, STORAGE_KEYS.conversation]);

  useEffect(() => {
    if (selectedContext) {
      saveToSession(STORAGE_KEYS.context, selectedContext);
    }
  }, [selectedContext, saveToSession, STORAGE_KEYS.context]);

  useEffect(() => {
    if (selectedSystemPrompts.length > 0) {
      saveToSession(STORAGE_KEYS.systemPrompts, selectedSystemPrompts);
    }
  }, [selectedSystemPrompts, saveToSession, STORAGE_KEYS.systemPrompts]);

  // Handle conversation loading when navigating from conversations page
  useEffect(() => {
    if (location.state?.loadConversation && location.state?.conversationId) {
      const loadConversationFromState = async () => {
        try {
          const conversationId = location.state.conversationId;
          // Get messages for the conversation
          const messages = await conversationsService.getMessages(conversationId);
          
          // Use the complete conversation object from navigation state
          if (location.state.conversation) {
            setCurrentConversation(location.state.conversation);
            setMessages(messages);
            
            // Restore system prompts from the conversation
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
      // Only update if we have a conversation with a valid ID
      // Otherwise, create a new one (handles the case where conversation was restored from session but not yet saved)
      if (currentConversation && currentConversation.id) {
        // Update existing conversation using Redux action
        const updatedConversation = await dispatch(updateConversationWithMessages({
          conversation: currentConversation,
          messages,
          originalPrompt: {
            promptText: messages[0]?.content || '',
            context: selectedContext,
            systemPrompts: selectedSystemPrompts, // Store all selected system prompts
            systemPrompt: selectedSystemPrompts[0] || null, // Keep for backward compatibility
            metadata: { estimatedTokens: 0 }
          }
        })).unwrap();
        
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
            embellishments: [],
            metadata: { estimatedTokens: 0 }
          }
        };
        const newConversation = await conversationsService.createConversation(
          currentProfile.id,
          conversationData,
          messages,
          {
            promptText: messages[0]?.content || '',
            context: selectedContext,
            systemPrompts: selectedSystemPrompts,
            systemPrompt: selectedSystemPrompts[0] || null,
            metadata: { estimatedTokens: 0 }
          }
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
  }, [currentProfile, currentConversation, selectedContext, selectedSystemPrompts, dispatch]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel || !selectedSystemPrompts.length || !currentProfile) return;

    // Close the system prompt drawer when sending a message
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
        []
      );

      // Track successful message sent to model
      MetricsService.recordMessageSent(selectedModel, 'success');

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;
        
        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          conversationId: 'current',
          content: content,
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
        console.log('AI response failed - Status:', response.status, 'Content present:', !!response.responses?.content, 'Full response:', response);
        throw new Error('The model failed to complete the call, please try again shortly');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Track error message sent to model
      MetricsService.recordMessageSent(selectedModel, 'error');
      
      // Determine user-friendly error message and debug info
      const { userMessage: errorUserMessage, debugInfo } = getErrorMessage(error, selectedModel);
      console.log('AI Response Error Debug Info:', debugInfo);
      
      // Log additional timeout details if this is a timeout error
      if (error instanceof ApiError && error.status === 408 && error.data) {
        console.log('Detailed Timeout Analysis:', error.data);
      }
      
      setError(errorUserMessage);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: 'current',
        content: `Error: ${errorUserMessage}`,
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

  // Wizard handlers
  const handleOpenWizard = () => {
    setWizardOpen(true);
    setWizardMinimized(false);
    setWizardError(null);
    
    // Only copy current message and initialize greeting for fresh wizard conversations
    if (wizardMessages.length === 0) {
      // Copy current message to wizard initial message for new conversations
      setWizardInitialMessage(currentMessage);
      
      // Initialize wizard with greeting
      const greetingMessage: WizardMessage = {
        id: `wizard-${Date.now()}-greeting`,
        role: 'assistant',
        content: "Hello! I'm the FIDU-Prompt-Wizard, your friendly prompt enhancement bot. My goal is to help you transform your initial idea into a powerful, precise instruction for an AI. Please share the prompt you'd like me to help you improve.",
        timestamp: new Date().toISOString()
      };
      setWizardMessages([greetingMessage]);
      
      // Clear the initial message after it's been set to prevent reuse
      setTimeout(() => setWizardInitialMessage(''), 100);
    }
  };

  const handleCloseWizard = () => {
    setWizardOpen(false);
    setWizardMinimized(false);
    setWizardMessages([]); // Clear conversation when explicitly closed
    setWizardError(null);
    setWizardInitialMessage(''); // Clear initial message
  };

  const handleMinimizeWizard = () => {
    setWizardMinimized(true);
    setWizardOpen(false);
  };

  const handleMaximizeWizard = () => {
    setWizardMinimized(false);
    setWizardOpen(true);
  };

  const handleWizardSendMessage = async (message: string) => {
    if (!message.trim() || !currentProfile) return;

    const userMessage: WizardMessage = {
      id: `wizard-${Date.now()}-user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setWizardMessages(prev => [...prev, userMessage]);
    setWizardLoading(true);
    setWizardError(null);

    try {
      // Find the Prompt Wizard system prompt
      const promptWizardSystemPrompt = systemPrompts.find(sp => sp.id === 'sys-2');
      if (!promptWizardSystemPrompt) {
        throw new Error('Prompt Wizard system prompt not found');
      }

      // Convert wizard messages to regular messages for API call
      const apiMessages: Message[] = wizardMessages.map(wm => ({
        id: wm.id,
        conversationId: 'wizard',
        content: wm.content,
        role: wm.role,
        timestamp: wm.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false
      }));

      // Add the new user message
      const apiUserMessage: Message = {
        id: userMessage.id,
        conversationId: 'wizard',
        content: userMessage.content,
        role: 'user',
        timestamp: userMessage.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false
      };

      // Add user message to API messages
      apiMessages.push(apiUserMessage);

      // Call the API with wizard-specific parameters
      const response = await promptsApi.executePrompt(
        apiMessages,
        null, // No context for wizard
        message,
        'gpt-oss-120b', // Fixed model for wizard
        currentProfile.id,
        [promptWizardSystemPrompt], // Use Prompt Wizard system prompt
        []
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;
        
        const aiMessage: WizardMessage = {
          id: `wizard-${Date.now()}-ai`,
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString()
        };
        setWizardMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('The wizard failed to complete the call, please try again shortly');
      }
    } catch (error) {
      console.error('Error getting wizard response:', error);
      setWizardError('Failed to get wizard response. Please try again.');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleCopyWizardResult = (content: string) => {
    setCurrentMessage(content);
    showToast('Prompt copied to chat input!');
    setWizardMinimized(true);
  };

  const handleClearWizardConversation = () => {
    setWizardMessages([]);
    setWizardError(null);
    setWizardInitialMessage(''); // Clear initial message
    showToast('Wizard conversation cleared');
  };

  // System Prompt Suggestor Wizard handlers
  const handleOpenSystemPromptSuggestor = () => {
    setSystemPromptSuggestorOpen(true);
    setSystemPromptSuggestorMinimized(false);
    setSystemPromptSuggestorMessages([]);
    setSystemPromptSuggestorError(null);
    setSystemPromptSuggestorInitialMessage(''); // Clear initial message
    
    // Add the librarian's greeting as the first assistant message
    const librarianGreeting: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-librarian-greeting`,
      role: 'assistant',
      content: 'Hello! I\'m the FIDU Librarian, your friendly system prompt assistant. I can help you find the perfect system prompt in our collection for your specific task or goal. What would you like to accomplish with AI today?',
      timestamp: new Date().toISOString()
    };
    
    setSystemPromptSuggestorMessages([librarianGreeting]);
  };

  const handleCloseSystemPromptSuggestor = () => {
    setSystemPromptSuggestorOpen(false);
    setSystemPromptSuggestorMinimized(false);
    setSystemPromptSuggestorMessages([]);
    setSystemPromptSuggestorError(null);
    setSystemPromptSuggestorInitialMessage('');
  };

  const handleMinimizeSystemPromptSuggestor = () => {
    setSystemPromptSuggestorMinimized(true);
    setSystemPromptSuggestorOpen(false);
  };

  const handleMaximizeSystemPromptSuggestor = () => {
    setSystemPromptSuggestorMinimized(false);
    setSystemPromptSuggestorOpen(true);
  };

  const handleSystemPromptSuggestorSendMessage = async (message: string) => {
    if (!message.trim() || !currentProfile) return;

    const userMessage: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setSystemPromptSuggestorMessages(prev => [...prev, userMessage]);
    setSystemPromptSuggestorLoading(true);
    setSystemPromptSuggestorError(null);

    try {
      // Find the System Prompt Suggestor system prompt
      const systemPromptSuggestorSystemPrompt = systemPrompts.find(sp => sp.id === 'sys-3');
      if (!systemPromptSuggestorSystemPrompt) {
        throw new Error('System Prompt Suggestor system prompt not found');
      }

      // Convert wizard messages to regular messages for API call
      // This includes the librarian's greeting message to maintain conversation context
      const apiMessages: Message[] = systemPromptSuggestorMessages.map(wm => ({
        id: wm.id,
        conversationId: 'system-prompt-suggestor',
        content: wm.content,
        role: wm.role,
        timestamp: wm.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false
      }));

      // Add the new user message
      const apiUserMessage: Message = {
        id: userMessage.id,
        conversationId: 'system-prompt-suggestor',
        content: userMessage.content,
        role: 'user',
        timestamp: userMessage.timestamp,
        platform: 'gpt-oss-120b',
        isEdited: false
      };

      // Add user message to API messages
      apiMessages.push(apiUserMessage);

      // Call the API with wizard-specific parameters
      const response = await promptsApi.executePrompt(
        apiMessages,
        null, // No context for wizard
        message,
        'gpt-oss-120b', // Fixed model for wizard
        currentProfile.id,
        [systemPromptSuggestorSystemPrompt], // Use System Prompt Suggestor system prompt
        []
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;
        
        const aiMessage: WizardMessage = {
          id: `system-prompt-suggestor-${Date.now()}-ai`,
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString()
        };
        setSystemPromptSuggestorMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('The System Prompt Suggestor failed to complete the call, please try again shortly');
      }
    } catch (error) {
      console.error('Error getting System Prompt Suggestor response:', error);
      setSystemPromptSuggestorError('Failed to get System Prompt Suggestor response. Please try again.');
    } finally {
      setSystemPromptSuggestorLoading(false);
    }
  };

  const handleCopySystemPromptSuggestorResult = (content: string) => {
    // For System Prompt Suggestor, we want to add the suggested system prompt to the selected system prompts
    // First, we need to find the system prompt by name from the content
    const suggestedPromptName = extractSystemPromptNameFromContent(content);
    if (suggestedPromptName) {
      const suggestedPrompt = systemPrompts.find(sp => sp.name === suggestedPromptName);
      if (suggestedPrompt && !selectedSystemPrompts.find(sp => sp.id === suggestedPrompt.id)) {
        setSelectedSystemPrompts(prev => [...prev, suggestedPrompt]);
        showToast(`System prompt "${suggestedPromptName}" added to selected prompts!`);
      } else if (suggestedPrompt) {
        showToast(`System prompt "${suggestedPromptName}" is already selected!`);
      } else {
        showToast('Could not find the suggested system prompt. Please add it manually.');
      }
    } else {
      showToast('Could not extract system prompt name from suggestion. Please add manually.');
    }
    setSystemPromptSuggestorMinimized(true);
  };

  const handleClearSystemPromptSuggestorConversation = () => {
    setSystemPromptSuggestorMessages([]);
    setSystemPromptSuggestorError(null);
    setSystemPromptSuggestorInitialMessage('');
    
    // Add the librarian's greeting back as the first assistant message
    const librarianGreeting: WizardMessage = {
      id: `system-prompt-suggestor-${Date.now()}-librarian-greeting`,
      role: 'assistant',
      content: 'Hello! I\'m the FIDU Librarian, your friendly system prompt assistant. I can help you find the perfect system prompt in our collection for your specific task or goal. What would you like to accomplish with AI today?',
      timestamp: new Date().toISOString()
    };
    
    setSystemPromptSuggestorMessages([librarianGreeting]);
    showToast('System Prompt Suggestor conversation cleared');
  };

  // Helper function to extract system prompt name from the librarian's response
  const extractSystemPromptNameFromContent = (content: string): string | null => {
    // Look for patterns like "I recommend the [Name] system prompt" or "The [Name] prompt would be perfect"
    const patterns = [
      /(?:recommend|suggest|perfect|ideal).*?["']([^"']+)["']/i,
      /(?:recommend|suggest|perfect|ideal).*?the\s+([A-Za-z\s]+?)\s+(?:system\s+)?prompt/i,
      /(?:system\s+)?prompt.*?["']([^"']+)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  };

  // Helper function to get system prompt by ID
  const getSystemPromptById = (id: string): SystemPrompt | null => {
    return systemPrompts.find(sp => sp.id === id) || null;
  };

  // Handler for adding system prompts from wizard suggestions
  const handleAddSystemPromptFromWizard = (promptId: string) => {
    const systemPrompt = getSystemPromptById(promptId);
    if (systemPrompt && !selectedSystemPrompts.find(sp => sp.id === promptId)) {
      setSelectedSystemPrompts(prev => [...prev, systemPrompt]);
      showToast(`System prompt "${systemPrompt.name}" added to selected prompts!`);
    } else if (systemPrompt) {
      showToast(`System prompt "${systemPrompt.name}" is already selected!`);
    } else {
      showToast('Could not find the suggested system prompt. Please add it manually.');
    }
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      const messages = await conversationsService.getMessages(conversation.id);
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
    // Clear persisted conversation state
    clearSession();
    // Reset to default system prompt
    if (systemPrompts.length > 0) {
      const defaultPrompt = systemPrompts.find(sp => sp.isDefault) || systemPrompts[0];
      if (defaultPrompt) {
        setSelectedSystemPrompts([defaultPrompt]);
      }
    }
    // Note: Embellishments removed
  }, [systemPrompts, clearSession]);

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
        []
      );

      if (response.status === 'completed' && response.responses?.content) {
        const content = response.responses.content;
        
        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          conversationId: 'current',
          content: content,
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
        console.log('AI retry response failed - Status:', response.status, 'Content present:', !!response.responses?.content, 'Full response:', response);
        throw new Error('The model failed to complete the call, please try again shortly');
      }
    } catch (error) {
      console.error('Error retrying message:', error);
      
      // Determine user-friendly error message and debug info
      const { userMessage: errorUserMessage, debugInfo } = getErrorMessage(error, selectedModel);
      console.log('AI Retry Error Debug Info:', debugInfo);
      
      // Log additional timeout details if this is a timeout error
      if (error instanceof ApiError && error.status === 408 && error.data) {
        console.log('Detailed Timeout Analysis (Retry):', error.data);
      }
      
      setError(errorUserMessage);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        conversationId: 'current',
        content: `Error: ${errorUserMessage}`,
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
  }, [messages, selectedContext, selectedModel, currentProfile, selectedSystemPrompts, saveConversation, showToast]);

  // Construct the full prompt as it would be sent to the model
  const constructFullPrompt = useCallback(() => {
    // Use the same unified function that builds prompts for the API
    return buildCompletePrompt(
      selectedSystemPrompts,
      [], // Embellishments removed
      selectedContext,
      messages,
      currentMessage.trim() || (messages.length > 0 ? messages.filter(m => m.role === 'user').pop()?.content || '' : '')
    );
  }, [selectedSystemPrompts, selectedContext, messages, currentMessage]);

  return (
    <Box sx={{ 
      height: '100%', // Use full height of parent container
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden', // Prevent outer page scrolling
      // Mobile-specific adjustments
      ...(isMobile && {
        height: 'calc(100vh - 120px)', // Account for bottom navigation
      })
    }}>
      {/* Storage Directory Banner */}
      <StorageDirectoryBanner pageType="prompt-lab" />
      
      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden', 
        position: 'relative',
        pb: isMobile ? 0 : 0, // No bottom padding needed since prompt bar is fixed
        minHeight: 0, // Ensure flex child can shrink properly
        // Mobile-specific adjustments
        ...(isMobile && {
          pb: 2, // Add padding for mobile
        })
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
            p: isMobile ? spacing.padding.sm : 3,
            pb: isMobile ? 25 : 24, // Extra bottom padding for mobile input box
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 1.5 : 2,
            // Mobile-specific scroll behavior
            ...(isMobile && {
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '2px',
              },
            })
          }}
        >
          {/* New Conversation Button - Top Right (when context is selected and messages exist) - Desktop Only */}
          {!isMobile && selectedContext && messages.length > 0 && (
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

          {/* New Conversation Button - Top Right (when no context selected and messages exist) - Desktop Only */}
          {!isMobile && messages.length > 0 && !selectedContext && (
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
                  mb: isMobile ? 1.5 : 2,
                  mr: message.role === 'user' ? (isMobile ? '5%' : '15%') : 0,
                  ml: message.role === 'assistant' ? (isMobile ? '5%' : 0) : 0,
                }}
              >
                <Paper
                  sx={{
                    p: isMobile ? 1.5 : 2,
                    maxWidth: isMobile ? '90%' : '70%',
                    minWidth: isMobile ? '60%' : 'auto',
                    backgroundColor: message.role === 'user' 
                      ? 'primary.light' 
                          : message.role === 'assistant' && message.content.startsWith('Error:')
                            ? 'error.light'
                            : modelInfo.color, // Use model-specific color for AI messages
                    color: message.role === 'user' 
                      ? 'primary.contrastText' 
                      : 'white', 
                    borderRadius: isMobile ? 3 : 2,
                    position: 'relative',
                    // Add subtle shadow for better visual separation
                    boxShadow: message.role === 'assistant' ? 2 : 1,
                    // Add hover effect for user messages to indicate rewind functionality
                    ...(message.role === 'user' && !isMobile && {
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-1px)',
                        transition: 'all 0.2s ease'
                      }
                    }),
                    // Add subtle border to indicate interactive elements
                    border: message.role === 'user' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                    // Mobile-specific touch feedback
                    ...(isMobile && message.role === 'user' && {
                      '&:active': {
                        transform: 'scale(0.98)',
                        transition: 'transform 0.1s ease'
                      }
                    })
                  }}
                >
                  {message.role === 'assistant' && (
                    <Avatar sx={{ 
                      width: isMobile ? 20 : 24, 
                      height: isMobile ? 20 : 24, 
                      position: 'absolute', 
                      top: isMobile ? -10 : -12, 
                      left: isMobile ? -10 : -12,
                      bgcolor: message.content.startsWith('Error:') ? 'error.dark' : modelInfo.color
                    }}>
                      <ModelIcon fontSize={isMobile ? 'small' : 'small'} />
                    </Avatar>
                  )}
                      
                      {/* Model information for AI messages */}
                      {message.role === 'assistant' && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: isMobile ? 0.5 : 1, 
                          mb: isMobile ? 0.5 : 1,
                          flexWrap: isMobile ? 'wrap' : 'nowrap'
                        }}>
                          <Chip
                            label={modelInfo.name}
                            size="small"
                            sx={{
                              height: isMobile ? 18 : 20,
                              fontSize: isMobile ? '0.6rem' : '0.7rem',
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              color: 'white',
                              '& .MuiChip-label': {
                                px: isMobile ? 0.5 : 1
                              }
                            }}
                          />
                          {!isMobile && (
                            <Typography variant="caption" sx={{ opacity: 0.7, color: 'white' }}>
                              {modelInfo.provider}
                            </Typography>
                          )}
                        </Box>
                      )}
                      
                  <Box sx={{ 
                    // Let EnhancedMarkdown handle paragraph styling
                    // Remove conflicting paragraph styles that override markdown rendering
                    '& pre': { 
                      backgroundColor: 'rgba(0,0,0,0.1)', 
                      padding: isMobile ? 0.75 : 1, 
                      borderRadius: isMobile ? 0.75 : 1, 
                      overflow: 'auto',
                      margin: isMobile ? '6px 0' : '8px 0',
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    },
                    '& code': { 
                      backgroundColor: 'rgba(0,0,0,0.1)', 
                      padding: isMobile ? '1px 3px' : '2px 4px', 
                      borderRadius: isMobile ? 0.5 : 1,
                      fontFamily: 'monospace',
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    },
                    '& ul, & ol': { margin: isMobile ? '6px 0' : '8px 0', paddingLeft: isMobile ? 1.5 : 2 },
                    '& li': { margin: isMobile ? '2px 0' : '4px 0' },
                    '& blockquote': { 
                      borderLeft: '3px solid rgba(255,255,255,0.3)', 
                      paddingLeft: isMobile ? 0.75 : 1, 
                      margin: isMobile ? '6px 0' : '8px 0',
                      fontStyle: 'italic'
                    },
                    '& h1, & h2, & h3, & h4, & h5, & h6': {
                      margin: isMobile ? '8px 0 4px 0' : '12px 0 8px 0',
                      fontWeight: 600,
                      lineHeight: 1.2
                    },
                    '& h1': { fontSize: isMobile ? '1.3em' : '1.5em' },
                    '& h2': { fontSize: isMobile ? '1.2em' : '1.3em' },
                    '& h3': { fontSize: isMobile ? '1.1em' : '1.1em' },
                    '& strong': { fontWeight: 600 },
                    '& em': { fontStyle: 'italic' },
                    '& hr': { 
                      border: 'none', 
                      borderTop: '1px solid rgba(255,255,255,0.2)', 
                      margin: isMobile ? '12px 0' : '16px 0' 
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      margin: isMobile ? '6px 0' : '8px 0',
                      fontSize: isMobile ? '0.8rem' : '0.9rem'
                    },
                    '& th, & td': {
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: isMobile ? '2px 4px' : '4px 8px',
                      textAlign: 'left'
                    },
                    '& th': {
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      fontWeight: 600
                    },
                    // Add padding to prevent button overlap
                    paddingRight: message.role === 'user' ? (isMobile ? '36px' : '44px') : (isMobile ? '36px' : '44px'), // Space for rewind/copy buttons
                    paddingBottom: message.role === 'assistant' ? (isMobile ? '36px' : '44px') : (isMobile ? '6px' : '8px'), // Extra bottom padding for copy button
                    // Mobile-specific typography
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    lineHeight: isMobile ? 1.4 : 1.5
                  }}>
                    <EnhancedMarkdown 
                      content={message.content}
                      enableSyntaxHighlighting={true}
                      showCopyButtons={true}
                      preprocess={true}
                    />
                  </Box>

                  {/* Rewind Button for User Messages */}
                  {message.role === 'user' && (
                    <IconButton
                      onClick={() => handleRewindToMessage(messageIndex)}
                      sx={{
                        position: 'absolute',
                        top: isMobile ? 6 : 8,
                        right: isMobile ? 6 : 8,
                        width: isMobile ? 32 : 28,
                        height: isMobile ? 32 : 28,
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
                        '&:active': isMobile ? {
                          transform: 'scale(0.95)',
                          backgroundColor: 'rgba(0,0,0,0.3)'
                        } : {},
                        transition: 'all 0.2s ease'
                      }}
                      title="Rewind conversation to this point (removes all messages after this message)"
                    >
                      <RestartAltIcon sx={{ fontSize: isMobile ? 16 : 14 }} />
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
                        bottom: isMobile ? 6 : 8,
                        right: isMobile ? 6 : 8,
                        width: isMobile ? 32 : 28,
                        height: isMobile ? 32 : 28,
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
                        '&:active': isMobile ? {
                          transform: 'scale(0.95)',
                          backgroundColor: 'rgba(255,255,255,0.4)'
                        } : {},
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <ContentCopyIcon sx={{ fontSize: isMobile ? 16 : 14 }} />
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
          left: isMobile ? 0 : 240, // Account for sidebar width on desktop
          right: 0,
          background: isMobile ? 'transparent' : 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.9) 100%)',
          p: isMobile ? 0 : 3,
          zIndex: 1000
        }}>
          {/* Container to center content within chat window */}
          <Box sx={{ 
            maxWidth: isMobile ? '100%' : 800,
            mx: isMobile ? 0 : 'auto',
            px: isMobile ? 0 : 2
          }}>
            {/* System Prompts Sliding Drawer - Desktop Only */}
            {!isMobile && (
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

                  {/* System Prompt Suggestor Wizard Button */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      p: 2, 
                      borderRadius: 2, 
                      backgroundColor: 'rgba(147, 112, 219, 0.1)',
                      border: '1px solid rgba(147, 112, 219, 0.3)',
                      mb: 2
                    }}>
                      <HelpOutlineIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                        Not sure what system prompt to use? Ask our librarian wizard:
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<WizardIcon />}
                        onClick={handleOpenSystemPromptSuggestor}
                        sx={{
                          backgroundColor: 'secondary.main',
                          color: 'secondary.contrastText',
                          borderRadius: 2,
                          px: 2,
                          py: 0.5,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          '&:hover': {
                            backgroundColor: 'secondary.dark'
                          }
                        }}
                      >
                        Ask Librarian
                      </Button>
                    </Box>
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
            )}

            {/* Unified Prompt Entry Container */}
            <Paper sx={{ 
              p: isMobile ? 2 : 0.75, 
              borderRadius: isMobile ? 0 : 2,
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              boxShadow: isMobile ? 3 : 1,
              // Mobile-specific positioning
              ...(isMobile ? {
                position: 'fixed',
                bottom: 0, // At the very bottom of the screen
                left: 0,
                right: 0,
                zIndex: 1000,
                maxWidth: '100vw',
                borderRadius: 0, // Full width, no border radius
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderTop: 1,
                borderTopColor: 'divider',
              } : {})
            }}>
              {/* Message Input Container */}
              <Box sx={{ 
                position: 'relative',
                width: '100%'
              }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={isMobile ? 2 : 1}
                  maxRows={isMobile ? 4 : 6}
                  placeholder={isMobile ? "Type your message..." : "Type your message..."}
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
                      borderRadius: isMobile ? 2 : 2,
                      backgroundColor: 'background.paper',
                      boxShadow: isMobile ? 1 : 1,
                      pr: isMobile ? 18 : 16, // Add right padding to make room for wizard and send buttons
                      fontSize: isMobile ? '1rem' : '0.875rem',
                      minHeight: isMobile ? 48 : 'auto',
                      border: isMobile ? '1px solid rgba(0,0,0,0.12)' : 'none',
                    },
                    '& .MuiInputBase-input': {
                      fontSize: isMobile ? '1rem' : '0.875rem',
                      padding: isMobile ? '12px 14px' : '8px 14px',
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ChatIcon color="action" sx={{ fontSize: isMobile ? 20 : 18 }} />
                      </InputAdornment>
                    )
                  }}
                />

                {/* Wizard Button - Inside text box */}
                <Tooltip title="Open Prompt Wizard">
                  <IconButton
                    onClick={handleOpenWizard}
                    sx={{
                      position: 'absolute',
                      right: isMobile ? 60 : 48,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: isMobile ? 40 : 32,
                      height: isMobile ? 40 : 32,
                      borderRadius: '50%',
                      backgroundColor: 'secondary.main',
                      color: 'secondary.contrastText',
                      '&:hover': {
                        backgroundColor: 'secondary.dark'
                      },
                      '&:active': isMobile ? {
                        transform: 'translateY(-50%) scale(0.95)',
                      } : {},
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <WizardIcon sx={{ fontSize: isMobile ? 20 : 16 }} />
                  </IconButton>
                </Tooltip>

                {/* Send Button - Inside text box */}
                <IconButton
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isLoading}
                  sx={{
                    position: 'absolute',
                    right: isMobile ? 10 : 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: isMobile ? 40 : 32,
                    height: isMobile ? 40 : 32,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled'
                    },
                    '&:active': isMobile ? {
                      transform: 'translateY(-50%) scale(0.95)',
                    } : {},
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={isMobile ? 20 : 16} color="inherit" />
                  ) : (
                    <SendIcon sx={{ fontSize: isMobile ? 20 : 16 }} />
                  )}
                </IconButton>
              </Box>

              {/* Controls Container Box - Mobile responsive */}
              {!isMobile ? (
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
                    model: {selectedModel} ▾
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
              ) : (
                // Mobile controls - Collapsible
                <Collapse in={showMobileControls}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 1.5, 
                    mt: 1.5,
                    px: 0.5
                  }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setModelModalOpen(true)}
                      sx={{ 
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    >
                      model: {selectedModel} ▾
                    </Button>
                    
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setContextModalOpen(true)}
                      sx={{ 
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
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
                      onClick={() => setSystemPromptModalOpen(true)}
                      sx={{ 
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    >
                      System Prompts ({selectedSystemPrompts.length}) ▾
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setFullPromptModalOpen(true)}
                      sx={{ 
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    >
                      View Full Prompt
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setConversationsDrawerOpen(!conversationsDrawerOpen)}
                      sx={{ 
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        color: 'primary.dark',
                        borderColor: 'primary.dark',
                        boxShadow: 1,
                        fontSize: '0.8rem',
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'primary.light',
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    >
                      Recent Conversations
                    </Button>
                  </Box>
                </Collapse>
              )}

              {/* Mobile Controls Toggle and New Chat Button */}
              {isMobile && (
                <Box sx={{ 
                  position: 'relative',
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  mt: 1.5,
                  mb: 0.5,
                  px: 2,
                }}>
                  {/* New Chat Button - Positioned at 1/4 from left */}
                  {messages.length > 0 && (
                    <Box sx={{
                      position: 'absolute',
                      left: '25%',
                      transform: 'translateX(-50%)',
                    }}>
                      <Button
                        variant="outlined"
                        onClick={startNewConversation}
                        startIcon={<AddIcon />}
                        size="small"
                        sx={{ 
                          color: 'primary.dark', 
                          borderColor: 'primary.dark',
                          fontSize: '0.75rem',
                          px: 2,
                          py: 0.75,
                          whiteSpace: 'nowrap',
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
                  
                  {/* Menu Toggle Button - Centered */}
                  <IconButton
                    onClick={() => setShowMobileControls(!showMobileControls)}
                    sx={{
                      backgroundColor: 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.selected'
                      },
                      width: 44,
                      height: 44,
                    }}
                  >
                    {showMobileControls ? <ExpandMore /> : <ExpandLessIcon />}
                  </IconButton>
                </Box>
              )}
            </Paper>


        </Box>
                  </Box>

            {/* Right Sidebar - Recent Conversations */}
      <Drawer
        anchor="right"
        open={conversationsDrawerOpen}
        onClose={() => setConversationsDrawerOpen(false)}
        variant={isMobile ? "temporary" : "persistent"}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? '85vw' : 300,
            maxWidth: isMobile ? 400 : 300,
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

      {/* Chat History Tab - Desktop Only */}
      {!isMobile && (
      <Tooltip title="Recent Conversations" placement="left">
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
      </Tooltip>
      )}

      {/* Wizard Tab - Desktop Only */}
      {!isMobile && wizardMessages.length > 0 && (
      <Tooltip title="Prompt Wizard" placement="left">
        <Box
          onClick={wizardOpen ? handleMinimizeWizard : handleMaximizeWizard}
          sx={{
            position: 'fixed',
            right: wizardOpen && !wizardMinimized ? 600 : 0,
            top: conversationsDrawerOpen ? 'calc(50% + 80px)' : 'calc(50% + 50px)', // Position below conversations tab with more gap
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
              backgroundColor: 'secondary.main',
              color: 'secondary.contrastText',
              boxShadow: 2,
              '&:hover': {
                backgroundColor: 'secondary.dark',
                boxShadow: 4
              }
            }}
          >
            <ChevronLeftIcon 
              sx={{ 
                fontSize: 18,
                transform: wizardOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease'
              }} 
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WizardIcon sx={{ fontSize: 20 }} />
            </Box>
          </Paper>
        </Box>
      </Tooltip>
      )}

      {/* System Prompt Suggestor Tab - Desktop Only */}
      {!isMobile && systemPromptSuggestorMessages.length > 0 && (
      <Tooltip title="System Prompt Librarian" placement="left">
        <Box
          onClick={systemPromptSuggestorOpen ? handleMinimizeSystemPromptSuggestor : handleMaximizeSystemPromptSuggestor}
          sx={{
            position: 'fixed',
            right: systemPromptSuggestorOpen && !systemPromptSuggestorMinimized ? 600 : 0,
            top: conversationsDrawerOpen ? 'calc(50% + 140px)' : 'calc(50% + 110px)', // Position below wizard tab
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
              backgroundColor: 'secondary.main',
              color: 'secondary.contrastText',
              boxShadow: 2,
              '&:hover': {
                backgroundColor: 'secondary.dark',
                boxShadow: 4
              }
            }}
          >
            <ChevronLeftIcon 
              sx={{ 
                fontSize: 18,
                transform: systemPromptSuggestorOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease'
              }} 
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MenuBookIcon sx={{ fontSize: 20 }} />
            </Box>
          </Paper>
        </Box>
      </Tooltip>
      )}

      {/* Modals */}
      <ModelSelectionModal
        open={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelectModel={(model) => {
          setSelectedModel(model);
          dispatch(updateLastUsedModel(model));
          setModelModalOpen(false);
        }}
        onAutoModeToggle={(model) => {
          setSelectedModel(model);
          dispatch(updateLastUsedModel(model));
          // Don't close the modal for auto mode toggles
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


      <FullPromptModal
        open={fullPromptModalOpen}
        onClose={() => setFullPromptModalOpen(false)}
        fullPrompt={constructFullPrompt()}
      />

      {/* Wizard Window */}
      <WizardWindow
        open={wizardOpen}
        onClose={handleCloseWizard}
        onMinimize={handleMinimizeWizard}
        title="Prompt Wizard"
        messages={wizardMessages}
        isLoading={wizardLoading}
        error={wizardError}
        onSendMessage={handleWizardSendMessage}
        onCopyResult={handleCopyWizardResult}
        onClearConversation={handleClearWizardConversation}
        initialMessage={wizardInitialMessage}
        modelName="GPT-OSS 120B"
      />

      {/* System Prompt Suggestor Wizard Window */}
      <WizardWindow
        open={systemPromptSuggestorOpen}
        onClose={handleCloseSystemPromptSuggestor}
        onMinimize={handleMinimizeSystemPromptSuggestor}
        title="System Prompt Librarian"
        messages={systemPromptSuggestorMessages}
        isLoading={systemPromptSuggestorLoading}
        error={systemPromptSuggestorError}
        onSendMessage={handleSystemPromptSuggestorSendMessage}
        onCopyResult={handleCopySystemPromptSuggestorResult}
        onClearConversation={handleClearSystemPromptSuggestorConversation}
        initialMessage={systemPromptSuggestorInitialMessage}
        modelName="GPT-OSS 120B"
        onAddSystemPrompt={handleAddSystemPromptFromWizard}
        systemPrompts={systemPrompts}
        showCopyButton={false}
        icon={<MenuBookIcon color="secondary" />}
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