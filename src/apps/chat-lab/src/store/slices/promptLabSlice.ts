import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  description: string;
  tokenCount: number;
  modelCompatibility: string[];
  categories: string[];
  isDefault: boolean;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  systemPromptId: string;
  contextIds: string[];
  description: string;
  tokenCount: number;
  createdAt: string;
}

export interface ModelResponse {
  model: string;
  response: string;
  tokenCount: number;
  timeMs: number;
  cost: number;
  timestamp: string;
}

export interface PromptExecution {
  id: string;
  prompt: string;
  systemPromptId: string;
  contextIds: string[];
  models: string[];
  responses: ModelResponse[];
  createdAt: string;
  bestResponseModel?: string;
}

export interface ContextSuggestion {
  contextId: string;
  contextName: string;
  relevanceScore: number;
  reason: string;
  tokenCount: number;
}

export interface PromptLabState {
  systemPrompts: SystemPrompt[];
  promptTemplates: PromptTemplate[];
  executions: PromptExecution[];
  currentPrompt: string;
  selectedSystemPrompts: string[];
  selectedModels: string[];
  contextSuggestions: ContextSuggestion[];
  isExecuting: boolean;
  loading: boolean;
  error: string | null;
  totalTokenCount: number;
  estimatedCost: number;
}

const initialState: PromptLabState = {
  systemPrompts: [],
  promptTemplates: [],
  executions: [],
  currentPrompt: '',
  selectedSystemPrompts: [],
  selectedModels: [],
  contextSuggestions: [],
  isExecuting: false,
  loading: false,
  error: null,
  totalTokenCount: 0,
  estimatedCost: 0,
};

// Mock data
const mockSystemPrompts: SystemPrompt[] = [
  {
    id: 'sys-1',
    name: 'Technical Assistant',
    content: 'You are an expert technical assistant with deep knowledge of software development, architecture, and best practices. Provide clear, accurate, and actionable advice.',
    description: 'General technical assistance with focus on software development',
    tokenCount: 42,
    modelCompatibility: ['claude-3-opus', 'claude-3-sonnet', 'gpt-4-turbo', 'gemini-ultra'],
    categories: ['Technical', 'General'],
    isDefault: true,
    createdAt: new Date('2024-01-10').toISOString()
  },
  {
    id: 'sys-2',
    name: 'Code Reviewer',
    content: 'You are a senior code reviewer. Analyze code for best practices, security vulnerabilities, performance issues, and maintainability. Provide specific, actionable feedback.',
    description: 'Specialized in code review and quality assessment',
    tokenCount: 38,
    modelCompatibility: ['claude-3-opus', 'gpt-4-turbo'],
    categories: ['Development', 'Code Quality'],
    isDefault: false,
    createdAt: new Date('2024-01-12').toISOString()
  },
  {
    id: 'sys-3',
    name: 'API Designer',
    content: 'You are an expert API architect. Help design RESTful APIs, GraphQL schemas, and integration patterns following industry standards and best practices.',
    description: 'Specialized in API design and architecture',
    tokenCount: 35,
    modelCompatibility: ['claude-3-sonnet', 'gpt-4-turbo', 'gemini-ultra'],
    categories: ['Architecture', 'API Design'],
    isDefault: false,
    createdAt: new Date('2024-01-08').toISOString()
  },
  {
    id: 'sys-4',
    name: 'UI/UX Consultant',
    content: 'You are a UI/UX expert with extensive experience in modern design patterns, accessibility, and user research. Provide insights on user experience and interface design.',
    description: 'Focused on user experience and interface design',
    tokenCount: 40,
    modelCompatibility: ['claude-3-opus', 'claude-3-sonnet', 'gpt-4-turbo'],
    categories: ['Design', 'UI/UX'],
    isDefault: false,
    createdAt: new Date('2024-01-15').toISOString()
  }
];

const mockPromptTemplates: PromptTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Code Review Request',
    prompt: 'Please review the following code for best practices, potential issues, and improvements:\n\n```\n[CODE_HERE]\n```\n\nFocus on:\n- Security vulnerabilities\n- Performance optimization\n- Code maintainability\n- Best practices compliance',
    systemPromptId: 'sys-2',
    contextIds: [],
    description: 'Template for requesting code reviews',
    tokenCount: 65,
    createdAt: new Date('2024-01-10').toISOString()
  },
  {
    id: 'tpl-2',
    name: 'API Design Consultation',
    prompt: 'I need help designing an API for [DOMAIN]. The requirements are:\n\n- [REQUIREMENT_1]\n- [REQUIREMENT_2]\n- [REQUIREMENT_3]\n\nPlease suggest:\n1. Resource structure\n2. Endpoint design\n3. Authentication strategy\n4. Error handling approach',
    systemPromptId: 'sys-3',
    contextIds: ['ctx-2'],
    description: 'Template for API design discussions',
    tokenCount: 78,
    createdAt: new Date('2024-01-12').toISOString()
  }
];

const availableModels = [
  'claude-3-opus',
  'claude-3-sonnet',
  'gpt-4-turbo',
  'gpt-4',
  'gemini-ultra',
  'gemini-pro'
];

// Async actions
export const fetchPromptLabData = createAsyncThunk(
  'promptLab/fetchData',
  async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return { 
      systemPrompts: mockSystemPrompts,
      promptTemplates: mockPromptTemplates,
      executions: []
    };
  }
);

export const executePrompt = createAsyncThunk(
  'promptLab/executePrompt',
  async ({ prompt, systemPromptId, contextIds, models }: {
    prompt: string;
    systemPromptId: string;
    contextIds: string[];
    models: string[];
  }) => {
    // Simulate API call with longer delay for execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock responses
    const responses: ModelResponse[] = models.map(model => ({
      model,
      response: `This is a mock response from ${model} for the prompt: "${prompt.substring(0, 50)}..."\n\nThe response would contain detailed analysis and suggestions based on the system prompt and context provided.`,
      tokenCount: Math.floor(Math.random() * 1000) + 200,
      timeMs: Math.floor(Math.random() * 5000) + 1000,
      cost: Math.random() * 0.5 + 0.1,
      timestamp: new Date().toISOString()
    }));

    const execution: PromptExecution = {
      id: `exec-${Date.now()}`,
      prompt,
      systemPromptId,
      contextIds,
      models,
      responses,
      createdAt: new Date().toISOString(),
      bestResponseModel: responses[0].model // Mock selection
    };

    return execution;
  }
);

export const generateContextSuggestions = createAsyncThunk(
  'promptLab/generateContextSuggestions',
  async (prompt: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock suggestions based on keywords
    const suggestions: ContextSuggestion[] = [];
    
    if (prompt.toLowerCase().includes('react') || prompt.toLowerCase().includes('component')) {
      suggestions.push({
        contextId: 'ctx-1',
        contextName: 'React Development Patterns',
        relevanceScore: 0.85,
        reason: 'Contains React patterns and best practices',
        tokenCount: 4500
      });
    }
    
    if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('rest')) {
      suggestions.push({
        contextId: 'ctx-2',
        contextName: 'API Design Guidelines',
        relevanceScore: 0.92,
        reason: 'Relevant API design principles',
        tokenCount: 3200
      });
    }
    
    if (prompt.toLowerCase().includes('auth') || prompt.toLowerCase().includes('security')) {
      suggestions.push({
        contextId: 'ctx-3',
        contextName: 'Authentication & Security',
        relevanceScore: 0.78,
        reason: 'Security best practices and auth patterns',
        tokenCount: 1800
      });
    }

    return suggestions;
  }
);

const promptLabSlice = createSlice({
  name: 'promptLab',
  initialState,
  reducers: {
    setCurrentPrompt: (state, action: PayloadAction<string>) => {
      state.currentPrompt = action.payload;
      // Trigger context suggestions if prompt is substantial
      if (action.payload.length > 20) {
        state.contextSuggestions = [];
      }
    },
    setSelectedSystemPrompts: (state, action: PayloadAction<string[]>) => {
      state.selectedSystemPrompts = action.payload;
    },
    setSelectedModels: (state, action: PayloadAction<string[]>) => {
      state.selectedModels = action.payload;
      // Update estimated cost and token count
      state.estimatedCost = action.payload.length * 0.05; // Mock calculation
    },
    toggleModel: (state, action: PayloadAction<string>) => {
      const model = action.payload;
      if (state.selectedModels.includes(model)) {
        state.selectedModels = state.selectedModels.filter(m => m !== model);
      } else {
        state.selectedModels.push(model);
      }
      state.estimatedCost = state.selectedModels.length * 0.05; // Mock calculation
    },
    clearCurrentPrompt: (state) => {
      state.currentPrompt = '';
      state.contextSuggestions = [];
      state.totalTokenCount = 0;
    },
    selectBestResponse: (state, action: PayloadAction<{ executionId: string; model: string }>) => {
      const execution = state.executions.find(e => e.id === action.payload.executionId);
      if (execution) {
        execution.bestResponseModel = action.payload.model;
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPromptLabData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPromptLabData.fulfilled, (state, action) => {
        state.loading = false;
        state.systemPrompts = action.payload.systemPrompts;
        state.promptTemplates = action.payload.promptTemplates;
        state.executions = action.payload.executions;
        // Set default system prompt
        const defaultPrompt = action.payload.systemPrompts.find(p => p.isDefault);
        if (defaultPrompt) {
          state.selectedSystemPrompts = [defaultPrompt.id];
        }
      })
      .addCase(fetchPromptLabData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch prompt lab data';
      })
      .addCase(executePrompt.pending, (state) => {
        state.isExecuting = true;
        state.error = null;
      })
      .addCase(executePrompt.fulfilled, (state, action) => {
        state.isExecuting = false;
        state.executions.unshift(action.payload);
        // Keep only the last 10 executions
        if (state.executions.length > 10) {
          state.executions = state.executions.slice(0, 10);
        }
      })
      .addCase(executePrompt.rejected, (state, action) => {
        state.isExecuting = false;
        state.error = action.error.message || 'Failed to execute prompt';
      })
      .addCase(generateContextSuggestions.fulfilled, (state, action) => {
        state.contextSuggestions = action.payload;
      });
  },
});

export const {
  setCurrentPrompt,
  setSelectedSystemPrompts,
  setSelectedModels,
  toggleModel,
  clearCurrentPrompt,
  selectBestResponse,
  clearError
} = promptLabSlice.actions;

export { availableModels };
export default promptLabSlice.reducer; 