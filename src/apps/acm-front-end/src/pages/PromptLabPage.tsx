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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  CircularProgress,
  Alert,
  Tab,
  Tabs
} from '@mui/material';
import {
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  BookmarkBorder as BookmarkIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
import { createPromptsApi } from '../services/api/prompts';
import type { DataPacketQueryParams, Conversation, Message } from '../types';
import { ConversationWindow } from '../components/conversations/ConversationWindow';
import { conversationsApi } from '../services/api/conversations';
import { PromptInput } from '../components/prompts/PromptInput';
import { RecentPrompts } from '../components/prompts/RecentPrompts';
import { ModelSelection } from '../components/prompts/ModelSelection';
import { PromptStack } from '../components/prompts/PromptStack';




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

  // Get auth state for profile ID
  const { currentProfile } = useAppSelector((state) => state.auth);
  
  // Get settings for API key access
  const { settings } = useAppSelector((state) => state.settings);

  // Create prompts API with settings-based API key provider
  const promptsApi = useMemo(() => {
    return createPromptsApi(() => settings.apiKeys?.nlpWorkbench);
  }, [settings.apiKeys?.nlpWorkbench]);

  // Debug logging for profile changes
  useEffect(() => {
    console.log('PromptLabPage: currentProfile changed to:', currentProfile);
  }, [currentProfile]);

  // UI State
  const [activeTab, setActiveTab] = useState(0);
  const [stackExpanded, setStackExpanded] = useState(true);
  const [stackMinimized, setStackMinimized] = useState(false);
  const [selectedContext, setSelectedContext] = useState<any>(null);
  const [localSelectedModel, setLocalSelectedModel] = useState<string>('');
  
  // Simple prompt text state with debouncing
  const [promptText, setPromptText] = useState('');
  const [debouncedPromptText, setDebouncedPromptText] = useState('');
  
  // Debounce prompt text changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPromptText(promptText);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [promptText]);

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
  const [savedPromptsSearchQuery, setSavedPromptsSearchQuery] = useState('');

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
    generatePromptId(defaultTitle, currentProfile.id);
    
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
        tags: ["Saved-Prompt"]
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
  const fetchSavedPrompts = useCallback(async () => {
    if (!currentProfile) {
      setSavedPromptsError('No profile selected');
      return;
    }

    setLoadingSavedPrompts(true);
    setSavedPromptsError(null);

    try {
      const queryParams: DataPacketQueryParams = {
        tags: ["ACM", "ACM-Prompt", "Saved-Prompt"],
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
  }, [currentProfile, promptsApi]);

  // Load saved prompts when profile changes or component mounts
  useEffect(() => {
    if (currentProfile) {
      fetchSavedPrompts();
    }
  }, [currentProfile, fetchSavedPrompts]);

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
    console.log('handleExecute called with currentProfile:', currentProfile);
    
    if (!promptText.trim()) {
      setExecutionError('Please enter a prompt before executing');
      return;
    }

    if (!currentProfile) {
      console.error('currentProfile is null in handleExecute');
      setExecutionError('Please select a profile before executing');
      return;
    }

    if (!localSelectedModel) {
      setExecutionError('Please select a model before executing');
      return;
    }

    console.log('Executing prompt with profile ID:', currentProfile.id);

    setIsExecuting(true);
    setExecutionError(null);

    try {
      // First, save the prompt to history
      const promptData = {
        id: generatePromptId(`Execution-${Date.now()}`, currentProfile.id),
        title: `Execution - ${new Date().toLocaleString()}`,
        prompt: promptText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['Prompt-History']
      };

      await promptsApi.savePrompt(promptData, currentProfile.id);

      // Then execute the prompt
      const executionResult = await promptsApi.executePrompt(
        [], // No previous messages for initial prompt
        selectedContext,
        promptText,
        localSelectedModel,
        currentProfile.id
      );

      // Initialize conversation with the original prompt and response
      const initialMessages = [
        {
          id: `msg-usr-${Date.now()}`,
          role: 'user',
          content: promptText,
          timestamp: new Date().toISOString(),
          model: localSelectedModel 
        },
        {
          id: executionResult.id,
          role: 'assistant',
          content: executionResult.responses.content,
          timestamp: executionResult.timestamp,
          model: localSelectedModel
        }
      ];

      // Create conversation in FIDU Core backed
      // TODO: Need to add Context to this somehow
      const conversation_id = crypto.randomUUID().toString();
      const conversation: Conversation = {
        id: conversation_id, 
        title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
        platform: localSelectedModel.toLowerCase() as 'chatgpt' | 'claude' | 'gemini' | 'other',
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
  const fetchExecutionHistory = useCallback(async () => {
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
  }, [currentProfile, promptsApi]);

  // Load execution history when profile changes or component mounts
  useEffect(() => {
    if (currentProfile) {
      fetchExecutionHistory();
    }
  }, [currentProfile, fetchExecutionHistory]);

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
        platform: localSelectedModel,
        isEdited: false
      };

      var allMessagesSoFar: Message[] = [];
      setConversationMessages(prev => {
        const updatedMessages = [...prev, userMessage];
        // Capture updated messages here to ensure we get most up to date state
        allMessagesSoFar = updatedMessages;
        return updatedMessages;
      });
      
      // Send follow-up to API with full conversation history
      const followUpResult = await promptsApi.executePrompt(
        conversationMessages, // Send all previous messages
        selectedContext,
        message,
        localSelectedModel,
        currentProfile.id
      );

      // Add assistant response to conversation
      const assistantMessage = {
        id: followUpResult.id,
        role: 'assistant' as 'user' | 'assistant' | 'system',
        conversationId: currentConversation.id,
        content: followUpResult.responses.content,
        timestamp: followUpResult.timestamp,
        platform: localSelectedModel,
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
  }, [currentProfile, currentConversation, localSelectedModel, selectedContext, conversationMessages, fetchExecutionHistory, promptsApi]);

  // Convert Message to ConversationMessage (filtering out system messages)
  const convertMessagesToConversationMessages = useCallback((messages: Message[]) => {
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString(),
        model: msg.platform
      }));
  }, []);

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

  const models = [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokens: 128000 },
  ]

  // Optimized token calculation - memoized to prevent recalculation
  const calculateTokenCount = useCallback((text: string) => {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }, []);

  // Memoized total tokens calculation to prevent expensive operations on every render
  const totalTokens = useMemo(() => {
    let total = 0;
    // Removed system prompts calculation since we're now showing recent prompts instead
    total += calculateTokenCount(debouncedPromptText);
    if (selectedContext) {
      total += selectedContext.tokenCount;
    }
    return total;
  }, [debouncedPromptText, selectedContext, calculateTokenCount]);

  // Memoized debounced prompt token count
  const debouncedPromptTokens = useMemo(() => {
    return calculateTokenCount(debouncedPromptText);
  }, [debouncedPromptText, calculateTokenCount]);

  // Filter saved prompts based on search query
  const filteredSavedPrompts = useMemo(() => {
    if (!savedPromptsSearchQuery.trim()) {
      return savedPrompts;
    }
    
    const query = savedPromptsSearchQuery.toLowerCase();
    return savedPrompts.filter(prompt => 
      prompt.title?.toLowerCase().includes(query) ||
      prompt.prompt?.toLowerCase().includes(query)
    );
  }, [savedPrompts, savedPromptsSearchQuery]);

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
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                <Tab label="Compose" icon={<CodeIcon />} />
                <Tab label="Saved" icon={<BookmarkIcon />} />
                <Tab label="History" icon={<HistoryIcon />} />
              </Tabs>

              {/* Compose Tab */}
              <TabPanel value={activeTab} index={0}>
                <Stack spacing={3}>
                  {/* Recent Prompts */}
                  <RecentPrompts 
                    prompts={executionHistory}
                    onUsePrompt={handleUsePrompt}
                    calculateTokenCount={calculateTokenCount}
                  />

                  {/* Prompt Input */}
                  <PromptInput 
                    value={promptText}
                    onChange={setPromptText}
                    onSave={handleSaveClick}
                  />

                  {/* Model Selection */}
                  <ModelSelection 
                    models={models}
                    selectedModel={localSelectedModel}
                    onModelToggle={(modelId) => {
                      setLocalSelectedModel(modelId);
                    }}
                  />
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

                {/* Search Bar */}
                <TextField
                  fullWidth
                  placeholder="Search saved prompts by title or content..."
                  value={savedPromptsSearchQuery}
                  onChange={(e) => setSavedPromptsSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: savedPromptsSearchQuery && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setSavedPromptsSearchQuery('')}
                        >
                          <CloseIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ mb: 2 }}
                  size="small"
                />

                {/* Search Results Count */}
                {savedPromptsSearchQuery && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {filteredSavedPrompts.length} of {savedPrompts.length} prompts match your search
                    </Typography>
                  </Box>
                )}
                
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

                {!loadingSavedPrompts && !savedPromptsError && filteredSavedPrompts.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                      {savedPromptsSearchQuery ? 'No prompts match your search' : 'No saved prompts yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {savedPromptsSearchQuery 
                        ? 'Try adjusting your search terms'
                        : 'Save your first prompt using the save button in the prompt stack'
                      }
                    </Typography>
                  </Box>
                )}

                {!loadingSavedPrompts && !savedPromptsError && filteredSavedPrompts.length > 0 && (
                  <Stack spacing={2}>
                    {filteredSavedPrompts.map((prompt) => (
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
      <PromptStack
        
        stackMinimized={stackMinimized}
        stackExpanded={stackExpanded}
        totalTokens={totalTokens}
        debouncedPromptText={debouncedPromptText}
        debouncedPromptTokens={debouncedPromptTokens}
        selectedContext={selectedContext}
        localSelectedModel={localSelectedModel}
        mockModels={models}
        promptText={promptText}
        isExecuting={isExecuting}
        executionError={executionError}
        onMinimize={() => setStackMinimized(true)}
        onToggleExpanded={() => setStackExpanded(!stackExpanded)}
        onRemoveContext={() => setSelectedContext(null)}
        onRemoveModel={(_) => setLocalSelectedModel('')}
        onExecute={handleExecute}
        onSave={handleSaveClick}
      />

      {/* Conversation Window */}
      <ConversationWindow 
        open={conversationOpen}
        onClose={handleCloseConversation}
        messages={convertMessagesToConversationMessages(conversationMessages)}
        selectedModel={localSelectedModel}
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