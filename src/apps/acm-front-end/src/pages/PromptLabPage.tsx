import React, { useState, useEffect } from 'react';
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
  Autocomplete
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
  DataObject as TokenIcon
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../store';
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
    promptTemplates, 
    executions, 
    contextSuggestions,
    currentPrompt,
    selectedSystemPrompts,
    selectedModels,
    isExecuting,
    loading, 
    error 
  } = useAppSelector((state) => state.promptLab || {
    systemPrompts: [],
    promptTemplates: [],
    executions: [],
    contextSuggestions: [],
    currentPrompt: '',
    selectedSystemPrompts: [],
    selectedModels: [],
    isExecuting: false,
    loading: false,
    error: null
  });

  // Ensure arrays are always defined
  const safeSelectedSystemPrompts = selectedSystemPrompts || [];
  const safeSelectedModels = selectedModels || [];

  // UI State
  const [activeTab, setActiveTab] = useState(0);
  const [promptText, setPromptText] = useState('');
  const [stackExpanded, setStackExpanded] = useState(true);
  const [stackMinimized, setStackMinimized] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Dialog states
  const [saveTemplateDialog, setSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  useEffect(() => {
    // dispatch(fetchPromptLabData());
  }, [dispatch]);

  // Mock data for development
  const mockSystemPrompts = [
    {
      id: 'sys-1',
      name: 'Code Assistant',
      content: 'You are an expert software developer. Help write clean, efficient, and well-documented code.',
      description: 'General coding assistance with best practices',
      tokenCount: 23,
      modelCompatibility: ['claude-3-sonnet', 'gpt-4-turbo', 'gemini-pro'],
      createdAt: new Date('2024-01-10')
    },
    {
      id: 'sys-2',
      name: 'Technical Writer',
      content: 'You are a technical documentation expert. Create clear, comprehensive documentation.',
      description: 'Technical writing and documentation',
      tokenCount: 18,
      modelCompatibility: ['claude-3-sonnet', 'gpt-4'],
      createdAt: new Date('2024-01-12')
    }
  ];

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

  const calculateTokenCount = (text: string) => {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  };

  const getTotalTokens = () => {
    let total = 0;
    safeSelectedSystemPrompts.forEach((id: string) => {
      const prompt = mockSystemPrompts.find(p => p.id === id);
      if (prompt) total += prompt.tokenCount;
    });
    total += calculateTokenCount(promptText);
    return total;
  };

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
            <Typography variant="body2">Prompt Stack ({getTotalTokens()} tokens)</Typography>
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
            label={`${getTotalTokens()} tokens`} 
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
            {/* System Prompts */}
            {safeSelectedSystemPrompts.length > 0 && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  System Prompts
                </Typography>
                {safeSelectedSystemPrompts.map((id: string) => {
                  const prompt = mockSystemPrompts.find(p => p.id === id);
                  return prompt ? (
                    <Box key={id} sx={{ mb: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {prompt.name}
                        </Typography>
                        <Chip label={`${prompt.tokenCount}t`} size="small" variant="outlined" />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {prompt.content.substring(0, 100)}...
                      </Typography>
                    </Box>
                  ) : null;
                })}
              </Box>
            )}

            {/* Current Prompt */}
            {promptText && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    User Prompt
                  </Typography>
                  <Chip 
                    label={`${calculateTokenCount(promptText)}t`} 
                    size="small" 
                    variant="outlined" 
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {promptText.substring(0, 150)}...
                </Typography>
              </Box>
            )}

            {/* Context Suggestions */}
            {mockContextSuggestions.length > 0 && (
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Suggested Contexts
                </Typography>
                {mockContextSuggestions.slice(0, 3).map((suggestion) => (
                  <Box key={suggestion.id} sx={{ mb: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {suggestion.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip label={`${suggestion.relevanceScore * 100}%`} size="small" color="success" />
                        <Chip label={`${suggestion.tokenCount}t`} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {suggestion.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <Button 
              variant="contained" 
              startIcon={<PlayIcon />}
              size="small"
              fullWidth
              disabled={!promptText || getTotalTokens() === 0}
            >
              Execute
            </Button>
            <IconButton size="small">
              <SaveIcon />
            </IconButton>
          </Stack>
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
                <Tab label="Templates" icon={<BookmarkIcon />} />
                <Tab label="History" icon={<HistoryIcon />} />
              </Tabs>

              {/* Compose Tab */}
              <TabPanel value={activeTab} index={0}>
                <Stack spacing={3}>
                  {/* System Prompt Selection */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      System Prompts
                    </Typography>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
                      gap: 2 
                    }}>
                      {mockSystemPrompts.map((prompt) => (
                        <Card 
                          key={prompt.id}
                          variant="outlined"
                          sx={{ 
                            cursor: 'pointer',
                            border: safeSelectedSystemPrompts.includes(prompt.id) ? 2 : 1,
                            borderColor: safeSelectedSystemPrompts.includes(prompt.id) ? 'primary.main' : 'divider'
                          }}
                          onClick={() => {
                            // Toggle selection logic would go here
                          }}
                        >
                          <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {prompt.name}
                              </Typography>
                              <Chip 
                                label={`${prompt.tokenCount} tokens`} 
                                size="small" 
                                variant="outlined"
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {prompt.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {prompt.content.substring(0, 80)}...
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
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
                      onChange={(e) => setPromptText(e.target.value)}
                      variant="outlined"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          fontFamily: 'monospace',
                          fontSize: '0.9rem'
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {calculateTokenCount(promptText)} tokens
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" startIcon={<SaveIcon />}>
                          Save Template
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<AutoAwesomeIcon />}>
                          Optimize
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
                            border: safeSelectedModels.includes(model.id) ? 2 : 1,
                            borderColor: safeSelectedModels.includes(model.id) ? 'primary.main' : 'divider'
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

              {/* Templates Tab */}
              <TabPanel value={activeTab} index={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">
                    Prompt Templates
                  </Typography>
                  <Button variant="contained" startIcon={<AddIcon />}>
                    Create Template
                  </Button>
                </Box>
                
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, 
                  gap: 2 
                }}>
                  {promptTemplates.map((template: any) => (
                    <Card key={template.id}>
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {template.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {template.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                          {template.tags.map((tag: string) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Chip 
                            label={`${template.tokenCount} tokens`} 
                            size="small" 
                            color="primary"
                          />
                          <Button size="small" variant="outlined">
                            Use Template
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </TabPanel>

              {/* History Tab */}
              <TabPanel value={activeTab} index={2}>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Execution History
                </Typography>
                
                {executions.map((execution: any) => (
                  <Card key={execution.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {execution.name || 'Untitled Execution'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {execution.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                        <Chip 
                          label={execution.status} 
                          size="small" 
                          color={execution.status === 'completed' ? 'success' : 'warning'}
                        />
                      </Box>
                      
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {execution.prompt.substring(0, 200)}...
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined">
                          View Details
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<CopyIcon />}>
                          Duplicate
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
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
                      <Button size="small" variant="contained">
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
    </Box>
  );
} 