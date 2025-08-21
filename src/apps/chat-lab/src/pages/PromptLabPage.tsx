import { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemSecondaryAction,
  Paper
} from '@mui/material';
import {
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  PlayArrow as ExecuteIcon,
  Settings as SettingsIcon,
  BookmarkBorder as BookmarkIcon,
  Description as ContextIcon,
  SmartToy as SystemPromptIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useAppSelector } from '../store';
import { createPromptsApi } from '../services/api/prompts';
import type { DataPacketQueryParams, Conversation, Message, Context, SystemPrompt } from '../types';
import { ConversationManager } from '../components/conversations/ConversationManager';
import { conversationsApi } from '../services/api/conversations';

// New interfaces for the updated prompt structure
interface PromptObject {
  id: string;
  title: string;
  promptText: string;
  context: Context | null;
  systemPrompt: SystemPrompt;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata?: {
    estimatedTokens: number;
  };
}

interface LoadSavedPromptModalProps {
  open: boolean;
  onClose: () => void;
  onLoadPrompt: (prompt: PromptObject) => void;
  savedPrompts: PromptObject[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

interface ContextSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectContext: (context: Context) => void;
  contexts: Context[];
  loading: boolean;
  error: string | null;
}

interface SystemPromptSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSystemPrompt: (systemPrompt: SystemPrompt) => void;
  systemPrompts: SystemPrompt[];
  loading: boolean;
  error: string | null;
}

// Load Saved Prompt Modal Component
function LoadSavedPromptModal({ 
  open, 
  onClose, 
  onLoadPrompt, 
  savedPrompts, 
  loading, 
  error,
  onRefresh
}: LoadSavedPromptModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return savedPrompts;
    const query = searchQuery.toLowerCase();
    return savedPrompts.filter(prompt => 
      prompt.promptText.toLowerCase().includes(query) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [savedPrompts, searchQuery]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Load Saved Prompt
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth
            placeholder="Search saved prompts..."
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

          {!loading && !error && filteredPrompts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {searchQuery ? 'No prompts match your search' : 'No saved prompts yet'}
              </Typography>
            </Box>
          )}

          {!loading && !error && filteredPrompts.length > 0 && (
            <List>
              {filteredPrompts.map((prompt) => (
                <ListItem key={prompt.id} divider>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body1" component="div" sx={{ fontWeight: 500, mb: 1 }}>
                      {prompt.promptText.substring(0, 100) + (prompt.promptText.length > 100 ? '...' : '')}
                    </Typography>
                    <Box component="div" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
                      Context: {prompt.context?.title || 'None'} | System: {prompt.systemPrompt.name}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {prompt.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onLoadPrompt(prompt)}
                    >
                      Load
                    </Button>
                  </ListItemSecondaryAction>
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

// Context Selection Modal Component
function ContextSelectionModal({ 
  open, 
  onClose, 
  onSelectContext, 
  contexts, 
  loading, 
  error 
}: ContextSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContexts = useMemo(() => {
    if (!searchQuery.trim()) return contexts;
    const query = searchQuery.toLowerCase();
    return contexts.filter(context => 
              context.title.toLowerCase().includes(query) ||
        context.body.toLowerCase().includes(query)
    );
  }, [contexts, searchQuery]);

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
                    <Box component="div" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
                      {context.body}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip 
                        label={`${context.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label="Active" 
                        size="small" 
                        color="success"
                      />
                    </Box>
                  </Box>
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onSelectContext(context)}
                    >
                      Select
                    </Button>
                  </ListItemSecondaryAction>
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

// View Prompt Modal Component
function ViewPromptModal({ 
  open, 
  onClose, 
  currentPrompt 
}: { 
  open: boolean; 
  onClose: () => void; 
  currentPrompt: PromptObject; 
}) {
  const [copied, setCopied] = useState(false);

  const formattedPrompt = useMemo(() => {
    let prompt = `${currentPrompt.systemPrompt.content}\n\n`;
    
    if (currentPrompt.context) {
      prompt += `Given the following context:\n${currentPrompt.context.body}\n\n`;
    }
    
    prompt += `Respond to the following prompt:\n${currentPrompt.promptText}`;
    
    return prompt;
  }, [currentPrompt]);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formattedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>View Formatted Prompt</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Prompt as it will be sent to the model:
            </Typography>
            <Button
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <CopyIcon />}
              onClick={handleCopyToClipboard}
              size="small"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
          </Box>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              maxHeight: '400px',
              overflow: 'auto'
            }}
          >
            <Typography variant="body2" component="pre" sx={{ 
              margin: 0, 
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word'
            }}>
              {formattedPrompt}
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// System Prompt Selection Modal Component
function SystemPromptSelectionModal({ 
  open, 
  onClose, 
  onSelectSystemPrompt, 
  systemPrompts, 
  loading, 
  error 
}: SystemPromptSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

      const filteredSystemPrompts = useMemo(() => {
      if (!searchQuery.trim()) return systemPrompts;
      const query = searchQuery.toLowerCase();
      return systemPrompts.filter(sp => 
        sp.name.toLowerCase().includes(query) ||
        sp.description.toLowerCase().includes(query)
      );
    }, [systemPrompts, searchQuery]);

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
                    <Box component="div" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
                      {systemPrompt.description}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip 
                        label={`${systemPrompt.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={systemPrompt.isDefault ? 'Default' : 'Custom'} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onSelectSystemPrompt(systemPrompt)}
                    >
                      Select
                    </Button>
                  </ListItemSecondaryAction>
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

  // Get auth state for profile ID
  const { currentProfile } = useAppSelector((state) => state.auth);

  // Create prompts API
  const promptsApi = useMemo(() => {
    return createPromptsApi();
  }, []);

  // Current prompt object state
  const [currentPrompt, setCurrentPrompt] = useState<PromptObject>({
    id: '',
    title: '',
    promptText: '',
    context: null,
    systemPrompt: {
      id: 'default',
      name: 'Default Technical Assistant',
      content: 'You are an expert technical assistant with deep knowledge of software development, architecture, and best practices. Provide clear, accurate, and actionable advice.',
      description: 'General technical assistance with focus on software development',
      tokenCount: 42,
      isDefault: true,
      isSystem: true,
      category: 'Technical',
      modelCompatibility: ['claude-3-opus', 'claude-3-sonnet', 'gpt-4-turbo', 'gemini-ultra'],
      createdAt: new Date('2024-01-10').toISOString(),
      updatedAt: new Date('2024-01-10').toISOString(),
      tags: ['technical', 'development', 'assistant']
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    metadata: {
      estimatedTokens: 0
    }
  });

  // Modal states
  const [loadSavedModalOpen, setLoadSavedModalOpen] = useState(false);
  const [contextSelectionModalOpen, setContextSelectionModalOpen] = useState(false);
  const [systemPromptSelectionModalOpen, setSystemPromptSelectionModalOpen] = useState(false);
  const [savePromptDialog, setSavePromptDialog] = useState(false);
  const [viewPromptModalOpen, setViewPromptModalOpen] = useState(false);

  // Save dialog states
  const [promptTitle, setPromptTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Data states
  const [savedPrompts, setSavedPrompts] = useState<PromptObject[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [models] = useState([
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { id: 'gpt-4.0-turbo', name: 'GPT-4.0 Turbo', provider: 'OpenAI' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  ]);
  const [selectedModel, setSelectedModel] = useState('');

  // Loading states
  const [loadingSavedPrompts, setLoadingSavedPrompts] = useState(false);

  // Error states
  const [savedPromptsError, setSavedPromptsError] = useState<string | null>(null);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);

  // Conversation management state
  const [conversationTabs, setConversationTabs] = useState<Array<{
    id: string;
    conversation: Conversation;
    messages: Message[];
    isMinimized: boolean;
    isActive: boolean;
    title: string;
    model: string;
    unreadCount: number;
  }>>([]);

  // Load saved prompts from API
  const loadSavedPrompts = useCallback(async () => {
    if (!currentProfile) return;
    
    setLoadingSavedPrompts(true);
    setSavedPromptsError(null);
    
    try {
      const queryParams: DataPacketQueryParams = {
        tags: ["FIDU-CHAT-LAB-Prompt", "FIDU-CHAT-LAB-Saved"],
        profile_id: currentProfile.id,
        limit: 100,
        offset: 0,
        sort_order: "desc"
      };
      
      const response = await promptsApi.getAll(queryParams);
      if ('prompts' in response) {
        // Transform the API response to PromptObject format
        const transformedPrompts: PromptObject[] = response.prompts.map(prompt => ({
          id: prompt.id,
          title: prompt.title,
          promptText: prompt.promptText,
          context: prompt.context,
          systemPrompt: prompt.systemPrompt,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
          tags: prompt.tags,
          metadata: prompt.metadata
        }));
        setSavedPrompts(transformedPrompts);
      }
    } catch (error: any) {
      console.error('Error loading saved prompts:', error);
      setSavedPromptsError(error.message || 'Failed to load saved prompts');
    } finally {
      setLoadingSavedPrompts(false);
    }
  }, [currentProfile, promptsApi]);

  // Load data when profile changes
  useEffect(() => {
    if (currentProfile) {
      loadSavedPrompts();
    }
  }, [currentProfile, loadSavedPrompts]);

  // Mock data loading for contexts and system prompts (replace with actual API calls later)
  useEffect(() => {
    // Load mock contexts
    setContexts([
              {
          id: 'ctx-1',
          title: 'React Development Patterns',
          body: 'Best practices and patterns for React development including hooks, state management, and performance optimization.',
          tokenCount: 4500,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          conversationIds: [],
          conversationMetadata: {
            totalMessages: 0,
            lastAddedAt: new Date().toISOString(),
            platforms: []
          }
        },
        {
          id: 'ctx-2',
          title: 'API Design Guidelines',
          body: 'RESTful API design principles, GraphQL patterns, and authentication strategies.',
          tokenCount: 3200,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          conversationIds: [],
          conversationMetadata: {
            totalMessages: 0,
            lastAddedAt: new Date().toISOString(),
            platforms: []
          }
        }
    ]);

    // Load mock system prompts
    setSystemPrompts([
      {
        id: 'sys-1',
        name: 'Technical Assistant',
        content: 'You are an expert technical assistant with deep knowledge of software development, architecture, and best practices. Provide clear, accurate, and actionable advice.',
        description: 'General technical assistance with focus on software development',
        tokenCount: 42,
        isDefault: true,
        isSystem: true,
        category: 'Technical',
        modelCompatibility: ['claude-3-opus', 'claude-3-sonnet', 'gpt-4-turbo', 'gemini-ultra'],
        createdAt: new Date('2024-01-10').toISOString(),
        updatedAt: new Date('2024-01-10').toISOString(),
        tags: ['technical', 'development', 'assistant']
      },
      {
        id: 'sys-2',
        name: 'Code Reviewer',
        content: 'You are an expert code reviewer. Analyze code for best practices, potential bugs, security issues, and performance improvements. Provide constructive feedback with specific examples.',
        description: 'Specialized in code review and analysis',
        tokenCount: 38,
        isDefault: false,
        isSystem: true,
        category: 'Development',
        modelCompatibility: ['claude-3-opus', 'gpt-4-turbo'],
        createdAt: new Date('2024-01-12').toISOString(),
        updatedAt: new Date('2024-01-12').toISOString(),
        tags: ['code-review', 'development', 'quality']
      }
    ]);
  }, []);

  // Calculate total tokens
  const totalTokens = useMemo(() => {
    let total = 0;
    total += Math.ceil(currentPrompt.promptText.length / 4); // Approximate tokens
    if (currentPrompt.context) {
      total += currentPrompt.context.tokenCount;
    }
    total += currentPrompt.systemPrompt.tokenCount;
    return total;
  }, [currentPrompt]);

  // Handle loading a saved prompt
  const handleLoadSavedPrompt = (prompt: PromptObject) => {
    setCurrentPrompt(prompt);
    setLoadSavedModalOpen(false);
  };

  // Handle selecting a context
  const handleSelectContext = (context: Context) => {
    setCurrentPrompt(prev => ({ ...prev, context }));
    setContextSelectionModalOpen(false);
  };

  // Handle selecting a system prompt
  const handleSelectSystemPrompt = (systemPrompt: SystemPrompt) => {
    setCurrentPrompt(prev => ({ ...prev, systemPrompt }));
    setSystemPromptSelectionModalOpen(false);
  };

  // Handle saving the prompt
  const handleSavePrompt = () => {
    if (!currentPrompt.promptText.trim()) {
      setSaveError('Please enter prompt text before saving');
      return;
    }
    
    const defaultTitle = currentPrompt.promptText.substring(0, 50) + (currentPrompt.promptText.length > 50 ? '...' : '');
    setPromptTitle(defaultTitle);
    setSavePromptDialog(true);
  };

  // Handle save confirmation
  const handleSaveConfirm = async () => {
    if (!currentPrompt.promptText.trim() || !promptTitle.trim()) {
      setSaveError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      // Create a prompt object for saving
      const promptToSave: PromptObject = {
        id: `prompt-${Date.now()}`,
        title: promptTitle,
        promptText: currentPrompt.promptText,
        context: currentPrompt.context,
        systemPrompt: currentPrompt.systemPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [...currentPrompt.tags, 'FIDU-CHAT-LAB-Saved'],
        metadata: {
          estimatedTokens: totalTokens
        }
      };

      // Save to FIDU Vault via API
      const savedPrompt = await promptsApi.savePrompt(promptToSave, currentProfile?.id);
      
      // Update local state with the saved prompt
      setSavedPrompts(prev => [savedPrompt, ...prev]);
      setSaveSuccess('Prompt saved successfully!');
      
      // Auto-close dialog after 2 seconds
      setTimeout(() => {
        setSavePromptDialog(false);
        setPromptTitle('');
        setSaveError(null);
        setSaveSuccess(null);
        setIsSaving(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      setSaveError(error.message || 'Failed to save prompt');
      setIsSaving(false);
    }
  };

  // Handle executing the prompt
  const handleExecute = async () => {
    if (!currentPrompt.promptText.trim()) {
      setExecutionError('Please enter prompt text before executing');
      return;
    }

    if (!selectedModel) {
      setExecutionError('Please select a model before executing');
      return;
    }

    if (!currentProfile) {
      setExecutionError('Please select a profile before executing');
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);

    try {
      // Execute the prompt via API
      const executionResult = await promptsApi.executePrompt(
        [], // No previous messages for initial prompt
        currentPrompt.context,
        currentPrompt.promptText,
        selectedModel,
        currentProfile.id
      );

      // Create conversation messages from the execution result
      const userMessage = {
        id: `msg-usr-${Date.now()}`,
        role: 'user' as const,
        content: currentPrompt.promptText,
        timestamp: new Date().toISOString(),
        platform: selectedModel,
        conversationId: 'execution-conversation',
        isEdited: false
      };

      const assistantMessage = {
        id: executionResult.id,
        role: 'assistant' as const,
        content: executionResult.responses.content,
        timestamp: executionResult.timestamp,
        platform: selectedModel,
        conversationId: 'execution-conversation',
        isEdited: false
      };

      // Create a new conversation with the original prompt information
      const newConversation: Partial<Conversation> = {
        id: uuidv4(), // Generate unique ID for new conversation
        title: currentPrompt.title || currentPrompt.promptText.substring(0, 50) + '...',
        platform: selectedModel.toLowerCase() as 'chatgpt' | 'claude' | 'gemini' | 'other',
        tags: ['FIDU-CHAT-LAB-Conversation'],
        isArchived: false,
        isFavorite: false,
        participants: ['User', 'AI Assistant'],
        status: 'active' as const,
        originalPrompt: {
          promptText: currentPrompt.promptText,
          context: currentPrompt.context,
          systemPrompt: currentPrompt.systemPrompt,
          metadata: {
            estimatedTokens: totalTokens
          }
        }
      };

      // Save the conversation to FIDU Vault
      const savedConversation = await conversationsApi.createConversation(
        currentProfile.id,
        newConversation,
        [userMessage, assistantMessage],
        newConversation.originalPrompt
      );

      // Create new conversation tab
      const newTab = {
        id: savedConversation.id,
        conversation: savedConversation,
        messages: [userMessage, assistantMessage],
        isMinimized: false,
        isActive: true,
        title: savedConversation.title,
        model: selectedModel,
        unreadCount: 0
      };

      // Add new tab and deactivate others
      setConversationTabs(prev => 
        prev.map(tab => ({ ...tab, isActive: false })).concat(newTab)
      );
      
    } catch (error: any) {
      console.error('Error executing prompt:', error);
      setExecutionError(error.message || 'Failed to execute prompt');
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle closing conversation
  const handleCloseConversation = (conversationId: string) => {
    setConversationTabs(prev => prev.filter(tab => tab.id !== conversationId));
  };

  // Handle minimizing conversation
  const handleMinimizeConversation = (conversationId: string) => {
    setConversationTabs(prev => 
      prev.map(tab => 
        tab.id === conversationId 
          ? { ...tab, isMinimized: true, isActive: false }
          : tab
      )
    );
  };

  // Handle activating conversation
  const handleActivateConversation = (conversationId: string) => {
    setConversationTabs(prev => 
      prev.map(tab => ({
        ...tab,
        isActive: tab.id === conversationId,
        isMinimized: tab.id === conversationId ? false : tab.isMinimized
      }))
    );
  };

  // Handle sending follow-up messages
  const handleSendFollowUpMessage = async (conversationId: string, message: string) => {
    if (!currentProfile || !selectedModel) {
      setExecutionError('Cannot send message: missing profile or model');
      return;
    }

    const conversationTab = conversationTabs.find(tab => tab.id === conversationId);
    if (!conversationTab) {
      setExecutionError('Conversation not found');
      return;
    }

    setIsSendingFollowUp(true);
    setExecutionError(null);

    // Add user message to conversation
    const userMessage: Message = {
      id: `msg-usr-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      platform: selectedModel,
      conversationId: conversationId,
      isEdited: false
    };

    // Add user message to local state immediately
    setConversationTabs(prev => 
      prev.map(tab => 
        tab.id === conversationId 
          ? { ...tab, messages: [...tab.messages, userMessage] }
          : tab
      )
    );

    try {
      // Execute the follow-up message via API
      const executionResult = await promptsApi.executePrompt(
        [...conversationTab.messages, userMessage], // Pass previous messages + new user message for context
        conversationTab.conversation.originalPrompt?.context || null,
        message,
        selectedModel,
        currentProfile.id
      );

      // Create assistant message from the execution result
      const assistantMessage: Message = {
        id: executionResult.id,
        role: 'assistant',
        content: executionResult.responses.content,
        timestamp: executionResult.timestamp,
        platform: selectedModel,
        conversationId: conversationId,
        isEdited: false
      };

      // Add assistant message to conversation
      setConversationTabs(prev => 
        prev.map(tab => 
          tab.id === conversationId 
            ? { ...tab, messages: [...tab.messages, assistantMessage] }
            : tab
        )
      );

      // Update the conversation in FIDU Vault with new messages
      const updatedMessages = [...conversationTab.messages, userMessage, assistantMessage];
      await conversationsApi.updateConversation(
        conversationTab.conversation,
        updatedMessages,
        conversationTab.conversation.originalPrompt
      );

    } catch (error: any) {
      console.error('Error sending follow-up message:', error);
      setExecutionError(error.message || 'Failed to send follow-up message');
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Prompt Lab
          </Typography>
          {conversationTabs.length > 0 && (
            <Chip
              label={`${conversationTabs.length} conversation${conversationTabs.length > 1 ? 's' : ''} open`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
        <Typography variant="body1" color="text.secondary">
          Design, construct, optimize, and send your AI prompts to a range of models
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        gap: 3 
      }}>
        {/* Left Panel - Prompt Designer */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Construct Your Prompt
              </Typography>

              <Stack spacing={3}>
                {/* Load from Saved */}
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<BookmarkIcon />}
                    onClick={() => setLoadSavedModalOpen(true)}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Load from Saved
                  </Button>
                </Box>

                {/* Add Prompt Text */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Prompt Text
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    placeholder="Write your prompt here..."
                    value={currentPrompt.promptText}
                    onChange={(e) => setCurrentPrompt(prev => ({ 
                      ...prev, 
                      promptText: e.target.value,
                      updatedAt: new Date().toISOString()
                    }))}
                    variant="outlined"
                  />
                </Box>

                {/* Add Context */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Context
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<ContextIcon />}
                      onClick={() => setContextSelectionModalOpen(true)}
                      sx={{ flexGrow: 1, justifyContent: 'flex-start' }}
                    >
                                              {currentPrompt.context ? currentPrompt.context.title : 'Select Context'}
                    </Button>
                    {currentPrompt.context && (
                      <IconButton
                        onClick={() => setCurrentPrompt(prev => ({ ...prev, context: null }))}
                        size="small"
                      >
                        <CloseIcon />
                      </IconButton>
                    )}
                  </Box>
                  {currentPrompt.context && (
                    <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'background.paper' }}>
                      <Typography component="div" variant="body2" color="text.secondary">
                        {currentPrompt.context.body}
                      </Typography>
                      <Chip 
                        label={`${currentPrompt.context.tokenCount} tokens`} 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    </Paper>
                  )}
                </Box>

                {/* System Prompt */}
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    System Prompt
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<SystemPromptIcon />}
                      onClick={() => setSystemPromptSelectionModalOpen(true)}
                      sx={{ flexGrow: 1, justifyContent: 'flex-start' }}
                    >
                      {currentPrompt.systemPrompt.name}
                    </Button>
                    <IconButton
                      size="small"
                      disabled
                    >
                      <SettingsIcon />
                    </IconButton>
                  </Box>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'background.paper' }}>
                    <Typography component="div" variant="body2" color="text.secondary">
                      {currentPrompt.systemPrompt.content}
                    </Typography>
                    <Chip 
                      label={`${currentPrompt.systemPrompt.tokenCount} tokens`} 
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Right Panel - Prompt Stack & Execution */}
        <Box>
          <Stack spacing={3}>
            {/* Prompt Stack Preview */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Prompt Stack
                </Typography>
                
                <Stack spacing={2}>
                  {/* System Prompt */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      System Prompt
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {currentPrompt.systemPrompt.content.substring(0, 100)}...
                    </Typography>
                  </Box>

                  {/* Context */}
                  {currentPrompt.context && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Context
                      </Typography>
                      <Typography variant="body2">
                        {currentPrompt.context.title}
                      </Typography>
                    </Box>
                  )}

                  {/* User Prompt */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      User Prompt
                    </Typography>
                    <Typography variant="body2">
                      {currentPrompt.promptText || 'No prompt text entered'}
                    </Typography>
                  </Box>

                  {/* Token Count */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography component="div" variant="body2" color="text.secondary">
                      Total Tokens
                    </Typography>
                    <Chip label={totalTokens} size="small" color="primary" />
                  </Box>

                  {/* Save Button */}
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSavePrompt}
                    fullWidth
                  >
                    Save Prompt
                  </Button>

                  {/* View Prompt Button */}
                  <Button
                    variant="outlined"
                    startIcon={<CopyIcon />}
                    onClick={() => setViewPromptModalOpen(true)}
                    fullWidth
                  >
                    View Prompt
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Execution Controls */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Execute
                </Typography>
                
                <Stack spacing={2}>
                  {/* Model Selection */}
                  <FormControl fullWidth>
                    <InputLabel>Select Model</InputLabel>
                    <Select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      label="Select Model"
                    >
                      {models.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Execute Button */}
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<ExecuteIcon />}
                    onClick={handleExecute}
                    disabled={!selectedModel || !currentPrompt.promptText.trim() || isExecuting}
                    fullWidth
                  >
                    {isExecuting ? 'Executing...' : 'Execute'}
                  </Button>

                  {executionError && (
                    <Alert severity="error">
                      {executionError}
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      {/* Modals */}
      <LoadSavedPromptModal
        open={loadSavedModalOpen}
        onClose={() => setLoadSavedModalOpen(false)}
        onLoadPrompt={handleLoadSavedPrompt}
        savedPrompts={savedPrompts}
        loading={loadingSavedPrompts}
        error={savedPromptsError}
        onRefresh={loadSavedPrompts}
      />

      <ContextSelectionModal
        open={contextSelectionModalOpen}
        onClose={() => setContextSelectionModalOpen(false)}
        onSelectContext={handleSelectContext}
        contexts={contexts}
        loading={false}
        error={null}
      />

      <SystemPromptSelectionModal
        open={systemPromptSelectionModalOpen}
        onClose={() => setSystemPromptSelectionModalOpen(false)}
        onSelectSystemPrompt={handleSelectSystemPrompt}
        systemPrompts={systemPrompts}
        loading={false}
        error={null}
      />

      <ViewPromptModal
        open={viewPromptModalOpen}
        onClose={() => setViewPromptModalOpen(false)}
        currentPrompt={currentPrompt}
      />

      {/* Save Prompt Dialog */}
      <Dialog 
        open={savePromptDialog} 
        onClose={isSaving ? undefined : () => setSavePromptDialog(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Save Prompt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={promptTitle}
              onChange={(e) => setPromptTitle(e.target.value)}
              placeholder="Enter a title for your prompt"
              disabled={isSaving}
            />
            {saveError && (
              <Alert severity="error">{saveError}</Alert>
            )}
            {saveSuccess && (
              <Alert severity="success">{saveSuccess}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSavePromptDialog(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveConfirm} 
            variant="contained"
            disabled={!promptTitle.trim() || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conversation Manager */}
      <ConversationManager
        conversations={conversationTabs}
        onCloseConversation={handleCloseConversation}
        onMinimizeConversation={handleMinimizeConversation}
        onActivateConversation={handleActivateConversation}
        onSendMessage={handleSendFollowUpMessage}
        isSendingFollowUp={isSendingFollowUp}
        error={executionError}
      />
    </Box>
  );
} 