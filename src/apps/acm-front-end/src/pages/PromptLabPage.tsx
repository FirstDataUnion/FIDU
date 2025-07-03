import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Paper,
  InputAdornment,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  Fab,
  LinearProgress,
  Autocomplete,
  Drawer,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  BookmarkBorder as BookmarkIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  Fullscreen as FullscreenIcon,
  Terminal as TerminalIcon,
  DataObject as TokenIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as UserIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { promptsApi } from '../services/api/prompts';
import type { DataPacketQueryParams, Conversation, Message } from '../types';
import { ConversationWindow } from '../components/conversations/ConversationWindow';
import { conversationsApi } from '../services/api/conversations';
// import { fetchPromptLabData, executePrompt, generateContextSuggestions } from '../store/slices/promptLabSlice';



interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prompt-lab-tabpanel-${index}`}
      aria-labelledby={`prompt-lab-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function PromptLabPage() {
  const dispatch = useAppDispatch();
  const { 
    systemPrompts, 
    executions, 
    contextSuggestions,
    currentPrompt,
    selectedModels,
    loading, 
    error 
  } = useAppSelector((state) => state.promptLab || {
    systemPrompts: [],
    executions: [],
    contextSuggestions: [],
    currentPrompt: '',
    selectedModels: [],
    loading: false,
    error: null
  });

  // Get auth state for profile ID
  const { currentProfile } = useAppSelector((state) => state.auth);

  // Ensure arrays are always defined
  const safeSelectedModels = selectedModels || [];

  // UI State
  const [activeTab, setActiveTab] = useState(0);
  const [promptText, setPromptText] = useState('');
  const [debouncedPromptText, setDebouncedPromptText] = useState('');
  const [stackExpanded, setStackExpanded] = useState(true);
  const [stackMinimized, setStackMinimized] = useState(false);
  const [selectedSavedPrompt, setSelectedSavedPrompt] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [selectedContext, setSelectedContext] = useState<any>(null);
  const [localSelectedModels, setLocalSelectedModels] = useState<string[]>([]);
  
  // Save dialog states
  const [savePromptDialog, setSavePromptDialog] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [existingPrompt, setExistingPrompt] = useState<any>(null);

  // Real saved prompts state
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [loadingSavedPrompts, setLoadingSavedPrompts] = useState(false);
  const [savedPromptsError, setSavedPromptsError] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Execution history state
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Conversation window state
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  useEffect(() => {
    // dispatch(fetchPromptLabData());
  }, [dispatch]);

  // Debounce prompt text changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPromptText(promptText);
    }, 2000);

    return () => clearTimeout(timer);
  }, [promptText]);

  // Function to immediately update debounced prompt when user clicks elsewhere
  const handlePromptBlur = () => {
    setDebouncedPromptText(promptText);
  };

  // Generate a hash-based ID for deduplication
  const generatePromptId = (title: string, profileId: string): string => {
    const content = `${title}-${profileId}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `prompt-${Math.abs(hash).toString(36)}`;
  };

  // Handle save button click
  const handleSaveClick = () => {
    if (!promptText.trim()) {
      setSaveError('Please enter a prompt before saving');
      return;
    }
    
    if (!currentProfile) {
      setSaveError('Please select a profile before saving');
      return;
    }

    // Generate a default title if none provided
    const defaultTitle = promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '');
    setPromptTitle(defaultTitle);
    
    // Generate ID and check for existing prompt
    const promptId = generatePromptId(defaultTitle, currentProfile.id);
    
    // For now, we'll assume no existing prompt (in a real implementation, you'd check the API)
    // TODO: Add check for existing prompt + update
    setExistingPrompt(null);
    setSaveError(null);
    setSavePromptDialog(true);
  };

  // Handle save confirmation
  const handleSaveConfirm = async () => {
    if (!promptText.trim() || !promptTitle.trim() || !currentProfile) {
      setSaveError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const promptId = generatePromptId(promptTitle, currentProfile.id);
      
      const promptData = {
        id: promptId,
        title: promptTitle,
        prompt: promptText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: []
      };

      const savedPrompt = await promptsApi.savePrompt(promptData, currentProfile.id);
      
      // Show success message
      setSaveSuccess('Prompt saved successfully!');
      setIsSaving(false);
      
      // Auto-close dialog after 2 seconds
      setTimeout(() => {
        handleSaveDialogClose();
      }, 2000);
      
      // Refresh saved prompts list
      await fetchSavedPrompts();

      // You could dispatch an action to update the saved prompts list here
      console.log('Prompt saved successfully:', savedPrompt);
      
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      setSaveError(error.message || 'Failed to save prompt');
      setIsSaving(false);
    }
  };

  // Handle save dialog close
  const handleSaveDialogClose = () => {
    setSavePromptDialog(false);
    setPromptTitle('');
    setSaveError(null);
    setSaveSuccess(null);
    setExistingPrompt(null);
    setIsSaving(false);
  };

  // Fetch saved prompts from API
  const fetchSavedPrompts = async () => {
    if (!currentProfile) {
      setSavedPromptsError('No profile selected');
      return;
    }

    setLoadingSavedPrompts(true);
    setSavedPromptsError(null);

    try {
      const queryParams: DataPacketQueryParams = {
        tags: ["ACM", "ACM-LAB-Prompt", "Saved-Prompt"],
        profile_id: currentProfile.id,
        limit: 100,
        offset: 0,
        sort_order: "desc"
      };
      const response = await promptsApi.getAll(queryParams);
      
      // Check if response has prompts property (PromptsResponse)
      if ('prompts' in response) {
        setSavedPrompts(response.prompts);
      } else {
        // Handle error response
        setSavedPrompts([]);
        setSavedPromptsError('Invalid response format');
      }
    } catch (error: any) {
      console.error('Error fetching saved prompts:', error);
      setSavedPromptsError(error.message || 'Failed to fetch saved prompts');
      setSavedPrompts([]);
    } finally {
      setLoadingSavedPrompts(false);
    }
  };

  // Load saved prompts when profile changes or component mounts
  useEffect(() => {
    if (currentProfile) {
      fetchSavedPrompts();
    }
  }, [currentProfile]);

  // Handle using a saved prompt
  const handleUsePrompt = (prompt: any) => {
    setPromptText(prompt.prompt);
    setActiveTab(0); // Switch to compose tab
  };

  // Handle copying a saved prompt
  const handleCopyPrompt = async (prompt: any) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      // You could add a toast notification here
      console.log('Prompt copied to clipboard');
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  // Handle executing the prompt
  const handleExecute = async () => {
    if (!promptText.trim()) {
      setExecutionError('Please enter a prompt before executing');
      return;
    }

    if (!currentProfile) {
      setExecutionError('Please select a profile before executing');
      return;
    }

    if (localSelectedModels.length === 0) {
      setExecutionError('Please select at least one model before executing');
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);

    try {
      // First, save the prompt to history
      const promptId = generatePromptId(`Execution-${Date.now()}`, currentProfile.id);
      const promptData = {
        id: promptId,
        title: `Execution - ${new Date().toLocaleString()}`,
        prompt: promptText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['Prompt-History']
      };

      await promptsApi.savePrompt(promptData, currentProfile.id);

      // Then execute the prompt
      const executionResult = await promptsApi.executePrompt(
        selectedContext,
        promptText,
        localSelectedModels,
        currentProfile.id
      );
      
      // Initialize conversation with the original prompt and response
      const initialMessages = [
        {
          id: `msg-${Date.now()}-1`,
          role: 'user',
          content: promptText,
          timestamp: new Date().toISOString(),
          model: localSelectedModels[0] // Use first selected model
        },
        {
          id: `msg-${Date.now()}-2`,
          role: 'assistant',
          content: executionResult?.responses?.[0]?.content || 'This is a placeholder response. In a real implementation, this would be the actual model response.',
          timestamp: new Date().toISOString(),
          model: localSelectedModels[0]
        }
      ];

      // Create conversation in FIDU Core backed
      // TODO: Need to add Context to this somehow
      const conversation_id = crypto.randomUUID().toString();
      const conversation: Conversation = {
        id: conversation_id, 
        title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
        platform: localSelectedModels[0].toLowerCase() as 'chatgpt' | 'claude' | 'gemini' | 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 2,
        tags: [],
        isArchived: false,
        isFavorite: false,
        participants: [], 
        status: 'active' as 'active' | 'archived' | 'deleted'
      };

      const messages = initialMessages.map(msg => ({
        id: msg.id,
        conversationId: conversation_id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant' | 'system',
        timestamp: msg.timestamp,
        platform: msg.model || 'unknown',
        isEdited: false
      }));

      await conversationsApi.createConversation(
        currentProfile.id,
        conversation,
        messages
      );

      setConversationMessages(messages);
      setCurrentConversation(conversation);
      setConversationOpen(true);
      setConversationError(null);
      
      // Refresh execution history
      await fetchExecutionHistory();
      
    } catch (error: any) {
      console.error('Error executing prompt:', error);
      setExecutionError(error.message || 'Failed to execute prompt');
    } finally {
      setIsExecuting(false);
    }
  };

  // Fetch execution history from API
  const fetchExecutionHistory = async () => {
    if (!currentProfile) {
      setHistoryError('No profile selected');
      return;
    }

    setLoadingHistory(true);
    setHistoryError(null);

    try {
      const queryParams: DataPacketQueryParams = {
        tags: ["ACM", "ACM-LAB-Prompt", "Prompt-History"],
        profile_id: currentProfile.id,
        limit: 100,
        offset: 0,
        sort_order: "desc"
      };
      const response = await promptsApi.getAll(queryParams);
      
      // Check if response has prompts property (PromptsResponse)
      if ('prompts' in response) {
        setExecutionHistory(response.prompts);
      } else {
        // Handle error response
        setExecutionHistory([]);
        setHistoryError('Invalid response format');
      }
    } catch (error: any) {
      console.error('Error fetching execution history:', error);
      setHistoryError(error.message || 'Failed to fetch execution history');
      setExecutionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load execution history when profile changes or component mounts
  useEffect(() => {
    if (currentProfile) {
      fetchExecutionHistory();
    }
  }, [currentProfile]);

  // Handle sending follow-up message
  const handleSendFollowUp = useCallback(async (message: string) => {
    if (!message.trim() || !currentProfile || !currentConversation) {
      return;
    }

    setIsSendingFollowUp(true);
    setConversationError(null);

    try {
      // Add user message to conversation
      const userMessage = {
        id: `msg-${Date.now()}-user`,
        conversationId: currentConversation.id,
        role: 'user' as 'user' | 'assistant' | 'system',
        content: message,
        timestamp: new Date().toISOString(),
        platform: localSelectedModels[0],
        isEdited: false
      };

      var allMessagesSoFar: Message[] = [];
      setConversationMessages(prev => {
        const updatedMessages = [...prev, userMessage];
        // Capture updated messages here to ensure we get most up to date state
        allMessagesSoFar = updatedMessages;
        return updatedMessages;
      });
      
      // Send follow-up to API (placeholder for now)
      // In a real implementation, you'd send the conversation context + new message
      const followUpResult = await promptsApi.executePrompt(
        selectedContext,
        message,
        localSelectedModels,
        currentProfile.id
      );

      // Add assistant response to conversation
      const assistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as 'user' | 'assistant' | 'system',
        conversationId: currentConversation.id,
        content: followUpResult?.responses?.[0]?.content || 'This is a placeholder follow-up response.',
        timestamp: new Date().toISOString(),
        platform: localSelectedModels[0],
        isEdited: false
      };

      // Update conversation in FIDU Core backed
      await conversationsApi.updateConversation(
        currentConversation,
        [...allMessagesSoFar, assistantMessage]
      );

      setConversationMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Error sending follow-up:', error);
      setConversationError(error.message || 'Failed to send follow-up message');
    } finally {
      setIsSendingFollowUp(false);
    }
  }, [currentProfile, currentConversation, localSelectedModels, selectedContext]);

  // Handle closing conversation window
  const handleCloseConversation = useCallback(() => {
    setConversationOpen(false);
    setConversationMessages([]);
    setCurrentConversation(null);
    setConversationError(null);
  }, []);


  const mockContextSuggestions = [
    {
      id: 'ctx-sug-1',
      title: 'React Best Practices',
      description: 'Component patterns, hooks usage, and performance optimization',
      relevanceScore: 0.95,
      tokenCount: 1200,
      type: 'reference'
    },
    {
      id: 'ctx-sug-2',
      title: 'TypeScript Configurations',
      description: 'Advanced type definitions and compiler settings',
      relevanceScore: 0.87,
      tokenCount: 800,
      type: 'knowledge'
    }
  ];

  const mockModels = [
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', maxTokens: 200000 },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', maxTokens: 200000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', maxTokens: 128000 },
    { id: 'gemini-ultra', name: 'Gemini Ultra', provider: 'Google', maxTokens: 32000 }
  ];

  // Mock saved prompts data
  const mockSavedPrompts = [
    {
      id: 'saved-1',
      name: 'Code Review Assistant',
      description: 'Helps review code for best practices and potential issues',
      prompt: 'Please review this code for best practices, potential bugs, and areas for improvement...',
      tokenCount: 45,
      tags: ['code', 'review', 'best-practices'],
      createdAt: new Date('2024-01-15'),
      lastUsed: new Date('2024-01-20')
    },
    {
      id: 'saved-2',
      name: 'API Documentation Generator',
      description: 'Generates comprehensive API documentation from code comments',
      prompt: 'Generate comprehensive API documentation for the following endpoints...',
      tokenCount: 32,
      tags: ['api', 'documentation', 'generator'],
      createdAt: new Date('2024-01-12'),
      lastUsed: new Date('2024-01-18')
    },
    {
      id: 'saved-3',
      name: 'Error Analysis Helper',
      description: 'Analyzes error messages and suggests solutions',
      prompt: 'Analyze this error message and provide a detailed explanation with potential solutions...',
      tokenCount: 28,
      tags: ['debugging', 'errors', 'troubleshooting'],
      createdAt: new Date('2024-01-10'),
      lastUsed: new Date('2024-01-16')
    }
  ];

  const calculateTokenCount = (text: string) => {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  };

  // Memoized total tokens calculation to prevent expensive operations on every render
  const totalTokens = useMemo(() => {
    let total = 0;
    // Removed system prompts calculation since we're now showing recent prompts instead
    total += calculateTokenCount(debouncedPromptText);
    if (selectedContext) {
      total += selectedContext.tokenCount;
    }
    return total;
  }, [debouncedPromptText, selectedContext]);

  // Memoized debounced prompt token count
  const debouncedPromptTokens = useMemo(() => {
    return calculateTokenCount(debouncedPromptText);
  }, [debouncedPromptText]);


  const PromptStack = () => {
    if (stackMinimized) {
      return (
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 16, 
            right: 16, 
            p: 1,
            zIndex: 1000,
            cursor: 'pointer',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText'
          }}
          onClick={() => setStackMinimized(false)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerminalIcon />
            <Typography variant="body2">Prompt Stack ({totalTokens} tokens)</Typography>
          </Box>
        </Paper>
      );
    }

    return (
      <Paper 
        sx={{ 
          position: 'fixed', 
          top: 80, 
          right: 16, 
          width: 350, 
          maxHeight: 'calc(100vh - 100px)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Prompt Stack
          </Typography>
          <Chip 
            label={`${totalTokens} tokens`} 
            size="small" 
            color="primary"
          />
          <IconButton size="small" onClick={() => setStackMinimized(true)}>
            <MinimizeIcon />
          </IconButton>
          <IconButton size="small" onClick={() => setStackExpanded(!stackExpanded)}>
            <ExpandMoreIcon sx={{ transform: stackExpanded ? 'rotate(180deg)' : 'none' }} />
          </IconButton>
        </Box>

        {/* Content */}
        {stackExpanded && (
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>

            {/* Current Prompt */}
            {debouncedPromptText && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Prompt
                  </Typography>
                  <Chip 
                    label={`${debouncedPromptTokens}t`} 
                    size="small" 
                    variant="outlined" 
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {debouncedPromptText.length > 150 
                    ? `${debouncedPromptText.substring(0, 150)}...` 
                    : debouncedPromptText
                  }
                </Typography>
              </Box>
            )}

            {/* Selected Context */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Selected Context
              </Typography>
              {selectedContext ? (
                <Box sx={{ p: 1, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {selectedContext.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Chip label={`${selectedContext.relevanceScore * 100}%`} size="small" color="success" />
                      <Chip label={`${selectedContext.tokenCount}t`} size="small" variant="outlined" />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {selectedContext.description}
                  </Typography>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<CloseIcon />}
                    onClick={() => setSelectedContext(null)}
                    sx={{ mt: 0.5 }}
                  >
                    Remove Context
                  </Button>
                </Box>
              ) : (
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', 
                  borderRadius: 1, 
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'grey.300'
                }}>
                  <Typography variant="caption" color="text.secondary">
                    No context selected
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Select a context from the suggestions panel
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Selected Model */}
            {localSelectedModels.length > 0 && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Selected Model
                </Typography>
                {localSelectedModels.map((modelId: string) => {
                  const model = mockModels.find(m => m.id === modelId);
                  return model ? (
                    <Box key={modelId} sx={{ p: 1, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {model.name}
                        </Typography>
                        <Chip label={model.provider} size="small" color="primary" />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Max tokens: {model.maxTokens.toLocaleString()}
                      </Typography>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        startIcon={<CloseIcon />}
                        onClick={() => {
                          setLocalSelectedModels(prev => 
                            prev.includes(model.id) 
                              ? prev.filter(id => id !== model.id)
                              : [...prev, model.id]
                          );
                        }}
                        sx={{ mt: 0.5 }}
                      >
                        Remove Model
                      </Button>
                    </Box>
                  ) : null;
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <Button 
              variant="contained" 
              startIcon={isExecuting ? <CircularProgress size={16} /> : <PlayIcon />}
              size="small"
              fullWidth
              disabled={!promptText || totalTokens === 0 || isExecuting}
              onClick={handleExecute}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
            <IconButton size="small" onClick={handleSaveClick}>
              <SaveIcon />
            </IconButton>
          </Stack>
          {executionError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {executionError}
            </Alert>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3, pr: stackMinimized ? 3 : 45 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Prompt Lab
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Design, test, and optimize your AI prompts with advanced tooling
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
              {/* Tabs */}
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                <Tab label="Compose" icon={<CodeIcon />} />
                <Tab label="Saved" icon={<BookmarkIcon />} />
                <Tab label="History" icon={<HistoryIcon />} />
              </Tabs>

              {/* Compose Tab */}
              <TabPanel value={activeTab} index={0}>
                <Stack spacing={3}>
                  {/* Recent Prompts */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Recent Prompts
                    </Typography>
                    {executionHistory.length > 0 ? (
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
                        gap: 2 
                      }}>
                        {executionHistory.slice(0, 2).map((execution) => (
                          <Card 
                            key={execution.id}
                            variant="outlined"
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': {
                                boxShadow: 2,
                                borderColor: 'primary.main'
                              }
                            }}
                            onClick={() => handleUsePrompt(execution)}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {execution.title}
                                </Typography>
                                <Chip 
                                  label={`${calculateTokenCount(execution.prompt)} tokens`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {execution.prompt.length > 100 
                                  ? `${execution.prompt.substring(0, 100)}...` 
                                  : execution.prompt
                                }
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Executed: {new Date(execution.createdAt).toLocaleDateString()}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    ) : (
                      <Box sx={{ 
                        p: 3, 
                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', 
                        borderRadius: 1, 
                        textAlign: 'center',
                        border: '2px dashed',
                        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'grey.300'
                      }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                          No recent prompts to show
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Execute a prompt to see it here
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Prompt Input */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Your Prompt
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      placeholder="Enter your prompt here..."
                      value={promptText}
                      // TODO: This is mega laggy cos it rerenders everything on each press. Need to optimise whole page a lot. 
                      onChange={(e) => setPromptText(e.target.value)} 
                      variant="outlined"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          fontFamily: 'monospace',
                          fontSize: '0.9rem'
                        }
                      }}
                      onBlur={handlePromptBlur}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {debouncedPromptTokens} tokens
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveClick}>
                          Save Prompt
                        </Button>
                      </Stack>
                    </Box>
                  </Box>

                  {/* Model Selection */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Models
                    </Typography>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
                      gap: 2 
                    }}>
                      {mockModels.map((model) => (
                        <Card 
                          key={model.id}
                          variant="outlined"
                          sx={{ 
                            cursor: 'pointer',
                            border: localSelectedModels.includes(model.id) ? 2 : 1,
                            borderColor: localSelectedModels.includes(model.id) ? 'primary.main' : 'divider'
                          }}
                          onClick={() => {
                            setLocalSelectedModels(prev => 
                              prev.includes(model.id) 
                                ? prev.filter(id => id !== model.id)
                                : [...prev, model.id]
                            );
                          }}
                        >
                          <CardContent sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {model.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              {model.provider}
                            </Typography>
                            <Chip 
                              label={`${model.maxTokens.toLocaleString()} max`} 
                              size="small" 
                              variant="outlined"
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                </Stack>
              </TabPanel>

              {/* Saved Tab */}
              <TabPanel value={activeTab} index={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">
                    Saved Prompts
                  </Typography>
                  <Button 
                    variant="outlined" 
                    startIcon={<RefreshIcon />}
                    onClick={fetchSavedPrompts}
                    disabled={loadingSavedPrompts}
                    size="small"
                  >
                    Refresh
                  </Button>
                </Box>
                
                {loadingSavedPrompts && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                )}

                {savedPromptsError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {savedPromptsError}
                  </Alert>
                )}

                {!loadingSavedPrompts && !savedPromptsError && savedPrompts.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      No saved prompts yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save your first prompt using the save button in the prompt stack
                    </Typography>
                  </Box>
                )}

                {!loadingSavedPrompts && !savedPromptsError && savedPrompts.length > 0 && (
                  <Stack spacing={2}>
                    {savedPrompts.map((prompt) => (
                      <Card key={prompt.id} variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" sx={{ mb: 1 }}>
                                {prompt.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {prompt.prompt.length > 150 
                                  ? `${prompt.prompt.substring(0, 150)}...` 
                                  : prompt.prompt
                                }
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${calculateTokenCount(prompt.prompt)} tokens`} 
                              size="small" 
                              color="primary"
                            />
                          </Box>
                          
                          {prompt.tags && prompt.tags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                              {prompt.tags.map((tag: string) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                              ))}
                            </Box>
                          )}
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Created: {new Date(prompt.createdAt).toLocaleDateString()}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="outlined" startIcon={<CopyIcon />} onClick={() => handleCopyPrompt(prompt)}>
                                Copy
                              </Button>
                              <Button size="small" variant="contained" onClick={() => handleUsePrompt(prompt)}>
                                Use Prompt
                              </Button>
                            </Stack>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </TabPanel>

              {/* History Tab */}
              <TabPanel value={activeTab} index={2}>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Execution History
                </Typography>
                
                {loadingHistory && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                )}

                {historyError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {historyError}
                  </Alert>
                )}

                {!loadingHistory && !historyError && executionHistory.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      No execution history yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Execute your first prompt to see it here
                    </Typography>
                  </Box>
                )}

                {!loadingHistory && !historyError && executionHistory.length > 0 && (
                  <Stack spacing={2}>
                    {executionHistory.map((execution) => (
                      <Card key={execution.id} variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" sx={{ mb: 1 }}>
                                {execution.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {execution.prompt.length > 200 
                                  ? `${execution.prompt.substring(0, 200)}...` 
                                  : execution.prompt
                                }
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${calculateTokenCount(execution.prompt)} tokens`} 
                              size="small" 
                              color="primary"
                            />
                          </Box>
                          
                          {execution.tags && execution.tags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                              {execution.tags.map((tag: string) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                              ))}
                            </Box>
                          )}
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Executed: {new Date(execution.createdAt).toLocaleDateString()}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="outlined" startIcon={<CopyIcon />} onClick={() => handleCopyPrompt(execution)}>
                                Copy
                              </Button>
                              <Button size="small" variant="contained" onClick={() => handleUsePrompt(execution)}>
                                Use Prompt
                              </Button>
                            </Stack>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </TabPanel>
            </CardContent>
          </Card>
        </Box>

        {/* Right Panel - Context Suggestions */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Context Suggestions
              </Typography>
              
              {mockContextSuggestions.map((suggestion) => (
                <Card key={suggestion.id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {suggestion.title}
                      </Typography>
                      <Chip 
                        label={`${Math.round(suggestion.relevanceScore * 100)}%`} 
                        size="small" 
                        color="success"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {suggestion.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={`${suggestion.tokenCount} tokens`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Button 
                        size="small" 
                        variant="contained"
                        onClick={() => setSelectedContext(suggestion)}
                      >
                        Add Context
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Floating Prompt Stack */}
      <PromptStack />

      {/* Conversation Window */}
      <ConversationWindow 
        open={conversationOpen}
        onClose={handleCloseConversation}
        messages={conversationMessages}
        selectedModel={localSelectedModels[0]}
        isSendingFollowUp={isSendingFollowUp}
        error={conversationError}
        onSendMessage={handleSendFollowUp}
      />

      {/* Save Prompt Dialog */}
      <Dialog 
        open={savePromptDialog} 
        onClose={isSaving ? undefined : handleSaveDialogClose} 
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
            <TextField
              fullWidth
              label="Prompt Content"
              multiline
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Your prompt content"
              disabled={isSaving}
            />
            {existingPrompt && (
              <Alert severity="warning">
                A prompt with this title already exists. Saving will update the existing prompt.
              </Alert>
            )}
            {saveError && (
              <Alert severity="error">
                {saveError}
              </Alert>
            )}
            {saveSuccess && (
              <Alert severity="success">
                {saveSuccess}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveDialogClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveConfirm} 
            variant="contained"
            disabled={!promptTitle.trim() || !promptText.trim() || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {isSaving ? 'Saving...' : existingPrompt ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 